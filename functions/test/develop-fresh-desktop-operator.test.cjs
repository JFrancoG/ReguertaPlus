"use strict";
const assert = require("node:assert/strict");
const {execFileSync} = require("node:child_process");
const {createHash} = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const {fixture} = require("./develop-migration-package-fixture.cjs");
const {prepareDevelopMigrationPackage} = require("../scripts/prepare-develop-migration-package.cjs");
const loaderFile = require.resolve("../scripts/develop-fresh-desktop-operator.cjs");
const sha = text => createHash("sha256").update(text).digest("hex");

test("a retained Develop module rejects before even opening the desktop review", () => {
  // The test worker has loaded the packet builder and its first-party imports.
  const {openFreshDevelopDesktop} = require(loaderFile);
  assert.throws(() => openFreshDevelopDesktop({preparationDirectory: __dirname, desktopEntry: __filename}),
    /requires a fresh module runtime before consent/);
});

test("a cold desktop reconstructs the sealed packet before exposing its one-shot entry", t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "develop-desktop-"));
  t.after(() => fs.rmSync(dir, {recursive: true, force: true}));
  function write(name, value) {
    const bytes = typeof value === "string" ? value : JSON.stringify(value);
    const file = path.join(dir, name);
    fs.writeFileSync(file, bytes, {flag: "wx"});
    return {path: file, sha256: sha(bytes)};
  }
  const input = fixture();
  const packet = prepareDevelopMigrationPackage(input);
  const {reviewedContentDigest, reviewedProposalDigest, ...data} = input;
  const files = Object.fromEntries(Object.entries(data).map(([key, value]) => [key, write(key + ".json", value)]));
  write("manifest-private.json", {reviewedContentDigest, reviewedProposalDigest, files});
  write("review-package-private.json", packet);
  const source = write("review.json", {repoRoot: path.resolve(__dirname, "../.."), entries: {}});
  const pins = {receiptId: "demo-receipt", operationId: "demo-operation", preparedDigest: "demo-prepared", packageDigest: packet.packageDigest};
  const attempt = write("attempt.cjs",
    `module.exports = {packetDirectory: __dirname, sourceReviewFile: ${JSON.stringify(source.path)}, requireOperationalReview: () => (${JSON.stringify(pins)})};`);
  const operator = write("operator.cjs", "module.exports = {};");
  const desktop = write("desktop.cjs", "module.exports = {prepareDesktopStart: () => 'synthetic-desktop'};");
  const seal = write("startup-integrity-private.json", {kind: "develop-outer-startup-integrity", checkBeforeRequire: true,
    files: {"attempt.cjs": attempt.sha256, "operator.cjs": operator.sha256}, sourceReviewSha256: source.sha256, ...pins});
  const options = {preparationDirectory: dir, desktopEntry: desktop.path, desktopSha256: desktop.sha256, startupSha256: seal.sha256};
  const child = `
    const assert = require('node:assert/strict');
    const {openFreshDevelopDesktop} = require(process.argv[1]);
    const result = openFreshDevelopDesktop(JSON.parse(process.argv[2]));
    (async () => {
      assert.equal(result.packageDigest, process.argv[3]);
      assert.equal(await result.prepareDesktopStart({}), 'synthetic-desktop');
      await assert.rejects(result.prepareDesktopStart({}), /already requested/);
    })().catch(e => { console.error(e); process.exitCode = 1; });
  `;
  const run = () => execFileSync(process.execPath, ["-e", child, loaderFile, JSON.stringify(options), packet.packageDigest],
    {stdio: "pipe"});
  run();
  fs.appendFileSync(files.indexes.path, " ");
  assert.throws(run, /indexes file changed/);
});
