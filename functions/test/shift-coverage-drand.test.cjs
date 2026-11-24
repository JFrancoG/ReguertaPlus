"use strict";
const assert = require("node:assert/strict");
const {test} = require("node:test");
const {createHash} = require("node:crypto");
const {DRAND_QUICKNET: policy, drandCoverageRoundTime, fetchDrandCoverageEvidence} =
  require("../lib/shift-coverage-drand.js");
const {commitCoverageDraw, revealCoverageDraw, parseCoverageBeaconPolicy} = require("../lib/shift-coverage-draw.js");
const {createShiftPlanningDigest: digest} = require("../lib/shift-planning-digest.js");
// https://api.drand.sh/52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971/public/1000000
const wire = require("./fixtures/shift-coverage-drand-quicknet.json");
const url = "https://api.drand.sh/" + policy.chainHash + "/public/1000000";
const availableAtMillis = 1695803364000;
const candidates = ["a", "b", "c", "d"].map((userId) => ({userId, memberDigest: digest(userId),
  exclusion: userId === "d" ? "same_type_claim" : null, reserve: null}));
const commit = (now = availableAtMillis - 300_000) => commitCoverageDraw({caseId: "case",
  selectionDigest: digest("selection"), assignmentContextDigest: digest("neighbors"), candidates, policy, now});
const response = (value) => async () => Response.json(value);

test("Quicknet round 1 is genesis and only the pinned chain, key, scheme and schedule are accepted", () => {
  assert.equal(drandCoverageRoundTime(1), policy.genesisMillis);
  assert.equal(drandCoverageRoundTime(wire.round), availableAtMillis);
  assert.equal(commit().round, wire.round);
  assert.equal(commit(availableAtMillis - 299_999).round, wire.round + 1);
  assert.equal(commit(availableAtMillis - 300_001).round, wire.round);
  for (const patch of [{publicKeyHex: "00".repeat(96)}, {genesisMillis: 1}, {periodMillis: 1},
    {chainHash: "00".repeat(32)}, {scheme: "other"}, {sourceId: "other"}, {endpoint: "https://example.invalid"}]) {
    assert.throws(() => parseCoverageBeaconPolicy({...policy, ...patch}), {code: "coverage_beacon_policy_required"});
  }
});

test("the archived public Quicknet vector authenticates the committed round and reproduces the exact order offline", async () => {
  const draw = commit();
  const evidence = await fetchDrandCoverageEvidence(draw, async (target, options) => {
    assert.equal(target, url);
    assert.equal(options.redirect, "error");
    assert.ok(options.signal instanceof AbortSignal);
    return Response.json(wire);
  });
  assert.equal(draw.commitmentDigest, "shift-planning:v1:sha256:a21abd32daaa2e2bf34ccf37856daa866131f5b35675520629d7969f5212f218");
  assert.deepEqual(evidence, {domain: "drand-quicknet-v1", sourceId: policy.sourceId, publishedAtMillis: availableAtMillis,
    round: wire.round, randomness: wire.randomness, signatureHex: wire.signature});
  assert.throws(() => revealCoverageDraw({draw, value: evidence, now: availableAtMillis - 1}),
    {code: "coverage_entropy_not_available"});
  const first = revealCoverageDraw({draw, value: evidence, now: availableAtMillis});
  assert.deepEqual(first.order, ["a", "c", "b"]);
  assert.deepEqual(revealCoverageDraw({draw: JSON.parse(JSON.stringify(draw)), value: first.evidence,
    now: availableAtMillis + 24 * 3_600_000}), first);
  assert.throws(() => revealCoverageDraw({draw, value: {...evidence, domain: "hu084-local-beacon-v1"},
    now: availableAtMillis}), {code: "coverage_beacon_evidence_invalid"});
});

test("wrong round, altered randomness or a correctly hashed signature for another round cannot enter the draw", async () => {
  const draw = commit();
  await assert.rejects(fetchDrandCoverageEvidence(draw, response({...wire, round: wire.round + 1})),
    {code: "coverage_beacon_evidence_invalid"});
  await assert.rejects(fetchDrandCoverageEvidence(draw, response({...wire, randomness: "00".repeat(32)})),
    {code: "coverage_beacon_signature_invalid"});
  const otherRound = commit(availableAtMillis - 299_999);
  await assert.rejects(fetchDrandCoverageEvidence(otherRound, response({...wire, round: otherRound.round})),
    {code: "coverage_beacon_signature_invalid"});
  const evidence = await fetchDrandCoverageEvidence(draw, response(wire));
  const badSignature = "ff".repeat(48);
  assert.throws(() => revealCoverageDraw({draw, value: {...evidence, signatureHex: badSignature,
    randomness: createHash("sha256").update(Buffer.from(badSignature, "hex")).digest("hex")},
  now: availableAtMillis}), {code: "coverage_beacon_signature_invalid"});
});

test("HTTP errors, interrupted responses and malformed or oversized relay bodies return bounded failure codes", async () => {
  const draw = commit();
  for (const fetcher of [async () => { throw new Error("relay unavailable"); },
    async () => new Response(null, {status: 503}),
    async () => new Response(new ReadableStream({pull(controller) { controller.error(Error("aborted")); }}))]) {
    await assert.rejects(fetchDrandCoverageEvidence(draw, fetcher), {code: "coverage_beacon_unavailable"});
  }
  for (const body of ["not JSON", JSON.stringify(wire) + " ".repeat(2048)]) {
    await assert.rejects(fetchDrandCoverageEvidence(draw, async () => new Response(body)),
      {code: "coverage_beacon_evidence_invalid"});
  }
});
