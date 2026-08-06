import assert from "node:assert/strict";
import test from "node:test";
import { buildImpressaoCognitiva, searchMemoryIndex } from "../memory-index.js";
import { MEMORY_COLLECTION } from "../memory-pipeline.js";

function stubGuardian(records) {
  const calls = [];
  return {
    calls,
    search: async (input) => {
      calls.push(input);
      return records;
    },
  };
}

const fullRecord = {
  id: "1",
  tipo: "arquitetural",
  criado_em: "2026-07-12T00:00:00.000Z",
  conteudo: {
    valor: "Este é um registro completo com informação sensível de detalhe interno que não deve vazar.",
    camada: 1,
    estado: "ativa",
    chave: "adr-002",
  },
};

test("buildImpressaoCognitiva never leaks the full conteudo field", () => {
  const impressao = buildImpressaoCognitiva(fullRecord);

  assert.equal(impressao.id, "1");
  assert.equal(impressao.tipo, "arquitetural");
  assert.equal(impressao.camada, 1);
  assert.equal(impressao.estado, "ativa");
  assert.equal(impressao.criadoEm, "2026-07-12T00:00:00.000Z");
  assert.deepEqual(impressao.ref, { collection: MEMORY_COLLECTION, id: "1" });
  assert.ok(!("conteudo" in impressao), "Impressão Cognitiva Inicial must not include the raw conteudo field");
  assert.ok(impressao.resumo.length <= 161);
});

test("buildImpressaoCognitiva prefers an explicit resumo field over truncating conteudo", () => {
  const impressao = buildImpressaoCognitiva({ ...fullRecord, conteudo: { ...fullRecord.conteudo, resumo: "ADR-002 aceito" } });
  assert.equal(impressao.resumo, "ADR-002 aceito");
});

test("searchMemoryIndex defaults to only active memories unless incluirNaoAtivas is set (filtered client-side, estado is not a real column)", async () => {
  const inativo = { ...fullRecord, id: "2", conteudo: { ...fullRecord.conteudo, estado: "substituida" } };
  const guardian = stubGuardian([fullRecord, inativo]);

  const ativos = await searchMemoryIndex(guardian, {}, "test");
  assert.deepEqual(ativos.map((r) => r.id), ["1"]);
  // The storage-side filter must never reference `estado` — it isn't a
  // column on `memoria_luna` and would 400, same root cause as the bug.
  assert.equal(guardian.calls[0].filter.estado, undefined);

  const todos = await searchMemoryIndex(guardian, { incluirNaoAtivas: true }, "test");
  assert.deepEqual(todos.map((r) => r.id).sort(), ["1", "2"]);
});

test("searchMemoryIndex filters by tipo (real column) and validates it against the known Tipo enum", async () => {
  const guardian = stubGuardian([fullRecord]);
  await searchMemoryIndex(guardian, { tipo: "arquitetural" }, "test");
  assert.equal(guardian.calls[0].filter.tipo, "arquitetural");
  assert.equal(guardian.calls[0].orderBy, "criado_em");

  await assert.rejects(() => searchMemoryIndex(guardian, { tipo: "invalido" }, "test"), /Tipo de memória inválido/);
});

test("searchMemoryIndex applies keyword filtering client-side and respects limit", async () => {
  const records = [
    { ...fullRecord, id: "1", conteudo: { ...fullRecord.conteudo, resumo: "prefere dark mode" } },
    { ...fullRecord, id: "2", conteudo: { ...fullRecord.conteudo, resumo: "prefere light mode" } },
    { ...fullRecord, id: "3", conteudo: { ...fullRecord.conteudo, resumo: "gosta de café" } },
  ];
  const guardian = stubGuardian(records);

  const resultados = await searchMemoryIndex(guardian, { q: "mode", limit: 1 }, "test");

  assert.equal(resultados.length, 1);
  assert.equal(resultados[0].id, "1");
});
