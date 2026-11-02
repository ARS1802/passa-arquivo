import { randomUUID, X509Certificate } from "node:crypto";
import { isUtf8 } from "node:buffer";
import { request as httpsRequest } from "node:https";
import { errorCode, modelError } from "../../model/file/File.js";
import * as peers from "../../model/peer/peerService.js";
import { discoveryLimits, getDiscoveryWindow, resolveTargets, validateCandidateCertificate, type Candidate } from "./discoveryService.js";

const statuses = ["pending", "prepared", "committing", "confirmed", "rejected", "cancelled", "expired"] as const;
/** Situação da sessão; confirmed exige gravação, confirmação de preparo remoto e atualização TLS local. */
export type PairingStatus = typeof statuses[number];

/** Dados locais da sessão; impressões digitais são públicas e nunca incluem chaves privadas. */
export interface PairingRequest {
  id: string;
  peer: Candidate;
  localCertificatePem: string;
  localFingerprint: string;
  peerFingerprint: string;
  createdAt: string;
  expiresAt: string;
  status: PairingStatus;
  role: "initiator" | "receiver";
  localAccepted: boolean;
  remoteAccepted: boolean;
  attemptsRemaining: number;
}

/** Controles internos de uma sessão vinculada à janela de descoberta. */
interface Session extends PairingRequest {
  busy: boolean;
  sent: boolean;
  signal: AbortSignal;
  interfaceName: string | undefined;
}

/** Resposta entre participantes; não divulga listas de pedidos, certificados ou segredos. */
export interface PairingMessage {
  id: string;
  status: PairingStatus;
  accepted: boolean;
}

const requests = new Map<string, Session>();
let requestWindow: ReturnType<typeof getDiscoveryWindow> | undefined;
let updateTrust: (() => Promise<void>) | undefined;

/** Registra a recarga TLS do backend; não abre rotas nem modifica a confiança por conta própria.
 * @param updater Operação registrada por app.ts, ou undefined ao encerrar o servidor.
 */
export function setTrustUpdater(updater: (() => Promise<void>) | undefined): void { updateTrust = updater; }

/** Confere o identificador recebido antes de utilizá-lo em uma mensagem ou consulta.
 * @param id UUID v4 da sessão.
 */
function validateId(id: string): void {
  if (typeof id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    throw modelError("validation_failed", "Informe um identificador válido de sessão.");
  }
}

/** Atualiza pedidos abertos; uma confirmação em gravação não é cancelada pela janela. */
function refreshRequests(): void {
  for (const session of requests.values()) {
    if (session.status !== "pending" && session.status !== "prepared") continue;
    if (Date.now() >= Date.parse(session.expiresAt)) session.status = "expired";
    else if (session.signal.aborted) session.status = "cancelled";
  }
}

/** Obtém a sessão interna ou informa sua ausência.
 * @param id Identificador da sessão local.
 */
function sessionById(id: string): Session {
  validateId(id);
  refreshRequests();
  const session = requests.get(id);
  if (!session) throw modelError("pairing_request_not_found", "O pedido não foi encontrado.");
  return session;
}

/** Devolve uma cópia sem os controles internos.
 * @param session Sessão mantida em memória.
 */
function snapshot(session: Session): PairingRequest {
  const { busy: _busy, sent: _sent, signal: _signal, interfaceName: _interface, ...result } = session;
  return { ...result, peer: { ...result.peer } };
}

/** Exige uma sessão aberta para ações ainda anteriores à confirmação.
 * @param session Sessão a conferir.
 */
function assertOpen(session: Session): void {
  refreshRequests();
  if (session.status !== "pending" && session.status !== "prepared") {
    throw modelError("pairing_request_closed", "O pedido não está aberto para esta operação.");
  }
}

/** Reserva a sessão para uma operação assíncrona, evitando duas gravações simultâneas.
 * @param session Sessão a reservar; o chamador libera busy em finally.
 */
function lock(session: Session): void {
  if (session.busy) throw modelError("pairing_in_progress", "Já existe uma operação nesta sessão.");
  session.busy = true;
}

/** Cria ou reencontra a sessão, conferindo rede e certificados por meio dos serviços existentes.
 * @param peer Candidato escolhido localmente ou extraído do TLS pelo controller.
 * @param role Papel desta instalação.
 * @param id Identificador local ou recebido do iniciador.
 * @param ttlMs Prazo restante do iniciador, limitado pela janela local.
 */
