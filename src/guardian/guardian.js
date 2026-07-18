import { createSupabaseAdapter } from "./adapters/supabase-adapter.js";
import { GuardianAuditor } from "./audit.js";

/**
 * Guardian: único responsável por toda comunicação física com mecanismos de
 * armazenamento. Executa exclusivamente operações físicas — nunca decide,
 * nunca infere, nunca consolida, nunca reconstrói contexto (isso é do
 * Hipocampo/Context Hub, órgãos diferentes). Fala com o armazenamento real
 * só através de um adapter injetado (`StorageContract` em contracts.js) —
 * nunca conhece tabelas/drivers diretamente.
 *
 * @param {ReturnType<typeof createSupabaseAdapter>} [adapter]
 * @param {GuardianAuditor} [auditor]
 */
export function createGuardian(adapter = createSupabaseAdapter(), auditor = new GuardianAuditor()) {
  async function run(operation, destination, origin, fn) {
    try {
      const result = await fn();
      auditor.record(origin, operation, destination, true);
      return result;
    } catch (error) {
      auditor.record(origin, operation, destination, false, error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  return {
    /** @param {import('./contracts.js').SaveInput} input @param {string} origin */
    save: (input, origin) => run("save", input.collection, origin, () => adapter.save(input)),

    /** @param {import('./contracts.js').UpdateInput} input @param {string} origin */
    update: (input, origin) => run("update", input.collection, origin, () => adapter.update(input)),

    /** @param {import('./contracts.js').DeleteInput} input @param {string} origin */
    delete: (input, origin) => run("delete", input.collection, origin, () => adapter.delete(input)),

    /** @param {import('./contracts.js').GetInput} input @param {string} origin */
    get: (input, origin) => run("get", input.collection, origin, () => adapter.get(input)),

    /** @param {import('./contracts.js').SearchInput} input @param {string} origin */
    search: (input, origin) => run("search", input.collection, origin, () => adapter.search(input)),

    /** @param {import('./contracts.js').CountInput} input @param {string} origin */
    count: (input, origin) => run("count", input.collection, origin, () => adapter.count(input)),

    /** Auditoria recente — só leitura, para diagnóstico. */
    recentAudit: (limit) => auditor.sink.recent(limit),
  };
}
