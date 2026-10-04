"use strict";
const assert = require("node:assert/strict");
const {test} = require("node:test");
const {createCoverageTiming, validateCoverageTiming, COVERAGE_DAY_MILLIS: day} =
  require("../lib/shift-coverage-deadlines.js");
const {createCoverageSelection, advanceCoverageSelection, refreshCoverageSelection,
  enterCoverageSelectionPhase, parseCoverageSelectionPolicy} =
  require("../lib/shift-coverage-selection.js");
const policy = {version: "hu089-provisional-v1"};
const opened = Date.parse("2027-03-27T12:00:00Z");
const candidate = (userId, reserve = true) => ({userId, exclusion: null,
  memberDigest: "fixture", reserve: reserve ? {userId, type: "market",
    active: true, enteredAtMillis: 1, revision: 1} : null});
const selection = (days, candidates = [candidate("a"), candidate("b")]) =>
  createCoverageSelection({policy, caseId: "case", candidates,
    openedAtMillis: opened, scheduledAtMillis: opened + days * day});

test("14-day and 5-day boundaries use elapsed days and only sub-five is admin-only", () => {
  for (const [remaining, mode, first] of [
    [14 * day, "normal", 2 * day], [14 * day - 1, "urgent", day],
    [5 * day, "urgent", day], [5 * day - 1, "adminOnly", 5 * day - 1],
    [1, "adminOnly", 1],
  ]) {
    const actual = createCoverageTiming(opened, opened + remaining);
    assert.equal(actual.mode, mode);
    assert.equal(actual.phaseClosesAtMillis, opened + first);
  }
  assert.equal(selection(4).phase, "adminRequired");
  assert.equal(advanceCoverageSelection({selection: selection(4),
    candidates: [candidate("a")], now: opened}).userId, null);
});

test("candidate changes do not renew the whole reserve deadline", () => {
  const candidates = [candidate("a"), candidate("b")];
  const initial = selection(14, candidates);
  const first = advanceCoverageSelection({selection: initial, candidates, now: opened});
  const second = advanceCoverageSelection({selection: first.selection, candidates,
    now: opened + day});
  assert.equal(first.userId, "a");
  assert.equal(second.userId, "b");
  assert.equal(second.selection.timing.phaseClosesAtMillis, opened + 2 * day);
  assert.deepEqual(initial.attemptedUserIds, []);
  const expired = advanceCoverageSelection({selection: second.selection,
    candidates, now: opened + 2 * day});
  assert.equal(expired.userId, null);
  assert.equal(expired.selection.phase, "volunteers");
  assert.equal(expired.selection.volunteerClosesAtMillis, opened + 9 * day);
});

test("early exhaustion advances promptly but never grants a volunteer phase longer than seven days", () => {
  const initial = selection(30, [candidate("a", false)]);
  const next = advanceCoverageSelection({selection: initial,
    candidates: initial.snapshot, now: opened + day});
  assert.equal(next.selection.phase, "volunteers");
  assert.equal(next.selection.volunteerClosesAtMillis, opened + 8 * day);
  assert.equal(next.selection.timing.mode, "normal");
});

test("late workers catch up at old deadlines without losing administrative time", () => {
  const initial = selection(14);
  const volunteers = refreshCoverageSelection(initial, opened + 8 * day);
  assert.equal(volunteers.phase, "volunteers");
  assert.equal(volunteers.timing.phaseStartedAtMillis, opened + 2 * day);
  assert.equal(volunteers.timing.phaseClosesAtMillis, opened + 9 * day);
  const draw = advanceCoverageSelection({selection: initial,
    candidates: initial.snapshot, now: opened + 10 * day});
  assert.equal(draw.selection.phase, "drawRequired");
  assert.equal(draw.userId, null);
  assert.equal(draw.selection.timing.phaseClosesAtMillis, opened + 11 * day);
  const admin = refreshCoverageSelection(initial, opened + 12 * day);
  assert.equal(admin.phase, "adminRequired");
  assert.equal(admin.timing.phaseStartedAtMillis, opened + 11 * day);
  assert.equal(admin.timing.phaseClosesAtMillis, opened + 14 * day);
  assert.deepEqual(refreshCoverageSelection(admin, opened + 20 * day), admin);
});

test("first eligible volunteer can receive an offer before window close; no volunteers keeps it open", () => {
  const candidates = [candidate("a", false), candidate("b", false), candidate("c", false)];
  const initial = enterCoverageSelectionPhase(selection(14, candidates), "volunteers", opened);
  assert.equal(advanceCoverageSelection({selection: initial, candidates, now: opened}).selection.phase,
    "volunteers");
  initial.volunteers = [{userId: "b", receivedAtMillis: opened + 2, withdrawn: false},
    {userId: "a", receivedAtMillis: opened + 1, withdrawn: true},
    {userId: "c", receivedAtMillis: opened + 3, withdrawn: false}];
  const first = advanceCoverageSelection({selection: initial, candidates, now: opened + 4});
  assert.equal(first.userId, "b");
  assert.equal(first.selection.timing.phaseClosesAtMillis, opened + 7 * day);
  const next = advanceCoverageSelection({selection: first.selection, candidates, now: opened + 5});
  assert.equal(next.userId, "c");
  assert.equal(next.selection.timing.phaseClosesAtMillis, opened + 7 * day);
});

test("urgent stages sum to five days and expiry never rerolls a committed draw", () => {
  const initial = selection(5);
  const draw = refreshCoverageSelection(initial, opened + 3 * day);
  assert.equal(draw.phase, "drawRequired");
  assert.equal(draw.timing.phaseClosesAtMillis, opened + 4 * day);
  draw.phase = "draw";
  draw.draw = {order: ["b", "a"], evidence: "immutable test commitment"};
  const expired = refreshCoverageSelection(draw, opened + 4 * day);
  assert.equal(expired.phase, "adminRequired");
  assert.equal(expired.timing.phaseClosesAtMillis, opened + 5 * day);
  assert.deepEqual(expired.draw, draw.draw);
});

test("invalid timing, missing evidence and arbitrary replacement policy are rejected", () => {
  for (const due of [opened, opened - 1, NaN, Infinity]) {
    assert.throws(() => createCoverageTiming(opened, due), {code: "invalid_coverage_timing"});
  }
  const initial = selection(14);
  for (const timing of [undefined, {...initial.timing, mode: "urgent"},
    {...initial.timing, phaseClosesAtMillis: opened + 3 * day}]) {
    assert.throws(() => validateCoverageTiming(timing, "reserve"), {code: "invalid_coverage_timing"});
  }
  assert.throws(() => parseCoverageSelectionPolicy({...policy, volunteerWindowMillis: 1}),
    {code: "coverage_selection_policy_required"});
  assert.throws(() => createCoverageSelection({policy, caseId: "case", candidates: []}),
    {code: "invalid_coverage_timing"});
  assert.throws(() => refreshCoverageSelection(initial, NaN), {code: "invalid_coverage_clock"});
});