async function createSession(peer: Candidate, role: PairingRequest["role"], id: string = randomUUID(), ttlMs: number = discoveryLimits.windowMs): Promise<Session> {
  validateId(id);
  const scope = getDiscoveryWindow();
  if (!Number.isSafeInteger(ttlMs) || ttlMs <= 0 || ttlMs > discoveryLimits.windowMs
    || !peer || typeof peer !== "object" || Array.isArray(peer)
    || Object.keys(peer).some(key => !["ipAddress", "displayName", "certificatePem"].includes(key))
    || typeof peer.displayName !== "string" || !peer.displayName || !peer.displayName.isWellFormed() || peer.displayName.includes("\0")
    || typeof peer.certificatePem !== "string"
    || Buffer.byteLength(JSON.stringify({ displayName: peer.displayName, certificatePem: peer.certificatePem })) > discoveryLimits.responseBytes) {
    throw modelError("validation_failed", "Informe os dados válidos do pedido.");
  }
  const ipAddress = resolveTargets({ addresses: [peer.ipAddress] }, scope.interfaceName)[0]!;
  let certificate: X509Certificate;
  try { certificate = new X509Certificate(peer.certificatePem); }
  catch { throw modelError("invalid_certificate", "O certificado do candidato não pôde ser interpretado."); }
  validateCandidateCertificate(certificate);
  const candidate = { ipAddress, displayName: peer.displayName, certificatePem: certificate.toString() };
  const { certificatePem: localCertificatePem } = await peers.localIdentity();
  const known = await peers.findPeer(candidate.certificatePem);
  if (scope.signal.aborted || Date.now() >= Date.parse(scope.expiresAt)) throw modelError("discovery_inactive", "A descoberta foi encerrada.");
  if (certificate.raw.equals(new X509Certificate(localCertificatePem).raw)) throw modelError("pairing_self", "Não é possível parear com a própria instalação.");
  if (requestWindow?.signal !== scope.signal) {
    requests.clear(); requestWindow = scope;
    scope.signal.addEventListener("abort", refreshRequests, { once: true });
  }
  refreshRequests();
  const sameId = requests.get(id);
  if (sameId) {
    if (sameId.peer.certificatePem !== candidate.certificatePem || sameId.role !== role) throw modelError("pairing_peer_rejected", "A sessão pertence a outro participante.");
    return sameId;
  }
  for (const session of requests.values()) {
    if (["pending", "prepared", "committing"].includes(session.status) && session.peer.certificatePem === candidate.certificatePem) {
      if (role === "initiator" && session.role === role) return session;
      throw modelError("pairing_conflict", "Já existe outro pedido aberto para esta identidade.");
    }
  }
  if (known) throw modelError("pairing_conflict", "Esta identidade já é confiável; não é necessário outro pareamento.");
  if (requests.size >= discoveryLimits.maxTargets) throw modelError("pairing_limit_reached", "A janela atingiu o limite de pedidos.");
  const session: Session = {
    id, peer: candidate, localCertificatePem,
    localFingerprint: new X509Certificate(localCertificatePem).fingerprint256,
    peerFingerprint: certificate.fingerprint256,
    createdAt: new Date().toISOString(), expiresAt: new Date(Math.min(Date.parse(scope.expiresAt), Date.now() + ttlMs)).toISOString(),
    status: "pending", role, localAccepted: false, remoteAccepted: false, attemptsRemaining: 3,
    busy: false, sent: role === "receiver", signal: scope.signal, interfaceName: scope.interfaceName,
  };
  requests.set(id, session);
  return session;
}

/** Cria somente a sessão local; startPairingRequest também envia o pedido ao outro dispositivo.
 * @param peer Candidato escolhido pelo usuário local.
 */
export async function createPairingRequest(peer: Candidate): Promise<PairingRequest> {
  return snapshot(await createSession(peer, "initiator"));
}

/** Consulta uma cópia do pedido local.
 * @param id Identificador da sessão.
 */
export function getPairingRequest(id: string): PairingRequest { return snapshot(sessionById(id)); }

/** Lista somente os pedidos da instalação local; essa operação não é uma rota remota. */
export function listPairingRequests(): PairingRequest[] {
  refreshRequests(); return [...requests.values()].map(snapshot);
}

/** Recebe um pedido cujo certificado e IP foram extraídos do TLS, nunca do corpo HTTP.
 * @param peer Identidade apresentada no handshake e nome recebido no pedido.
 * @param id Sessão criada pelo iniciador.
 * @param ttlMs Prazo restante, limitado a 120 segundos e à janela local.
 */
export async function receivePairingRequest(peer: Candidate, id: string, ttlMs: number): Promise<PairingRequest> {
  return snapshot(await createSession(peer, "receiver", id, ttlMs));
}

