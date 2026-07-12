import { InMemoryAuditSink } from "../audit.js";

/**
 * Auditoria de decisão do pipeline de memória. Mais rica que o
 * `GuardianAuditor` genérico do Guardian (que audita operações físicas de
 * armazenamento) — esta audita a decisão cognitiva-mínima do pipeline:
 * sinais extraídos, score, tipo e status de validação, conforme exigido em
 * ARQUITETURA-DA-MEMORIA.md §1.1 ("Auditoria de cada operação (input,
 * sinais extraídos, score, decisão, tipo, status de validação)").
 *
 * Reaproveita `InMemoryAuditSink` (mesmo padrão já usado pelo Guardian e
 * pelo Gateway no monorepo `luna`) em vez de inventar um mecanismo de
 * sink novo.
 */
export class MemoryDecisionAuditor {
  constructor(sink = new InMemoryAuditSink()) {
    this.sink = sink;
  }

  /**
   * @param {{ origin: string, tipo?: string, signals?: object, score: number,
   *   decisao: "persistido"|"substituido"|"descartado"|"rejeitado",
   *   statusValidacao: string, chave?: string }} entry
   */
  record(entry) {
    this.sink.record({ ...entry, at: new Date().toISOString() });
  }

  recent(limit) {
    return this.sink.recent(limit);
  }
}
