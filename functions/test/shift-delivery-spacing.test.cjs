"use strict";
const assert = require("node:assert/strict");
const {test} = require("node:test");
const {planDeliveryShifts} = require("../lib/delivery-shift-planner.js");
const {parseDeliverySpacingSource, validateDeliverySpacing} = require("../lib/shift-delivery-spacing.js");
const {createShiftPlanningDigest: digest} = require("../lib/shift-planning-digest.js");

const planningRequestId = "spacing-season-2026";
const authorityDigest = digest({activeRevision: "published-before-spacing", revision: 7});
const source = (history = [], exceptions = []) => ({version: "hu089-delivery-spacing-v1",
  authorityDigest, history, exceptions});
const cursor = (count = 10, roundNumber = 1, nextMemberIndex = 0) => ({schemaVersion: 1,
  type: "delivery", cohortUserIds: Array.from({length: count}, (_, index) => `member-${index}`),
  roundNumber, nextMemberIndex});
const input = (count = 10, ordinarySpacing = source()) => ({planningRequestId,
  targetSeasonStartYear: 2026, deliveryWeekday: "WED", rotation: cursor(count),
  continuity: {kind: "newRotation"}, ordinarySpacing});
const history = (date = "2026-09-02", userId = "member-0", roundNumber = 1, shiftId = "prior-ordinary") =>
  ({shiftId, date, userId, roundNumber});
const shift = (date = "2026-11-04", rotationOwnerUserId = "member-0", roundNumber = 2) =>
  ({date, rotationOwnerUserId, roundNumber});
const exception = (extra = {}) => ({id: "force-majeure-1", operationId: "authorize-empty-slot",
  planningRequestId, userId: "member-0", previousDate: "2026-09-02", previousRoundNumber: 1,
  date: "2026-11-04", roundNumber: 2, reason: "Avoid an unstaffed ordinary delivery",
  approvedByUserId: "admin", approvedAtMillis: 1_780_000_000_000,
  authorityDigest, authorized: true, ...extra});
const validate = (shifts, value = source()) => validateDeliverySpacing({planningRequestId, shifts, source: value});
// Independent fixture calendar: no production calendar or rotation helper is used.
const dateAt = (week) => new Date(Date.UTC(2026, 8, 2 + 7 * week)).toISOString().slice(0, 10);
const assertUnmovedQueue = (plan, count, physicalCount) => {
  assert.equal(plan.shifts.length, physicalCount);
  for (let index = 0; index < physicalCount; index++) {
    const row = plan.shifts[index];
    assert.equal(row.date, dateAt(index));
    assert.deepEqual(row.assignedUserIds, [`member-${index % count}`]);
    assert.equal(row.rotationOwnerUserId, `member-${index % count}`);
    assert.equal(row.roundNumber, Math.floor(index / count) + 1);
    assert.equal(row.positionInRound, index % count + 1);
    assert.equal(row.helperUserId, index + 1 < physicalCount ? `member-${(index + 1) % count}` : null);
  }
  assert.equal(plan.generatedTargetShiftCount, 52);
  assert.equal(plan.nextRotation.nextMemberIndex, 0);
  assert.equal(plan.nextRotation.roundNumber, physicalCount / count + 1);
};

test("ten ordinary weekly owners meet the exact minimum without moving dates, queue positions or helper succession", () => {
  const value = input();
  const before = structuredClone(value);
  const plan = planDeliveryShifts(value);
  assertUnmovedQueue(plan, 10, 60);
  assert.equal(plan.shifts[0].date, "2026-09-02");
  assert.equal(plan.shifts[10].date, "2026-11-11");
  assert.deepEqual(plan.spacingEvidence, {source: source(), appliedExceptionIds: []});
  assert.deepEqual(value, before);
});

