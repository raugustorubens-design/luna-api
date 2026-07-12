import assert from "node:assert/strict";
import test from "node:test";
import { extractSignals } from "../extract.js";
import { computeScore, passesThreshold } from "../filter.js";
import { classifyTipo } from "../classify.js";
import { ETA, MU, THRESHOLD, TIPOS_VALIDOS } from "../constants.js";

test("extractSignals clamps values into [0,1] and defaults missing/invalid signals to 0.5", () => {
  assert.deepEqual(extractSignals({ relevance: 1.5, impact: -0.2, entropy: 0.3 }), { relevance: 1, impact: 0, entropy: 0.3 });
  assert.deepEqual(extractSignals({}), { relevance: 0.5, impact: 0.5, entropy: 0.5 });
  assert.deepEqual(extractSignals(), { relevance: 0.5, impact: 0.5, entropy: 0.5 });
  assert.deepEqual(extractSignals({ relevance: "alta" }), { relevance: 0.5, impact: 0.5, entropy: 0.5 });
});

test("computeScore implements Score = R + eta*I - mu*E exactly", () => {
  const signals = { relevance: 0.8, impact: 0.6, entropy: 0.2 };
  const expected = signals.relevance + ETA * signals.impact - MU * signals.entropy;
  assert.equal(computeScore(signals), expected);
});

test("passesThreshold follows the tau ~= 0.6 rule from memory_core.alg", () => {
  assert.equal(passesThreshold(THRESHOLD), true);
  assert.equal(passesThreshold(THRESHOLD - 0.001), false);
  assert.equal(passesThreshold(1), true);
  assert.equal(passesThreshold(0), false);
});

test("classifyTipo accepts every documented Tipo and rejects unknown values", () => {
  for (const tipo of TIPOS_VALIDOS) {
    assert.equal(classifyTipo(tipo), tipo);
  }
  assert.throws(() => classifyTipo("inexistente"), /Tipo de memória inválido/);
  assert.throws(() => classifyTipo(undefined), /Tipo de memória inválido/);
});
