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

// A tabela real `memoria_luna` (Supabase, conferida via information_schema)
// só tem `id, tipo, contexto, conteudo, criado_em, titulo, empresa_id,
// embedding` — mesmas colunas que `luna-core/src/luna/memory-engine.ts`
// (`persistMemory()`) já usa com sucesso em produção. `camada`/`estado`/
// `resumo`/`chave`/`signals`/`score` nunca existiram como coluna própria;
// continuam calculados e usados aqui para a decisão de persistir/descartar/
// substituir, mas agora guardados dentro do `conteudo` (jsonb, aceita
// estrutura livre) em vez de colunas inexistentes — é o que causava o 400
// em toda escrita/busca antes desta correção.
//
// Consequência: o contrato genérico do Guardian (`search`) só sabe filtrar
// por igualdade de coluna real (`supabase-adapter.js`, `.eq(column, value)`)
// — não filtra dentro de um campo jsonb. A Replacement Policy (dedup por
// `chave`) busca por um lote recente e filtra client-side, mesmo padrão já
// usado por `memory-engine.ts` (`retrieveMemory`, pool de candidatos +
// ranking em memória) e pela própria Memory Index (filtro de palavra-chave).
const DEDUP_CANDIDATE_POOL_LIMIT = 200;

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
   *   contexto?: string, titulo?: string, empresa_id?: number,
   *   signals?: { relevance?: number, impact?: number, entropy?: number } }} input
   * @param {string} origin
   */
  async function write(input, origin) {
    const { tipo, conteudo, resumo, chave, contexto, titulo, empresa_id } = input ?? {};
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
      const candidatos = await guardian.search(
        { collection: MEMORY_COLLECTION, limit: DEDUP_CANDIDATE_POOL_LIMIT, orderBy: "criado_em", ascending: false },
        origin,
      );
      const existente = candidatos.find((r) => r.conteudo?.chave === chave && r.conteudo?.estado === "ativa");
      if (existente) {
        await guardian.update(
          { collection: MEMORY_COLLECTION, id: existente.id, data: { conteudo: { ...existente.conteudo, estado: "substituida" } } },
          origin,
        );
        substituiu = existente.id;
      }
    }

    const record = await guardian.save(
      {
        collection: MEMORY_COLLECTION,
        data: {
          tipo: tipoValidado,
          contexto,
          titulo,
          empresa_id,
          conteudo: {
            valor: conteudo,
            camada: CAMADA_INICIAL,
            estado: "ativa",
            resumo,
            chave,
            signals,
            score,
          },
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
