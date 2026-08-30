const assert = require("node:assert/strict");
const {test} = require("node:test");

const {
  buildDeliveryCalendarOverride,
  createDeliveryCalendarCommandDigest,
  parseDeliveryCalendarMutationContextInput,
  parseDeliveryCalendarMutationInput,
} = require("../lib/delivery-calendar-command.js");

const authority = {
  schemaVersion: 1,
  stateRevision: 7,
  writeEpoch: 3,
  activeRevision: "bundle-2026-27-r1",
  activeDigest: `shift-planning:v1:sha256:${"a".repeat(64)}`,
};

const upsertCommand = {
  schemaVersion: 1,
  environment: "develop",
  operationId: "calendar-2026-W44-tue",
  action: "upsert",
  weekKey: "2026-W44",
  expectedPlanningAuthority: authority,
  expectedOverrideDigest: null,
  deliveryWeekday: "TUE",
};

test("parses the exact context and mutation contracts", () => {
  assert.deepEqual(parseDeliveryCalendarMutationContextInput({
    schemaVersion: 1,
    environment: "production",
    weekKey: "2026-W53",
  }), {
    schemaVersion: 1,
    environment: "production",
    weekKey: "2026-W53",
  });
  assert.deepEqual(
    parseDeliveryCalendarMutationInput(upsertCommand),
    upsertCommand,
  );
  const {deliveryWeekday: _deliveryWeekday, ...deleteCommand} = upsertCommand;
  assert.deepEqual(parseDeliveryCalendarMutationInput({
    ...deleteCommand,
    operationId: "calendar-2026-W44-delete",
    action: "delete",
    expectedOverrideDigest:
      `delivery-calendar:v1:sha256:${"b".repeat(64)}`,
  }), {
    ...deleteCommand,
    operationId: "calendar-2026-W44-delete",
    action: "delete",
    expectedOverrideDigest:
      `delivery-calendar:v1:sha256:${"b".repeat(64)}`,
  });
});

test("rejects extra fields, impossible weeks and invalid action payloads", () => {
  assert.throws(
    () => parseDeliveryCalendarMutationContextInput({
      schemaVersion: 1,
      environment: "develop",
      weekKey: "2026-W54",
    }),
    {code: "invalid_delivery_calendar_command"},
  );
  assert.throws(
    () => parseDeliveryCalendarMutationInput({
      ...upsertCommand,
      updatedBy: "forged-admin",
    }),
    {code: "invalid_delivery_calendar_command"},
  );
  assert.throws(
    () => parseDeliveryCalendarMutationInput({
      ...upsertCommand,
      deliveryWeekday: "WED",
    }),
    {code: "invalid_delivery_calendar_command"},
  );
  assert.throws(
    () => parseDeliveryCalendarMutationInput({
      ...upsertCommand,
      action: "delete",
    }),
    {code: "invalid_delivery_calendar_command"},
  );
});

test("derives canonical Madrid instants across daylight-saving changes", () => {
  assert.deepEqual(buildDeliveryCalendarOverride({
    weekKey: "2026-W44",
    deliveryWeekday: "TUE",
    actorMemberId: "admin-member",
    updatedAtMillis: 1_798_000_000_000,
  }), {
    weekKey: "2026-W44",
    deliveryDateMillis: Date.parse("2026-10-26T23:00:00.000Z"),
    ordersBlockedDateMillis: Date.parse("2026-10-27T23:00:00.000Z"),
    ordersOpenAtMillis: Date.parse("2026-10-28T23:00:00.000Z"),
    ordersCloseAtMillis: Date.parse("2026-11-01T22:59:59.000Z"),
    updatedBy: "admin-member",
    updatedAtMillis: 1_798_000_000_000,
  });
});

test("binds command intent deterministically", () => {
  const first = createDeliveryCalendarCommandDigest(upsertCommand);
  const second = createDeliveryCalendarCommandDigest({...upsertCommand});
  assert.match(first, /^delivery-calendar:v1:sha256:[a-f0-9]{64}$/);
  assert.equal(second, first);
  assert.notEqual(
    createDeliveryCalendarCommandDigest({
      ...upsertCommand,
      operationId: "calendar-2026-W44-thu",
      deliveryWeekday: "THU",
    }),
    first,
  );
});
