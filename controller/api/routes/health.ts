import type { Router } from "express";
import { noBody, query } from "../../connection/sharingService.js";

/** Registra a consulta de saúde, protegida pelo controle mTLS comum da aplicação.
 * @param router Router instalado depois da autenticação de peers conhecidos.
 */
export function registerHealth(router: Router): void {
  router.get("/health", async (request, response) => {
    query(request, []);
    await noBody(request);
    response.json({ status: "ok" });
  });
}
