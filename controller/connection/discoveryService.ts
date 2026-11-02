import { X509Certificate } from "node:crypto";
import { request } from "node:https";
import { BlockList, isIP } from "node:net";
import { networkInterfaces } from "node:os";
import { TLSSocket } from "node:tls";
import { isUtf8 } from "node:buffer";
import { modelError } from "../../model/file/File.js";
import { localIdentity } from "../../model/peer/peerService.js";

/** Limites da descoberta; não são limites das operações de arquivos. */
export const discoveryLimits = Object.freeze({
  port: 8444, windowMs: 120_000, maxTargets: 256, concurrency: 8, attemptMs: 2_000, responseBytes: 16_384,
});

/** Destinos escolhidos pelo usuário local; nunca recebidos de um candidato remoto. */
export interface DiscoveryTargets {
  addresses?: readonly string[];
  networks?: readonly string[];
}

/** Um anúncio encontrado, ainda sem confiança ou autorização para arquivos. */
export interface Candidate {
  ipAddress: string;
  displayName: string;
  certificatePem: string;
}

/** Resultado de cada destino que não produziu um candidato. */
export interface DiscoveryFailure {
  ipAddress: string;
  reason: "unreachable" | "timeout" | "invalid_response" | "cancelled" | "self";
}

/** Janela pertencente ao processo local; o sinal cancela buscas e o listener temporário. */
interface DiscoveryWindow {
  controller: AbortController;
  expiresAt: number;
  interfaceName: string | undefined;
  running: boolean;
  timer: ReturnType<typeof setTimeout>;
}

let window: DiscoveryWindow | undefined;

/** Padroniza um IP literal, sem DNS, zona ou endereço IPv4 mapeado em IPv6.
 * @param value IP fornecido pela ação local.
 */
function canonicalIp(value: string): string {
  if (typeof value !== "string" || !isIP(value) || value.includes("%")) {
    throw modelError("validation_failed", "Informe endereços IP literais válidos.");
  }
  const result = isIP(value) === 6 ? new URL(`http://[${value}]/`).hostname.slice(1, -1) : value;
  if (result === "::" || result.startsWith("::ffff:") || result.startsWith("ff") && isIP(result) === 6
    || isIP(result) === 4 && (result === "0.0.0.0" || Number(result.split(".")[0]) >= 224)) {
    throw modelError("validation_failed", "O endereço não identifica um destino individual permitido.");
  }
  return result;
}

/** Converte IPv4 já validado para um inteiro sem sinal.
 * @param value Endereço IPv4 literal.
 */
function ipv4Number(value: string): number {
  return value.split(".").reduce((result, octet) => result * 256 + Number(octet), 0);
}

/** Confere um CIDR IPv4 escrito com o endereço da rede, sem corrigir bits de host.
 * @param value Rede escolhida pelo usuário local.
 */
function ipv4Network(value: string): { start: number; end: number; prefix: number } {
  const match = typeof value === "string" ? /^(\d+\.\d+\.\d+\.\d+)\/(0|[1-9]|[12][0-9]|3[0-2])$/.exec(value) : null;
  if (!match || isIP(match[1]!) !== 4) throw modelError("validation_failed", "Informe uma rede CIDR IPv4 válida.");
  const prefix = Number(match[2]);
  const size = 2 ** (32 - prefix);
  const start = ipv4Number(match[1]!);
  if (start % size !== 0) throw modelError("validation_failed", "O CIDR precisa usar o endereço da rede.");
  return { start, end: start + size - 1, prefix };
}

/** Obtém as interfaces reais selecionadas, sem presumir que todo IP privado seja local.
 * @param interfaceName Nome da interface; omitido, considera as interfaces do sistema.
 */
