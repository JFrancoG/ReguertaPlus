"use strict";

const assert = require("node:assert/strict");
const {test} = require("node:test");
const {execFileSync} = require("node:child_process");
const {createShiftPlanningDigest: digest} = require("../lib/shift-planning-digest.js");
const {decodeShiftPlanningFirestoreDocument: decode} = require("../lib/shift-planning-publication-contract.js");
const migration = require("../scripts/rehearse-develop-shift-migration.cjs");
const fixture = require("./develop-shift-migration-fixture.cjs");

const input = () => ({contentProposal: fixture.contentProposal(), legacyCapture: fixture.legacyCapture()});
const redigestProposal = (proposal) => {
  const body = {...proposal};
  delete body.proposalDigest; delete body.contentDigest;
  return {...body, contentDigest: digest(body.content), proposalDigest: digest(body)};
};

test("prepares a detached partial-horizon proposal without manufacturing legacy ownership or completion", () => {
  const args = input(), before = structuredClone(args);
  const result = migration.prepareDevelopShiftMigration(args);
  assert.deepEqual(args, before);
  assert.equal(result.liveExecutable, false);
  assert.equal(result.content.shifts.length, 72);
  assert.equal(result.legacy.length, 62);
  assert.equal(result.content.helperProjectionDraft.length, 53);
  for (const type of ["delivery", "market"]) {
    const cursor = result.content.rotations[type].postPublishedCursor;
    assert.deepEqual(cursor.cohortUserIds, fixture.cohort);
    assert.equal(cursor.roundNumber, 2); assert.equal(cursor.nextMemberIndex, 22);
  }
  for (const row of result.legacy) {
    const raw = decode(row.payload);
    assert.equal(raw.rotationOwnerUserId, undefined);
    assert.equal(raw.completion, undefined);
    assert.equal(raw.lastBackendMutation, undefined);
  }
  assert.equal(result.policyDraft.localOnly.planningReady, false);
  assert.equal(result.policyDraft.document.creditLedger.enabled, false);
  assert.equal(result.policyDraft.document.coverage?.enabled, undefined);
  args.contentProposal.content.shifts[0].assignedUserIds[0] = "changed-input";
  assert.notEqual(result.content.shifts[0].assignedUserIds[0], "changed-input");
});

test("rejects changed content digests, duplicate public identities and legacy collisions", () => {
  const tampered = input(); tampered.contentProposal.content.shifts[0].date = "2030-01-01";
  assert.throws(() => migration.prepareDevelopShiftMigration(tampered), /content digest/);
  const duplicate = input();
  duplicate.contentProposal.content.shifts[1].id = duplicate.contentProposal.content.shifts[0].id;
  duplicate.contentProposal = redigestProposal(duplicate.contentProposal);
  assert.throws(() => migration.prepareDevelopShiftMigration(duplicate), /72 exact content rows/);
  const collision = input();
  collision.contentProposal.content.shifts[0].id = collision.legacyCapture.documents[0].name.split("/").at(-1);
  collision.contentProposal = redigestProposal(collision.contentProposal);
  assert.throws(() => migration.prepareDevelopShiftMigration(collision), /ID collision/);
});

test("rejects re-digested locally valid owner positions that reverse the declared rotation consumption", () => {
  const args = input(), rows = args.contentProposal.content.shifts.filter((row) => row.type === "delivery");
  const firstOwner = rows[0].rotationOwnerUserIds, firstPositions = rows[0].positions;
  rows[0].rotationOwnerUserIds = rows[1].rotationOwnerUserIds; rows[0].positions = rows[1].positions;
  rows[1].rotationOwnerUserIds = firstOwner; rows[1].positions = firstPositions;
  args.contentProposal = redigestProposal(args.contentProposal);
  assert.throws(() => migration.prepareDevelopShiftMigration(args), /migration_rehearsal_rejected/);
});

