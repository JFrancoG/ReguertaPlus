const assert = require("node:assert/strict");
const {readFileSync} = require("node:fs");
const {join} = require("node:path");
const {test} = require("node:test");

const projectRoot = join(__dirname, "..");
const readProjectFile = (relativePath) =>
  readFileSync(join(projectRoot, relativePath), "utf8");

test("Firebase Admin runtime uses only modular entrypoints", () => {
  const runtimeFiles = [
    "src/index.ts",
    "src/shift-planning-firebase-notification-transport.ts",
    "scripts/backfill-auth-links.cjs",
    "scripts/backfill-member-directory.cjs",
    "scripts/backfill-notification-inbox.cjs",
    "scripts/backfill-public-versions.cjs",
    "test/order-reminder-scheduler.test.cjs",
  ];

  runtimeFiles.forEach((relativePath) => {
    const source = readProjectFile(relativePath);
    assert.doesNotMatch(source, /["']firebase-admin["']/);
    assert.doesNotMatch(source, /\badmin\.(?:auth|firestore|messaging)\b/);
  });
});

test("multicast dispatch keeps legacy tokens separate from FIDs", () => {
  const source = readProjectFile("src/index.ts");
  const multicastCalls = Array.from(source.matchAll(
    /sendEachForMulticast\(\{([\s\S]*?)\}\);/g,
  ));

  assert.equal(multicastCalls.length, 2);
  assert.match(multicastCalls[0][1], /\btokens:\s*tokenChunk\b/);
  assert.doesNotMatch(multicastCalls[0][1], /\bfids\s*:/);
  assert.match(multicastCalls[1][1], /\bfids:\s*fidChunk\b/);
  assert.doesNotMatch(multicastCalls[1][1], /\btokens\s*:/);

  assert.equal(source.match(/\.get\("fcmToken"\)/g)?.length, 1);
  assert.equal(
    source.match(/\.get\("firebaseInstallationId"\)/g)?.length,
    1,
  );
});
