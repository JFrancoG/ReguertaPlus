import type {sheets_v4 as SheetsV4} from "googleapis";
import {Transaction, Timestamp} from "@google-cloud/firestore";
import {buildNotificationInboxDocument} from "./notification-inbox.js";
import {coverageId, coverageMember, rejectCoverage} from "./shift-coverage.js";
import {coverageSheetRow, ShiftCoverageEffects} from
  "./shift-coverage-effects.js";
import {createProvisionalCreditFirestore} from "./shift-credit-publication.js";
import {createShiftPlanningDigest as digest} from "./shift-planning-digest.js";
import {parseShiftPlanningPublicShiftDocument} from
  "./shift-planning-publication-contract.js";
import {assertShiftPlanningWriterAuthority} from
  "./shift-planning-writer-authority.js";
import {createShiftSheetsMemberResolver, readShiftSheetsImport,
  ShiftSheetsImportTab} from
  "./shift-sheets-import.js";
import {ShiftSheetsConfig} from "./shift-sheets-config.js";
import {createShiftSheetsAdapter, ShiftSheetsHumanWriteBackRow,
  ShiftSheetsProjectionRow} from "./shift-sheets.js";

type Submission = {operationId: string; rows: ShiftSheetsProjectionRow[];
  humanRows: ShiftSheetsHumanWriteBackRow[]; sourceDigest: string};

/**
 * Fixed-demo integration runner. HU-083 owns exact-cell patches and read-back;
 * this adapter owns the command receipt, local workbook reservation and inbox
 * release. No Google/FCM client or deployed entrypoint is constructed here.
 * Ambiguous submissions retain their exact before image and reservation. Source
 * drift blocks it for reconciliation; it must never be silently re-prepared.
 * @param {object} input Local workbook API fixture and explicit reviewed tabs.
 * @return {object} Drain one operation, or close the owned emulator store.
 */
