/**
 * CLASSIFY — memory_core.alg passo 4 / ARQUITETURA-DA-MEMORIA.md §2.
 * Atribui o Tipo (dimensão fixa, definida na escrita). Não decide Estado nem
 * Maturação — cada dimensão é independente (ARQUITETURA-DA-MEMORIA.md §2).
 */
import { TIPOS_VALIDOS } from "./constants.js";

/**
 * @param {string} tipo
 * @returns {string} o próprio tipo, se válido
 * @throws {Error} se o tipo não estiver entre os valores reconhecidos
 */
export function classifyTipo(tipo) {
  if (!TIPOS_VALIDOS.includes(tipo)) {
    throw new Error(`Tipo de memória inválido: "${tipo}". Valores aceitos: ${TIPOS_VALIDOS.join(", ")}`);
  }
  return tipo;
}
