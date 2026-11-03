/**
 * Responsabilidade: Ler a configuração, integrar o model e registrar a API de arquivos
 * protegida por mTLS.
 *
 * Exemplo prático: Ao iniciar o backend, carrega a identidade persistida e só permite
 * consultar /health com um certificado confiável.
 */
import express, { type Express } from "express";
import { constants, X509Certificate } from "node:crypto";
import { access, mkdir, realpath } from "node:fs/promises";
import { createServer, type Server } from "node:https";
import { isIP, type Socket } from "node:net";
import { homedir } from "node:os";
import path from "node:path";
import { loadEnvFile } from "node:process";
import { TLSSocket } from "node:tls";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { Directory } from "../../model/file/Directory.js";
import { errorCode, modelError } from "../../model/file/File.js";
import * as files from "../../model/file/fileService.js";
import * as peers from "../../model/peer/peerService.js";
import { handleError } from "../connection/sharingService.js";
import { setTrustUpdater } from "../connection/paringService.js";
import { registerHealth } from "./routes/health.js";
import { registerNavigation } from "./routes/navigate.js";
import { registerDownloads } from "./routes/download.js";
import { registerChanges } from "./routes/upload.js";

/** Limites de requisições e downloads usados pelas rotas implementadas. */
export interface ApiLimits {
  jsonMaxBytes: number;
  zipMaxEntries: number;
  zipMaxBytes: number;
  /** Limite de bytes do arquivo de upload; omitido, usa 1 GiB. */
  uploadMaxBytes?: number;
}

const defaultLimits: Readonly<ApiLimits> = Object.freeze({
  jsonMaxBytes: 16_384, zipMaxEntries: 10_000, zipMaxBytes: 10_737_418_240,
});
// O backend compilado fica em dist/controller/api; os dados persistem na raiz do projeto.
const projectDir = fileURLToPath(new URL("../../../", import.meta.url));
// Cada socket exige autenticação antes da primeira requisição; não há confiança por IP.
const connections = new WeakMap<TLSSocket, Promise<void>>();

/** Confere prova de posse validada pelo TLS, validade e certificado exato persistido.
 * @param socket Conexão TLS recebida pelo servidor, nunca dados de cabeçalhos HTTP.
 * @returns Certificado público do peer confiável com conexão TLS válida.
 */
async function verifyPeer(socket: TLSSocket): Promise<string> {
  if (!socket.authorized || !socket.encrypted || socket.getProtocol() !== "TLSv1.3" || socket.isSessionReused()) {
    throw modelError("peer_rejected", "A conexão não tem uma autenticação TLS aceita.");
  }
  const presented = socket.getPeerX509Certificate();
  const now = Date.now();
  if (!presented || now < Date.parse(presented.validFrom) || now > Date.parse(presented.validTo)) {
    throw modelError("peer_rejected", "O certificado não está disponível ou válido.");
  }
  const pem = presented.toString();
  const known = await peers.findPeer(pem);
  if (!known || !presented.raw.equals(new X509Certificate(known.certificatePem).raw)) {
    throw modelError("peer_rejected", "O certificado não pertence a um peer conhecido.");
  }
  return pem;
}

/** Registra cada nova conexão autenticada uma vez, conservando o primeiro pareamento.
 * @param socket Socket que terminou um handshake TLS completo.
 * @returns Operação de autenticação e registro associada à conexão.
 */
function authenticateConnection(socket: TLSSocket): Promise<void> {
  const existing = connections.get(socket);
  if (existing) return existing;
  const operation = (async () => {
    const certificatePem = await verifyPeer(socket);
    if (!socket.remoteAddress) throw modelError("peer_rejected", "O endereço da conexão não está disponível.");
    await peers.recordConnection(certificatePem, socket.remoteAddress);
  })();
  connections.set(socket, operation);
  return operation;
}

/** Cria a aplicação sem abrir servidor nem preparar identidade ou pastas.
 * Toda rota, inclusive health, exige mTLS e confiança previamente persistida.
 * @param limits Limites das rotas; omitidos, utiliza os padrões documentados.
 * @returns Aplicação Express com rotas e tratamento de erros registrados.
 */
