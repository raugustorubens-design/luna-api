/**
 * Auditoria do Guardian: registra origem, operação, horário e destino de
 * toda operação física de armazenamento. Mesmo formato (sink injetável,
 * in-memory por padrão) já usado pelo Gateway no monorepo `luna`
 * (`src/gateway/audit/audit.ts`, `GatewayAuditor`/`InMemoryAuditSink`) —
 * reaproveitado aqui como padrão, não uma tabela nova inventada sem
 * necessidade.
 */

export class InMemoryAuditSink {
  constructor() {
    /** @type {import('./contracts.js').AuditEntry[]} */
    this.entries = [];
  }

  /** @param {import('./contracts.js').AuditEntry} entry */
  record(entry) {
    this.entries.push(entry);
  }

  recent(limit = 50) {
    return this.entries.slice(-limit);
  }
}

export class GuardianAuditor {
  constructor(sink = new InMemoryAuditSink()) {
    this.sink = sink;
  }

  /**
   * @param {string} origin
   * @param {import('./contracts.js').AuditEntry["operation"]} operation
   * @param {string} destination
   * @param {boolean} success
   * @param {string} [error]
   */
  record(origin, operation, destination, success, error) {
    this.sink.record({
      origin,
      operation,
      destination,
      success,
      error,
      at: new Date().toISOString(),
    });
  }
}
