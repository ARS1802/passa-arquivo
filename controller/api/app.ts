import express, { Request, Response } from "express";
const app = express();
app.listen(3030);
app.get("/", (req: Request, res: Response) => {
  res.send("/home/arthur/Projetos/tests/passa-arquivo/GUI/index.html");
});