test("nine owners require an exact exception for every short cross-round pair, preserving the original staffed calendar", () => {
  const value = input(9);
  assert.throws(() => planDeliveryShifts(value), {code: "delivery_spacing_conflict"});
  const exceptions = Array.from({length: 45}, (_, offset) => {
    const index = offset + 9;
    return exception({id: `force-majeure-${index}`, operationId: `authorize-${index}`,
      userId: `member-${index % 9}`, previousDate: dateAt(index - 9),
      previousRoundNumber: Math.floor((index - 9) / 9) + 1,
      date: dateAt(index), roundNumber: Math.floor(index / 9) + 1});
  });
  assert.throws(() => planDeliveryShifts({...value, ordinarySpacing: source([], exceptions.slice(0, 1))}),
    {code: "delivery_spacing_conflict"});
  const authorized = {...value, ordinarySpacing: source([], exceptions)};
  const before = structuredClone(authorized);
  const plan = planDeliveryShifts(authorized);
  assertUnmovedQueue(plan, 9, 54);
  assert.equal(plan.shifts[9].date, "2026-11-04");
  assert.deepEqual([...plan.spacingEvidence.appliedExceptionIds].sort(), exceptions.map((row) => row.id).sort());
  assert.deepEqual(plan.spacingEvidence.source, authorized.ordinarySpacing);
  assert.deepEqual(authorized, before);
});

test("the minimum counts seventy calendar days across both Madrid daylight-saving changes", () => {
  for (const [prior, short, exact] of [["2026-09-02", "2026-11-10", "2026-11-11"],
    ["2027-02-03", "2027-04-13", "2027-04-14"]]) {
    const evidence = source([history(prior)]);
    const before = structuredClone(evidence);
    assert.throws(() => validate([shift(short)], evidence), {code: "delivery_spacing_conflict"});
    assert.deepEqual(validate([shift(exact)], evidence), []);
    assert.deepEqual(evidence, before);
  }
});

test("same-round ordinary positions are outside the cross-round restriction", () => {
  assert.deepEqual(validate([shift("2026-09-09", "member-0", 1)], source([history()])), []);
});

test("append consults the previous season's ordinary owner beyond the immediate predecessor", () => {
  const ordinarySpacing = source([history("2026-08-19", "member-0", 7),
    history("2026-08-26", "member-9", 7, "immediate-predecessor")]);
  const value = {...input(10, ordinarySpacing), rotation: cursor(10, 8), continuity: {
    kind: "persistedAppend", predecessor: {shiftId: "immediate-predecessor", scheduledDate: "2026-08-26",
      effectiveLeadUserId: "member-9", completion: {state: "uncompleted", assignmentRevision: 4,
        completionRevision: 0, plannedHelperUserId: "member-0"}}}};
  const before = structuredClone(value);
  assert.throws(() => planDeliveryShifts(value), {code: "delivery_spacing_conflict"});
  const receipt = exception({previousDate: "2026-08-19", previousRoundNumber: 7,
    date: "2026-09-02", roundNumber: 8});
  const plan = planDeliveryShifts({...value, ordinarySpacing: source(ordinarySpacing.history, [receipt])});
  assert.equal(plan.shifts[0].date, "2026-09-02");
  assert.equal(plan.shifts[0].rotationOwnerUserId, "member-0");
  assert.equal(plan.predecessorHelperUpdate, null);
  assert.deepEqual(plan.spacingEvidence.appliedExceptionIds, [receipt.id]);
  assert.deepEqual(value, before);
});

test("inherited published dates stay intact while the first newly generated lead remains guarded", () => {
  const dates = ["2026-09-02", "2026-09-09", "2026-09-16", "2026-09-23", "2026-09-30", "2026-10-07"];
  const published = dates.map((date, index) => history(date, `member-${index}`, 2, `published-${index}`));
  const value = {...input(10, source([...published, history("2026-08-06", "member-6", 1)])),
    rotation: cursor(10, 2, 6), inheritedTargetPrefix: {dates, positions: dates.map((_, index) => ({
      rotationOwnerUserId: `member-${index}`, roundNumber: 2, positionInRound: index + 1})),
    rotationBeforePrefix: cursor(10, 2), lineageRevision: "published-prefix", lineageDigest: authorityDigest},
    continuity: {kind: "persistedAppend", predecessor: {shiftId: "published-5", scheduledDate: "2026-10-07",
      effectiveLeadUserId: "member-5", completion: {state: "uncompleted", assignmentRevision: 4,
        completionRevision: 0, plannedHelperUserId: "member-6"}}}};
  const before = structuredClone(value);
  assert.throws(() => planDeliveryShifts(value), {code: "delivery_spacing_conflict"});
  value.ordinarySpacing.history.at(-1).date = "2026-08-05";
  const plan = planDeliveryShifts(value);
  assert.equal(plan.shifts[0].date, "2026-10-14");
  assert.equal(plan.shifts[0].rotationOwnerUserId, "member-6");
  assert.equal(plan.shifts.some((row) => dates.includes(row.date)), false);
  assert.deepEqual(value.inheritedTargetPrefix, before.inheritedTargetPrefix);
  assert.deepEqual(plan.spacingEvidence.appliedExceptionIds, []);
});

