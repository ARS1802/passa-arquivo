/**
 * Responsabilidade: Validar dados HTTP, enviar streams e traduzir erros para respostas
 * seguras compartilhadas pelas rotas.
 *
 * Exemplo prático: Se uma consulta repetir path, query recusa a entrada e handleError
 * responde validation_failed sem revelar caminhos locais.
 */
import express, { type NextFunction, type Request, type Response } from "express";
import { isUtf8 } from "node:buffer";
import { once } from "node:events";
import type { Readable } from "node:stream";
import { errorCode, modelError } from "../../model/file/File.js";

// Notificações de alterações nos arquivos continuam pendentes; mensagens de pareamento ficam em paringService.ts.
const problems = {
  malformed_request: [400, "Requisição malformada", "A requisição não tem o formato esperado."],
  invalid_path: [400, "Caminho inválido", "O caminho tem um formato inválido."],
  path_forbidden: [403, "Caminho proibido", "O caminho solicitado não é permitido."],
  entry_forbidden: [403, "Operação proibida sobre a entrada", "A operação não é permitida sobre esta entrada."],
  entry_not_found: [404, "Entrada não encontrada", "A entrada solicitada não existe."],
  entry_conflict: [409, "Conflito de entrada", "A entrada é incompatível com a operação ou com o destino."],
  cross_device_operation: [409, "Operação entre filesystems não suportada", "A operação não pode atravessar sistemas de arquivos."],
  payload_too_large: [413, "Limite de tamanho excedido", "A requisição ou o resultado excede o limite permitido."],
  unsupported_media_type: [415, "Tipo de mídia não suportado", "O tipo de conteúdo não é aceito nesta operação."],
  validation_failed: [422, "Validação da requisição falhou", "Confira os campos obrigatórios, seus tipos e valores."],
  discovery_inactive: [409, "Descoberta encerrada", "A janela de descoberta não está aberta."],
  discovery_target_forbidden: [403, "Destino proibido", "O destino está fora da rede selecionada."],
  invalid_certificate: [422, "Certificado inválido", "O certificado não tem o formato ou a validade exigidos."],
  pairing_peer_rejected: [403, "Participante recusado", "O certificado não pertence ao participante desta sessão."],
  pairing_request_not_found: [404, "Pedido não encontrado", "A sessão de pareamento não foi encontrada."],
  pairing_conflict: [409, "Conflito de pareamento", "A identidade ou a sessão já está associada a outro pedido."],
  pairing_request_closed: [409, "Pedido encerrado", "A sessão não permite esta operação ou seu prazo terminou."],
  pairing_in_progress: [409, "Operação em andamento", "Já existe uma operação nesta sessão."],
  pairing_not_ready: [409, "Pareamento incompleto", "Faltam aceites ou confirmações de gravação para concluir."],
  pairing_self: [422, "Própria identidade", "A instalação não pode parear consigo mesma."],
  pairing_limit_reached: [429, "Limite de pedidos", "A janela atingiu o limite de pedidos de pareamento."],
  peer_limit_reached: [409, "Limite de peers", "As 99 posições de peers estão ocupadas."],
  internal_error: [500, "Erro interno", "Não foi possível concluir a operação."],
} as const;

/** Lê a query uma única vez e recusa parâmetros desconhecidos, estruturados ou repetidos.
 * @param request Requisição recebida pelo Express.
 * @param allowed Nomes dos parâmetros aceitos pela rota.
 * @returns Parâmetros decodificados uma única vez, sem nomes repetidos.
 */
export function query(request: Request, allowed: readonly string[]): Record<string, string> {
  const result: Record<string, string> = Object.create(null);
  const queryStart = request.originalUrl.indexOf("?");
  const rawQuery = queryStart < 0 ? "" : request.originalUrl.slice(queryStart + 1);
  // Mantém %2B intacto até a decodificação, para distingui-lo de + (espaço).
  for (const part of rawQuery.replaceAll("+", " ").split("&")) {
    if (!part) continue;
    const separator = part.indexOf("=");
    let name: string;
    let value: string;
    try {
      name = decodeURIComponent(separator < 0 ? part : part.slice(0, separator));
      value = decodeURIComponent(separator < 0 ? "" : part.slice(separator + 1));
    } catch { throw modelError("malformed_request", "A query contém uma codificação inválida."); }
    if (!allowed.includes(name) || Object.hasOwn(result, name)) {
      throw modelError("validation_failed", "A query contém parâmetros desconhecidos ou repetidos.");
    }
    result[name] = value;
  }
  return result;
}

/** Obtém um campo textual sem converter tipos ou corrigir seu conteúdo.
 * @param value Valor do campo, já decodificado quando veio da query.
 * @returns Texto recebido, preservando espaços e conteúdo.
 */
export function stringField(value: unknown): string {
  if (typeof value !== "string") throw modelError("validation_failed", "Informe o campo textual obrigatório.");
  return value;
}

/** Obtém overwrite com padrão somente quando omitido.
 * @param value Valor JSON do campo.
 * @returns Booleano informado, ou false quando o campo foi omitido.
 */
export function overwriteField(value: unknown): boolean {
  if (value === undefined) return false;
  if (typeof value !== "boolean") throw modelError("validation_failed", "overwrite precisa ser booleano.");
  return value;
}

