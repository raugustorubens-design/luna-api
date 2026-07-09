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
    from(collection) {
      calls.push(["from", collection]);
      return {
        insert(rows) {
          calls.push(["insert", rows]);
          return { select: () => Promise.resolve(overrides.insertResult ?? { data: rows.map((r) => ({ id: "gen-1", ...r })), error: null }) };
        },
        update(data) {
          calls.push(["update", data]);
          return { eq: (col, val) => ({ select: () => Promise.resolve(overrides.updateResult ?? { data: [{ id: val, ...data }], error: null }) }) };
        },
        delete() {
          calls.push(["delete"]);
          return { eq: (col, val) => Promise.resolve(overrides.deleteResult ?? { error: null }) };
        },
        select(columns) {
          calls.push(["select", columns]);
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
