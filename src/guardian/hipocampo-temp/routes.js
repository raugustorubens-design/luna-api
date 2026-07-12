import { Router } from "express";
import { createGuardian } from "../guardian.js";
import { createMemoryPipeline } from "./memory-pipeline.js";
import { searchMemoryIndex } from "./memory-index.js";
import { avaliarSuficiencia } from "./metacognicao.js";

function origin(req) {
  return typeof req.headers["x-guardian-origin"] === "string" ? req.headers["x-guardian-origin"] : "unknown";
}

/**
 * Rotas do pipeline de memória (EXTRACT→FILTER→CLASSIFY→VALIDATE→PERSIST) e
 * da Memory Index. Contrato HTTP separado de `/guardian/save` etc. (routes.js)
 * porque aquele é o contrato genérico de armazenamento — qualquer coleção,
 * sem dimensões de memória; este é específico da memória do organismo
 * (Tipo/Maturação/Estado), conforme ARQUITETURA-DA-MEMORIA.md.
 *
 * @param {ReturnType<typeof createGuardian>} [guardian]
 */
export function createMemoryRouter(guardian = createGuardian()) {
  const router = Router();
  const pipeline = createMemoryPipeline(guardian);

  router.post("/guardian/memory", async (req, res) => {
    try {
      const result = await pipeline.write(req.body, origin(req));
      res.status(result.status === "descartado" ? 200 : 201).json(result);
    } catch (error) {
      const status = error && typeof error.status === "number" ? error.status : 500;
      res.status(status).json({ error: error instanceof Error ? error.message : "Guardian memory write failed" });
    }
  });

  router.get("/guardian/memory/index-search", async (req, res) => {
    try {
      const { tipo, q, limit, incluirNaoAtivas } = req.query;
      const resultados = await searchMemoryIndex(
        guardian,
        {
          tipo: typeof tipo === "string" ? tipo : undefined,
          q: typeof q === "string" ? q : undefined,
          limit: limit ? Number(limit) : undefined,
          incluirNaoAtivas: incluirNaoAtivas === "true",
        },
        origin(req),
      );
      const suficiencia = avaliarSuficiencia({ camadaMaximaDisponivel: 1 });
      res.json({ resultados, ...suficiencia });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Memory Index search failed" });
    }
  });

  router.get("/guardian/memory/audit", (req, res) => {
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    res.json({ entries: pipeline.decisionAuditor.recent(limit) });
  });

  // Contrato reservado: aprofundamento para Camada 2+ ainda não existe
  // (ARQUITETURA-DA-MEMORIA.md §3, §8.1). Rota preparada, não implementada —
  // devolve 501 explícito em vez de 404 (a diferença importa: isto não é uma
  // rota inexistente, é um contrato conhecido ainda sem implementação).
  router.post("/guardian/memory/deepen", (_req, res) => {
    res.status(501).json({
      error: "Camada 2+ ainda não implementada nesta versão do Guardian. Contrato reservado para consolidação futura (ARQUITETURA-DA-MEMORIA.md §3).",
    });
  });

  return router;
}
