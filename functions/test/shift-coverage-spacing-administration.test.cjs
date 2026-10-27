"use strict";
const assert = require("node:assert/strict");
const {test} = require("node:test");
const {deliverySpacingConflicts, validateDeliverySpacing} = require("../lib/shift-delivery-spacing.js");
const {createShiftPlanningDigest: digest} = require("../lib/shift-planning-digest.js");

test("administrative diagnostics enumerate every short ordinary cross-round pair without granting approval", () => {
  const source = {version: "hu089-delivery-spacing-v1", authorityDigest: digest("authority"), exceptions: [], history: [
    {shiftId: "first", userId: "ana", date: "2026-08-05", roundNumber: 1},
    {shiftId: "recent", userId: "ana", date: "2026-09-02", roundNumber: 2},
    {shiftId: "other", userId: "eva", date: "2026-09-09", roundNumber: 1},
  ]};
  const input = {planningRequestId: "bundle", source, shifts: [
    {date: "2026-10-07", rotationOwnerUserId: "ana", roundNumber: 3},
    {date: "2026-10-14", rotationOwnerUserId: "eva", roundNumber: 1},
    {date: "2026-11-11", rotationOwnerUserId: "ana", roundNumber: 3},
  ]};
  const before = structuredClone(input);
  assert.deepEqual(deliverySpacingConflicts(input), [
    {userId: "ana", previousDate: "2026-09-02", previousRoundNumber: 2, date: "2026-10-07", roundNumber: 3},
    {userId: "ana", previousDate: "2026-08-05", previousRoundNumber: 1, date: "2026-10-07", roundNumber: 3},
  ]);
  assert.throws(() => validateDeliverySpacing(input), {code: "delivery_spacing_conflict"});
  assert.deepEqual(input, before);
});

test("diagnostics reject duplicate dates rather than approving a conflicting public projection", () => {
  const source = {version: "hu089-delivery-spacing-v1", authorityDigest: digest("authority"), exceptions: [], history: [
    {shiftId: "existing", userId: "ana", date: "2026-09-02", roundNumber: 1},
  ]};
  assert.throws(() => deliverySpacingConflicts({source,
    shifts: [{date: "2026-09-02", rotationOwnerUserId: "eva", roundNumber: 2}]}),
  {code: "invalid_delivery_spacing_source"});
});
