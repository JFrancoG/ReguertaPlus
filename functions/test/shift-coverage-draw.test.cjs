"use strict";
const assert = require("node:assert/strict");
const {test} = require("node:test");
const {generateKeyPairSync, sign} = require("node:crypto");
const {commitCoverageDraw, revealCoverageDraw, parseCoverageBeaconPolicy} = require("../lib/shift-coverage-draw.js");
const {createShiftPlanningDigest: digest} = require("../lib/shift-planning-digest.js");
const {publicKey, privateKey} = generateKeyPairSync("ed25519");
const policy = {sourceId: "local-test", publicKeyPem: publicKey.export({format: "pem", type: "spki"}),
  genesisMillis: 1000, periodMillis: 1000};
const candidates = ["a", "b", "c", "d"].map((userId) => ({userId, memberDigest: digest(userId),
  exclusion: userId === "d" ? "same_type_claim" : null, reserve: null}));
const commit = (extra = {}) => commitCoverageDraw({caseId: "case", selectionDigest: digest("selection"),
  assignmentContextDigest: digest("neighbors"), candidates, policy, now: 1999, ...extra});
const signed = (draw, extra = {}, key = privateKey) => {
  const payload = {domain: "hu084-local-beacon-v1", sourceId: draw.beacon.sourceId,
    round: draw.round, publishedAtMillis: draw.availableAtMillis, randomness: "ab".repeat(32), ...extra};
  return {...payload, signatureHex: sign(null, Buffer.from(digest(payload)), key).toString("hex")};
};

test("commit binds a canonical pool and a strictly future round; trusted policy requires a valid signing key", () => {
  const first = commit();
  assert.deepEqual(commit({candidates: [...candidates].reverse()}), first);
  assert.equal(first.availableAtMillis, 3000);
  assert.equal(first.order, null);
  assert.ok(first.availableAtMillis - first.committedAtMillis >= policy.periodMillis);
  assert.throws(() => commit({candidates: [...candidates, candidates[0]]}), {code: "coverage_draw_duplicate_candidate"});
  for (const bad of [undefined, {...policy, periodMillis: 0}, {...policy, publicKeyPem: "bad-key"},
    {...policy, genesisMillis: -1}]) assert.throws(() => parseCoverageBeaconPolicy(bad));
  const publicOnly = parseCoverageBeaconPolicy({...policy,
    publicKeyPem: privateKey.export({format: "pem", type: "pkcs8"})});
  assert.equal(publicOnly.publicKeyPem, policy.publicKeyPem);
  assert.equal(publicOnly.publicKeyPem.includes("PRIVATE KEY"), false);
});

test("authenticated reveal produces a reproducible permutation excluding ineligible members", () => {
  const draw = commit(), value = signed(draw);
  const first = revealCoverageDraw({draw, value, now: draw.availableAtMillis});
  assert.deepEqual(revealCoverageDraw({draw, value, now: draw.availableAtMillis + 1}), first);
  assert.deepEqual(new Set(first.order), new Set(["a", "b", "c"]));
  assert.equal(first.commitmentDigest, draw.commitmentDigest);
  assert.deepEqual(first.evidence, value);
  assert.equal(draw.order, null);
  assert.throws(() => revealCoverageDraw({draw: first, value, now: draw.availableAtMillis}),
    {code: "coverage_draw_already_revealed_or_changed"});
});

test("early reveal, altered commitments and evidence from another round or key fail closed", () => {
  const draw = commit(), value = signed(draw), now = draw.availableAtMillis;
  assert.throws(() => revealCoverageDraw({draw, value, now: now - 1}), {code: "coverage_entropy_not_available"});
  for (const patch of [{candidates: candidates.slice(0, 1)}, {caseId: "replacement"}, {round: draw.round + 1}]) {
    assert.throws(() => revealCoverageDraw({draw: {...draw, ...patch}, value, now}),
      {code: "coverage_draw_already_revealed_or_changed"});
  }
  for (const patch of [{sourceId: "other"}, {round: draw.round + 1}, {publishedAtMillis: now - 1}]) {
    assert.throws(() => revealCoverageDraw({draw, value: signed(draw, patch), now}),
      {code: "coverage_beacon_evidence_invalid"});
  }
  assert.throws(() => revealCoverageDraw({draw, value: {...value, randomness: "cd".repeat(32)}, now}),
    {code: "coverage_beacon_signature_invalid"});
  const foreign = generateKeyPairSync("ed25519");
  assert.throws(() => revealCoverageDraw({draw, value: signed(draw, {}, foreign.privateKey), now}),
    {code: "coverage_beacon_signature_invalid"});
});
