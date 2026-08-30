const assert = require("node:assert/strict");
const {test} = require("node:test");

const {
  isEligibleForShiftRotation,
} = require("../lib/shift-eligibility.js");

test("includes active members who are not producers", () => {
  assert.equal(isEligibleForShiftRotation({
    isActive: true,
    roles: ["member"],
    isCommonPurchaseManager: false,
  }), true);
  assert.equal(isEligibleForShiftRotation({
    isActive: true,
    roles: ["member", "admin"],
    isCommonPurchaseManager: false,
  }), true);
});

test("excludes inactive members regardless of their roles", () => {
  assert.equal(isEligibleForShiftRotation({
    isActive: false,
    roles: ["member"],
    isCommonPurchaseManager: false,
  }), false);
  assert.equal(isEligibleForShiftRotation({
    isActive: false,
    roles: ["member", "producer"],
    isCommonPurchaseManager: true,
  }), false);
});

test("excludes real producers without consulting catalog visibility", () => {
  for (const producerCatalogEnabled of [true, false]) {
    assert.equal(isEligibleForShiftRotation({
      isActive: true,
      roles: ["member", "producer"],
      isCommonPurchaseManager: false,
      producerCatalogEnabled,
    }), false);
  }
});

test("includes common purchase managers represented as producers", () => {
  for (const producerCatalogEnabled of [true, false]) {
    assert.equal(isEligibleForShiftRotation({
      isActive: true,
      roles: ["member", "producer"],
      isCommonPurchaseManager: true,
      companyName: "Compras Regüerta",
      producerCatalogEnabled,
    }), true);
  }
  assert.equal(isEligibleForShiftRotation({
    isActive: true,
    roles: ["producer", "member", "PRODUCER"],
    isCommonPurchaseManager: true,
  }), true);
});
