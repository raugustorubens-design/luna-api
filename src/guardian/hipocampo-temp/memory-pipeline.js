/**
 * Pipeline de escrita de memória — EXTRACT → FILTER → CLASSIFY (memory_core.alg
 * §CORE PIPELINE; ARQUITETURA-DA-MEMORIA.md §6). VALIDATE e PERSIST continuam
 * sendo responsabilidade permanente do Guardian (ARQUITETURA-DA-MEMORIA.md
 * §1.1) — este módulo os invoca através do contrato genérico do Guardian
 * (`guardian.save`/`guardian.search`/`guardian.update`), nunca reimplementando
 * acesso a armazenamento.
 *
 * Residência temporária: EXTRACT/FILTER/CLASSIFY pertencem arquiteturalmente
 * ao Hipocampo (ARQUITETURA-DA-MEMORIA.md §1.1, "Estratégia de migração
 * (MVP)") — vivem aqui só até o Hipocampo existir como órgão independente.
 * Por isso este módulo só depende do contrato do Guardian (`guardian.save`/
 * `search`/`update`), nunca de `adapters/supabase-adapter.js` diretamente —
 * extração futura para outro serviço não deve exigir reescrever o Guardian.
 *
 * Fora de escopo nesta versão (não implementado aqui):
 * - RETRIEVE/UPDATE (M(t+1) sigmoide) e FEEDBACK adaptativo de memory_core.alg
 *   — dependem de calibração automática, adiada (ARQUITETURA-DA-MEMORIA.md §1.1).
 * - Consolidação para Camadas 2+ (ARQUITETURA-DA-MEMORIA.md §3, §8.1).
 * - Transições de Estado para "obsoleta"/"contraditoria" (ARQUITETURA-DA-MEMORIA.md
 *   §8.3 — quem decide isso ainda não foi definido pelos arquitetos).
 */
import { extractSignals } from "./extract.js";
import { computeScore, passesThreshold } from "./filter.js";
import { classifyTipo } from "./classify.js";
import { CAMADA_INICIAL, THRESHOLD } from "./constants.js";
import { MemoryDecisionAuditor } from "./memory-audit.js";

export const MEMORY_COLLECTION = "memoria_luna";

class MemoryValidationError extends Error {
  constructor(message) {
    super(message);
    this.status = 400;
  }
}

/**
 * @param {ReturnType<typeof import("../guardian.js").createGuardian>} guardian
 * @param {MemoryDecisionAuditor} [decisionAuditor]
 */
export function createMemoryPipeline(guardian, decisionAuditor = new MemoryDecisionAuditor()) {
  /**
   * @param {{ tipo: string, conteudo: unknown, resumo?: string, chave?: string,
   *   signals?: { relevance?: number, impact?: number, entropy?: number } }} input
   * @param {string} origin
   */
  async function write(input, origin) {
    const { tipo, conteudo, resumo, chave } = input ?? {};
    const signals = extractSignals(input?.signals);
    const score = computeScore(signals);

    if (conteudo === undefined || conteudo === null || conteudo === "") {
      decisionAuditor.record({ origin, tipo, signals, score, decisao: "rejeitado", statusValidacao: "conteudo_ausente", chave });
      throw new MemoryValidationError("conteudo é obrigatório");
    }

    if (!passesThreshold(score)) {
      decisionAuditor.record({ origin, tipo, signals, score, decisao: "descartado", statusValidacao: "abaixo_do_limiar", chave });
      return { status: "descartado", score, threshold: THRESHOLD };
    }

    let tipoValidado;
    try {
      tipoValidado = classifyTipo(tipo);
    } catch (error) {
      decisionAuditor.record({ origin, tipo, signals, score, decisao: "rejeitado", statusValidacao: "tipo_invalido", chave });
      throw new MemoryValidationError(error instanceof Error ? error.message : String(error));
    }

    // VALIDATE + Replacement Policy (Guardian, ARQUITETURA-DA-MEMORIA.md §1.1 /
    // memory_core.alg §7 "IF duplicate → REPLACE"). Dedup por `chave` explícita
    // do chamador — não há busca semântica nesta versão (fora de escopo).
    let substituiu = null;
    if (chave) {
      const existentes = await guardian.search({ collection: MEMORY_COLLECTION, filter: { chave, estado: "ativa" }, limit: 1 }, origin);
      const existente = existentes[0];
      if (existente) {
        await guardian.update({ collection: MEMORY_COLLECTION, id: existente.id, data: { estado: "substituida" } }, origin);
        substituiu = existente.id;
      }
    }

    const record = await guardian.save(
      {
        collection: MEMORY_COLLECTION,
        data: {
          tipo: tipoValidado,
          camada: CAMADA_INICIAL,
          estado: "ativa",
          conteudo,
          resumo,
          chave,
          signals,
          score,
          criadoEm: new Date().toISOString(),
        },
      },
      origin,
    );

    decisionAuditor.record({
      origin,
      tipo: tipoValidado,
      signals,
      score,
      decisao: substituiu ? "substituido" : "persistido",
      statusValidacao: "valido",
      chave,
    });

    return { status: substituiu ? "substituido" : "persistido", score, record, substituiu };
  }

  return { write, decisionAuditor };
}

export { MemoryValidationError };