function localNetworks(interfaceName?: string) {
  const available = networkInterfaces();
  if (interfaceName !== undefined && (typeof interfaceName !== "string" || !Object.hasOwn(available, interfaceName))) {
    throw modelError("validation_failed", "A interface de rede selecionada não existe.");
  }
  const entries = Object.entries(available).filter(([name]) => interfaceName === undefined || name === interfaceName)
    .flatMap(([name, addresses]) => (addresses ?? []).map(address => ({ ...address, name })));
  if (!entries.length) throw modelError("discovery_network_unavailable", "Não há endereços na interface selecionada.");
  return entries;
}

/** Confere se o IP pertence às redes das interfaces locais selecionadas.
 * @param ipAddress IP literal sem identificador de zona.
 * @param interfaceName Interface escolhida, quando houver.
 */
export function isLocalTarget(ipAddress: string, interfaceName?: string): boolean {
  const ip = canonicalIp(ipAddress);
  return localNetworks(interfaceName).some(entry => {
    if (!entry.cidr || isIP(ip) !== (entry.family === "IPv4" ? 4 : 6)) return false;
    const prefix = Number(entry.cidr.split("/")[1]);
    const allowed = new BlockList();
    allowed.addSubnet(entry.address, prefix, entry.family === "IPv4" ? "ipv4" : "ipv6");
    if (!allowed.check(ip, entry.family === "IPv4" ? "ipv4" : "ipv6")) return false;
    if (entry.family === "IPv4" && prefix < 31) {
      const size = 2 ** (32 - prefix);
      const start = Math.floor(ipv4Number(entry.address) / size) * size;
      const value = ipv4Number(ip);
      return value !== start && value !== start + size - 1;
    }
    return true;
  });
}

/** Expande somente CIDRs IPv4 locais e remove destinos repetidos antes de abrir conexões.
 * @param targets IPs e redes escolhidos pelo usuário local.
 * @param interfaceName Interface utilizada para delimitar as redes permitidas.
 */
export function resolveTargets(targets: DiscoveryTargets, interfaceName?: string): string[] {
  localNetworks(interfaceName);
  if (!targets || typeof targets !== "object" || Array.isArray(targets)
    || Object.keys(targets).some(key => key !== "addresses" && key !== "networks")
    || targets.addresses !== undefined && !Array.isArray(targets.addresses)
    || targets.networks !== undefined && !Array.isArray(targets.networks)) {
    throw modelError("validation_failed", "Informe listas de endereços e redes.");
  }
  const addresses = new Set<string>();
  /** Confere e inclui um destino sem duplicar tentativas.
   * @param value Endereço individual a consultar.
   */
  const add = (value: string): void => {
    const ip = canonicalIp(value);
    if (!isLocalTarget(ip, interfaceName)) throw modelError("discovery_target_forbidden", "O destino está fora das redes locais selecionadas.");
    if (ip.startsWith("fe80:") && interfaceName === undefined) throw modelError("validation_failed", "IPv6 link-local exige uma interface explícita.");
    addresses.add(ip);
    if (addresses.size > discoveryLimits.maxTargets) throw modelError("discovery_limit_exceeded", "A busca excede 256 destinos distintos.");
  };
  for (const value of targets.addresses ?? []) add(value);
  for (const value of targets.networks ?? []) {
    const network = ipv4Network(value);
    const start = network.start + (network.prefix < 31 ? 1 : 0);
    const end = network.end - (network.prefix < 31 ? 1 : 0);
    if (end - start + 1 > discoveryLimits.maxTargets) throw modelError("discovery_limit_exceeded", "A rede excede o limite de 256 destinos.");
    for (let address = start; address <= end; address++) {
      add([24, 16, 8, 0].map(shift => address >>> shift & 255).join("."));
    }
  }
  if (!addresses.size) throw modelError("validation_failed", "Escolha ao menos um destino para a busca.");
  return [...addresses];
}

/** Abre a janela somente por chamada local; não abre portas por conta própria.
 * @internal O listener temporário chama esta função depois de validar a configuração local.
 * @param interfaceName Interface escolhida para delimitar os destinos.
 */