export function createApp(limits: Readonly<ApiLimits> = defaultLimits): Express {
  const configured: ApiLimits = {
    jsonMaxBytes: limits.jsonMaxBytes,
    zipMaxEntries: limits.zipMaxEntries,
    zipMaxBytes: limits.zipMaxBytes,
  };
  const uploadMaxBytes = limits.uploadMaxBytes === undefined ? 1_073_741_824 : limits.uploadMaxBytes;
  if ([...Object.values(configured), uploadMaxBytes].some(value => !Number.isSafeInteger(value) || value <= 0)
    || Object.keys(defaultLimits).some(key => !Object.hasOwn(limits, key))) {
    throw modelError("configuration_invalid", "Informe limites inteiros positivos.");
  }
  const app = express();
  app.disable("x-powered-by");
  app.disable("etag");
  app.set("query parser", false);
  app.set("case sensitive routing", true);
  app.set("strict routing", true);
  app.use(async (request, _response, next) => {
    const socket = request.socket;
    if (!(socket instanceof TLSSocket)) { socket.destroy(); return; }
    try {
      await authenticateConnection(socket);
      // Uma conexão mantida aberta não conserva confiança removida do registro.
      await verifyPeer(socket);
    } catch {
      socket.destroy();
      return;
    }
    next();
  });
  const router = express.Router({ caseSensitive: true, strict: true });
  registerHealth(router);
  registerNavigation(router);
  registerDownloads(router, configured);
  registerChanges(router, configured.jsonMaxBytes, uploadMaxBytes);
  app.use(router);
  app.use(handleError);
  return app;
}

/** Configuração das partes que já podem iniciar sem descoberta ou controle local. */
interface BackendOptions extends ApiLimits {
  root: string | undefined;
  stateDir: string;
  stagingDir: string;
  host: string;
  port: number;
  shutdownTimeoutMs: number;
  tlsMode: "self-signed" | "provided";
}

/** Lê somente opções documentadas, com prioridade de argumentos sobre ambiente.
 * Opções legadas sem integração segura com o model são recusadas explicitamente.
 * @param argv Argumentos da aplicação, sem nome do executável ou do arquivo.
 * @param env Variáveis do ambiente local.
 * @returns Opções validadas para inicializar o backend.
 */
