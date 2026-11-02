import type { Request, Response, Router } from "express";
import busboy from "busboy";
import type { Readable } from "node:stream";
import * as files from "../../../model/file/fileService.js";
import { modelError } from "../../../model/file/File.js";
import { jsonObject, metadataLocation, noBody, overwriteField, query, stringField } from "../../connection/sharingService.js";

/** Registra alterações locais atribuídas ao fluxo de envio/compartilhamento.
 * @param router Router instalado depois da autenticação de peers conhecidos.
 * @param jsonMaxBytes Limite documentado de corpo JSON.
 * @param uploadMaxBytes Limite dos bytes do arquivo, sem contar os separadores multipart.
 */
export function registerChanges(router: Router, jsonMaxBytes: number, uploadMaxBytes = 1_073_741_824): void {
  router.put("/api/v2/files", async (request, response) => {
    const fields = query(request, ["path"]);
    const path = stringField(fields.path);
    const cancellation = requestCancellation(request, response);
    try {
      const content = multipartFile(request, cancellation.signal);
      const result = await files.write(path, content, uploadMaxBytes, cancellation.signal);
      if (result.created) {
        response.location(metadataLocation(result.entry.path)).status(201).json(result.entry);
      } else response.status(204).end();
    } finally { cancellation.dispose(); }
  });
  router.post("/api/v2/actions/copy", async (request, response) => {
    query(request, []);
    const body = await jsonObject(request, response, jsonMaxBytes, ["sourcePath", "targetPath", "overwrite"]);
    const sourcePath = stringField(body.sourcePath);
    const targetPath = stringField(body.targetPath);
    const overwrite = overwriteField(body.overwrite);
    const cancellation = requestCancellation(request, response);
    try {
      const result = await files.copy(sourcePath, targetPath, overwrite, cancellation.signal);
      if (result.created) response.location(metadataLocation(result.entry.path));
      response.status(result.created ? 201 : 200).json(result.entry);
    } finally { cancellation.dispose(); }
  });
  router.put("/api/v2/directories", async (request, response) => {
    const fields = query(request, ["path"]);
    await noBody(request);
    const result = await files.createDirectory(stringField(fields.path));
    if (result.created) response.location(metadataLocation(result.entry.path));
    response.status(result.created ? 201 : 200).json(result.entry);
  });
  router.delete("/api/v2/entries", async (request, response) => {
    const fields = query(request, ["path"]);
    await noBody(request);
    await files.remove(stringField(fields.path));
    response.status(204).end();
  });
  router.patch("/api/v2/entries", async (request, response) => {
    const fields = query(request, ["path"]);
    const path = stringField(fields.path);
    const body = await jsonObject(request, response, jsonMaxBytes, ["name", "parentPath", "overwrite"]);
    const changes: { name?: string; parentPath?: string; overwrite: boolean } = { overwrite: overwriteField(body.overwrite) };
    if (body.name !== undefined) changes.name = stringField(body.name);
    if (body.parentPath !== undefined) changes.parentPath = stringField(body.parentPath);
    response.json(await files.move(path, changes));
  });
}

/** Vincula o cancelamento da operação à desconexão, sem confundir fim do corpo com desconexão.
 * @param request Requisição autenticada.
 * @param response Resposta da operação, ainda não concluída.
 */
function requestCancellation(request: Request, response: Response): { signal: AbortSignal; dispose: () => void } {
  const controller = new AbortController();
  /** Interrompe somente uma operação cuja resposta não foi concluída. */
  const cancel = (): void => {
    if (!response.writableFinished) controller.abort(modelError("operation_cancelled", "A conexão foi encerrada antes da conclusão."));
  };
  request.once("aborted", cancel);
  response.once("close", cancel);
  response.once("error", cancel);
  if (request.aborted || response.destroyed) cancel();
  return {
    signal: controller.signal,
    /** Remove os observadores quando a operação termina ou falha. */
    dispose() {
      request.off("aborted", cancel);
      response.off("close", cancel);
      response.off("error", cancel);
    },
  };
}

