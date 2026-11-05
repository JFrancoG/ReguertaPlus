// Test-only counterfactual fixture. No live control-plane, delivery or replay API.
const {Firestore, Timestamp} = require("@google-cloud/firestore");
const {createShiftPlanningDigest: digest} = require("../lib/shift-planning-digest.js");
const {captureShiftPlanningWriterAuthority, assertShiftPlanningWriterAuthority} =
  require("../lib/shift-planning-writer-authority.js");
const {DEPLOYED_LEGACY_SOURCE_SHA256: sourceSha256} =
  require("../lib/develop-legacy-pause-rehearsal.js");
const ROOT = "developBackendHandoff/fixture";
const STATE = "develop/plus-collections/shiftPlanningState/current";
const PROJECT = "demo-reguerta-writer-controls";
const SOURCE = `//firestore.googleapis.com/projects/${PROJECT}/databases/(default)`;
const routes = {
  onShiftWritten: "shifts", onDeliveryCalendarOverrideWritten: "deliveryCalendar",
  onShiftPlanningRequestCreated: "shiftPlanningRequests",
  onNotificationEventCreated: "notificationEvents",
};
const fail = (code) => { throw Object.assign(Error(code), {code}); };
const key = (value) => digest(value).split(":").at(-1);
const stamp = (value) => value ? {
  seconds: value.seconds, nanoseconds: value.nanoseconds,
} : null;
function wire(value) {
  if (value instanceof Timestamp) return {timestamp: stamp(value)};
  if (value === null || typeof value === "string" || typeof value === "boolean" ||
      (typeof value === "number" && Number.isFinite(value))) return value;
  if (Array.isArray(value)) return Array.from(value, wire);
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(Object.entries(value).map(([name, item]) => [name, wire(item)]));
  }
  return fail("unsupported_wire_value");
}
function wireSnapshot(snapshot) {
  return {path: snapshot.ref.path, exists: snapshot.exists,
    createTime: stamp(snapshot.createTime), updateTime: stamp(snapshot.updateTime),
    readTime: stamp(snapshot.readTime), fields: wire(snapshot.data() || null)};
}
function eventWire(entryPoint, event) {
  const after = event.data.after || event.data;
  const before = event.data.before || null;
  const {data: _snapshots, ...metadata} = event;
  return {sourceSha256, entryPoint, event: wire(metadata),
    before: before ? wireSnapshot(before) : null, after: wireSnapshot(after)};
}
function coreOf(envelope) {
  const {event, entryPoint, after, before} = envelope;
  if (envelope.sourceSha256 !== sourceSha256 || !routes[entryPoint] ||
      event.source !== SOURCE || event.params.env !== "develop" ||
      !event.id || event.id.length > 512 || !Number.isFinite(Date.parse(event.time)) ||
      !event.type.startsWith("google.cloud.firestore.document.v1.") ||
      !after.path.startsWith(`develop/plus-collections/${routes[entryPoint]}/`) ||
      after.path.split("/").length !== 4 ||
      event.subject !== `documents/${after.path}` ||
      (before && before.path !== after.path)) fail("event_identity_invalid");
  for (const snapshot of [before, after].filter(Boolean)) {
    if (!snapshot.readTime || (snapshot.exists && (!snapshot.createTime ||
        !snapshot.updateTime || snapshot.fields === null))) {
      fail("event_snapshot_incomplete");
    }
  }
  // Read times and delivery IDs differ between consumers; source versions do not.
  const version = (snapshot) => snapshot && {
    ...snapshot, readTime: null,
  };
  return {sourceSha256, entryPoint, source: event.source, subject: event.subject,
    type: event.type, params: event.params, before: version(before), after: version(after)};
}
function manifestOf(snapshot) {
  return digest(snapshot.docs.map((doc) => ({id: doc.id, coreDigest: doc.get("coreDigest")}))
    .sort((a, b) => a.id.localeCompare(b.id)));
}
function createHandoffFixture() {
  if (process.env.GCLOUD_PROJECT !== PROJECT ||
      process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8897") {
    fail("local_emulator_required");
  }
  const db = new Firestore({projectId: PROJECT, host: "127.0.0.1:8897", ssl: false});
  const ref = db.doc(ROOT);
  const get = (name, id) => ref.collection(name).doc(id);
  const strictId = (id) => {
    if (!/^[a-z][a-z0-9-]{0,63}$/.test(id)) fail("fixture_id_invalid");
    return id;
  };
  async function authority() {
    const state = (await db.doc(STATE).get()).data();
    const captured = captureShiftPlanningWriterAuthority(state);
    if (!captured) fail("authority_missing");
    return captured;
  }
  async function evidenceDigest(record) {
    const collection = record.kind === "legacyCompleted" ? "oldTerminals" : "commands";
    const id = record.evidence.operationId || record.evidence.commandId;
    const snapshot = await get(collection, id).get();
    return digest({data: wire(snapshot.data() || null), version: stamp(snapshot.updateTime)});
  }
  async function dispositionValid(record, event) {
    if (record.evidenceDigest && record.evidenceDigest !== await evidenceDigest(record)) return false;
    if (record.kind === "legacyCompleted") {
      if (event.core.entryPoint !== "onNotificationEventCreated") return false;
      const [operation, terminal, current] = await db.getAll(
        get("oldOperations", record.evidence.operationId),
        get("oldTerminals", record.evidence.operationId), db.doc(event.core.after.path),
      );
      const originalPayload = current.data() || {};
      delete originalPayload.dispatch;
      return operation.get("eventKey") === event.key &&
        terminal.get("status") === "settled" &&
        terminal.get("afterImageDigest") === digest(wire(current.data())) &&
        terminal.get("afterVersionDigest") === digest(stamp(current.updateTime)) &&
        digest(wire(originalPayload)) === digest(event.core.after.fields) &&
        ["success", "no_tokens"].includes(current.get("dispatch.status"));
    }
    if (record.kind !== "reconciledCurrentProjection" ||
        event.core.entryPoint === "onNotificationEventCreated") return false;
    const command = await get("commands", record.evidence.commandId).get();
    if (!command.exists || command.get("kind") !== "closedDemoProjectionCommand" ||
        command.get("state") !== "committed" ||
        command.get("sourcePath") !== event.core.after.path) return false;
    const [source, projection] = await db.getAll(
      db.doc(command.get("sourcePath")), db.doc(command.get("projectionPath")),
    );
    assertShiftPlanningWriterAuthority({
      capturedValue: command.get("authority"),
      currentStateValue: (await db.doc(STATE).get()).data(),
      changedCode: "authority_changed", changedMessage: "authority_changed",
    });
    return !!command.get("authority") &&
      digest(wire(source.data())) === command.get("sourceDigest") &&
      digest(stamp(source.updateTime)) === command.get("sourceVersionDigest") &&
      digest(wire(projection.data())) === command.get("projectionDigest");
  }
  return {
    async initializeUniverse(operationIds = []) {
      operationIds.forEach(strictId);
      if (new Set(operationIds).size !== operationIds.length) fail("duplicate_fixture_id");
      await ref.create({scope: "closed-demo-fixture", sourceSha256,
        expectedOldOperationIds: operationIds, canApply: false});
    },
    async capture(envelope) {
      const core = coreOf(envelope);
      const logical = {entryPoint: core.entryPoint, source: core.source,
        subject: core.subject, type: core.type,
        before: core.before && {exists: core.before.exists, updateTime: core.before.updateTime},
        after: {exists: core.after.exists, updateTime: core.after.updateTime}};
      const eventKey = key(logical);
      const capture = {key: eventKey, core, coreDigest: digest(core), envelope};
      const deliveryDigest = digest({...envelope, before: core.before, after: core.after});
      const eventRef = get("events", eventKey);
      const deliveryRef = get("deliveries", key({source: core.source,
        entryPoint: core.entryPoint, id: envelope.event.id}));
      await db.runTransaction(async (tx) => {
        const [prior, delivery] = await tx.getAll(eventRef, deliveryRef);
        if ((prior.exists && prior.get("coreDigest") !== capture.coreDigest) ||
            (delivery.exists && delivery.get("envelopeDigest") !== deliveryDigest)) {
          fail("event_payload_conflict");
        }
        if (!prior.exists) tx.create(eventRef, capture);
        if (!delivery.exists) tx.create(deliveryRef, {eventKey, envelope,
          envelopeDigest: deliveryDigest});
      });
      return {acknowledgeable: true, eventKey, coreDigest: capture.coreDigest};
    },
    async observeOld(id, harness, invoke, eventKey = null) {
      strictId(id);
      const universe = await ref.get();
      if (!universe.get("expectedOldOperationIds").includes(id)) fail("unknown_old_operation");
      await get("oldOperations", id).create({sourceSha256, eventKey});
      let error;
      try { await invoke(); } catch (caught) { error = caught; }
      const uncertain = error || harness.trace.some((item) => item.port === "logger.error");
      let afterImage = {};
      if (eventKey) {
        const retained = await get("events", eventKey).get();
        const current = await db.doc(retained.get("core.after.path")).get();
        afterImage = {afterImageDigest: digest(wire(current.data())),
          afterVersionDigest: digest(stamp(current.updateTime))};
      }
      await get("oldTerminals", id).create({status: uncertain ? "uncertain" : "settled",
        traceDigest: digest(harness.trace), ...afterImage});
      if (error) throw error;
    },
    async retainUnknown(id) {
      await get("unknownHistory", strictId(id)).create({unresolved: true, sourceSha256});
    },
    async appendDisposition(eventKey, record) {
      strictId(record.id);
      if (!["legacyCompleted", "reconciledCurrentProjection", "possiblyDelivered",
        "unresolved"].includes(record.kind)) fail("replay_forbidden");
      const event = (await get("events", eventKey).get()).data();
      if (!event || record.coreDigest !== event.coreDigest) fail("disposition_binding_invalid");
      if (["legacyCompleted", "reconciledCurrentProjection"].includes(record.kind) &&
          !await dispositionValid(record, event)) fail("disposition_readback_invalid");
      const safe = ["legacyCompleted", "reconciledCurrentProjection"].includes(record.kind);
      const value = {...record, eventKey, sourceSha256,
        ...(safe ? {evidenceDigest: await evidenceDigest(record)} : {})};
      const disposition = get("dispositions", record.id);
      await db.runTransaction(async (tx) => {
        const prior = await tx.get(disposition);
        if (prior.exists && digest(prior.data()) !== digest(value)) fail("disposition_conflict");
        if (!prior.exists) tx.create(disposition, value);
      });
    },
    async freezeManifest() {
      return manifestOf(await ref.collection("events").get());
    },
    async assess(expectedManifest) {
      const blockers = [];
      const universe = await ref.get();
      if (!universe.exists) blockers.push("universe_missing");
      let capturedAuthority = null;
      try { capturedAuthority = await authority(); } catch { blockers.push("authority_unavailable"); }
      const operations = [];
      for (const id of universe.get("expectedOldOperationIds") || []) {
        const [operation, terminal] = await db.getAll(get("oldOperations", id), get("oldTerminals", id));
        const status = !operation.exists ? "notObserved" : (terminal.get("status") || "running");
        operations.push({id, status, operationDigest: digest(wire(operation.data() || null)),
          terminalDigest: digest(wire(terminal.data() || null))});
        if (status !== "settled") blockers.push(`old_operation_${status}`);
      }
      const unknownHistory = await ref.collection("unknownHistory").get();
      if (!unknownHistory.empty) blockers.push("unknown_old_history");
      const events = await ref.collection("events").get();
      if (!expectedManifest) blockers.push("capture_manifest_unsealed");
      else if (manifestOf(events) !== expectedManifest) blockers.push("capture_manifest_changed");
      const dispositions = await ref.collection("dispositions").get();
      const acceptedExternal = await ref.collection("externalAccepted").get();
      const external = [];
      for (const request of acceptedExternal.docs) {
        const terminal = await get("externalTerminals", request.id).get();
        external.push({id: request.id, acceptedDigest: digest(request.data()),
          terminalDigest: digest(terminal.data() || null)});
        let verified = false;
        if (terminal.exists && terminal.get("committed") === true &&
            terminal.get("submissionDigest") === request.get("submissionDigest") &&
            terminal.get("targetPath") === request.get("targetPath")) {
          const current = await db.doc(request.get("targetPath")).get();
          verified = terminal.get("afterImageDigest") === digest(wire(current.data())) &&
            terminal.get("afterVersionDigest") === digest(stamp(current.updateTime));
        }
        if (!verified) blockers.push("external_request_pending");
      }
      for (const event of events.docs) {
        const records = dispositions.docs.map((doc) => doc.data())
          .filter((record) => record.eventKey === event.id);
        let reconciled = false;
        for (const record of records) {
          if (["possiblyDelivered", "unresolved"].includes(record.kind)) {
            blockers.push(`event_${record.kind}`);
          } else {
            try { reconciled ||= await dispositionValid(record, event.data()); } catch { /* Held. */ }
          }
        }
        if (!reconciled) blockers.push("event_unreconciled");
      }
      const manifest = (snapshot) => snapshot.docs.map((doc) => ({
        id: doc.id, digest: digest(doc.data()),
      })).sort((a, b) => a.id.localeCompare(b.id));
      const packet = {eventManifest: manifest(events), unknownHistory: manifest(unknownHistory),
        dispositionManifest: manifest(dispositions), external,
        scope: "closed-demo-fixture", sourceSha256, operations,
        eventCount: events.size, retainedManifestDigest: manifestOf(events),
        capturedAuthority, blockers: [...new Set(blockers)],
        legacyUntracked: true, canClaimClosure: false, canApply: false,
        knownFixtureReconciliationReady: blockers.length === 0,
        physicalHandoffReady: false, requiredExternalProofs: [
          "effective_legacy_authority_revoked", "owner_and_workbook_fence",
          "provider_operations_terminal", "capture_and_queue_completeness",
        ]};
      return {...packet, packetDigest: digest(packet)};
    },
    async dispose() { await db.terminate(); },
  };
}
module.exports = {createHandoffFixture, eventWire, wire, stamp, key, ROOT, STATE,
  SOURCE, PROJECT, digest, manifestOf};
