"use strict";
const {test} = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const {execFileSync} = require("node:child_process"), {createRequire} = require("node:module");
const {wrapDevelopScheduledReminder: wrap} = require("../lib/develop-shift-intake-bridge.js");
const {prepareDevelopAdministrativeBridge: prepare, wrapAdministrativeSource, REMINDERS, REMINDER_PROFILE} =
  require("../scripts/prepare-develop-intake-bridge.cjs");
for (const targets of [["develop"], ["production", "develop"], ["local", "develop", "production"]])
  test(`scheduled and direct callback guard rejects whole target set ${targets}`, async () => {
    for (const name of REMINDERS) await assert.rejects(wrap(name, async () => assert.fail("original callback"), () => targets)({jobName: "direct"}),
      /develop_legacy_intake_closed/);
  });
test("preserves original non-develop callback arguments, result, error and one execution", async () => {
  const event = {}, expected = {}, error = Error("original"), name = REMINDERS[0];let calls = 0;
  assert.equal(await wrap(name, async received => {assert.equal(received, event);calls++;return expected;}, () => ["production"])(event), expected);
  assert.equal(calls, 1);
  await assert.rejects(wrap(name, async () => {throw error;}, () => ["production"])(event), e => e === error);
});
test("rejects unknown identities, invalid resolver results and unsupported source", async () => {
  assert.throws(() => wrap("other", async () => {}, () => ["develop"]), /entry_invalid/);
  for (const target of [[], null, "develop", ["unexpected"], [null]])
    await assert.rejects(wrap(REMINDERS[0], async () => assert.fail("callback"), () => target)(), /environment_invalid/);
  assert.throws(() => wrapAdministrativeSource(Buffer.from("unreviewed"), "reminders3"), /source_digest_mismatch/);
});
const directory = process.env.HU084_REMAINING_LEGACY_SOURCES;
test("reminder package preserves all original callback bodies, schedules, lock and only three exports", {skip: !directory}, () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "reminder-bridge-"));
  try {
    const archive = path.join(directory, "sendPendingOrderReminderSunday20.zip"), out = path.join(tmp, "packet");
    const manifest = prepare({profile: "reminders3", sourceZip: archive, outputDirectory: out,
      compiledDirectory: path.resolve(__dirname, "../lib"), projectId: "reguerta-9f27f", codebase: "default"});
    assert.equal(manifest.canApply, false);assert.deepEqual(manifest.exports, REMINDERS);
    assert.equal(manifest.patchCount, 4);assert.equal(manifest.sourceArchiveSha256, REMINDER_PROFILE.zip);
    assert.equal(manifest.guards.functionBuildUpdateOnly, true);assert.equal(manifest.guards.schedulerJobsMustRemainPaused, true);
    assert.equal(manifest.guards.firebaseCliDeployForbidden, true);
    assert.deepEqual(fs.readFileSync(path.join(out, "runtime/package-lock.json")), execFileSync("unzip", ["-p", archive, "package-lock.json"]));
    for (const [index, row] of manifest.registrations.entries()) assert.ok(row.options[0].includes(`0 ${[20, 22, 23][index]} * * 0`));
    const original = execFileSync("unzip", ["-p", archive, "lib/index.js"]).toString();
    const transformed = fs.readFileSync(path.join(out, "runtime/lib/legacy.js"), "utf8");
    for (const hour of [20, 22, 23]) {
      const body = `async () => {\n    await runPendingOrderReminderForHour(${hour});\n}`;
      assert.ok(original.includes(body));assert.ok(transformed.includes(body));
    }
    const entry = fs.readFileSync(path.join(out, "runtime/lib/index.js"), "utf8");
    assert.deepEqual([...entry.matchAll(/^exports\.([A-Za-z0-9_]+) =/gm)].map(x => x[1]), REMINDERS);
    assert.equal(fs.existsSync(path.join(out, "runtime/.env")), false);
  } finally {fs.rmSync(tmp, {recursive: true, force: true});}
});
const sdkRoot = process.env.HU084_CAPTURE_SDK_NODE_MODULES;
test("deployed scheduler SDK returns HTTP500 on maintenance rejection without executing original ports", {skip: !sdkRoot}, async () => {
  const sdk = createRequire(path.join(sdkRoot, "firebase-functions/package.json"));
  assert.equal(JSON.parse(fs.readFileSync(path.join(sdkRoot, "firebase-functions/package.json"))).version, "6.3.2");
  const {onSchedule} = sdk("firebase-functions/v2/scheduler");
  let status, sent = false;
  const fn = onSchedule({schedule: "0 20 * * 0", timeZone: "Europe/Madrid"},
    wrap(REMINDERS[0], async () => assert.fail("original work"), () => ["develop"]));
  await fn({header: () => undefined}, {status(code) {status = code;return this;}, send() {sent = true;return this;}});
  assert.equal(status, 500);assert.equal(sent, true);
});
const runtimeFile = process.env.HU084_REMINDER_RUNTIME_METADATA;
test("reviewed reminder metadata preserves an absent maximum rather than introducing a new instance limit", {skip: !directory || !runtimeFile}, () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "reminder-runtime-"));
  try {
    const options = {profile: "reminders3", sourceZip: path.join(directory, "sendPendingOrderReminderSunday20.zip"),
      compiledDirectory: path.resolve(__dirname, "../lib"), projectId: "reguerta-9f27f", codebase: "default"};
    const good = prepare({...options, outputDirectory: path.join(tmp, "good"), runtimeMetadataPath: runtimeFile});
    assert.equal(good.runtimeMetadata.functions.length, 3);
    assert.ok(good.runtimeMetadata.functions.every(f => f.maximumInstancesKnown === false && f.maximumInstances === undefined));
    const metadata = JSON.parse(fs.readFileSync(runtimeFile));metadata.observations[0].data.serviceConfig.maxInstanceCount = 20;
    const changed = path.join(tmp, "changed.json");fs.writeFileSync(changed, JSON.stringify(metadata));
    assert.throws(() => prepare({...options, outputDirectory: path.join(tmp, "bad"), runtimeMetadataPath: changed}), /runtime_metadata_changed/);
  } finally {fs.rmSync(tmp, {recursive: true, force: true});}
});