function backendOptions(argv: string[], env: NodeJS.ProcessEnv): BackendOptions {
  const names = ["root", "state-dir", "staging-dir", "host", "port", "json-max-bytes", "zip-max-entries", "zip-max-bytes", "shutdown-timeout-ms",
    "tls-mode", "tls-cert-file", "tls-key-file", "tls-sans", "tokens-file", "cors-origins", "upload-max-bytes"];
  const options = Object.fromEntries(names.map(name => [name, { type: "string" as const }]));
  let parsed: ReturnType<typeof parseArgs>;
  try { parsed = parseArgs({ args: argv, options, tokens: true, strict: true, allowPositionals: false }); }
  catch { throw modelError("configuration_invalid", "Há argumentos desconhecidos ou sem valor."); }
  const seen = new Set<string>();
  for (const token of parsed.tokens ?? []) {
    if (token.kind !== "option" || seen.has(token.name)) throw modelError("configuration_invalid", "Há argumentos repetidos ou não aceitos.");
    seen.add(token.name);
  }
  /** Relaciona o nome público da opção à variável de ambiente documentada.
   * @param name Nome da opção sem os hífens iniciais.
   * @returns Nome da variável de ambiente com o prefixo PASSA_.
   */
  const environmentName = (name: string): string => `PASSA_${name.replaceAll("-", "_").toUpperCase()}`;
  const accepted = new Set(names.map(environmentName));
  if (Object.keys(env).some(name => name.startsWith("PASSA_") && !accepted.has(name))) {
    throw modelError("configuration_invalid", "Há variáveis PASSA_ desconhecidas.");
  }
  /** Obtém o valor escolhido sem substituir valores vazios por padrões.
   * @param name Nome público da opção.
   * @param fallback Padrão documentado, quando houver.
   * @returns Valor de argumento, ambiente ou padrão, nessa prioridade.
   */
  const value = (name: string, fallback?: string): string => {
    const chosen = parsed.values[name] ?? env[environmentName(name)] ?? fallback;
    if (typeof chosen !== "string" || !chosen) throw modelError("configuration_invalid", `Informe --${name} com um valor válido.`);
    return chosen;
  };
  /** Confere um inteiro decimal positivo dentro do limite da opção.
   * @param name Nome público da opção.
   * @param fallback Valor padrão documentado.
   * @param maximum Maior valor aceito.
   * @returns Inteiro positivo validado dentro do limite informado.
   */
  const integer = (name: string, fallback: number, maximum = Number.MAX_SAFE_INTEGER): number => {
    const text = value(name, String(fallback));
    const result = Number(text);
    if (!/^\d+$/.test(text) || !Number.isSafeInteger(result) || result <= 0 || result > maximum) {
      throw modelError("configuration_invalid", `O valor de --${name} precisa ser um inteiro positivo dentro do limite.`);
    }
    return result;
  };
  /** Confere um caminho absoluto nativo sem alterar espaços dos nomes.
   * @param name Nome público da opção.
   * @param fallback Caminho padrão quando a opção for omitida.
   * @returns Caminho absoluto nativo normalizado.
   */
  const absolute = (name: string, fallback?: string): string => {
    const text = value(name, fallback);
    if (!path.isAbsolute(text) || text.includes("\0")) throw modelError("configuration_invalid", `--${name} exige um caminho absoluto válido.`);
    return path.normalize(text);
  };
  const root = parsed.values.root === undefined && env.PASSA_ROOT === undefined ? undefined : absolute("root");
  const stateDir = absolute("state-dir", path.join(projectDir, "model", "peer"));
  const stagingDir = absolute("staging-dir", path.join(projectDir, "tmp"));
  const host = value("host", "127.0.0.1");
  if (!isIP(host) || host.includes("%")) throw modelError("configuration_invalid", "--host exige um IP válido sem identificador de zona.");
  const mode = value("tls-mode", "self-signed");
  if (mode !== "self-signed" && mode !== "provided") throw modelError("configuration_invalid", "--tls-mode precisa ser self-signed ou provided.");
  for (const [name, filename] of [["tls-cert-file", "server.crt"], ["tls-key-file", "server.key"]]) {
    const expected = path.join(stateDir, "tls", filename!);
    const provided = value(name!, mode === "self-signed" ? expected : undefined);
    if (!path.isAbsolute(provided) || path.normalize(provided) !== expected) {
      throw modelError("configuration_invalid", "Os arquivos TLS precisam corresponder à identidade persistida pelo model em state-dir/tls.");
    }
  }
  for (const name of ["tls-sans", "tokens-file", "cors-origins"]) {
    if (parsed.values[name] !== undefined || env[environmentName(name)] !== undefined) {
      throw modelError("configuration_invalid", `--${name} ainda não tem integração definida com o transporte P2P.`);
    }
  }
  return {
    root, stateDir, stagingDir, host, tlsMode: mode, port: integer("port", 8443, 65535),
    jsonMaxBytes: integer("json-max-bytes", defaultLimits.jsonMaxBytes),
    uploadMaxBytes: integer("upload-max-bytes", 1_073_741_824),
    zipMaxEntries: integer("zip-max-entries", defaultLimits.zipMaxEntries),
    zipMaxBytes: integer("zip-max-bytes", defaultLimits.zipMaxBytes),
    shutdownTimeoutMs: integer("shutdown-timeout-ms", 10_000, 2_147_483_647),
  };
}

/** Prepara a raiz padrão no diretório do usuário ou mantém a configuração explícita.
 * Quando omitida, cria passa-arquivo, passa-arquivo(2), passa-arquivo(3), etc.,
 * reservando o primeiro nome livre sem alterar entradas existentes.
 * @param configuredRoot Caminho absoluto já validado, escolhido por --root ou PASSA_ROOT.
 * @returns Caminho da raiz; uma configuração explícita continua exigindo pasta existente.
 */
export async function prepareSharedRoot(configuredRoot?: string): Promise<string> {
  if (configuredRoot !== undefined) return configuredRoot;
  const base = path.join(homedir(), "passa-arquivo");
  for (let number = 1; ; number++) {
    const candidate = number === 1 ? base : `${base}(${number})`;
    try {
      await mkdir(candidate, { mode: 0o700 });
      return candidate;
    } catch (error) {
      if (errorCode(error) !== "EEXIST") throw error;
    }
  }
}

