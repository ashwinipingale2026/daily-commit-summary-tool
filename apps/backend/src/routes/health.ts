import { Router } from "express";

export function createHealthRouter(): Router {
  const router = Router();
  router.get("/", (_request, response) => {
    response.json({ status: "ok" });
  });
  return router;
}
