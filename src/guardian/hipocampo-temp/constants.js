/**
 * Constantes do pipeline EXTRACT→FILTER→CLASSIFY (`memory_core.alg` v1.0.0,
 * ARQUITETURA-DA-MEMORIA.md §6). Fixas nesta versão do MVP — não há loop de
 * feedback adaptativo (`memory_core.alg` passo 9 "FEEDBACK") nesta etapa; a
 * calibração automática de η/θ/μ é evolução futura, após evidência
 * suficiente (ARQUITETURA-DA-MEMORIA.md §1.1, "Decisão MVP").
 */

// Peso do Impacto na fórmula Score = R + ηI − μE
export const ETA = 0.5;

// Peso de penalidade da Entropia na fórmula Score = R + ηI − μE
export const MU = 0.5;

// Limiar de descarte (τ) — memory_core.alg §3 "Threshold Rule"
export const THRESHOLD = 0.6;

// Toda memória nasce em Camada 1 nesta versão (ARQUITETURA-DA-MEMORIA.md §3).
// Camadas 2+ (consolidação em segundo plano) não existem ainda.
export const CAMADA_INICIAL = 1;

// Tipo (CLASSIFY) — ARQUITETURA-DA-MEMORIA.md §2. Fixo na escrita.
export const TIPOS_VALIDOS = ["episodica", "arquitetural", "preferencia", "projeto", "contextual"];

// Estado (ciclo de vida) — ARQUITETURA-DA-MEMORIA.md §2. Nesta versão só
// "ativa" e "substituida" são produzidos automaticamente (Replacement
// Policy). "arquivada"/"contraditoria"/"obsoleta"/"em_validacao" existem no
// contrato mas quem decide essas transições ainda não foi definido pelos
// arquitetos (ARQUITETURA-DA-MEMORIA.md §8, item 3) — não implementadas aqui.
export const ESTADOS_VALIDOS = ["ativa", "arquivada", "contraditoria", "obsoleta", "substituida", "em_validacao"];