/** Confere se o remetente TLS é o participante registrado e prepara uma resposta mínima.
 * @param id Sessão consultada pelo outro participante.
 * @param certificatePem Certificado extraído do socket TLS pelo controller.
 */
export function pairingMessage(id: string, certificatePem: string): PairingMessage {
  const session = sessionById(id);
  if (!new X509Certificate(certificatePem).raw.equals(new X509Certificate(session.peer.certificatePem).raw)) {
    throw modelError("pairing_peer_rejected", "O certificado não pertence à sessão.");
  }
  return { id, status: session.status, accepted: session.localAccepted };
}

/** Envia uma mensagem com TLS nativo validado e pinning do certificado exato, independente do IP.
 * @param session Sessão que delimita o destino, o certificado e o prazo.
 * @param method Método HTTP da mensagem.
 * @param suffix Sufixo interno da rota, sem valores recebidos do peer.
 * @param body Objeto JSON; omitido em GET.
 */
async function send(session: Session, method: string, suffix: string, body?: object): Promise<PairingMessage> {
  if (session.signal.aborted || Date.now() >= Date.parse(session.expiresAt)) throw modelError("pairing_request_closed", "A janela da sessão foi encerrada.");
  const ip = resolveTargets({ addresses: [session.peer.ipAddress] }, session.interfaceName)[0]!;
  const identity = await peers.localIdentity();
  const expected = new X509Certificate(session.peer.certificatePem);
  const content = body === undefined ? undefined : JSON.stringify(body);
  if (content !== undefined && Buffer.byteLength(content) > discoveryLimits.responseBytes) throw modelError("validation_failed", "A mensagem excede o limite do pareamento.");
  return new Promise((resolve, reject) => {
    let finished = false;
    let timeout: ReturnType<typeof setTimeout>;
    /** Conclui a mensagem uma vez e libera seu prazo.
     * @param error Falha segura, quando houver.
     * @param value Resposta validada.
     */
    const finish = (error?: Error, value?: PairingMessage): void => {
      if (finished) return;
      finished = true; clearTimeout(timeout);
      if (error) reject(error); else resolve(value!);
    };
    const outgoing = httpsRequest({
      host: ip.startsWith("fe80:") ? `${ip}%${session.interfaceName}` : ip,
      port: discoveryLimits.port, method, path: `/connect/requests${suffix}`, agent: false,
      cert: identity.certificatePem, key: identity.privateKeyPem, ca: [session.peer.certificatePem],
      rejectUnauthorized: true, minVersion: "TLSv1.3", maxVersion: "TLSv1.3", signal: session.signal,
      checkServerIdentity: (_host, presented) => presented.raw.equals(expected.raw)
        ? undefined : modelError("pairing_peer_rejected", "O destino apresentou outro certificado."),
      headers: content === undefined ? {} : { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(content) },
    }, async response => {
      try {
        if (!/^application\/(?:problem\+)?json(?:;|$)/i.test(String(response.headers["content-type"]))) throw new Error("Resposta inválida.");
        const chunks: Buffer[] = []; let total = 0;
        for await (const chunk of response) {
          total += chunk.length;
          if (total > discoveryLimits.responseBytes) { outgoing.destroy(); throw new Error("Resposta excedida."); }
          chunks.push(Buffer.from(chunk));
        }
        const bytes = Buffer.concat(chunks);
        if (!isUtf8(bytes)) throw new Error("Resposta inválida.");
        const value = JSON.parse(bytes.toString("utf8"));
        if ((response.statusCode ?? 500) >= 400) {
          const code = typeof value?.code === "string" && /^(pairing_[a-z_]{1,40}|validation_failed|peer_limit_reached)$/.test(value.code) ? value.code : "pairing_failed";
          finish(modelError(code, "O outro dispositivo não concluiu a operação de pareamento.")); return;
        }
        if (![200, 201].includes(response.statusCode!) || !value || typeof value !== "object" || Array.isArray(value)
          || Object.keys(value).length !== 3 || value.id !== session.id || !statuses.includes(value.status) || typeof value.accepted !== "boolean") {
          throw new Error("Resposta inválida.");
        }
        session.remoteAccepted = value.accepted;
        finish(undefined, value);
      } catch { finish(modelError("pairing_failed", "O outro dispositivo retornou uma resposta inválida.")); outgoing.destroy(); }
    });
    outgoing.on("error", error => finish(modelError(session.signal.aborted ? "pairing_request_closed" : errorCode(error) === "pairing_peer_rejected" ? "pairing_peer_rejected" : "pairing_unreachable", "A mensagem de pareamento não foi concluída.")));
    timeout = setTimeout(() => { finish(modelError("pairing_timeout", "O outro dispositivo excedeu o prazo da mensagem.")); outgoing.destroy(); }, discoveryLimits.attemptMs);
    outgoing.end(content);
  });
}

