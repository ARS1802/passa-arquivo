import express from "express";
import { constants } from "node:crypto";
import { createServer, type Server } from "node:https";
import { TLSSocket } from "node:tls";
import type { Socket } from "node:net";
import { localIdentity } from "../../../model/peer/peerService.js";
import { modelError } from "../../../model/file/File.js";
import { handleError, jsonObject, noBody, query } from "../../connection/sharingService.js";
import { activateDiscovery, deactivateDiscovery, discoveryLimits, isDiscoveryActive, isLocalTarget, validateCandidateCertificate } from "../../connection/discoveryService.js";
import { receivePairingRequest, pairingMessage, prepareReceivedPairing, confirmReceivedPairing, receivePairingClosure } from "../../connection/paringService.js";

/** Opções fornecidas por uma chamada local; nenhum candidato remoto pode defini-las. */
export interface DiscoveryOptions {
  displayName: string;
  listenAddress: string;
  interfaceName?: string;
}

let opening = false;
let listener: { server: Server; closed: Promise<void> } | undefined;

/** Encerra a descoberta e aguarda a liberação da porta temporária. */
export async function closeDiscovery(): Promise<void> {
  deactivateDiscovery();
  if (listener) await listener.closed;
}

/** Abre por 120 segundos a entrada de candidatos na porta 8444, por ação local.
 * GET /connect anuncia nome e certificado; as rotas de sessões só recebem mensagens dos participantes.
 * Aceite humano e controle da descoberta continuam disponíveis apenas por chamadas locais.
 * Este listener não registra rotas de arquivos e não altera o TLS do servidor principal.
 * @param options Nome de exibição, IP local de escuta e interface opcional.
 * @returns Prazo da janela e operação local de encerramento.
 */
