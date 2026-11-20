"use strict";

// This must be the first project entry loaded by the attended desktop host.
// Third-party clients may already exist. A cached first-party module could be
// older than the file whose digest the sealed operator will verify on disk.
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const functionsRoot = path.resolve(__dirname, "..");
const sha256 = bytes => crypto.createHash("sha256").update(bytes).digest("hex");

function readPinned(file, expected) {
  assert.match(expected, /^[0-9a-f]{64}$/);
  assert.ok(fs.lstatSync(file).isFile(), "Reviewed regular file required");
  const bytes = fs.readFileSync(file);
  assert.equal(sha256(bytes), expected, "Desktop startup source mismatch");
  return bytes;
}

function openFreshDevelopDesktop({preparationDirectory, startupSha256, desktopEntry, desktopSha256}) {
  assert.ok(path.isAbsolute(preparationDirectory) && path.isAbsolute(desktopEntry));
  const preparation = fs.realpathSync(preparationDirectory);
  const desktop = fs.realpathSync(desktopEntry);
  const root = fs.realpathSync(functionsRoot);
  const hasPriorModules = Object.keys(require.cache).some(file => {
    if (file === __filename) return false;
    const local = path.relative(root, file);
    const inFunctions = !local.startsWith(".." + path.sep) && !path.isAbsolute(local);
    return (inFunctions && !local.split(path.sep).includes("node_modules")) ||
      file.startsWith(preparation + path.sep) || file === desktop;
  });
  assert.equal(hasPriorModules, false, "Develop desktop requires a fresh module runtime before consent");

  const seal = JSON.parse(readPinned(path.join(preparation, "startup-integrity-private.json"), startupSha256));
  assert.equal(seal.kind, "develop-outer-startup-integrity");
  assert.equal(seal.checkBeforeRequire, true);
  for (const required of ["attempt.cjs", "operator.cjs"]) assert.ok(Object.hasOwn(seal.files, required));
  for (const [name, expected] of Object.entries(seal.files)) {
    assert.equal(path.basename(name), name);
    readPinned(path.join(preparation, name), expected);
  }
  readPinned(desktop, desktopSha256);
  const attempt = require(path.join(preparation, "attempt.cjs"));
  const pins = attempt.requireOperationalReview();
  for (const key of ["receiptId", "packageDigest", "preparedDigest", "operationId"]) {
    assert.equal(pins[key], seal[key], "Desktop seal and operation must match");
  }
  const review = JSON.parse(readPinned(attempt.sourceReviewFile, seal.sourceReviewSha256));
  assert.equal(fs.realpathSync(path.join(review.repoRoot, "functions")), root);
  // The sealed coordinator verifies the selected source files, their inventory
  // and evidence before it loads its execution dependencies.
  require(path.join(preparation, "operator.cjs"));
  const {loadManifest, prepareDevelopMigrationPackage} = require("./prepare-develop-migration-package.cjs");
  const packetFile = name => path.join(attempt.packetDirectory, name);
  const rebuilt = prepareDevelopMigrationPackage(loadManifest(packetFile("manifest-private.json")));
  assert.equal(rebuilt.packageDigest, pins.packageDigest, "Rebuilt desktop package differs from the reviewed operation");
  assert.deepEqual(rebuilt, JSON.parse(fs.readFileSync(packetFile("review-package-private.json"))));
  const entry = require(desktop);
  assert.equal(typeof entry.prepareDesktopStart, "function");
  let opened = false;
  return {
    receiptId: pins.receiptId, operationId: pins.operationId, packageDigest: pins.packageDigest,
    sourceFilesChecked: Object.keys(review.entries).length,
    async prepareDesktopStart(inputs) {
      assert.equal(opened, false, "Desktop start already requested");
      opened = true;
      return entry.prepareDesktopStart(inputs);
    },
  };
}

module.exports = {openFreshDevelopDesktop};
