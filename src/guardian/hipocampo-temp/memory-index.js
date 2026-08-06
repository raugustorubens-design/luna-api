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

// `camada`/`estado`/`resumo`/`chave` are not real `memoria_luna` columns —
// they live inside `conteudo` (jsonb), same convention `memory-pipeline.js`
// writes them with. See the comment at the top of that file.
function summarize(record) {
  const conteudo = record.conteudo ?? {};
  if (conteudo.resumo) return String(conteudo.resumo);
  const original = conteudo.original;
  if (typeof original === "string") {
    return original.length > RESUMO_MAX_LENGTH ? `${original.slice(0, RESUMO_MAX_LENGTH)}…` : original;
  }
  const serialized = JSON.stringify(original ?? {});
  return serialized.length > RESUMO_MAX_LENGTH ? `${serialized.slice(0, RESUMO_MAX_LENGTH)}…` : serialized;
}

/** Impressão Cognitiva Inicial — nunca inclui o `conteudo` completo. */
export function buildImpressaoCognitiva(record) {
  const conteudo = record.conteudo ?? {};
  return {
    id: record.id,
    tipo: record.tipo,
    resumo: summarize(record),
    camada: conteudo.camada,
    estado: conteudo.estado,
    criadoEm: record.criado_em,
    ref: { collection: MEMORY_COLLECTION, id: record.id },
  };
}

function matchesKeyword(record, q) {
  const needle = q.toLowerCase();
  const chave = record.conteudo?.chave ?? "";
  return summarize(record).toLowerCase().includes(needle) || chave.toLowerCase().includes(needle);
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

  const records = await guardian.search(
    { collection: MEMORY_COLLECTION, filter, limit: FETCH_BATCH, orderBy: "criado_em", ascending: false },
    origin,
  );

  // `estado` isn't a real column (see summarize() comment above) — filtered
  // client-side after fetch, same as the keyword filter below.
  const ativas = incluirNaoAtivas ? records : records.filter((record) => record.conteudo?.estado === "ativa");
  const filtered = q ? ativas.filter((record) => matchesKeyword(record, q)) : ativas;

  return filtered.slice(0, limit).map(buildImpressaoCognitiva);
}
