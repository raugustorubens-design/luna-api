/**
 * FILTER — memory_core.alg passo 3 / ARQUITETURA-DA-MEMORIA.md §6.
 * Score = R + ηI − μE; descarta se Score < τ.
 */
import { ETA, MU, THRESHOLD } from "./constants.js";

/** @param {{ relevance: number, impact: number, entropy: number }} signals */
export function computeScore({ relevance, impact, entropy }) {
  return relevance + ETA * impact - MU * entropy;
}

/** @param {number} score */
export function passesThreshold(score) {
  return score >= THRESHOLD;
}
