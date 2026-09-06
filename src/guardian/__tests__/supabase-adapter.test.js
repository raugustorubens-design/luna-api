import assert from "node:assert/strict";
import test from "node:test";
import { createSupabaseAdapter } from "../adapters/supabase-adapter.js";

function fakeSupabaseClient(overrides = {}) {
  const calls = [];
  const terminal = (result) => ({
    select: () => terminal(result),
    eq(column, value) {
      calls.push(["eq", column, value]);
      return terminal(result);
    },
    order(column, options) {
      calls.push(["order", column, options]);
      return terminal(result);
    },
    limit(n) {
      calls.push(["limit", n]);
      return Promise.resolve(result);
    },
    then: (resolve) => resolve(result),
  });

  return {
    calls,
    storage: {
      from(bucket) {
        calls.push(["storage.from", bucket]);
        return {
          upload(path, buffer, options) {
            calls.push(["upload", path, options]);
            return Promise.resolve(overrides.uploadResult ?? { data: { path }, error: null });
          },
          download(path) {
            calls.push(["download", path]);
            return Promise.resolve(
              overrides.downloadResult ?? {
                data: { type: "image/jpeg", arrayBuffer: () => Promise.resolve(new TextEncoder().encode("abc").buffer) },
                error: null,
              },
            );
          },
          remove(paths) {
            calls.push(["remove", paths]);
            return Promise.resolve(overrides.removeResult ?? { data: paths, error: null });
          },
        };
      },
    },
    from(collection) {
      calls.push(["from", collection]);
      return {
        insert(rows) {
          calls.push(["insert", rows]);
          return { select: () => Promise.resolve(overrides.insertResult ?? { data: rows.map((r) => ({ id: "gen-1", ...r })), error: null }) };
        },
        upsert(rows, options) {
          calls.push(["upsert", rows, options]);
          return { select: () => Promise.resolve(overrides.upsertResult ?? { data: rows.map((r) => ({ id: "gen-1", ...r })), error: null }) };
        },
        update(data) {
          calls.push(["update", data]);
          return { eq: (col, val) => ({ select: () => Promise.resolve(overrides.updateResult ?? { data: [{ id: val, ...data }], error: null }) }) };
        },
        delete() {
          calls.push(["delete"]);
          return { eq: (col, val) => Promise.resolve(overrides.deleteResult ?? { error: null }) };
        },
        select(columns, options) {
          calls.push(["select", columns, options]);
          if (options?.count === "exact" && options?.head) {
            return terminal(overrides.countResult ?? { count: 0, error: null });
          }
          return terminal(overrides.selectResult ?? { data: [], error: null });
        },
      };
    },
  };
}

test("supabase adapter save inserts a row and returns it", async () => {
  const client = fakeSupabaseClient();
  const adapter = createSupabaseAdapter(client);

  const record = await adapter.save({ collection: "memoria_luna", data: { titulo: "t" } });

  assert.equal(record.id, "gen-1");
  assert.deepEqual(client.calls[0], ["from", "memoria_luna"]);
});

test("supabase adapter save throws on error instead of swallowing it", async () => {
  const client = fakeSupabaseClient({ insertResult: { data: null, error: { message: "insert failed" } } });
  const adapter = createSupabaseAdapter(client);

  await assert.rejects(() => adapter.save({ collection: "memoria_luna", data: {} }), /insert failed/);
});

test("supabase adapter save upserts on the given column when onConflict is provided (idempotência, pacote 110)", async () => {
  const client = fakeSupabaseClient();
  const adapter = createSupabaseAdapter(client);

  const record = await adapter.save({ collection: "convergia_rondas", data: { local_id: "local-1" }, onConflict: "local_id" });

  assert.equal(record.id, "gen-1");
  assert.deepEqual(client.calls[0], ["from", "convergia_rondas"]);
  assert.deepEqual(client.calls[1], ["upsert", [{ local_id: "local-1" }], { onConflict: "local_id", ignoreDuplicates: true }]);
});

test("supabase adapter save returns null when the upsert hits an existing conflicting row (ON CONFLICT DO NOTHING)", async () => {
  const client = fakeSupabaseClient({ upsertResult: { data: [], error: null } });
  const adapter = createSupabaseAdapter(client);

  const record = await adapter.save({ collection: "convergia_rondas", data: { local_id: "local-1" }, onConflict: "local_id" });

  assert.equal(record, null, "linha já existe com o mesmo local_id — nenhuma nova linha, nenhuma sobrescrita");
});