export async function openDiscovery(options: DiscoveryOptions): Promise<{ expiresAt: string; close: typeof closeDiscovery }> {
  if (opening || listener) throw modelError("discovery_already_active", "A entrada temporária já está aberta.");
  if (!options || typeof options !== "object" || Array.isArray(options)
    || Object.keys(options).some(name => !["displayName", "listenAddress", "interfaceName"].includes(name))
    || typeof options.displayName !== "string" || !options.displayName || !options.displayName.isWellFormed() || options.displayName.includes("\0")
    || !isLocalTarget(options.listenAddress, options.interfaceName)) {
    throw modelError("validation_failed", "Informe um nome e um endereço de escuta da rede local selecionada.");
  }
  opening = true;
  try {
    const identity = await localIdentity();
    const announcement = { displayName: options.displayName, certificatePem: identity.certificatePem };
    if (Buffer.byteLength(JSON.stringify(announcement)) > discoveryLimits.responseBytes) {
      throw modelError("validation_failed", "O nome torna o anúncio maior que o limite permitido.");
    }
    const window = activateDiscovery(options.interfaceName);
    const app = express();
    app.disable("x-powered-by");
    app.disable("etag");
    app.set("query parser", false);
    app.set("case sensitive routing", true);
    app.set("strict routing", true);
    app.use((request, _response, next) => {
      const socket = request.socket;
      try {
        if (!isDiscoveryActive() || window.signal.aborted || !(socket instanceof TLSSocket)
          || socket.getProtocol() !== "TLSv1.3" || socket.isSessionReused()) throw new Error("Conexão recusada.");
        const certificate = socket.getPeerX509Certificate();
        const remote = socket.remoteAddress?.replace(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/, "$1").split("%")[0];
        if (!certificate || !remote || !isLocalTarget(remote, options.interfaceName)) throw new Error("Candidato recusado.");
        validateCandidateCertificate(certificate);
        next();
      } catch { socket.destroy(); }
    });
    app.get("/connect", async (request, response) => {
      query(request, []);
      await noBody(request);
      response.json(announcement);
    });
    app.post("/connect/requests", async (request, response) => {
      query(request, []);
      const body = await jsonObject(request, response, discoveryLimits.responseBytes, ["id", "displayName", "ttlMs"]);
      if (typeof body.id !== "string" || typeof body.displayName !== "string" || typeof body.ttlMs !== "number") {
        throw modelError("validation_failed", "Informe id, displayName e ttlMs.");
      }
      const socket = request.socket as TLSSocket;
      const certificatePem = socket.getPeerX509Certificate()!.toString();
      const ipAddress = socket.remoteAddress!.replace(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/, "$1").split("%")[0]!;
      const session = await receivePairingRequest({ ipAddress, displayName: body.displayName, certificatePem }, body.id, body.ttlMs);
      response.status(201).set("Location", `/connect/requests/${session.id}`).json(pairingMessage(session.id, certificatePem));
    });
    app.get("/connect/requests/:id", async (request, response) => {
      query(request, []); await noBody(request);
      response.json(pairingMessage(request.params.id!, (request.socket as TLSSocket).getPeerX509Certificate()!.toString()));
    });
    app.post("/connect/requests/:id/preparation", async (request, response) => {
      query(request, []); await jsonObject(request, response, discoveryLimits.responseBytes, []);
      response.json(await prepareReceivedPairing(request.params.id!, (request.socket as TLSSocket).getPeerX509Certificate()!.toString()));
    });
    app.post("/connect/requests/:id/confirmation", async (request, response) => {
      query(request, []); await jsonObject(request, response, discoveryLimits.responseBytes, []);
      response.json(await confirmReceivedPairing(request.params.id!, (request.socket as TLSSocket).getPeerX509Certificate()!.toString()));
    });
    app.delete("/connect/requests/:id", async (request, response) => {
      query(request, []);
      const body = await jsonObject(request, response, discoveryLimits.responseBytes, ["reason"]);
      if (body.reason !== "rejected" && body.reason !== "cancelled") throw modelError("validation_failed", "Informe o motivo do encerramento.");
      response.json(await receivePairingClosure(request.params.id!, (request.socket as TLSSocket).getPeerX509Certificate()!.toString(), body.reason));
    });
    app.use(handleError);
    const server = createServer({
      cert: identity.certificatePem, key: identity.privateKeyPem, ca: [],
      requestCert: true,
      // Aceita apresentação de certificados ainda desconhecidos somente neste listener.
      // Posse da chave é demonstrada no handshake; confiança só poderá nascer do pareamento.
      rejectUnauthorized: false, minVersion: "TLSv1.3", maxVersion: "TLSv1.3",
      secureOptions: constants.SSL_OP_NO_TICKET,
    }, app);
    server.headersTimeout = discoveryLimits.attemptMs;
    server.requestTimeout = discoveryLimits.attemptMs;
    server.on("resumeSession", (_id, callback) => callback(null));
    server.on("newSession", (_id, _data, callback) => callback());
    const sockets = new Set<Socket>();
    server.on("connection", socket => { sockets.add(socket); socket.once("close", () => sockets.delete(socket)); });
    /** Libera conexões quando a ação local fecha ou o prazo encerra a descoberta. */
    const stop = (): void => {
      if (server.listening) server.close();
      for (const socket of sockets) socket.destroy();
    };
    window.signal.addEventListener("abort", stop, { once: true });
    const closed = new Promise<void>(resolve => server.once("close", resolve));
    try {
      await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(discoveryLimits.port, options.listenAddress, () => { server.off("error", reject); resolve(); });
      });
    } catch (error) {
      deactivateDiscovery();
      throw error;
    }
    listener = { server, closed };
    /** Fecha a entrada temporária no encerramento do processo local. */
    const shutdown = (): void => { deactivateDiscovery(); };
    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);
    server.once("close", () => {
      if (listener?.server === server) listener = undefined;
      window.signal.removeEventListener("abort", stop);
      process.off("SIGINT", shutdown); process.off("SIGTERM", shutdown);
    });
    server.on("error", () => {
      console.error("A descoberta foi encerrada por uma falha na entrada temporária.");
      deactivateDiscovery();
    });
    if (window.signal.aborted) { stop(); await closed; throw modelError("discovery_inactive", "A janela foi encerrada durante a abertura."); }
    return { expiresAt: window.expiresAt, close: closeDiscovery };
  } finally { opening = false; }
}