/** Fornece somente os bytes de uma parte file e valida o formulário inteiro antes do EOF.
 * O nome do arquivo e o MIME da parte não escolhem caminhos no servidor.
 * @param request Requisição multipart ainda não consumida.
 * @param signal Cancelamento da operação quando o cliente desconecta.
 * @returns Fonte por partes; erros de formato ou campos extras impedem a publicação pelo model.
 */
function multipartFile(request: Request, signal: AbortSignal): AsyncIterable<Uint8Array> {
  if (!/^multipart\/form-data(?:\s*;|\s*$)/i.test(request.get("content-type") ?? "")) {
    throw modelError("unsupported_media_type", "O upload exige multipart/form-data.");
  }
  let parser: ReturnType<typeof busboy>;
  try {
    // partsLimit é emitido ao completar a parte; 2 detecta a segunda sem recusar a primeira.
    parser = busboy({ headers: request.headers, limits: { files: 1, fields: 0, parts: 2 } });
  } catch { throw modelError("malformed_request", "O cabeçalho multipart não tem um boundary válido."); }
  return receive();

  /** Mantém o fluxo sob controle de vazão e aguarda a validação do fechamento multipart. */
  async function* receive(): AsyncGenerator<Uint8Array> {
    let file: Readable | undefined;
    let failure: Error | undefined;
    /** Registra a primeira falha e encerra os streams fora do callback interno do parser.
     * @param error Falha de formato, validação ou cancelamento.
     */
    const fail = (error: Error): void => {
      if (failure) return;
      failure = error;
      queueMicrotask(() => { file?.destroy(error); parser.destroy(error); });
    };
    const completed = new Promise<void>(resolve => {
      parser.once("close", resolve);
      parser.once("error", () => {
        failure ??= modelError("malformed_request", "O corpo multipart está incompleto ou inválido.");
        resolve();
      });
    });
    const ready = new Promise<Readable | undefined>(resolve => {
      parser.on("file", (name, stream) => {
        file = stream;
        stream.on("error", () => fail(modelError("malformed_request", "O arquivo multipart está incompleto.")));
        if (name !== "file") fail(modelError("validation_failed", "O upload exige somente uma parte de arquivo chamada file."));
        resolve(stream);
      });
      parser.once("close", () => resolve(undefined));
      parser.once("error", () => resolve(undefined));
    });
    /** Recusa arquivos extras, campos textuais ou qualquer segunda parte. */
    const extraPart = (): void => { fail(modelError("validation_failed", "O upload aceita exatamente um arquivo e nenhum outro campo.")); };
    parser.on("filesLimit", extraPart);
    parser.on("fieldsLimit", extraPart);
    parser.on("partsLimit", extraPart);
    /** Encaminha a interrupção da requisição ao parser e à fonte de bytes. */
    const abort = (): void => { fail(signal.reason instanceof Error ? signal.reason : modelError("operation_cancelled", "O upload foi cancelado.")); };
    /** Trata falhas de transporte sem deixá-las presas na espera por uma parte. */
    const requestError = (): void => { fail(modelError("malformed_request", "O recebimento do upload foi interrompido.")); };
    signal.addEventListener("abort", abort, { once: true });
    request.once("error", requestError);
    try {
      signal.throwIfAborted();
      request.pipe(parser);
      const stream = await ready;
      if (failure) throw failure;
      if (!stream) throw modelError("validation_failed", "O upload não contém a parte de arquivo file.");
      for await (const chunk of stream) {
        signal.throwIfAborted();
        if (failure) throw failure;
        yield chunk;
      }
      await completed;
      signal.throwIfAborted();
      if (failure) throw failure;
    } catch (error) {
      throw failure ?? error;
    } finally {
      request.unpipe(parser);
      parser.destroy();
      file?.destroy();
      signal.removeEventListener("abort", abort);
      request.off("error", requestError);
    }
  }
}
