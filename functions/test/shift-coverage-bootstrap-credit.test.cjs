"use strict";
const assert = require("node:assert/strict");
const {test} = require("node:test");
const {planZeroShiftCoverageCredits} = require("../lib/shift-coverage-bootstrap-credit.js");
const {createShiftPlanningDigest: digest} = require("../lib/shift-planning-digest.js");
const empty = () => ({credits: [], claims: [], ledgers: []});
const credit = (state = "consumed", patch = {}) => ({schemaVersion: 1,
  policyRevision: "hu084-provisional-v1", id: "historical-case", caseId: "historical-case",
  shiftId: "historical-shift", type: "delivery", userId: "member", state,
  earnedAtMillis: 100, completionRevision: 1,
  ...(state === "consumed" ? {consumedByPlanId: "past-plan", consumedAtMillis: 200} : {}),
  ...(state === "cancelled" ? {cancelledByMembershipOperationId: "past-departure", cancelledAtMillis: 200} : {}),
  ...patch});
const row = (data, id = data.id) => ({id, data});
const claim = (value, state = "released") => ({
  id: digest([value.type, value.userId]).split(":").at(-1),
  data: {type: value.type, userId: value.userId, caseId: value.id, state,
    ...(state !== "released" ? {} : value.state === "consumed" ?
      {consumedByPlanId: value.consumedByPlanId, consumedAtMillis: value.consumedAtMillis} :
      {cancelledByMembershipOperationId: value.cancelledByMembershipOperationId,
        cancelledAtMillis: value.cancelledAtMillis})},
});
const historical = (value = credit()) => ({credits: [row(value)], claims: [claim(value)],
  ledgers: [{id: value.type, data: {revision: 4}}]});
const codes = (result) => result.blockers.map((blocker) => blocker.code);

test("explicit zero with no history creates only the two missing ledger generations", () => {
  assert.deepEqual(planZeroShiftCoverageCredits(empty()), {blockers: [], creates: [
    {collection: "shiftCoverageLedgerState", id: "delivery", data: {revision: 0}},
    {collection: "shiftCoverageLedgerState", id: "market", data: {revision: 0}},
  ]});
});

test("valid consumed and cancelled history is preserved without credit or claim writes", () => {
  const consumed = credit(), cancelled = credit("cancelled", {
    id: "cancelled-case", caseId: "cancelled-case", type: "market", userId: "other-member"});
  const source = {credits: [row(consumed), row(cancelled)], claims: [claim(consumed), claim(cancelled)],
    ledgers: [{id: "delivery", data: {revision: 4}}, {id: "market", data: {revision: 3}}]};
  const original = structuredClone(source);
  assert.deepEqual(planZeroShiftCoverageCredits(source), {blockers: [], creates: []});
  assert.deepEqual(source, original);
});

test("existing empty zero ledgers are no-ops rather than rewritten generations", () => {
  assert.deepEqual(planZeroShiftCoverageCredits({...empty(), ledgers:
    ["delivery", "market"].map((id) => ({id, data: {revision: 0}}))}), {blockers: [], creates: []});
});

test("pending compensation and its active claim block zero declaration without cancellation", () => {
  const value = credit("pending"), source = {credits: [row(value)], claims: [claim(value, "creditPending")],
    ledgers: [{id: "delivery", data: {revision: 1}}]};
  const original = structuredClone(source), result = planZeroShiftCoverageCredits(source);
  assert.deepEqual(new Set(codes(result)), new Set([
    "bootstrap_credit_pending_conflicts_with_zero", "bootstrap_credit_active_claim_conflicts_with_zero"]));
  assert.deepEqual(result.creates, []); assert.deepEqual(source, original);
});

test("an accepted unfinished coverage blocks zero even without an earned credit", () => {
  const value = credit("pending"), result = planZeroShiftCoverageCredits({...empty(), claims: [claim(value, "accepted")]});
  assert.deepEqual(codes(result), ["bootstrap_credit_active_claim_conflicts_with_zero"]);
  assert.deepEqual(result.creates, []);
});

test("history without a ledger cannot invent a generation from row counts", () => {
  for (const state of ["consumed", "cancelled"]) {
    const source = historical(credit(state)); source.ledgers = [];
    const result = planZeroShiftCoverageCredits(source);
    assert.deepEqual(codes(result), ["bootstrap_credit_history_generation_missing"]);
    assert.deepEqual(result.creates, []);
  }
});

test("historical rows need not retain every old claim because the member slot is reusable", () => {
  const source = historical(); source.claims = [];
  assert.deepEqual(planZeroShiftCoverageCredits(source), {blockers: [], creates: [
    {collection: "shiftCoverageLedgerState", id: "market", data: {revision: 0}},
  ]});
});

test("document and claim identities cannot be adopted from unrelated paths", () => {
  for (const mutate of [
    (source) => { source.credits[0].id = "different-document"; },
    (source) => { source.claims[0].id = "different-member-hash"; },
    (source) => { source.ledgers[0].id = "unrecognized-type"; },
  ]) {
    const source = historical(); mutate(source);
    const result = planZeroShiftCoverageCredits(source);
    assert.ok(result.blockers.length > 0); assert.deepEqual(result.creates, []);
  }
});

test("released claims require the exact corresponding consumed or cancelled evidence", () => {
  for (const mutate of [
    (source) => { source.credits = []; },
    (source) => { source.claims[0].data.consumedAtMillis++; },
    (source) => { source.claims[0].data.consumedByPlanId = "different-plan"; },
    (source) => { source.claims[0].data.cancelledAtMillis = 200; },
  ]) {
    const source = historical(); mutate(source);
    const result = planZeroShiftCoverageCredits(source);
    assert.ok(codes(result).includes("bootstrap_credit_claim_invalid"));
    assert.deepEqual(result.creates, []);
  }
});

test("duplicate source rows are blockers even when their payloads are equal", () => {
  for (const collection of ["credits", "claims", "ledgers"]) {
    const source = historical(); source[collection].push(structuredClone(source[collection][0]));
    const result = planZeroShiftCoverageCredits(source);
    assert.ok(codes(result).includes("bootstrap_credit_duplicate_source"));
    assert.deepEqual(result.creates, []);
  }
});

test("malformed, exhausted or zero historical generations never yield partial initialization", () => {
  for (const value of [{revision: -1}, {revision: 0}, {revision: 1, inferred: true},
    {revision: Number.MAX_SAFE_INTEGER - 1}, {revision: NaN}]) {
    const source = historical(); source.ledgers[0].data = value;
    const result = planZeroShiftCoverageCredits(source);
    assert.ok(result.blockers.length > 0); assert.deepEqual(result.creates, []);
  }
  const source = historical(); source.credits[0].data.policyRevision = "unapproved-policy";
  assert.deepEqual(planZeroShiftCoverageCredits(source).creates, []);
});

test("source enumeration cannot change the bootstrap proposal or its blocker order", () => {
  const source = historical(); source.credits.push(row(credit("pending", {
    id: "pending-case", caseId: "pending-case", type: "market", userId: "other-member"})));
  const reversed = Object.fromEntries(Object.entries(source).map(([key, values]) => [key, [...values].reverse()]));
  assert.deepEqual(planZeroShiftCoverageCredits(source), planZeroShiftCoverageCredits(reversed));
});