/** Inicia HTTPS, preparando o estado pelo model na primeira execução.
 * O estado padrão fica em model/peer e o staging em tmp; ambos persistem entre reinícios.
 * Não cria confiança em peers nem abre controle de pareamento.
 * @returns Servidor aberto, que também pode ser encerrado pelo chamador local.
 */
export async function startBackend(): Promise<Server> {
  try { loadEnvFile(path.join(projectDir, ".env")); }
  catch (error) {
    if (errorCode(error) !== "ENOENT") throw modelError("configuration_invalid", "Não foi possível ler o arquivo .env do projeto.");
  }
  const options = backendOptions(process.argv.slice(2), process.env);
  // provided exige identidade existente; initialize só pode preparar a primeira identidade em self-signed.
  // A validade, a correspondência da chave e as permissões continuam sendo conferidas pelo model.
  if (options.tlsMode === "provided") {
    try {
      await Promise.all(["server.crt", "server.key"].map(name => access(path.join(options.stateDir, "tls", name))));
    } catch {
      throw modelError("configuration_invalid", "O modo provided exige certificado e chave TLS já existentes.");
    }
  }
  const root = await prepareSharedRoot(options.root);
  await Directory.openArea(options.stagingDir);
  await peers.initialize({ stateDir: options.stateDir, rootDir: root, stagingDir: options.stagingDir });
  const identity = await peers.localIdentity();
  const known = await peers.listPeers();
  await files.setSharedDirectory(root, { stateDir: options.stateDir, stagingDir: options.stagingDir });
  // A raiz explícita precisa existir; a raiz padrão já foi criada com nome disponível.
  await realpath(root);
  const server = createServer({
    cert: identity.certificatePem, key: identity.privateKeyPem,
    ca: known.map(peer => peer.certificatePem),
    requestCert: true, rejectUnauthorized: true,
    minVersion: "TLSv1.3", maxVersion: "TLSv1.3", secureOptions: constants.SSL_OP_NO_TICKET,
  }, createApp(options));
  /** Recarrega os certificados confiáveis para novos handshakes, mantendo TLS e mTLS exigidos. */
  const refreshTrust = async (): Promise<void> => {
    const trusted = await peers.listPeers();
    server.setSecureContext({
      cert: identity.certificatePem, key: identity.privateKeyPem,
      ca: trusted.map(peer => peer.certificatePem),
      minVersion: "TLSv1.3", maxVersion: "TLSv1.3", secureOptions: constants.SSL_OP_NO_TICKET,
    });
  };
  server.on("resumeSession", (_id, callback) => callback(null));
  server.on("newSession", (_id, _data, callback) => callback());
  server.on("secureConnection", socket => {
    void authenticateConnection(socket).catch(() => socket.destroy());
  });
  const sockets = new Set<Socket>();
  server.on("connection", socket => { sockets.add(socket); socket.once("close", () => sockets.delete(socket)); });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(options.port, options.host, () => { server.off("error", reject); resolve(); });
  });
  setTrustUpdater(refreshTrust);
  let closing = false;
  let shutdownTimer: ReturnType<typeof setTimeout> | undefined;
  /** Aguarda operações abertas até o prazo documentado e depois fecha seus sockets. */
  const shutdown = (): void => {
    if (closing) return;
    closing = true;
    server.close();
    server.closeIdleConnections();
    shutdownTimer = setTimeout(() => { for (const socket of sockets) socket.destroy(); }, options.shutdownTimeoutMs);
    shutdownTimer.unref();
  };
  server.on("error", () => {
    console.error("O servidor encontrou uma falha e será encerrado.");
    process.exitCode = 1;
    shutdown();
  });
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
  server.once("close", () => {
    setTrustUpdater(undefined);
    if (shutdownTimer) clearTimeout(shutdownTimer);
    process.off("SIGINT", shutdown); process.off("SIGTERM", shutdown);
  });
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  startBackend().then(() => console.log("Servidor HTTPS iniciado para peers conhecidos."), (error: unknown) => {
    const configuration = error !== null && typeof error === "object" && "code" in error && error.code === "configuration_invalid";
    console.error(configuration && error instanceof Error ? error.message : "Não foi possível iniciar HTTPS; confira a configuração, a identidade e os registros existentes.");
    process.exitCode = configuration ? 2 : 1;
  });
}