/** Recusa corpo em consultas e operações que não o aceitam; zero bytes são permitidos.
 * @param request Requisição cujo conteúdo será conferido.
 */
export async function noBody(request: Request): Promise<void> {
  if (Number(request.headers["content-length"] ?? 0) > 0) {
    request.resume();
    throw modelError("malformed_request", "Esta operação não aceita corpo.");
  }
  if (request.headers["transfer-encoding"] === undefined) return;
  for await (const chunk of request.iterator({ destroyOnReturn: false })) {
    if (chunk.length) {
      request.resume();
      throw modelError("malformed_request", "Esta operação não aceita corpo.");
    }
  }
}

/** Lê um objeto JSON obrigatório com limite de bytes e lista explícita de campos.
 * @param request Requisição autenticada, antes de outro parser consumir o corpo.
 * @param response Resposta usada pelo middleware nativo do Express.
 * @param maximum Limite configurado de bytes do JSON.
 * @param fields Campos aceitos nesta operação.
 * @returns Objeto JSON validado, contendo somente campos permitidos.
 */
export async function jsonObject(request: Request, response: Response, maximum: number, fields: readonly string[]): Promise<Record<string, unknown>> {
  if (!/^application\/json(?:\s*;\s*charset\s*=\s*(?:utf-8|"utf-8"))?\s*$/i.test(request.get("content-type") ?? "")) {
    throw modelError("unsupported_media_type", "Esta operação exige application/json em UTF-8.");
  }
  const parse = express.json({
    limit: maximum, strict: false, inflate: false,
    /** Seleciona o parser após a validação explícita de Content-Type desta função.
     * @returns true, pois o tipo de conteúdo já foi conferido.
     */
    type: () => true,
    /** Recusa conteúdo vazio ou bytes que não representem texto UTF-8 válido.
     * @param _request Requisição recebida pelo parser do Express.
     * @param _response Resposta associada; não é enviada por esta verificação.
     * @param bytes Corpo bruto, antes de interpretar o JSON.
     */
    verify(_request, _response, bytes) {
      if (!bytes.length || !isUtf8(bytes)) throw modelError("malformed_request", "Informe um JSON válido em UTF-8.");
    },
  });
  try {
    await new Promise<void>((resolve, reject) => parse(request, response, error => error ? reject(error) : resolve()));
  } catch (error) {
    const type = error !== null && typeof error === "object" && "type" in error ? error.type : undefined;
    if (type === "entity.too.large") throw modelError("payload_too_large", "O JSON excede o limite permitido.");
    if (type === "encoding.unsupported" || type === "charset.unsupported") throw modelError("unsupported_media_type", "A codificação não é aceita.");
    throw modelError("malformed_request", "Informe um corpo JSON válido.");
  }
  const body: unknown = request.body;
  if (body === undefined) throw modelError("malformed_request", "O corpo JSON é obrigatório.");
  if (body === null || typeof body !== "object" || Array.isArray(body)
    || Object.keys(body).some(field => !fields.includes(field))) {
    throw modelError("validation_failed", "Informe um objeto com somente os campos aceitos.");
  }
  return body as Record<string, unknown>;
}

/** Constrói Location sem revelar caminhos absolutos.
 * @param path Caminho relativo retornado pelo model.
 * @returns URL relativa de consulta dos metadados da entrada.
 */
export function metadataLocation(path: string): string {
  return `/api/v2/entries?${new URLSearchParams({ path })}`;
}

/** Envia bytes com controle de vazão e cancela a leitura se o cliente desconectar.
 * @param source Stream aberto pelo model.
 * @param response Resposta com tipo e disposição já definidos.
 */
export async function sendStream(source: Readable, response: Response): Promise<void> {
  const cancellation = new AbortController();
  /** Cancela a fonte e uma eventual espera pelo consumidor. */
  const cancel = (): void => { cancellation.abort(); source.destroy(); };
  response.on("close", cancel);
  response.on("error", cancel);
  try {
    for await (const chunk of source) {
      if (response.destroyed) return;
      if (!response.write(chunk)) await once(response, "drain", { signal: cancellation.signal });
    }
    if (!response.destroyed) response.end();
  } catch (error) {
    if (!cancellation.signal.aborted) throw error;
  } finally {
    source.destroy();
    response.off("close", cancel);
    response.off("error", cancel);
  }
}

/** Traduz falhas para Problem Details sem ecoar mensagens do sistema ou segredos.
 * Após começar um download, encerra a resposta em vez de acrescentar JSON.
 * @param error Falha original do controller ou model.
 * @param request Requisição associada à operação.
 * @param response Resposta que receberá o problema, quando ainda possível.
 * @param _next Continuação exigida pela assinatura de middleware de erros do Express.
 */
export function handleError(error: unknown, request: Request, response: Response, _next: NextFunction): void {
  if (response.destroyed) return;
  if (response.headersSent) { response.destroy(); return; }
  const received = errorCode(error);
  const code = received && Object.hasOwn(problems, received) ? received as keyof typeof problems : "internal_error";
  const [status, title, detail] = problems[code];
  response.removeHeader("Content-Disposition");
  response.removeHeader("Content-Length");
  if (!request.complete) response.set("Connection", "close");
  response.status(status).type("application/problem+json").json({
    type: `urn:passa-arquivo:problem:${code}`, title, status, detail, code,
  });
}
