import assert from "node:assert/strict";
import test from "node:test";
import { createMemoryPipeline, MEMORY_COLLECTION } from "../memory-pipeline.js";
import { MemoryDecisionAuditor } from "../memory-audit.js";
import { THRESHOLD } from "../constants.js";

function stubGuardian(overrides = {}) {
  const calls = [];
  let nextId = 1;
  return {
    calls,
    save: async (input) => {
      calls.push(["save", input]);
      return { id: String(nextId++), collection: input.collection, ...input.data };
    },
    update: async (input) => {
      calls.push(["update", input]);
      return { id: input.id, ...input.data };
    },
    search: async () => {
      calls.push(["search"]);
      return overrides.searchResult ?? [];
    },
  };
}

const highSignals = { relevance: 0.9, impact: 0.9, entropy: 0 };
const lowSignals = { relevance: 0.1, impact: 0, entropy: 1 };

test("discards a candidate whose score is below the threshold, without touching storage", async () => {
  const guardian = stubGuardian();
  const pipeline = createMemoryPipeline(guardian);

  const result = await pipeline.write({ tipo: "episodica", conteudo: "irrelevante", signals: lowSignals }, "test");

  assert.equal(result.status, "descartado");
  assert.ok(result.score < THRESHOLD);
  assert.deepEqual(guardian.calls, []);
});

test("rejects a candidate with an invalid Tipo before touching storage", async () => {
  const guardian = stubGuardian();
  const pipeline = createMemoryPipeline(guardian);

  await assert.rejects(
    () => pipeline.write({ tipo: "nao-existe", conteudo: "x", signals: highSignals }, "test"),
    /Tipo de memória inválido/,
  );
  assert.deepEqual(guardian.calls, []);
});

test("rejects a candidate without conteudo", async () => {
  const guardian = stubGuardian();
  const pipeline = createMemoryPipeline(guardian);

  await assert.rejects(() => pipeline.write({ tipo: "episodica", signals: highSignals }, "test"), /conteudo é obrigatório/);
});

test("persists a high-signal candidate in Camada 1, Estado ativa", async () => {
  const guardian = stubGuardian();
  const pipeline = createMemoryPipeline(guardian);

  const result = await pipeline.write({ tipo: "preferencia", conteudo: "usa dark mode", signals: highSignals }, "forge");

  assert.equal(result.status, "persistido");
  assert.equal(result.record.camada, 1);
  assert.equal(result.record.estado, "ativa");
  assert.equal(result.record.tipo, "preferencia");
  assert.equal(guardian.calls[0][0], "save");
  assert.equal(guardian.calls[0][1].collection, MEMORY_COLLECTION);
});

test("replacement policy: a new high-signal memory with the same chave replaces (marks substituida) the old one", async () => {
  const guardian = stubGuardian({ searchResult: [{ id: "old-1", chave: "tema-x", estado: "ativa" }] });
  const pipeline = createMemoryPipeline(guardian);

  const result = await pipeline.write({ tipo: "preferencia", conteudo: "prefere dark mode agora", chave: "tema-x", signals: highSignals }, "forge");

  assert.equal(result.status, "substituido");
  assert.equal(result.substituiu, "old-1");
  const updateCall = guardian.calls.find(([op]) => op === "update");
  assert.ok(updateCall);
  assert.equal(updateCall[1].id, "old-1");
  assert.equal(updateCall[1].data.estado, "substituida");
});

test("does not replace anything when no existing active memory shares the chave", async () => {
  const guardian = stubGuardian({ searchResult: [] });
  const pipeline = createMemoryPipeline(guardian);

  const result = await pipeline.write({ tipo: "projeto", conteudo: "novo projeto", chave: "projeto-y", signals: highSignals }, "forge");

  assert.equal(result.status, "persistido");
  assert.equal(result.substituiu, null);
});

test("records a decision audit entry for every outcome (descartado/rejeitado/persistido/substituido)", async () => {
  const auditor = new MemoryDecisionAuditor();
  const guardian = stubGuardian();
  const pipeline = createMemoryPipeline(guardian, auditor);

  await pipeline.write({ tipo: "episodica", conteudo: "baixo sinal", signals: lowSignals }, "test");
  await pipeline.write({ tipo: "episodica", conteudo: "alto sinal", signals: highSignals }, "test");

  const decisions = auditor.recent().map((entry) => entry.decisao);
  assert.deepEqual(decisions, ["descartado", "persistido"]);
});
