const assert = require("node:assert/strict");
const {test} = require("node:test");

const {
  buildMemberDirectoryDocument,
} = require("../lib/member-directory.js");

test("member directory exposes operational fields but no private identity", () => {
  const document = buildMemberDirectoryDocument("member-one", {
    displayName: " Test Member ",
    normalizedEmail: "private@example.test",
    phoneNumber: "+34000000000",
    authUid: "secret-auth-uid",
    roles: ["member", "producer"],
    isActive: true,
    companyName: " Test Farm ",
    producerCatalogEnabled: true,
    isCommonPurchaseManager: false,
    producerParity: "odd",
    ecoCommitment: {mode: "biweekly", parity: "even"},
  });

  assert.deepEqual(document, {
    userId: "member-one",
    displayName: "Test Member",
    companyName: "Test Farm",
    roles: ["member", "producer"],
    isActive: true,
    producerCatalogEnabled: true,
    isCommonPurchaseManager: false,
    producerParity: "odd",
    ecoCommitment: {mode: "biweekly", parity: "even"},
  });
  assert.equal(Object.hasOwn(document, "normalizedEmail"), false);
  assert.equal(Object.hasOwn(document, "phoneNumber"), false);
  assert.equal(Object.hasOwn(document, "authUid"), false);
});

test("member directory excludes inactive or malformed members", () => {
  assert.equal(buildMemberDirectoryDocument("inactive", {
    displayName: "Inactive",
    roles: ["member"],
    isActive: false,
  }), null);
  assert.equal(buildMemberDirectoryDocument("missing-name", {
    roles: ["member"],
    isActive: true,
  }), null);
});
