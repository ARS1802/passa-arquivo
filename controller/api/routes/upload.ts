import type { Router } from "express";
import * as files from "../../../model/file/fileService.js";
import { jsonObject, metadataLocation, noBody, overwriteField, query, stringField } from "../../connection/sharingService.js";

/** Registra alterações locais atribuídas ao fluxo de envio/compartilhamento.
 * PUT /api/v2/files depende de parser multipart por partes, ainda não disponível.
 * POST /api/v2/actions/copy depende de cancelamento antes da publicação no model.
 * @param router Router instalado depois da autenticação de peers conhecidos.
 * @param jsonMaxBytes Limite documentado de corpo JSON.
 */
export function registerChanges(router: Router, jsonMaxBytes: number): void {
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
