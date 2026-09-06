import express from 'express';
import type { Express } from 'express';

/** Monta a aplicação; rotas e listener serão integrados nas etapas correspondentes. */
export function createApp(): Express {
  const app = express();
  app.disable('x-powered-by');
  return app;
}
