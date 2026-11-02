/**
 * Responsabilidade: Registrar a consulta de saúde após a autenticação comum da aplicação.
 *
 * Exemplo prático: Um peer autenticado consulta GET /health e recebe status ok quando a
 * requisição não contém parâmetros ou corpo.
 */
import type { Router } from "express";
import { noBody, query } from "../../connection/sharingService.js";

/** Registra a consulta de saúde, protegida pelo controle mTLS comum da aplicação.
 * @param router Router instalado depois da autenticação de peers conhecidos.
 */
export function registerHealth(router: Router): void {
  /** Responde à consulta de saúde após recusar parâmetros e corpo.
   * @param request Requisição validada pelo controle de acesso deste listener.
   * @param response Resposta enviada depois de concluir a operação.
   */
  router.get("/health", async (request, response) => {
    query(request, []);
    await noBody(request);
    response.json({ status: "ok" });
  });
}