/** Envia o pedido real para o candidato, sem aceitar ou gravar confiança.
 * @param peer Candidato escolhido localmente.
 * @param displayName Nome de exibição desta instalação, sem uso como prova de identidade.
 */
export async function startPairingRequest(peer: Candidate, displayName: string): Promise<PairingRequest> {
  if (typeof displayName !== "string" || !displayName || !displayName.isWellFormed() || displayName.includes("\0")) throw modelError("validation_failed", "Informe o nome local.");
  const session = await createSession(peer, "initiator");
  lock(session);
  try {
    assertOpen(session); session.sent = true;
    const result = await send(session, "POST", "", { id: session.id, displayName, ttlMs: Math.max(1, Date.parse(session.expiresAt) - Date.now()) });
    if (["rejected", "cancelled", "expired"].includes(result.status)) session.status = result.status;
    return snapshot(session);
  } finally { session.busy = false; }
}

/** Confere a impressão digital completa recebida por um canal independente e confiável.
 * Apenas uma chamada local pode registrar este aceite; não há rota remota equivalente.
 * @param id Sessão exibida ao usuário.
 * @param expectedFingerprint SHA-256 completo do outro dispositivo, com ou sem dois-pontos.
 */
export async function acceptPairingRequest(id: string, expectedFingerprint: string): Promise<PairingRequest> {
  const session = sessionById(id); assertOpen(session);
  if (session.busy) throw modelError("pairing_in_progress", "Já existe uma operação nesta sessão.");
  if (typeof expectedFingerprint !== "string") throw modelError("validation_failed", "Informe a impressão digital completa.");
  const supplied = expectedFingerprint.replaceAll(":", "").toUpperCase();
  if (!/^[0-9A-F]{64}$/.test(supplied) || supplied !== session.peerFingerprint.replaceAll(":", "")) {
    session.attemptsRemaining--;
    if (!session.attemptsRemaining) {
      await closeRequest(session, "rejected", true);
      throw modelError("pairing_attempts_exceeded", "O pedido atingiu três conferências incorretas.");
    }
    throw modelError("fingerprint_mismatch", "A impressão digital não corresponde ao participante.");
  }
  session.localAccepted = true;
  return snapshot(session);
}

/** Consulta o estado remoto sem aceitar pedidos ou iniciar a gravação.
 * @param id Sessão já enviada ao outro dispositivo.
 */
export async function refreshPairingRequest(id: string): Promise<PairingRequest> {
  const session = sessionById(id); assertOpen(session); lock(session);
  try {
    const result = await send(session, "GET", `/${id}`);
    if (["rejected", "cancelled", "expired"].includes(result.status)) await closeRequestUnlocked(session, result.status as "rejected" | "cancelled" | "expired");
    return snapshot(session);
  } finally { session.busy = false; }
}

/** Prepara o registro local sem liberar arquivos e verifica se a janela continuou aberta.
 * @param session Sessão cujos aceites foram conferidos pelo controller.
 */
async function prepare(session: Session): Promise<void> {
  if (!session.localAccepted) throw modelError("pairing_not_ready", "O usuário local ainda não confirmou o certificado.");
  await peers.preparePeer(session.peer, session.id);
  try { assertOpen(session); }
  catch (error) { await peers.discardPreparedPeer(session.peer.certificatePem, session.id); throw error; }
  session.status = "prepared";
}

/** Recebe a preparação do iniciador, sem substituir o aceite do usuário desta máquina.
 * @param id Sessão autenticada pelo controller.
 * @param certificatePem Certificado do remetente TLS.
 */
export async function prepareReceivedPairing(id: string, certificatePem: string): Promise<PairingMessage> {
  pairingMessage(id, certificatePem);
  const session = sessionById(id); lock(session);
  try {
    if (session.role !== "receiver") throw modelError("pairing_conflict", "Somente o iniciador pode preparar esta ponta.");
    if (session.status !== "confirmed" && session.status !== "committing") { assertOpen(session); await prepare(session); }
    session.remoteAccepted = true;
    return pairingMessage(id, certificatePem);
  } finally { session.busy = false; }
}

/** Publica confiança e atualiza o servidor antes de informar conclusão.
 * @param session Sessão com confirmação de preparação do outro participante.
 */
async function confirm(session: Session): Promise<void> {
  session.status = "committing";
  await peers.confirmPeer(session.peer.certificatePem, session.id);
  if (updateTrust) await updateTrust();
  session.status = "confirmed";
}

