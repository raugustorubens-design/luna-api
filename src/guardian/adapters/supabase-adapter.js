import { createClient } from "@supabase/supabase-js";

/**
 * Único módulo do Guardian autorizado a conhecer o driver real de
 * armazenamento. O Guardian (guardian.js) nunca importa `@supabase/supabase-js`
 * diretamente — só fala com este adapter através do contrato genérico
 * save/update/delete/get/search. Trocar Supabase por Postgres/Redis/Qdrant/
 * Neo4j/MinIO no futuro significa escrever um novo adapter, não tocar
 * guardian.js.
 *
 * Mesmas variáveis de ambiente que o Memory Engine do monorepo `luna` já usa
 * (`SUPABASE_URL`, `SUPABASE_KEY`) — não uma convenção nova.
 */
export function createSupabaseAdapter(client) {
  const supabase =
    client ??
    createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_KEY"));

  return {
    /** @param {import('../contracts.js').SaveInput} input */
    async save({ collection, data }) {
      const { data: rows, error } = await supabase.from(collection).insert([data]).select();
      if (error) throw new Error(error.message ?? "Guardian save failed");
      return rows?.[0] ?? null;
    },

    /** @param {import('../contracts.js').UpdateInput} input */
    async update({ collection, id, data }) {
      const { data: rows, error } = await supabase.from(collection).update(data).eq("id", id).select();
      if (error) throw new Error(error.message ?? "Guardian update failed");
      return rows?.[0] ?? null;
    },

    /** @param {import('../contracts.js').DeleteInput} input */
    async delete({ collection, id }) {
      const { error } = await supabase.from(collection).delete().eq("id", id);
      if (error) throw new Error(error.message ?? "Guardian delete failed");
      return true;
    },

    /** @param {import('../contracts.js').GetInput} input */
    async get({ collection, id }) {
      const { data: rows, error } = await supabase.from(collection).select("*").eq("id", id).limit(1);
      if (error) throw new Error(error.message ?? "Guardian get failed");
      return rows?.[0] ?? null;
    },

    /** @param {import('../contracts.js').SearchInput} input */
    async search({ collection, filter, limit = 10, orderBy, ascending = false }) {
      let query = supabase.from(collection).select("*");
      for (const [column, value] of Object.entries(filter ?? {})) {
        query = query.eq(column, value);
      }
      if (orderBy) query = query.order(orderBy, { ascending });
      query = query.limit(limit);

      const { data: rows, error } = await query;
      if (error) throw new Error(error.message ?? "Guardian search failed");
      return rows ?? [];
    },
  };
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} environment variable is required for the Guardian's Supabase adapter`);
  return value;
}
