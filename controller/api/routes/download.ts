/**
 * Responsabilidade: Registrar downloads de arquivos e ZIP, encerrando as leituras quando a
 * transferência termina ou falha.
 *
 * Exemplo prático: Ao baixar nota.txt, abre a leitura no model e envia os bytes ao peer sem
 * carregar o arquivo inteiro na memória.
 */
import type { Router } from "express";
import { posix } from "node:path";
import * as files from "../../../model/file/fileService.js";
import { jsonObject, noBody, query, sendStream, stringField } from "../../connection/sharingService.js";

/** Registra download de arquivo e ZIP, cancelando fontes em falhas e desconexões.
 * @param router Router instalado depois da autenticação de peers conhecidos.
 * @param limits Limites documentados de JSON e de compactação.
 */
export function registerDownloads(router: Router, limits: { jsonMaxBytes: number; zipMaxEntries: number; zipMaxBytes: number }): void {
  /** Abre o arquivo no model e envia seu conteúdo como download.
   * @param request Requisição validada pelo controle de acesso deste listener.
   * @param response Resposta enviada depois de concluir a operação.
   */
  router.get("/api/v2/files", async (request, response) => {
    const fields = query(request, ["path"]);
    await noBody(request);
    const path = stringField(fields.path);
    const source = await files.read(path);
    try {
      response.attachment(posix.basename(path));
      await sendStream(source, response);
    } finally { source.destroy(); }
  });
  /** Valida o pedido de compactação e envia o ZIP produzido pelo model.
   * @param request Requisição validada pelo controle de acesso deste listener.
   * @param response Resposta enviada depois de concluir a operação.
   */
  router.post("/api/v2/actions/archive", async (request, response) => {
    query(request, []);
    const body = await jsonObject(request, response, limits.jsonMaxBytes, ["path"]);
    const path = body.path === undefined ? "." : stringField(body.path);
    const source = await files.archive(path, limits.zipMaxEntries, limits.zipMaxBytes);
    try {
      response.attachment(path === "." ? "raiz.zip" : `${posix.basename(path)}.zip`).type("application/zip");
      await sendStream(source, response);
    } finally { source.destroy(); }
  });
}
