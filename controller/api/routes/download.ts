import type { Router } from "express";
import * as files from "../../../model/file/fileService.js";
import { jsonObject, noBody, query, sendStream, stringField } from "../../connection/sharingService.js";

/** Registra download de arquivo e ZIP, cancelando fontes em falhas e desconexões.
 * @param router Router instalado depois da autenticação de peers conhecidos.
 * @param limits Limites documentados de JSON e de compactação.
 */
export function registerDownloads(router: Router, limits: { jsonMaxBytes: number; zipMaxEntries: number; zipMaxBytes: number }): void {
  router.get("/api/v2/files", async (request, response) => {
    const fields = query(request, ["path"]);
    await noBody(request);
    const path = stringField(fields.path);
    const source = await files.read(path);
    try {
      response.attachment(path.split("/").at(-1)!);
      await sendStream(source, response);
    } finally { source.destroy(); }
  });
  router.post("/api/v2/actions/archive", async (request, response) => {
    query(request, []);
    const body = await jsonObject(request, response, limits.jsonMaxBytes, ["path"]);
    const path = body.path === undefined ? "." : stringField(body.path);
    const source = await files.archive(path, limits.zipMaxEntries, limits.zipMaxBytes);
    try {
      response.attachment(path === "." ? "raiz.zip" : `${path.split("/").at(-1)!}.zip`).type("application/zip");
      await sendStream(source, response);
    } finally { source.destroy(); }
  });
}