test("supabase adapter save throws on error during upsert instead of swallowing it", async () => {
  const client = fakeSupabaseClient({ upsertResult: { data: null, error: { message: "upsert failed" } } });
  const adapter = createSupabaseAdapter(client);

  await assert.rejects(() => adapter.save({ collection: "convergia_rondas", data: {}, onConflict: "local_id" }), /upsert failed/);
});

test("supabase adapter get filters by id and returns the first row", async () => {
  const client = fakeSupabaseClient({ selectResult: { data: [{ id: "1", titulo: "found" }], error: null } });
  const adapter = createSupabaseAdapter(client);

  const record = await adapter.get({ collection: "memoria_luna", id: "1" });

  assert.equal(record.titulo, "found");
});

test("supabase adapter get returns null when nothing matches", async () => {
  const client = fakeSupabaseClient({ selectResult: { data: [], error: null } });
  const adapter = createSupabaseAdapter(client);

  const record = await adapter.get({ collection: "memoria_luna", id: "missing" });

  assert.equal(record, null);
});

test("supabase adapter delete succeeds and returns true", async () => {
  const client = fakeSupabaseClient();
  const adapter = createSupabaseAdapter(client);

  const result = await adapter.delete({ collection: "memoria_luna", id: "1" });

  assert.equal(result, true);
});

test("supabase adapter count uses a real count query (exact, head: true), not fetch-all", async () => {
  const client = fakeSupabaseClient({ countResult: { count: 7, error: null } });
  const adapter = createSupabaseAdapter(client);

  const count = await adapter.count({ collection: "messages" });

  assert.equal(count, 7);
  assert.deepEqual(client.calls[0], ["from", "messages"]);
  assert.deepEqual(client.calls[1], ["select", "*", { count: "exact", head: true }]);
});

test("supabase adapter count applies equality filters before counting", async () => {
  const client = fakeSupabaseClient({ countResult: { count: 2, error: null } });
  const adapter = createSupabaseAdapter(client);

  await adapter.count({ collection: "messages", filter: { conversation_id: "abc" } });

  assert.deepEqual(
    client.calls.filter((c) => c[0] === "eq"),
    [["eq", "conversation_id", "abc"]],
  );
});

test("supabase adapter count throws on error instead of swallowing it", async () => {
  const client = fakeSupabaseClient({ countResult: { count: null, error: { message: "count failed" } } });
  const adapter = createSupabaseAdapter(client);

  await assert.rejects(() => adapter.count({ collection: "messages" }), /count failed/);
});

test("supabase adapter saveFile uploads base64 content to the given bucket/path", async () => {
  const client = fakeSupabaseClient();
  const adapter = createSupabaseAdapter(client);

  const result = await adapter.saveFile({
    bucket: "ronda-fotos",
    path: "rfoto_1/campo.jpg",
    content: Buffer.from("hello").toString("base64"),
    contentType: "image/jpeg",
  });

  assert.deepEqual(result, { bucket: "ronda-fotos", path: "rfoto_1/campo.jpg" });
  assert.deepEqual(client.calls[0], ["storage.from", "ronda-fotos"]);
  assert.equal(client.calls[1][0], "upload");
  assert.equal(client.calls[1][1], "rfoto_1/campo.jpg");
});

test("supabase adapter getFile downloads and returns base64 content", async () => {
  const client = fakeSupabaseClient();
  const adapter = createSupabaseAdapter(client);

  const result = await adapter.getFile({ bucket: "ronda-fotos", path: "rfoto_1/campo.jpg" });

  assert.equal(result.contentType, "image/jpeg");
  assert.equal(Buffer.from(result.content, "base64").toString(), "abc");
});

test("supabase adapter getFile returns null when the object is not found", async () => {
  const client = fakeSupabaseClient({ downloadResult: { data: null, error: { message: "Object not found" } } });
  const adapter = createSupabaseAdapter(client);

  const result = await adapter.getFile({ bucket: "ronda-fotos", path: "missing.jpg" });

  assert.equal(result, null);
});

test("supabase adapter deleteFile removes the object and returns true", async () => {
  const client = fakeSupabaseClient();
  const adapter = createSupabaseAdapter(client);

  const result = await adapter.deleteFile({ bucket: "ronda-fotos", path: "rfoto_1/campo.jpg" });

  assert.equal(result, true);
  assert.deepEqual(client.calls[client.calls.length - 1], ["remove", ["rfoto_1/campo.jpg"]]);
});