export function activateDiscovery(interfaceName?: string): { signal: AbortSignal; expiresAt: string } {
  localNetworks(interfaceName);
  if (isDiscoveryActive()) throw modelError("discovery_already_active", "A descoberta já está ativa.");
  const controller = new AbortController();
  const expiresAt = Date.now() + discoveryLimits.windowMs;
  const timer = setTimeout(() => controller.abort(), discoveryLimits.windowMs);
  controller.signal.addEventListener("abort", () => clearTimeout(timer), { once: true });
  window = { controller, expiresAt, interfaceName, running: false, timer };
  return { signal: controller.signal, expiresAt: new Date(expiresAt).toISOString() };
}

/** Informa se a janela local ainda permite consultas e novos pedidos. */
export function isDiscoveryActive(): boolean {
  return !!window && !window.controller.signal.aborted && Date.now() < window.expiresAt;
}

/** Consulta a janela local para vincular os pedidos ao mesmo prazo, cancelamento e interface.
 * @throws Se a descoberta estiver desativada ou expirada.
 */
export function getDiscoveryWindow(): { signal: AbortSignal; expiresAt: string; interfaceName: string | undefined } {
  if (!window || !isDiscoveryActive()) throw modelError("discovery_inactive", "Ative a descoberta local antes de criar pedidos.");
  return { signal: window.controller.signal, expiresAt: new Date(window.expiresAt).toISOString(), interfaceName: window.interfaceName };
}

/** Fecha a janela e cancela conexões da busca; não remove peers conhecidos. */
export function deactivateDiscovery(): void { window?.controller.abort(); }

/** Confere formato, validade e assinatura de um certificado candidato, sem conceder confiança.
 * @param certificate Certificado apresentado no handshake TLS completo.
 */
export function validateCandidateCertificate(certificate: X509Certificate): void {
  const now = Date.now();
  if (now < Date.parse(certificate.validFrom) || now > Date.parse(certificate.validTo)
    || !certificate.verify(certificate.publicKey)) {
    throw modelError("invalid_certificate", "O certificado candidato não tem uma identidade autoassinada válida.");
  }
}

/** Consulta um candidato na entrada temporária, sem usar o transporte de arquivos.
 * @param ipAddress Destino já conferido contra as interfaces locais.
 * @param identity Identidade local usada para provar posse da chave no TLS.
 * @param scope Janela que deve cancelar a tentativa quando encerrada.
 */
