import { Router } from "express";
import { createGuardian } from "./guardian.js";

/**
 * Contrato HTTP público do Guardian. Preparado para quando outro serviço
 * (o Memory Engine do monorepo `luna`, hoje; qualquer consumidor autorizado
 * no futuro) puder chamar este processo pela rede — não significa que
 * alguém já chama isto em produção nesta etapa ("Não realizar deploy.
 * Preparar apenas a arquitetura.").
 */
export function createGuardianRouter(guardian = createGuardian()) {
  const router = Router();

  function origin(req) {
    return typeof req.headers["x-guardian-origin"] === "string" ? req.headers["x-guardian-origin"] : "unknown";
  }

  router.post("/guardian/save", async (req, res) => {
    try {
      const record = await guardian.save(req.body, origin(req));
      res.status(201).json(record);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Guardian save failed" });
    }
  });

  router.post("/guardian/update", async (req, res) => {
    try {
      const record = await guardian.update(req.body, origin(req));
      if (!record) return res.status(404).json({ error: "Record not found" });
      res.json(record);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Guardian update failed" });
    }
  });

  router.post("/guardian/delete", async (req, res) => {
    try {
      await guardian.delete(req.body, origin(req));
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Guardian delete failed" });
    }
  });

  router.get("/guardian/get", async (req, res) => {
    try {
      const record = await guardian.get({ collection: req.query.collection, id: req.query.id }, origin(req));
      if (!record) return res.status(404).json({ error: "Record not found" });
      res.json(record);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Guardian get failed" });
    }
  });

  router.post("/guardian/search", async (req, res) => {
    try {
      const records = await guardian.search(req.body, origin(req));
      res.json({ records });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Guardian search failed" });
    }
  });

  router.get("/guardian/audit", (req, res) => {
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    res.json({ entries: guardian.recentAudit(limit) });
  });

  return router;
}
