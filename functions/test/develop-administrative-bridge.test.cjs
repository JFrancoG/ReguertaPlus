"use strict";
const {test} = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {createHash} = require("node:crypto");
const {execFileSync} = require("node:child_process");
const bridge = require("../lib/develop-shift-intake-bridge.js");
const {prepareDevelopAdministrativeBridge: prepare, wrapAdministrativeSource, ADMINISTRATIVE} =
  require("../scripts/prepare-develop-intake-bridge.cjs");
const directory = process.env.HU084_REMAINING_LEGACY_SOURCES;

test("administrative guard preserves the original production/local callback and request without constructing capture", () => {
  for (const name of ADMINISTRATIVE) for (const target of ["production", "local"]) {
    const request = {query: {env: target}}, response = {}, result = {original: name};
    const wrapped = bridge.wrapDevelopAdministrativeHttp(name, (req, res) => {
      assert.equal(req, request); assert.equal(res, response); return result;
    }, () => target);
    assert.equal(wrapped(request, response), result);
  }
});

test("default/mixed develop sets reject the whole request before original work and unknown targets fail closed", () => {
  for (const targets of [["develop"], ["local", "develop", "production"], ["production", "develop"]]) {
    let status, body;
    const wrapped = bridge.wrapDevelopAdministrativeHttp("validateGlobalVersionPolicy",
      () => assert.fail("No subset may execute"), () => targets);
    wrapped({query: {}}, {status(value) { status = value; return this; }, json(value) { body = value; }});
    assert.equal(status, 503); assert.equal(body.error, "develop_legacy_intake_closed");
  }
  for (const targets of [[], "unreviewed", ["production", "unexpected"], {env: "production"}]) {
    const wrapped = bridge.wrapDevelopAdministrativeHttp("onProductWrite", () => assert.fail("legacy"), () => targets);
    assert.throws(() => wrapped({}, {}), /environment_invalid/);
  }
});

test("modern parser preserves original errors and rejects direct develop with the original safe HTTP type", () => {
  class HttpError extends Error { constructor() { super("maintenance"); this.status = 503; } }
  const originalError = Error("original parser failure"), request = {};
  const rejected = bridge.wrapDevelopEnvironmentResolver(() => { throw originalError; }, () => new HttpError());
  assert.throws(() => rejected(request), (error) => error === originalError);
  const direct = bridge.wrapDevelopEnvironmentResolver((received) => {
    assert.equal(received, request); return "develop";
  }, () => new HttpError());
  assert.throws(() => direct(request), (error) => error instanceof HttpError && error.status === 503);
});

test("effective reviewer routing is resolved by the original port then blocked before member work", async () => {
  let read = false;
  const originalError = Error("existing rejection");
  const wrapped = bridge.wrapDevelopEffectiveEnvironmentResolver(async (requested, identity) => {
    assert.equal(requested, "production"); assert.equal(identity.uid, "reviewer"); read = true; return "develop";
  }, () => Object.assign(Error("maintenance"), {status: 503}));
  await assert.rejects(wrapped("production", {uid: "reviewer"}), (error) => error.status === 503);
  assert.equal(read, true);
  const failure = bridge.wrapDevelopEffectiveEnvironmentResolver(async () => { throw originalError; }, () => Error("other"));
  await assert.rejects(failure(), (error) => error === originalError);
});

test("both profiles reject unaudited source bytes and unknown profiles", () => {
  for (const profile of ["legacy-http8", "authorized-member1"]) {
    assert.throws(() => wrapAdministrativeSource(Buffer.from("unknown"), profile), /source_digest_mismatch/);
  }
  assert.throws(() => wrapAdministrativeSource(Buffer.from("unknown"), "arbitrary"), /profile_invalid/);
});

for (const [profile, archiveName, exports] of [
  ["legacy-http8", "onProductWrite.zip", ADMINISTRATIVE],
  ["authorized-member1", "resolveAuthorizedMember.zip", ["resolveAuthorizedMember"]],
]) test(`profile ${profile} preserves its exact lock/helpers and exports only its reviewed HTTP functions`,
  {skip: !directory}, () => {
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "administrative-bridge-"));
    const output = path.join(temporary, "packet"), archive = path.join(directory, archiveName);
    try {
      const manifest = prepare({profile, sourceZip: archive, outputDirectory: output,
        compiledDirectory: path.resolve(__dirname, "../lib"), projectId: "reguerta-9f27f", codebase: "default"});
      assert.deepEqual(manifest.exports, exports);
      assert.equal(manifest.requiredOnly, exports.map((name) => `functions:${name}`).join(","));
      assert.equal(manifest.canApply, false);
      for (const file of manifest.files) assert.equal(createHash("sha256")
        .update(fs.readFileSync(path.join(output, file.path))).digest("hex"), file.sha256);
      assert.ok(manifest.files.some((file) => file.path === "firebase.http.json"));
      assert.deepEqual(fs.readFileSync(path.join(output, "runtime/package-lock.json")),
        execFileSync("unzip", ["-p", archive, "package-lock.json"]));
      const originalPackage = JSON.parse(execFileSync("unzip", ["-p", archive, "package.json"]));
      const generatedPackage = JSON.parse(fs.readFileSync(path.join(output, "runtime/package.json")));
      assert.deepEqual(generatedPackage, {...originalPackage, scripts: {...originalPackage.scripts, "gcp-build": ""}});
      const entry = fs.readFileSync(path.join(output, "runtime/lib/index.js"), "utf8");
      assert.deepEqual([...entry.matchAll(/^exports\.([A-Za-z0-9_]+) =/gm)].map((match) => match[1]), exports);
      assert.equal(fs.existsSync(path.join(output, "runtime/.env")), false);
      assert.equal(fs.readdirSync(path.join(output, "runtime/lib")).some((name) => name.endsWith(".map")), false);
      assert.equal(manifest.patchCount, profile === "legacy-http8" ? 9 : 3);
      if (profile === "authorized-member1") {
        for (const file of manifest.files.filter((file) => /lib\/(backend-security|member-directory|notification-inbox|shift-swap-security)\.js$/.test(file.path))) {
          assert.deepEqual(fs.readFileSync(path.join(output, file.path)), execFileSync("unzip", ["-p", archive, file.path.slice(8)]));
        }
        assert.equal(manifest.originalCallbacksUnchanged, true);
      }
      assert.throws(() => prepare({profile, sourceZip: archive, outputDirectory: output,
        compiledDirectory: path.resolve(__dirname, "../lib"), projectId: "reguerta-9f27f", codebase: "default"}), /configuration_invalid/);
    } finally { fs.rmSync(temporary, {recursive: true, force: true}); }
  });
