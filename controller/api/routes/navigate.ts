/**
 * Responsabilidade: Registrar consultas de metadados e listagem, encaminhando as operações
 * ao model.
 *
 * Exemplo prático: GET /api/v2/directories/entries?path=documentos lista os filhos imediatos
 * de documentos após a autenticação.
 */
import type { Router } from "express";
import * as files from "../../../model/file/fileService.js";
import { noBody, query, stringField } from "../../connection/sharingService.js";

/** Registra consultas de metadados e filhos imediatos, sem repetir regras do model.
 * @param router Router instalado depois da autenticação de peers conhecidos.
 */
export function registerNavigation(router: Router): void {
  /** Consulta os metadados do caminho obrigatório no model.
   * @param request Requisição validada pelo controle de acesso deste listener.
   * @param response Resposta enviada depois de concluir a operação.
   */
  router.get("/api/v2/entries", async (request, response) => {
    const fields = query(request, ["path"]);
    await noBody(request);
    response.json(await files.metadata(stringField(fields.path)));
  });
  /** Lista a pasta informada ou a raiz quando path é omitido.
   * @param request Requisição validada pelo controle de acesso deste listener.
   * @param response Resposta enviada depois de concluir a operação.
   */
  router.get("/api/v2/directories/entries", async (request, response) => {
    const fields = query(request, ["path"]);
    await noBody(request);
    response.json(await files.list(fields.path === undefined ? "." : fields.path));
  });
}
