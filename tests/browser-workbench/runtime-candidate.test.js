import assert from "node:assert/strict";
import test from "node:test";

import { CandidateLoadError, loadProductCandidate } from "../../apps/browser-workbench/src/runtime-candidate.js";

test("candidate service failure is bounded and retry-oriented", async () => {
  const error = await loadProductCandidate(async () => { throw new TypeError("private socket path"); }).catch((failure) => failure);
  assert.ok(error instanceof CandidateLoadError);
  assert.equal(error.code, "CANDIDATE_SERVICE_UNAVAILABLE");
  assert.match(error.message, /retry/i);
  assert.doesNotMatch(error.message, /private socket path/i);
});

test("malformed candidate response never exposes parser internals", async () => {
  const error = await loadProductCandidate(async () => ({
    ok: true,
    json: async () => { throw new SyntaxError("Unexpected token < in JSON at position 0"); },
  })).catch((failure) => failure);
  assert.ok(error instanceof CandidateLoadError);
  assert.equal(error.code, "CANDIDATE_RESPONSE_UNREADABLE");
  assert.match(error.message, /No review data was accepted/);
  assert.doesNotMatch(error.message, /Unexpected token|JSON/i);
});