test("rejects captures from shared projects, other environments and changed raw dispositions", () => {
  for (const mutate of [
    (a) => { a.legacyCapture.projectId = "reguerta-9f27f"; },
    (a) => { a.legacyCapture.environment = "production"; },
    (a) => { a.legacyCapture.documents[0].name = a.legacyCapture.documents[0].name.replace(migration.PROJECT_ID, "reguerta-9f27f"); },
    (a) => { a.legacyCapture.documents[0].fields.source = {stringValue: "app"}; },
    (a) => { a.legacyCapture.documents[0].fields.status = {stringValue: "confirmed"}; },
    (a) => { a.legacyCapture.documents[0].fields.lastBackendMutation = {mapValue: {fields: {}}}; },
    (a) => { a.legacyCapture.documents[1] = structuredClone(a.legacyCapture.documents[0]); },
  ]) {
    const args = input(); mutate(args);
    assert.throws(() => migration.prepareDevelopShiftMigration(args), /migration_rehearsal_rejected/);
  }
});

test("rejects policy drafts that activate coverage, credits or a non-local workbook", () => {
  for (const mutate of [
    (d) => { d.document.coverage = {enabled: true}; },
    (d) => { d.document.creditLedger.enabled = true; },
    (d) => { d.document.sync.partitions.delivery.workbookId = "shared-workbook"; },
    (d) => { d.localOnly.planningReady = true; },
  ]) {
    const args = input(), draft = migration.createLocalMigrationPolicyDraft(args.contentProposal);
    mutate(draft); draft.draftDigest = digest({document: draft.document, localOnly: draft.localOnly});
    assert.throws(() => migration.prepareDevelopShiftMigration({...args, policyDraft: draft}), /migration_rehearsal_rejected/);
  }
});

test("decodes nanosecond timestamps and nested raw values without accepting lossy or unsupported fields", () => {
  const raw = fixture.legacyCapture().documents[0], decoded = migration.decodeRESTDocument(raw);
  assert.equal(decoded.data.createdAt.nanoseconds, 1234);
  assert.equal(decoded.data.updatedAt.nanoseconds, 5678);
  assert.deepEqual(decoded.data.syncMeta.retained, [null, true, "Example legacy note"]);
  for (const field of [{integerValue: "9007199254740993"}, {referenceValue: "projects/shared/documents/x/y"},
    {stringValue: "literal", booleanValue: true}]) {
    assert.throws(() => migration.decodeRESTDocument({...raw, fields: {...raw.fields, unsupported: field}}),
      /migration_rehearsal_rejected/);
  }
});

const constructorProbe = (projectId, host, tamper = false) => {
  const scriptPath = require.resolve("../scripts/rehearse-develop-shift-migration.cjs");
  const fixturePath = require.resolve("./develop-shift-migration-fixture.cjs");
  const source = `
    const assert = require('node:assert/strict'), Module = require('node:module');
    const actual = require('@google-cloud/firestore'), original = Module._load;
    let constructions = 0;
    Module._load = function(name, parent, main) {
      if (name === '@google-cloud/firestore') return {...actual, Firestore: class {
        constructor() { constructions++; throw new Error('unexpected SDK construction'); }
      }};
      return original.call(this, name, parent, main);
    };
    const m = require(${JSON.stringify(scriptPath)}), f = require(${JSON.stringify(fixturePath)});
    const prepared = m.prepareDevelopShiftMigration({contentProposal: f.contentProposal(), legacyCapture: f.legacyCapture()});
    if (${tamper}) prepared.content.shifts[0].assignedUserIds[0] = 'tampered';
    assert.throws(() => m.createDevelopShiftMigrationRehearsal({prepared, controlPlane: {},
      failurePersistence: {}, nowMillis: () => f.NOW}), /fixed demo emulator required|prepared binding/);
    assert.equal(constructions, 0);
  `;
  execFileSync(process.execPath, ["-e", source], {cwd: require("node:path").resolve(__dirname, ".."),
    env: {...process.env, GCLOUD_PROJECT: projectId, FIRESTORE_EMULATOR_HOST: host,
      METADATA_SERVER_DETECTION: "none"}, stdio: "pipe"});
};

test("refuses every non-exact destination before constructing a Firestore client", () => {
  for (const [project, host] of [["reguerta-9f27f", migration.HOST], [migration.PROJECT_ID, "localhost:8798"],
    [migration.PROJECT_ID, "127.0.0.1:8080"], [migration.PROJECT_ID, "example.com:8798"],
    [migration.PROJECT_ID, ""]]) constructorProbe(project, host);
});

test("refuses mutated prepared manifests before constructing the fixed emulator client", () => {
  constructorProbe(migration.PROJECT_ID, migration.HOST, true);
});