export const createProvisionalCoverageEffectsWorker = (input: {
  config: ShiftSheetsConfig;
  sheets: Pick<SheetsV4.Resource$Spreadsheets, "get" | "batchUpdate">;
  tabs: readonly ShiftSheetsImportTab[];
  readWorkbookVersion(): Promise<string>;
  nowMillis(): number;
}) => {
  if (input.config.environment !== "develop" ||
    input.config.workbookId !== "coverage-rehearsal-book") {
    return rejectCoverage("coverage_effects_local_workbook_required");
  }
  const db = createProvisionalCreditFirestore();
  const root = "develop/plus-collections";
  const reservation = db.doc(`${root}/shiftCoverageProjectionState/workbook`);
  const adapter = createShiftSheetsAdapter(input);
  const effectRef = (id: string) =>
    db.doc(`${root}/shiftCoverageEffects/${id}`);
  const load = async (tx: Transaction, id: string) => {
    const [effect, receipt, maintenance, lock] = await tx.getAll(
      effectRef(id),
      db.doc(`${root}/shiftCoverageOperations/${id}`),
      db.doc(`${root}/shiftPlanningState/current`), reservation);
    const record = effect.data();
    const value = record?.value as ShiftCoverageEffects | undefined;
    if (!value) return rejectCoverage("coverage_effects_missing");
    const {effectsDigest, ...core} = value;
    if (value.operationId !== id || value.environment !== "develop" ||
      value.schemaVersion !== 1 || effectsDigest !== digest(core) ||
      receipt.data()?.effectsDigest !== effectsDigest) {
      return rejectCoverage("coverage_effects_changed");
    }
    if (record?.state === "completed") {
      return {completed: true as const, value};
    }
    assertShiftPlanningWriterAuthority({capturedValue: record?.authority,
      currentStateValue: maintenance.data(),
      changedCode: "coverage_effects_authority_changed",
      changedMessage: "Coverage effects lost their writer authority"});
    const current = await tx.get(db.doc(
      `${root}/shiftCoverageCases/${value.caseId}`));
    if (current.data()?.digest !== value.caseDigest ||
      digest(current.data()?.value) !== value.caseDigest) {
      return rejectCoverage("coverage_effects_superseded");
    }
    if (value.action.startsWith("offer") &&
      current.data()?.value.offer?.expiresAtMillis <= input.nowMillis()) {
      return rejectCoverage("coverage_effects_expired");
    }
    const [shifts, users, calendar] = await Promise.all([
      tx.get(db.collection(`${root}/shifts`).limit(501)),
      tx.get(db.collection(`${root}/users`).limit(501)),
      tx.get(db.collection(`${root}/deliveryCalendar`).limit(501)),
    ]);
    if ([shifts, users, calendar].some((s) => s.size > 500)) {
      return rejectCoverage("coverage_effects_source_limit");
    }
    const rows = shifts.docs.map((doc) => coverageSheetRow(doc.id,
      parseShiftPlanningPublicShiftDocument({targetPath: doc.ref.path,
        value: doc.data()})));
    for (const change of value.changes) {
      if (digest(rows.find((row) => row.id === change.after.id)) !==
        digest(change.after)) {
        return rejectCoverage("coverage_effects_source_changed");
      }
    }
    const sourceDigest = digest([shifts, users, calendar].map((s) =>
      s.docs.map((doc) => [doc.id, doc.updateTime?.seconds,
        doc.updateTime?.nanoseconds])));
    const submission = record?.submission as Submission | undefined;
    if (submission && (submission.sourceDigest !== sourceDigest ||
      digest(submission) !== record?.submissionDigest)) {
      return rejectCoverage("coverage_effects_source_changed");
    }
    if (value.changes.length && lock.exists &&
      lock.data()?.operationId !== id) {
      return rejectCoverage("coverage_effects_workbook_reserved");
    }
    return {completed: false as const, value, rows, users, calendar,
      sourceDigest, submission, locked: lock.exists};
  };

  return {
    close: () => db.terminate(),
    async drain(operationId: string) {
      const id = coverageId(operationId);
      const source = await db.runTransaction(async (tx) => {
        const value = await load(tx, id);
        if (!value.completed && value.value.changes.length && !value.locked) {
          tx.create(reservation, {operationId: id});
        }
        return value;
      });
      if (source.completed) return {state: "completed", replayed: true};
      let submission = source.submission;
      if (source.value.changes.length && !submission) {
        try {
          const members = source.users.docs.map((doc) => {
            const data = doc.data();
            return {userId: doc.id, names: [data.displayName as string],
              phones: [data.phoneNumber ?? data.phone ?? ""],
              eligibleTypes: ["delivery", "market"] as const};
          });
          if (members.some((m) => typeof m.names[0] !== "string" ||
            !m.names[0].trim() || typeof m.phones[0] !== "string")) {
            return rejectCoverage("coverage_effects_member_label_missing");
          }
          const resolver = createShiftSheetsMemberResolver(members);
          const baseline = source.rows.map((row) => source.value.changes
            .find((change) => change.before.id === row.id)?.before ?? row);
          const observation = await readShiftSheetsImport({
            config: input.config, sheets: input.sheets, tabs: input.tabs,
            baseline, members, readWorkbookVersion: input.readWorkbookVersion,
            deliveryCalendar: source.calendar.docs.filter((doc) =>
              doc.data().deliveryDate instanceof Timestamp).map((doc) => ({
              weekKey: doc.id, date: doc.data().deliveryDate.toDate()
                .toISOString().slice(0, 10)})),
          });
          const humanRows = source.value.changes.map((change) => {
            const human = observation.humanRows.find((r) =>
              r.id === change.after.id);
            const observed = observation.assignments.find((r) =>
              r.id === change.after.id);
            if (!human || !observed ||
              ![change.before, change.after].some((row) =>
                digest(row.assignedUserIds) ===
                  digest(observed.assignedUserIds))) {
              return rejectCoverage("coverage_effects_manual_conflict");
            }
            const next = {...structuredClone(human),
              after: human.after.map((row) => ({values: [...row.values]}))};
            const delivery = change.after.type === "delivery";
            next.assignedUserIds = [...change.after.assignedUserIds];
            next.assignedUserIds.forEach((userId, index) => {
              const member = members.find((m) => m.userId === userId) ??
                rejectCoverage("coverage_effects_member_label_missing");
              if (resolver.resolve(member.names[0], member.phones[0]) !==
                userId) {
                return rejectCoverage("coverage_effects_member_label_missing");
              }
              const cells = next.after[delivery ? 0 : index + 1].values;
              cells[delivery ? 1 : 0] = {stringValue: member.names[0]};
              cells[delivery ? 2 : 1] = member.phones[0] ?
                {stringValue: member.phones[0]} : {};
            });
            if (next.helper) {
              const userId = change.after.helperUserId;
              const name = userId ? members.find((m) =>
                m.userId === userId)?.names[0] : "";
              if (name === undefined) {
                return rejectCoverage("coverage_effects_member_label_missing");
              }
              const oldName = change.before.helperUserId ? members.find((m) =>
                m.userId === change.before.helperUserId)?.names[0] : "";
              const actual = human.before[0].values[5].stringValue ?? "";
              if (![oldName, name].includes(actual)) {
                return rejectCoverage("coverage_effects_manual_conflict");
              }
              if (userId && resolver.resolve(name, "") !== userId) {
                return rejectCoverage("coverage_effects_member_label_missing");
              }
              next.helper = {userId, name};
              next.after[0].values[5] = name ? {stringValue: name} : {};
            }
            return next;
          });
          const prepared: Submission = {operationId: id,
            rows: source.value.changes.map((c) => c.after), humanRows,
            sourceDigest: source.sourceDigest};
          submission = await db.runTransaction(async (tx) => {
            const fresh = await load(tx, id);
            if (fresh.completed) return undefined;
            if (fresh.submission) return fresh.submission;
            if (fresh.sourceDigest !== prepared.sourceDigest) {
              return rejectCoverage("coverage_effects_source_changed");
            }
            tx.update(effectRef(id), {submission: prepared,
              submissionDigest: digest(prepared)});
            return prepared;
          });
        } catch (error) {
          // Only a proven pre-submission failure releases the reservation.
          await db.runTransaction(async (tx) => {
            const [effect, lock] = await tx.getAll(effectRef(id), reservation);
            if (!effect.data()?.submission && lock.data()?.operationId === id) {
              tx.delete(reservation);
            }
          });
          throw error;
        }
      }
      if (source.value.changes.length && !submission) {
        return {state: "completed", replayed: true};
      }
      const projection = submission ? await adapter.reconcile({
        ...submission,
        authorizeMutation: async () => {
          await db.runTransaction(async (tx) => {
            const fresh = await load(tx, id);
            if (fresh.completed) {
              return rejectCoverage("coverage_effects_already_completed");
            }
          });
        },
      }) : null;
      if (projection?.kind === "ambiguous") {
        return {state: "pending", replayed: false};
      }
      return db.runTransaction(async (tx) => {
        const fresh = await load(tx, id);
        if (fresh.completed) return {state: "completed", replayed: true};
        if (fresh.value.changes.length && projection?.kind !== "verified") {
          return rejectCoverage("coverage_effects_readback_required");
        }
        const now = input.nowMillis();
        if (!Number.isSafeInteger(now) || now < 0) {
          return rejectCoverage("invalid_coverage_clock");
        }
        const deliveredTo: string[] = [];
        for (const intent of fresh.value.notifications) {
          const user = fresh.users.docs.find((doc) => doc.id === intent.userId);
          if (!user || !coverageMember(user.data()).active) continue;
          const eventId = intent.push.data.eventId;
          const inbox = buildNotificationInboxDocument(eventId, {
            ...intent.push.notification, type: intent.push.data.type,
            target: "users", targetPayload: {userIds: [intent.userId]},
            createdBy: "system", sentAt: Timestamp.fromMillis(now),
          }, intent.userId) ?? rejectCoverage("coverage_effects_inbox_invalid");
          tx.create(db.doc(`${root}/users/${intent.userId}/` +
            `notificationInbox/${eventId}`), inbox);
          deliveredTo.push(intent.userId);
        }
        tx.update(effectRef(id), {state: "completed", projection,
          completedAt: Timestamp.fromMillis(now), deliveredTo});
        if (fresh.value.changes.length) tx.delete(reservation);
        return {state: "completed", replayed: false};
      });
    },
  };
};
