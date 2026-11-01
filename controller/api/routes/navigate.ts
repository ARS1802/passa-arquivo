import type { Router } from "express";
import * as files from "../../../model/file/fileService.js";
import { noBody, query, stringField } from "../../connection/sharingService.js";

/** Registra consultas de metadados e filhos imediatos, sem repetir regras do model.
 * @param router Router instalado depois da autenticação de peers conhecidos.
 */
export function registerNavigation(router: Router): void {
  router.get("/api/v2/entries", async (request, response) => {
    const fields = query(request, ["path"]);
    await noBody(request);
    response.json(await files.metadata(stringField(fields.path)));
  });
  router.get("/api/v2/directories/entries", async (request, response) => {
    const fields = query(request, ["path"]);
    await noBody(request);
    response.json(await files.list(fields.path === undefined ? "." : fields.path));
  });
}