async function probe(ipAddress: string, identity: Awaited<ReturnType<typeof localIdentity>>, scope: DiscoveryWindow): Promise<Candidate | DiscoveryFailure> {
  return new Promise(resolve => {
    let settled = false;
    let timedOut = false;
    let invalidResponse = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    /** Conclui a tentativa uma única vez e libera seu prazo.
     * @param result Candidato ou razão da falha.
     */
    const finish = (result: Candidate | DiscoveryFailure): void => {
      if (settled) return;
      settled = true;
      if (timeout) clearTimeout(timeout);
      resolve(result);
    };
    const host = ipAddress.startsWith("fe80:") ? `${ipAddress}%${scope.interfaceName}` : ipAddress;
    const outgoing = request({
      host, port: discoveryLimits.port, path: "/connect", method: "GET", agent: false,
      cert: identity.certificatePem, key: identity.privateKeyPem,
      // Exclusivo do contexto de candidatos: nenhum dado é tratado como confiança.
      rejectUnauthorized: false, minVersion: "TLSv1.3", maxVersion: "TLSv1.3", signal: scope.controller.signal,
    }, response => {
      response.on("error", () => { invalidResponse = true; outgoing.destroy(); });
      try {
        const socket = response.socket;
        const presented = socket instanceof TLSSocket ? socket.getPeerX509Certificate() : undefined;
        if (!presented || socket instanceof TLSSocket && socket.isSessionReused()
          || response.statusCode !== 200 || !/^application\/json(?:;|$)/i.test(String(response.headers["content-type"]))) {
          throw modelError("invalid_response", "A resposta não é um anúncio válido.");
        }
        validateCandidateCertificate(presented);
        const chunks: Buffer[] = [];
        let total = 0;
        response.on("data", (chunk: Buffer) => {
          total += chunk.length;
          if (total > discoveryLimits.responseBytes) { invalidResponse = true; outgoing.destroy(); }
          else chunks.push(chunk);
        });
        response.on("end", () => {
          try {
            const bytes = Buffer.concat(chunks);
            if (!isUtf8(bytes)) throw new Error("Anúncio inválido.");
            const body: unknown = JSON.parse(bytes.toString("utf8"));
            if (body === null || typeof body !== "object" || Array.isArray(body)
              || Object.keys(body).length !== 2 || !("displayName" in body) || !("certificatePem" in body)
              || typeof body.displayName !== "string" || !body.displayName || !body.displayName.isWellFormed() || body.displayName.includes("\0")
              || typeof body.certificatePem !== "string" || !presented.raw.equals(new X509Certificate(body.certificatePem).raw)) {
              throw new Error("Anúncio inválido.");
            }
            if (presented.raw.equals(new X509Certificate(identity.certificatePem).raw)) finish({ ipAddress, reason: "self" });
            else finish({ ipAddress, displayName: body.displayName, certificatePem: presented.toString() });
          } catch { finish({ ipAddress, reason: "invalid_response" }); }
        });
      } catch { invalidResponse = true; outgoing.destroy(); }
    });
    outgoing.on("error", () => finish({ ipAddress, reason: scope.controller.signal.aborted ? "cancelled" : timedOut ? "timeout" : invalidResponse ? "invalid_response" : "unreachable" }));
    // close também cobre destruição após os cabeçalhos, sem um novo evento error na requisição.
    outgoing.on("close", () => {
      if (!settled) finish({ ipAddress, reason: scope.controller.signal.aborted ? "cancelled" : timedOut ? "timeout" : invalidResponse ? "invalid_response" : "unreachable" });
    });
    timeout = setTimeout(() => { timedOut = true; outgoing.destroy(); }, discoveryLimits.attemptMs);
    outgoing.end();
  });
}

/** Procura candidatos com no máximo oito tentativas simultâneas na janela local.
 * @param targets Endereços e redes escolhidos pelo usuário; não são comandos HTTP remotos.
 * @returns Candidatos e falhas por destino, sem persistir confiança ou iniciar pareamento.
 */
export async function discover(targets: DiscoveryTargets): Promise<{ candidates: Candidate[]; failures: DiscoveryFailure[]; cancelled: boolean }> {
  const scope = window;
  if (!scope || !isDiscoveryActive()) throw modelError("discovery_inactive", "Ative a descoberta local antes de buscar.");
  if (scope.running) throw modelError("discovery_in_progress", "Já existe uma busca nesta janela.");
  const addresses = resolveTargets(targets, scope.interfaceName);
  scope.running = true;
  try {
    const identity = await localIdentity();
    const results: Array<Candidate | DiscoveryFailure> = new Array(addresses.length);
    let next = 0;
    /** Processa destinos sem criar um worker por endereço. */
    const worker = async (): Promise<void> => {
      while (next < addresses.length) {
        const index = next++;
        const ipAddress = addresses[index]!;
        results[index] = scope.controller.signal.aborted ? { ipAddress, reason: "cancelled" } : await probe(ipAddress, identity, scope);
      }
    };
    await Promise.all(Array.from({ length: Math.min(discoveryLimits.concurrency, addresses.length) }, worker));
    return {
      candidates: results.filter((result): result is Candidate => !("reason" in result)),
      failures: results.filter((result): result is DiscoveryFailure => "reason" in result),
      cancelled: scope.controller.signal.aborted,
    };
  } finally { scope.running = false; }
}
