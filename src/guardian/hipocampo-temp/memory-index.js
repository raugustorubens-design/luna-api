/**
 * Memory Index — ARQUITETURA-DA-MEMORIA.md §1.3. Não é a memória, é o mapa
 * da memória: devolve apenas a Impressão Cognitiva Inicial (Camada 1), nunca
 * o registro completo. "Decisão MVP: implementada como módulo interno do
 * Guardian. Arquiteturalmente pertence ao Hipocampo e deverá migrar para ele
 * quando esse órgão existir de forma independente" — por isso este módulo,
 * como o pipeline de escrita, só depende do contrato do Guardian
 * (`guardian.search`), nunca de um adapter de armazenamento diretamente.
 *
 * MVP: sem busca semântica/vetorial (fora de escopo). Filtragem por `tipo`/
 * `estado` ocorre no armazenamento (contrato de igualdade simples do
 * Guardian); filtragem por palavra-chave (`q`) ocorre em memória, após a
 * busca. Trocar por busca vetorial/semântica no futuro não deve exigir
 * mudar o formato desta resposta (Impressão Cognitiva Inicial).
 */
import { classifyTipo } from "./classify.js";
import { MEMORY_COLLECTION } from "./memory-pipeline.js";

const FETCH_BATCH = 100;
const RESUMO_MAX_LENGTH = 160;

function summarize(record) {
  if (record.resumo) return String(record.resumo);
  if (typeof record.conteudo === "string") {
    return record.conteudo.length > RESUMO_MAX_LENGTH ? `${record.conteudo.slice(0, RESUMO_MAX_LENGTH)}…` : record.conteudo;
  }
  const serialized = JSON.stringify(record.conteudo ?? {});
  return serialized.length > RESUMO_MAX_LENGTH ? `${serialized.slice(0, RESUMO_MAX_LENGTH)}…` : serialized;
}

/** Impressão Cognitiva Inicial — nunca inclui o `conteudo` completo. */
export function buildImpressaoCognitiva(record) {
  return {
    id: record.id,
    tipo: record.tipo,
    resumo: summarize(record),
    camada: record.camada,
    estado: record.estado,
    criadoEm: record.criadoEm,
    ref: { collection: MEMORY_COLLECTION, id: record.id },
  };
}

function matchesKeyword(record, q) {
  const needle = q.toLowerCase();
  return summarize(record).toLowerCase().includes(needle) || (record.chave ?? "").toLowerCase().includes(needle);
}

/**
 * @param {ReturnType<typeof import("../guardian.js").createGuardian>} guardian
 * @param {{ tipo?: string, q?: string, limit?: number, incluirNaoAtivas?: boolean }} criteria
 * @param {string} origin
 */
export async function searchMemoryIndex(guardian, criteria = {}, origin) {
  const { tipo, q, limit = 10, incluirNaoAtivas = false } = criteria;

  const filter = {};
  if (tipo) filter.tipo = classifyTipo(tipo);
  if (!incluirNaoAtivas) filter.estado = "ativa";

  const records = await guardian.search(
    { collection: MEMORY_COLLECTION, filter, limit: FETCH_BATCH, orderBy: "criadoEm", ascending: false },
    origin,
  );

  const filtered = q ? records.filter((record) => matchesKeyword(record, q)) : records;

  return filtered.slice(0, limit).map(buildImpressaoCognitiva);
}
