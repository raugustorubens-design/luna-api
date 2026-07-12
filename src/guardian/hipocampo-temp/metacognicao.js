/**
 * Metacognição — Passo 2 (suficiência), ARQUITETURA-DA-MEMORIA.md §4 e §5.
 *
 * "Compreendi corretamente o que o usuário precisa?" (Passo 1) e a regra de
 * não-interrogação são responsabilidade do Hipocampo/Gateway (fora deste
 * repositório) — o Guardian só participa do Passo 2 ("a informação já
 * disponível atende completamente à necessidade?").
 *
 * Nesta versão do MVP só existe Camada 1 (ARQUITETURA-DA-MEMORIA.md §3) —
 * não há Camadas 2+ para aprofundar. Por isso a avaliação de suficiência é
 * sempre positiva: não é uma decisão real do sistema, é uma consequência de
 * só existir uma camada. Quando Camadas 2+ existirem, esta função deixa de
 * ser trivial e passa a decidir se deve aprofundar (ARQUITETURA-DA-MEMORIA.md
 * §5, "Metacognição — Passo 2: informação suficiente? (não) aprofunda mais
 * uma camada").
 *
 * @param {{ camadaMaximaDisponivel?: number }} [params]
 */
export function avaliarSuficiencia({ camadaMaximaDisponivel = 1 } = {}) {
  return {
    suficiente: true,
    camadaEntregue: camadaMaximaDisponivel,
    motivo:
      "Apenas Camada 1 (Impressão Cognitiva) existe nesta versão do Guardian; " +
      "não há Camadas 2+ para avaliar aprofundamento. Contrato de aprofundamento " +
      "reservado para uma versão futura (ver POST /guardian/memory/deepen).",
  };
}
