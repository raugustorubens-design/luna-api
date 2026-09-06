import assert from "node:assert/strict";
import test from "node:test";
import { createGuardian } from "../guardian.js";
import { InMemoryAuditSink, GuardianAuditor } from "../audit.js";

function stubAdapter(overrides = {}) {
  const calls = [];
  return {
    calls,
    save: async (input) => {
      calls.push(["save", input]);
      if (overrides.saveError) throw overrides.saveError;
      return { id: "1", ...input.data };
    },
    update: async (input) => {
      calls.push(["update", input]);
      if (overrides.updateError) throw overrides.updateError;
      return overrides.updateResult !== undefined ? overrides.updateResult : { id: input.id, ...input.data };
    },
    delete: async (input) => {
      calls.push(["delete", input]);
      if (overrides.deleteError) throw overrides.deleteError;
      return true;
    },
    get: async (input) => {
      calls.push(["get", input]);
      return overrides.getResult !== undefined ? overrides.getResult : { id: input.id };
    },
    search: async (input) => {
      calls.push(["search", input]);
      return overrides.searchResult ?? [];
    },
    count: async (input) => {
      calls.push(["count", input]);
      if (overrides.countError) throw overrides.countError;
      return overrides.countResult ?? 0;
    },
  };
}

test("guardian.save delegates to the adapter and records a success audit entry", async () => {
  const adapter = stubAdapter();
  const sink = new InMemoryAuditSink();
  const guardian = createGuardian(adapter, new GuardianAuditor(sink));

  const record = await guardian.save({ collection: "memoria_luna", data: { titulo: "t" } }, "memory-engine");

  assert.equal(record.id, "1");
  assert.equal(sink.entries.length, 1);
  assert.deepEqual(sink.entries[0], {
    origin: "memory-engine",
    operation: "save",
    destination: "memoria_luna",
    success: true,
    error: undefined,
    at: sink.entries[0].at,
  });
  assert.match(sink.entries[0].at, /^\d{4}-\d{2}-\d{2}T/);
});

test("guardian.save passes onConflict through untouched — Guardian never inspects/hardcodes column names", async () => {
  const adapter = stubAdapter();
  const guardian = createGuardian(adapter, new GuardianAuditor(new InMemoryAuditSink()));

  await guardian.save({ collection: "convergia_rondas", data: { local_id: "x" }, onConflict: "local_id" }, "convergia-ronda-routes");

  assert.deepEqual(adapter.calls[0], ["save", { collection: "convergia_rondas", data: { local_id: "x" }, onConflict: "local_id" }]);
});

test("guardian.get/search/update/delete/count all delegate and audit under the right operation name", async () => {
  const adapter = stubAdapter({ searchResult: [{ id: "2" }], countResult: 3 });
  const sink = new InMemoryAuditSink();
  const guardian = createGuardian(adapter, new GuardianAuditor(sink));

  await guardian.get({ collection: "memoria_luna", id: "1" }, "memory-engine");
  await guardian.search({ collection: "memoria_luna", filter: { tipo: "checkpoint" } }, "context-hub");
  await guardian.update({ collection: "memoria_luna", id: "1", data: { titulo: "novo" } }, "memory-engine");
  await guardian.delete({ collection: "memoria_luna", id: "1" }, "memory-engine");
  const count = await guardian.count({ collection: "memoria_luna" }, "luna-core.chat");

  assert.equal(count, 3);
  assert.deepEqual(
    sink.entries.map((e) => e.operation),
    ["get", "search", "update", "delete", "count"],
  );
  assert.ok(sink.entries.every((e) => e.success));
});

test("guardian records a failed audit entry and rethrows when the adapter fails", async () => {
  const adapter = stubAdapter({ saveError: new Error("connection refused") });
  const sink = new InMemoryAuditSink();
  const guardian = createGuardian(adapter, new GuardianAuditor(sink));

  await assert.rejects(
    () => guardian.save({ collection: "memoria_luna", data: {} }, "memory-engine"),
    /connection refused/,
  );

  assert.equal(sink.entries.length, 1);
  assert.equal(sink.entries[0].success, false);
  assert.equal(sink.entries[0].error, "connection refused");
});

test("guardian never does anything beyond delegate+audit — no decision/consolidation logic in the module", async () => {
  const source = await import("node:fs/promises").then((fs) => fs.readFile(new URL("../guardian.js", import.meta.url), "utf8"));
  // Matches actual calls/imports, not the module's own Portuguese docstring
  // explaining what it must NOT do (which legitimately contains "infere"/
  // "consolida" as prose).
  assert.doesNotMatch(source, /decideAndConsolidate\(|\binfer\w*\(|\bconsolidat\w*\(/i, "Guardian must never decide/infer/consolidate");
});

test("guardian.recentAudit exposes the audit trail read-only", async () => {
  const adapter = stubAdapter();
  const guardian = createGuardian(adapter);

  await guardian.save({ collection: "memoria_luna", data: {} }, "memory-engine");
  await guardian.get({ collection: "memoria_luna", id: "1" }, "memory-engine");

  const recent = guardian.recentAudit(1);
  assert.equal(recent.length, 1);
  assert.equal(recent[0].operation, "get");
});