test("a credit can compress ordinary dates below ten weeks even in a ten-owner cohort", () => {
  const value = input();
  assert.equal(planDeliveryShifts(value).shifts[10].date, "2026-11-11");
  value.provisionalCredits = {frozenThroughRound: 0, credits: [{schemaVersion: 1,
    policyRevision: "hu084-provisional-v1", id: "credit-member-9", caseId: "credit-member-9",
    shiftId: "covered-extra", userId: "member-9", type: "delivery", state: "pending",
    earnedAtMillis: 1, completionRevision: 1}]};
  const before = structuredClone(value);
  assert.throws(() => planDeliveryShifts(value), {code: "delivery_spacing_conflict"});
  assert.deepEqual(value, before);
});

test("force majeure never waives adjacent lead/helper incompatibility", () => {
  const value = {...input(10, source([history("2026-08-26", "member-0", 1)], [exception({
    previousDate: "2026-08-26", previousRoundNumber: 1, date: "2026-09-02", roundNumber: 2})])),
  rotation: cursor(10, 2), continuity: {kind: "persistedAppend", predecessor: {
    shiftId: "prior-ordinary", scheduledDate: "2026-08-26", effectiveLeadUserId: "member-0",
    completion: {state: "uncompleted", assignmentRevision: 4, completionRevision: 0,
      plannedHelperUserId: "member-0"}}}};
  assert.throws(() => planDeliveryShifts(value), {code: "adjacent_delivery_lead_conflict"});
});

test("spacing sources reject unknown fields, malformed dates and duplicated immutable evidence", () => {
  const valid = source([history()], [exception()]);
  assert.deepEqual(parseDeliverySpacingSource(valid), valid);
  const invalid = [{...valid, enabled: true}, {...valid, version: "future-policy"},
    {...valid, authorityDigest: "chosen-authority"},
    source([{...history(), date: "2026-02-30"}]), source([history(), history()]),
    source([], [exception({reason: " "})]), source([], [exception({approvedAtMillis: -1})]),
    source([], [exception({previousRoundNumber: 2})]), source([], [exception({previousDate: "2026-11-04"})]),
    source([], [exception(), exception({operationId: "other-operation"})]),
    source([], [exception(), exception({id: "other-receipt", operationId: "other-operation"})]),
    source([], [exception({overrideEveryConflict: true})])];
  for (const value of invalid) assert.throws(() => parseDeliverySpacingSource(value),
    {code: "invalid_delivery_spacing_source"});
});

test("exceptions bind current authority, administrator availability, request and exact short pair", () => {
  const prior = [history()];
  const upcoming = [shift()];
  const receipt = exception();
  assert.deepEqual(validate(upcoming, source(prior, [receipt])), [receipt.id]);
  for (const changed of [{authorized: false}, {authorityDigest: digest("different-published-authority")}]) {
    assert.throws(() => validate(upcoming, source(prior, [exception(changed)])),
      {code: "delivery_spacing_exception_unavailable"});
  }
  assert.throws(() => validate(upcoming, source(prior, [exception({planningRequestId: "another-request"})])),
    {code: "delivery_spacing_conflict"});
  assert.throws(() => validate([shift("2026-11-11")], source(prior, [receipt])),
    {code: "delivery_spacing_exception_unused"});
  assert.deepEqual(validate([shift("2026-11-11")], source(prior, [exception({planningRequestId: "another-request"})])), []);
});

test("an appended rotation cannot replace its required historical source with an empty new-rotation snapshot", () => {
  const value = {...input(), rotation: cursor(10, 2), continuity: {kind: "persistedAppend", predecessor: {
    shiftId: "predecessor", scheduledDate: "2026-08-26", effectiveLeadUserId: "member-9",
    completion: {state: "uncompleted", assignmentRevision: 1, completionRevision: 0,
      plannedHelperUserId: "member-0"}}}};
  assert.throws(() => planDeliveryShifts(value), {code: "delivery_spacing_history_required"});
});
