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
  camada: 1,
  estado: "ativa",
  conteudo: "Este é um registro completo com informação sensível de detalhe interno que não deve vazar.",
  criadoEm: "2026-07-12T00:00:00.000Z",
  chave: "adr-002",
};

test("buildImpressaoCognitiva never leaks the full conteudo field", () => {
  const impressao = buildImpressaoCognitiva(fullRecord);

  assert.equal(impressao.id, "1");
  assert.equal(impressao.tipo, "arquitetural");
  assert.equal(impressao.camada, 1);
  assert.equal(impressao.estado, "ativa");
  assert.deepEqual(impressao.ref, { collection: MEMORY_COLLECTION, id: "1" });
  assert.ok(!("conteudo" in impressao), "Impressão Cognitiva Inicial must not include the raw conteudo field");
  assert.ok(impressao.resumo.length <= 161);
});

test("buildImpressaoCognitiva prefers an explicit resumo field over truncating conteudo", () => {
  const impressao = buildImpressaoCognitiva({ ...fullRecord, resumo: "ADR-002 aceito" });
  assert.equal(impressao.resumo, "ADR-002 aceito");
});

test("searchMemoryIndex defaults to only active memories unless incluirNaoAtivas is set", async () => {
  const guardian = stubGuardian([fullRecord]);
  await searchMemoryIndex(guardian, {}, "test");

  assert.equal(guardian.calls[0].filter.estado, "ativa");
});

test("searchMemoryIndex filters by tipo and validates it against the known Tipo enum", async () => {
  const guardian = stubGuardian([fullRecord]);
  await searchMemoryIndex(guardian, { tipo: "arquitetural" }, "test");
  assert.equal(guardian.calls[0].filter.tipo, "arquitetural");

  await assert.rejects(() => searchMemoryIndex(guardian, { tipo: "invalido" }, "test"), /Tipo de memória inválido/);
});

test("searchMemoryIndex applies keyword filtering client-side and respects limit", async () => {
  const records = [
    { ...fullRecord, id: "1", resumo: "prefere dark mode" },
    { ...fullRecord, id: "2", resumo: "prefere light mode" },
    { ...fullRecord, id: "3", resumo: "gosta de café" },
  ];
  const guardian = stubGuardian(records);

  const resultados = await searchMemoryIndex(guardian, { q: "mode", limit: 1 }, "test");

  assert.equal(resultados.length, 1);
  assert.equal(resultados[0].id, "1");
});
