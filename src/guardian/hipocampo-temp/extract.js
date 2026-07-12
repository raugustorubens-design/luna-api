/**
 * EXTRACT — memory_core.alg passo 2. Extrai/normaliza os sinais estruturados
 * de uma memória candidata. Nesta versão do MVP o organismo ainda não tem um
 * extrator cognitivo automático (isso dependeria de um modelo de linguagem,
 * fora do escopo do Guardian) — o chamador (Gateway/Hipocampo, hoje ainda
 * fora deste repositório) fornece os sinais já estimados; EXTRACT garante
 * que estejam presentes e dentro do intervalo válido (0–1), aplicando um
 * default neutro quando ausentes.
 */

const DEFAULT_SIGNAL = 0.5;

function clamp01(value) {
  if (typeof value !== "number" || Number.isNaN(value)) return DEFAULT_SIGNAL;
  return Math.min(1, Math.max(0, value));
}

/**
 * @param {{ relevance?: number, impact?: number, entropy?: number }} [signals]
 * @returns {{ relevance: number, impact: number, entropy: number }}
 */
export function extractSignals(signals = {}) {
  return {
    relevance: clamp01(signals.relevance),
    impact: clamp01(signals.impact),
    entropy: clamp01(signals.entropy),
  };
}
