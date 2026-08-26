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

    /**
     * ADR-012: contagem via `count: "exact", head: true` do Supabase — não
     * traz nenhuma linha, só o total, ao contrário de `search` + `.length`.
     * @param {import('../contracts.js').CountInput} input
     */
    async count({ collection, filter }) {
      let query = supabase.from(collection).select("*", { count: "exact", head: true });
      for (const [column, value] of Object.entries(filter ?? {})) {
        query = query.eq(column, value);
      }

      const { count, error } = await query;
      if (error) throw new Error(error.message ?? "Guardian count failed");
      return count ?? 0;
    },

    /**
     * GENESIS pacote 2026-08-25-foto-storage-retencao-e-memoria-obrigatoria.md
     * (Peça 1): persistência de arquivo em Supabase Storage, ao lado (não em
     * substituição) do contrato de linha relacional acima — mesmo princípio
     * de "toda persistência passa pelo Guardian", estendido para objeto
     * binário. `content` chega e sai sempre como base64, mesmo padrão de
     * `*_data_base64` já usado nas coleções relacionais.
     * @param {import('../contracts.js').SaveFileInput} input
     */
    async saveFile({ bucket, path, content, contentType }) {
      const { error } = await supabase.storage
        .from(bucket)
        .upload(path, Buffer.from(content, "base64"), { contentType, upsert: true });
      if (error) throw new Error(error.message ?? "Guardian saveFile failed");
      return { bucket, path };
    },

    /** @param {import('../contracts.js').GetFileInput} input */
    async getFile({ bucket, path }) {
      const { data, error } = await supabase.storage.from(bucket).download(path);
      if (error) {
        if (String(error.message ?? "").toLowerCase().includes("not found")) return null;
        throw new Error(error.message ?? "Guardian getFile failed");
      }
      const buffer = Buffer.from(await data.arrayBuffer());
      return { bucket, path, content: buffer.toString("base64"), contentType: data.type };
    },

    /** @param {import('../contracts.js').DeleteFileInput} input */
    async deleteFile({ bucket, path }) {
      const { error } = await supabase.storage.from(bucket).remove([path]);
      if (error) throw new Error(error.message ?? "Guardian deleteFile failed");
      return true;
    },
  };
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} environment variable is required for the Guardian's Supabase adapter`);
  return value;
}