/** Confirma a ponta receptora após os dois aceites e as duas preparações.
 * @param id Identificador da sessão preparada.
 * @param certificatePem Certificado do iniciador no TLS.
 */
export async function confirmReceivedPairing(id: string, certificatePem: string): Promise<PairingMessage> {
  pairingMessage(id, certificatePem);
  const session = sessionById(id); lock(session);
  try {
    if (session.role !== "receiver" || !session.localAccepted || !["prepared", "committing", "confirmed"].includes(session.status)) throw modelError("pairing_not_ready", "A sessão ainda não está preparada.");
    if (session.status === "prepared") assertOpen(session);
    if (session.status !== "confirmed") await confirm(session);
    return pairingMessage(id, certificatePem);
  } finally { session.busy = false; }
}

/** Conclui pelo iniciador: prepara A, prepara B, confirma B e só então confirma A.
 * Falhas são propagadas; repetir a mesma sessão retoma as operações idempotentes.
 * @param id Sessão iniciada nesta instalação e aceita pelos dois usuários.
 */
export async function completePairingRequest(id: string): Promise<PairingRequest> {
  const session = sessionById(id); lock(session);
  try {
    if (session.role !== "initiator" || !session.sent || !session.localAccepted) throw modelError("pairing_not_ready", "Envie o pedido e confira o certificado localmente antes de concluir.");
    if (session.status === "confirmed") return snapshot(session);
    if (session.status !== "committing") { assertOpen(session); await prepare(session); }
    const prepared = await send(session, "POST", `/${id}/preparation`, {});
    if (!prepared.accepted || !["prepared", "committing", "confirmed"].includes(prepared.status)) throw modelError("pairing_not_ready", "O outro usuário ainda não confirmou a sessão.");
    const confirmed = await send(session, "POST", `/${id}/confirmation`, {});
    if (confirmed.status !== "confirmed") throw modelError("pairing_not_ready", "A confirmação remota ainda não terminou.");
    await confirm(session);
    return snapshot(session);
  } finally { session.busy = false; }
}

/** Descarta a preparação local e preserva confiança que já tenha sido confirmada.
 * @param session Sessão que será encerrada.
 * @param status Motivo do encerramento.
 */
async function closeRequestUnlocked(session: Session, status: "rejected" | "cancelled" | "expired"): Promise<void> {
  await peers.discardPreparedPeer(session.peer.certificatePem, session.id);
  session.status = status;
}

/** Encerra uma sessão e, quando possível, avisa o outro participante.
 * @param session Sessão local ou recebida.
 * @param status Motivo do encerramento.
 * @param notify Envia DELETE ao outro participante quando a sessão ainda está acessível.
 */
async function closeRequest(session: Session, status: "rejected" | "cancelled", notify: boolean): Promise<PairingRequest> {
  lock(session);
  try {
    if (session.status !== "pending" && session.status !== "prepared" && session.status !== status) throw modelError("pairing_request_closed", "A sessão já foi encerrada por outro motivo ou entrou em confirmação.");
    await closeRequestUnlocked(session, status);
    if (notify && session.sent && !session.signal.aborted && Date.now() < Date.parse(session.expiresAt)) {
      try { await send(session, "DELETE", `/${session.id}`, { reason: status }); }
      catch (error) { if (errorCode(error) !== "pairing_request_not_found") throw error; }
    }
    return snapshot(session);
  } finally { session.busy = false; }
}

/** Recusa localmente e avisa o outro participante; falhas de gravação ou comunicação são propagadas.
 * @param id Identificador do pedido.
 */
export async function rejectPairingRequest(id: string): Promise<PairingRequest> {
  return closeRequest(sessionById(id), "rejected", true);
}

/** Cancela localmente e avisa o outro participante, sem remover confiança já concluída.
 * @param id Identificador do pedido.
 */
export async function cancelPairingRequest(id: string): Promise<PairingRequest> {
  return closeRequest(sessionById(id), "cancelled", true);
}

/** Processa somente o encerramento remoto da própria sessão, sem poder aceitar pedidos.
 * @param id Sessão do remetente autenticado.
 * @param certificatePem Certificado obtido do TLS.
 * @param reason Motivo de encerramento enviado pelo participante.
 */
export async function receivePairingClosure(id: string, certificatePem: string, reason: "rejected" | "cancelled"): Promise<PairingMessage> {
  pairingMessage(id, certificatePem);
  await closeRequest(sessionById(id), reason, false);
  return pairingMessage(id, certificatePem);
}
