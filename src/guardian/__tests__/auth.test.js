import assert from "node:assert/strict";
import test from "node:test";
import { requireGuardianToken } from "../auth.js";

function mockRes() {
  return {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

test("rejects with 503 when no secret is configured -- fail-closed, never open by omission", () => {
  const middleware = requireGuardianToken(undefined);
  const res = mockRes();
  let nextCalled = false;

  middleware({ headers: {} }, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 503);
});

test("rejects with 401 when no Authorization header is sent", () => {
  const middleware = requireGuardianToken("segredo-de-teste");
  const res = mockRes();
  let nextCalled = false;

  middleware({ headers: {} }, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 401);
});

test("rejects with 401 when the token does not match", () => {
  const middleware = requireGuardianToken("segredo-de-teste");
  const res = mockRes();
  let nextCalled = false;

  middleware({ headers: { authorization: "Bearer token-errado" } }, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 401);
});

test("rejects tokens of different length without throwing (timingSafeEqual guard)", () => {
  const middleware = requireGuardianToken("segredo-longo-de-verdade");
  const res = mockRes();
  let nextCalled = false;

  assert.doesNotThrow(() => {
    middleware({ headers: { authorization: "Bearer curto" } }, res, () => {
      nextCalled = true;
    });
  });
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 401);
});

test("calls next() when the token matches exactly", () => {
  const middleware = requireGuardianToken("segredo-de-teste");
  const res = mockRes();
  let nextCalled = false;

  middleware({ headers: { authorization: "Bearer segredo-de-teste" } }, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, null);
});

test("ignores a malformed Authorization header (missing Bearer prefix)", () => {
  const middleware = requireGuardianToken("segredo-de-teste");
  const res = mockRes();
  let nextCalled = false;

  middleware({ headers: { authorization: "segredo-de-teste" } }, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 401);
});

test("reads GUARDIAN_SHARED_SECRET from the environment by default", () => {
  const previous = process.env.GUARDIAN_SHARED_SECRET;
  process.env.GUARDIAN_SHARED_SECRET = "do-ambiente";
  try {
    const middleware = requireGuardianToken();
    const res = mockRes();
    let nextCalled = false;
    middleware({ headers: { authorization: "Bearer do-ambiente" } }, res, () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, true);
  } finally {
    if (previous === undefined) delete process.env.GUARDIAN_SHARED_SECRET;
    else process.env.GUARDIAN_SHARED_SECRET = previous;
  }
});
