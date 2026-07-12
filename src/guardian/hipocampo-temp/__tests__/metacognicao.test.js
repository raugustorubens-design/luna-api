import assert from "node:assert/strict";
import test from "node:test";
import { avaliarSuficiencia } from "../metacognicao.js";

test("avaliarSuficiencia is always sufficient in this MVP, since only Camada 1 exists", () => {
  const resultado = avaliarSuficiencia();

  assert.equal(resultado.suficiente, true);
  assert.equal(resultado.camadaEntregue, 1);
  assert.match(resultado.motivo, /Camada 1/);
});
