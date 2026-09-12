import {createShiftCreditRehearsal} from "./shift-credit-rehearsal.js";
import {
  commitCoverageDraw,
  CoverageBeaconPolicy,
  parseCoverageBeaconPolicy,
  revealCoverageDraw,
} from "./shift-coverage-draw.js";
import {
  advanceCoverageSelection,
  coverageCandidateExclusion,
  CoverageCandidate,
  CoverageReserve,
  CoverageSelectionPolicy,
  createCoverageSelection,
  parseCoverageSelectionPolicy,
} from "./shift-coverage-selection.js";
import {Firestore, Timestamp} from "@google-cloud/firestore";
import {createShiftPlanningDigest as digest} from "./shift-planning-digest.js";
import {
  parseShiftPlanningPublicShiftDocument,
  ShiftPlanningPublicShiftDocument,
} from "./shift-planning-publication-contract.js";
import {
  assertShiftPlanningWriterAuthority,
  captureShiftPlanningWriterAuthority,
} from "./shift-planning-writer-authority.js";
import {
  coverageId,
  coverageMember,
  parseShiftCoverageCommand,
  rejectCoverage,
  SHIFT_COVERAGE_POLICY_REVISION,
  ShiftCoverageCase,
  ShiftCoverageCredit,
} from "./shift-coverage.js";

const projectId = "demo-reguerta-hu084-coverage";
const host = "127.0.0.1:8798";
const root = "develop/plus-collections";
const hashId = (values: string[]) =>
  digest(values).slice("shift-planning:v1:sha256:".length);
const ownership = (shift: ShiftPlanningPublicShiftDocument) => digest({
  owner: shift.rotationOwnerUserId, owners: shift.rotationOwnerUserIds,
  round: shift.roundNumber, position: shift.positionInRound,
  positions: shift.rotationPositions?.map((position) => ({
    owner: position.rotationOwnerUserId, round: position.roundNumber,
    position: position.positionInRound,
  })) ?? null,
});
const context = (shift: ShiftPlanningPublicShiftDocument | undefined) =>
  shift ? {assigned: shift.assignedUserIds, helper: shift.helperUserId,
    assignment: shift.assignmentRevision, document: shift.documentRevision,
    completion: shift.completion.state,
    revision: shift.completion.revision} : null;

/**
 * Runs provisional administrative coverage exclusively in a fixed local
 * emulator. No endpoint imports this store; it cannot construct a live client.
 * The identity is an already resolved member ID, not a field in the command.
 * Membership/roles, source neighborhood and claims are re-read transactionally.
 * Offer duration is required test policy, not an implicit assembly decision.
 * @param {object} options Trusted clock and explicit provisional offer bound.
 * @return {object} Execute and close the isolated prototype store.
 */
export const createProvisionalShiftCoverageStore = (options: {
  nowMillis: () => number;
  maximumOfferWindowMillis: number;
  selectionPolicy?: CoverageSelectionPolicy;
  beaconPolicy?: CoverageBeaconPolicy;
}) => {
  if (process.env.GCLOUD_PROJECT !== projectId ||
      process.env.FIRESTORE_EMULATOR_HOST !== host ||
      !Number.isSafeInteger(options.maximumOfferWindowMillis) ||
      options.maximumOfferWindowMillis <= 0) {
    return rejectCoverage("coverage_provisional_emulator_required");
  }
  const {nowMillis, maximumOfferWindowMillis} = options;
  const selectionPolicy = options.selectionPolicy ?
    parseCoverageSelectionPolicy(options.selectionPolicy) : undefined;
  const beaconPolicy = options.beaconPolicy ?
    parseCoverageBeaconPolicy(options.beaconPolicy) : undefined;
  const db = new Firestore({projectId, host, ssl: false});
  const ref = (collection: string, id: string) =>
    db.doc(`${root}/${collection}/${id}`);

  return {
    ...createShiftCreditRehearsal(db, nowMillis),
    close: () => db.terminate(),
    async execute(value: unknown, actorMemberId: string) {
      const command = parseShiftCoverageCommand(value);
      const actorId = coverageId(actorMemberId);
      const commandDigest = digest({actorId, command});
      const caseRef = ref("shiftCoverageCases", command.caseId);
      const receiptRef = ref("shiftCoverageOperations", command.operationId);
      return db.runTransaction(async (transaction) => {
        const now = nowMillis();
        if (!Number.isSafeInteger(now) || now < 0) {
          return rejectCoverage("invalid_coverage_clock");
        }
        const [actorSnapshot, caseSnapshot, receiptSnapshot, maintenance] =
          await transaction.getAll(ref("users", actorId), caseRef, receiptRef,
            ref("shiftPlanningState", "current"));
        const actor = coverageMember(actorSnapshot.data());
        if (!actor.active ||
            (["offer", "offerNext", "startSelection", "expire", "complete",
              "fail", "commitDraw", "revealDraw", "offerAdmin", "resumeAdmin"]
              .includes(command.action) &&
              !actor.admin)) return rejectCoverage("coverage_actor_forbidden");
        const authority =
          captureShiftPlanningWriterAuthority(maintenance.data());
        if (!authority) return rejectCoverage("coverage_authority_required");
        if (receiptSnapshot.exists) {
          const receipt = receiptSnapshot.data() ??
            rejectCoverage("invalid_coverage_receipt");
          if (receipt.commandDigest !== commandDigest) {
            return rejectCoverage("coverage_operation_conflict");
          }
          return {case: receipt.result as ShiftCoverageCase, replayed: true};
        }
        const stored = caseSnapshot.data();
        const previous = stored?.value as ShiftCoverageCase | undefined;
        if (stored && (stored.digest !== digest(previous) ||
            previous?.id !== command.caseId ||
              previous.environment !== "develop" ||
            previous.policyRevision !== SHIFT_COVERAGE_POLICY_REVISION)) {
          return rejectCoverage("invalid_coverage_case");
        }
        if ((previous?.revision ?? 0) !== command.expectedRevision ||
            (command.action === "open") === Boolean(previous)) {
          return rejectCoverage("coverage_revision_conflict");
        }
        if (previous && now < previous.updatedAtMillis) {
          return rejectCoverage("invalid_coverage_clock");
        }
        if (previous) {
          assertShiftPlanningWriterAuthority({
            capturedValue: stored?.authority,
            currentStateValue: maintenance.data(),
            changedCode: "coverage_authority_changed",
            changedMessage: "Coverage planning authority changed",
          });
        }
        const shiftId = command.action === "open" ?
          command.shiftId : (previous?.shiftId ??
          rejectCoverage("coverage_case_missing"));
        const shifts = await transaction.get(
          db.collection(`${root}/shifts`).limit(1001),
        );
        if (shifts.size > 1000) return rejectCoverage("coverage_source_limit");
        const target = shifts.docs.find((item) => item.id === shiftId);
        if (!target) return rejectCoverage("coverage_shift_missing");
        const shift = parseShiftPlanningPublicShiftDocument({
          targetPath: target.ref.path, value: target.data(),
        });
        if (shift.documentRevision !== command.expectedShiftRevision ||
            shift.writeEpoch !== authority.writeEpoch ||
            shift.bundleRevision !== authority.activeRevision ||
            shift.bundleDigest !== authority.activeDigest) {
          return rejectCoverage("coverage_shift_changed");
        }
        const positionIndex = command.action === "open" ?
          shift.assignedUserIds.indexOf(command.absentUserId) :
          (previous?.positionIndex ?? -1);
        if (positionIndex < 0 ||
          positionIndex >= shift.assignedUserIds.length ||
            (previous && (previous.type !== shift.type ||
              previous.ownershipDigest !== ownership(shift)))) {
          return rejectCoverage("coverage_position_changed");
        }
        const slotRef = ref("shiftCoverageSlots", hashId([shiftId,
          String(positionIndex)]));
        const creditRef = ref("shiftCoverageCredits", command.caseId);
        const ledgerRef = ref("shiftCoverageLedgerState", shift.type);
        const [slotSnapshot, creditSnapshot, ledgerSnapshot] =
          await transaction.getAll(slotRef, creditRef, ledgerRef);
        if (command.action !== "open" &&
          slotSnapshot.data()?.caseId !== command.caseId) {
          return rejectCoverage("coverage_slot_changed");
        }
        const delivery = shift.type === "delivery" ? shifts.docs
          .filter((item) => item.data().type === "delivery")
          .map((item) => ({id: item.id, ref: item.ref,
            data: parseShiftPlanningPublicShiftDocument({
              targetPath: item.ref.path, value: item.data(),
            })}))
          .sort((a, b) => a.data.date.toMillis() - b.data.date.toMillis()) : [];
        const index = delivery.findIndex((item) => item.id === shiftId);
        const predecessor = delivery[index - 1];
        const successor = delivery[index + 1];
        const assignmentContextDigest = digest({
          target: context(shift), previous: context(predecessor?.data),
          next: context(successor?.data),
        });
        let preparedSelection = previous?.selection;
        let selectedUserId: string | null = null;
        let candidates: CoverageCandidate[] = [];
        const needsSelection = ["startSelection", "offerNext", "volunteer",
          "withdrawVolunteer", "commitDraw"].includes(command.action) ||
          (command.action === "accept" &&
            previous?.offer?.source === "reserve");
        if (needsSelection) {
          if (!previous || previous.status !==
              (command.action === "accept" ? "offered" : "open")) {
            return rejectCoverage("coverage_state_conflict");
          }
          if (command.action === "startSelection" && previous.selection) {
            return rejectCoverage("coverage_selection_already_started");
          }
          if (command.action === "startSelection" && previous.revision !== 1) {
            return rejectCoverage("coverage_selection_requires_new_case");
          }
          if (command.action !== "startSelection" && !previous.selection) {
            return rejectCoverage("coverage_selection_missing");
          }
          const users = await transaction.get(
            db.collection(`${root}/users`).limit(251));
          const reserves = await transaction.get(
            db.collection(`${root}/shiftCoverageReserves`)
              .where("type", "==", shift.type).limit(251));
          const claims = await transaction.get(
            db.collection(`${root}/shiftCoverageMemberClaims`)
              .where("type", "==", shift.type).limit(251));
          if ([users, reserves, claims].some((items) => items.size > 250)) {
            return rejectCoverage("coverage_selection_source_limit");
          }
          const reserveByUser = new Map<string, CoverageReserve>();
          for (const document of reserves.docs) {
            const value = document.data() as CoverageReserve;
            const id = coverageId(value.userId);
            if (document.id !== hashId([shift.type, id]) ||
                typeof value.active !== "boolean" ||
                !Number.isSafeInteger(value.enteredAtMillis) ||
                value.enteredAtMillis < 0 || value.enteredAtMillis > now ||
                !Number.isSafeInteger(value.revision) || value.revision < 1) {
              return rejectCoverage("invalid_coverage_reserve");
            }
            reserveByUser.set(id, {userId: id, type: shift.type,
              active: value.active, enteredAtMillis: value.enteredAtMillis,
              revision: value.revision});
          }
          const claimed = new Set(claims.docs.map((item) => {
            const id = coverageId(item.data().userId);
            if (item.id !== hashId([shift.type, id])) {
              return rejectCoverage("invalid_coverage_claim");
            }
            return id;
          }));
          const adjacentUserIds = shift.type === "delivery" ?
            [predecessor?.data.assignedUserIds[0],
              successor?.data.assignedUserIds[0]]
              .filter((id): id is string => Boolean(id)) : [];
          candidates = users.docs.map((item) => {
            let membership;
            try {
              membership = coverageMember(item.data());
            } catch {
              membership = {invalid: true};
            }
            return {userId: coverageId(item.id),
              memberDigest: digest(membership),
              reserve: reserveByUser.get(item.id) ?? null,
              exclusion: coverageCandidateExclusion({userId: item.id,
                memberValue: item.data(), claimed: claimed.has(item.id),
                assignedUserIds: shift.assignedUserIds, adjacentUserIds})};
          });
          if (command.action === "startSelection") {
            preparedSelection = createCoverageSelection({caseId: command.caseId,
              policy: parseCoverageSelectionPolicy(selectionPolicy),
              candidates});
          } else if (command.action === "offerNext" && preparedSelection) {
            const advanced = advanceCoverageSelection({
              selection: preparedSelection, candidates, now});
            preparedSelection = advanced.selection;
            selectedUserId = advanced.userId;
          }
        }
        let preparedDraw = previous?.selection?.draw;
        if (command.action === "commitDraw") {
          if (!preparedSelection ||
              preparedSelection.phase !== "drawRequired" ||
              preparedSelection.draw) {
            return rejectCoverage("coverage_draw_state_conflict");
          }
          const frozen = preparedSelection.snapshot.map((original) => {
            const current = candidates.find((item) =>
              item.userId === original.userId);
            return {...(current ?? original), exclusion: original.exclusion ??
              (preparedSelection?.attemptedUserIds.includes(original.userId) ?
                "already_offered" : current?.exclusion ??
                (!current ? "member_missing" : null))};
          });
          preparedSelection = structuredClone(preparedSelection);
          preparedSelection.latestExclusions = frozen.flatMap((item) =>
            item.exclusion ?
              [{userId: item.userId, reason: item.exclusion}] : []);
          if (frozen.every((item) => item.exclusion)) {
            preparedSelection.phase = "adminRequired";
          } else {
            preparedDraw = commitCoverageDraw({caseId: command.caseId,
              selectionDigest: preparedSelection.snapshotDigest,
              assignmentContextDigest, candidates: frozen,
              policy: beaconPolicy, now});
            if (preparedDraw.availableAtMillis >= shift.date.toMillis()) {
              return rejectCoverage("coverage_draw_too_late");
            }
            const published = await transaction.get(
              ref("shiftCoverageBeaconRounds", hashId([
                preparedDraw.beacon.sourceId, String(preparedDraw.round)])));
            if (published.exists) {
              return rejectCoverage("coverage_entropy_already_available");
            }
            preparedSelection.draw = preparedDraw;
          }
        } else if (command.action === "revealDraw") {
          if (previous?.status !== "open" ||
              preparedSelection?.phase !== "drawRequired" || !preparedDraw) {
            return rejectCoverage("coverage_draw_state_conflict");
          }
          if (preparedDraw.assignmentContextDigest !==
              assignmentContextDigest) {
            return rejectCoverage("coverage_draw_source_changed");
          }
          const published = await transaction.get(
            ref("shiftCoverageBeaconRounds", hashId([
              preparedDraw.beacon.sourceId, String(preparedDraw.round)])));
          preparedSelection = {...preparedSelection, phase: "draw",
            draw: revealCoverageDraw({draw: preparedDraw,
              value: published.data(), now})};
        }
        const candidateId = command.action === "offerNext" ? selectedUserId :
          command.action === "offer" || command.action === "offerAdmin" ?
            command.userId :
            previous?.acceptedUserId ?? previous?.offer?.userId;
        const claimRef = candidateId ?
          ref("shiftCoverageMemberClaims", hashId([shift.type, candidateId])) :
          null;
        const claim = claimRef ? await transaction.get(claimRef) : null;
        const candidate = candidateId && ["offer", "offerNext", "offerAdmin",
          "accept"].includes(command.action) ? coverageMember(
            (await transaction.get(ref("users", candidateId))).data(),
          ) : null;
        const pending = () => {
          if (shift.completion.state !== "uncompleted" ||
              shift.status === "swap_pending" || shift.date.toMillis() <= now) {
            return rejectCoverage("coverage_shift_unavailable");
          }
        };
        const eligible = () => {
          if (!candidate?.eligible || !candidateId ||
              shift.assignedUserIds.includes(candidateId) ||
              (claim?.exists && claim.data()?.caseId !== command.caseId)) {
            return rejectCoverage("coverage_candidate_ineligible");
          }
          if (shift.type === "delivery" && (!predecessor || !successor ||
              shift.helperUserId !== successor.data.assignedUserIds[0] ||
              (predecessor.data.completion.state === "uncompleted" &&
                predecessor.data.helperUserId !== shift.assignedUserIds[0]) ||
              [predecessor.data.assignedUserIds[0],
                successor.data.assignedUserIds[0]]
                .includes(candidateId))) {
            return rejectCoverage("coverage_delivery_neighborhood_conflict");
          }
        };
        const updatedAt = Timestamp.fromMillis(now);
        const writes = new Map<string, ShiftPlanningPublicShiftDocument>();
        const updateShift = (path: string,
          data: ShiftPlanningPublicShiftDocument) => {
          writes.set(path, parseShiftPlanningPublicShiftDocument({
            targetPath: path, value: data,
          }));
        };
        let next: ShiftCoverageCase;
        let claimAction: "hold" | "credit" | "release" | null = null;
        let releaseSlot = false;
        let credit: ShiftCoverageCredit | null = null;
        if (command.action === "open") {
          pending();
          if (!actor.admin && actorId !== command.absentUserId) {
            return rejectCoverage("coverage_actor_forbidden");
          }
          if (slotSnapshot.exists) {
            return rejectCoverage("coverage_slot_occupied");
          }
          next = {schemaVersion: 1,
            policyRevision: SHIFT_COVERAGE_POLICY_REVISION,
            environment: "develop", id: command.caseId, shiftId,
            type: shift.type,
            absentUserId: command.absentUserId, positionIndex,
            ownershipDigest: ownership(shift), openedByUserId: actorId,
            reason: command.reason, status: "open", revision: 1, offer: null,
            acceptedUserId: null, creditId: null, createdAtMillis: now,
            updatedAtMillis: now};
        } else {
          const current = previous ?? rejectCoverage("coverage_case_missing");
          next = {...current, revision: current.revision + 1,
            updatedAtMillis: now};
          switch (command.action) {
          case "startSelection": case "commitDraw": case "revealDraw":
            pending();
            next.selection = preparedSelection ??
              rejectCoverage("coverage_selection_missing");
            break;
          case "volunteer": case "withdrawVolunteer": {
            pending();
            const selection = structuredClone(current.selection) ??
              rejectCoverage("coverage_selection_missing");
            if (selection.phase !== "volunteers" ||
                selection.volunteerClosesAtMillis === null ||
                now >= selection.volunteerClosesAtMillis) {
              return rejectCoverage("coverage_volunteer_window_closed");
            }
            const entry = selection.volunteers.find(
              (v) => v.userId === actorId);
            if (command.action === "withdrawVolunteer") {
              if (!entry || entry.withdrawn) {
                return rejectCoverage("coverage_volunteer_missing");
              }
              entry.withdrawn = true;
            } else {
              const source = selection.snapshot.find(
                (v) => v.userId === actorId);
              const live = candidates.find((v) => v.userId === actorId);
              if (!source || source.exclusion || !live || live.exclusion ||
                  selection.attemptedUserIds.includes(actorId) || entry) {
                return rejectCoverage("coverage_candidate_ineligible");
              }
              selection.volunteers.push({userId: actorId,
                receivedAtMillis: now, withdrawn: false});
            }
            next.selection = selection;
            break;
          }
          case "resumeAdmin":
            pending();
            if (current.status !== "cancelled" || !current.selection?.draw ||
                shift.assignedUserIds[positionIndex] !== current.absentUserId) {
              return rejectCoverage("coverage_admin_resume_forbidden");
            }
            next.status = "open";
            next.selection = {...current.selection, phase: "adminRequired"};
            break;
          case "offer": case "offerNext": case "offerAdmin":
            pending();
            if (current.status !== "open" ||
                shift.assignedUserIds[positionIndex] !== current.absentUserId) {
              return rejectCoverage("coverage_state_conflict");
            }
            if (command.action === "offerNext") {
              next.selection = preparedSelection ??
                rejectCoverage("coverage_selection_missing");
              if (!selectedUserId) {
                const closes = next.selection.volunteerClosesAtMillis;
                if (closes !== null && (!Number.isSafeInteger(closes) ||
                    closes >= shift.date.toMillis())) {
                  return rejectCoverage("coverage_offer_deadline");
                }
                break;
              }
            } else if (command.action === "offerAdmin") {
              if (current.selection?.phase !== "adminRequired") {
                return rejectCoverage("coverage_admin_not_required");
              }
            } else if (current.selection) {
              return rejectCoverage(
                "coverage_selection_admin_override_blocked");
            }
            eligible();
            if (command.expiresAtMillis <= now ||
                command.expiresAtMillis > now + maximumOfferWindowMillis ||
                command.expiresAtMillis >= shift.date.toMillis()) {
              return rejectCoverage("coverage_offer_deadline");
            }
            next.status = "offered";
            next.offer = {id: command.operationId,
              userId: candidateId ??
                rejectCoverage("coverage_candidate_missing"),
              source: command.action !== "offerNext" ? "admin" :
                preparedSelection?.phase === "draw" ? "draw" :
                  preparedSelection?.phase === "reserve" ?
                    "reserve" : "volunteer",
              expiresAtMillis: command.expiresAtMillis,
              assignmentContextDigest};
            break;
          case "accept": case "decline": case "expire": {
            if (current.status !== "offered" || !current.offer) {
              return rejectCoverage("coverage_state_conflict");
            }
            if (command.action !== "expire" &&
              actorId !== current.offer.userId) {
              return rejectCoverage("coverage_actor_forbidden");
            }
            const expired = now >= current.offer.expiresAtMillis;
            if (expired !== (command.action === "expire")) {
              return rejectCoverage("coverage_offer_deadline");
            }
            if (command.action === "accept") {
              pending();
              eligible();
              if (current.offer.source === "reserve") {
                const original = current.selection?.snapshot.find(
                  (entry) => entry.userId === actorId)?.reserve;
                const live = candidates.find(
                  (entry) => entry.userId === actorId)?.reserve;
                if (!original || !live?.active ||
                    live.revision !== original.revision ||
                    live.enteredAtMillis !== original.enteredAtMillis) {
                  return rejectCoverage("coverage_reserve_changed");
                }
              }
              const sameContext = current.offer.assignmentContextDigest ===
                assignmentContextDigest;
              const sameAssignee = shift.assignedUserIds[positionIndex] ===
                current.absentUserId;
              if (!sameContext || !sameAssignee) {
                return rejectCoverage("coverage_offer_source_changed");
              }
              const assigned = [...shift.assignedUserIds];
              assigned[positionIndex] = actorId;
              updateShift(target.ref.path, {...shift, assignedUserIds: assigned,
                rotationPositions: shift.rotationPositions?.map((position, i) =>
                  ({...position, effectiveAssigneeUserId: assigned[i]})) ??
                    null,
                assignmentRevision: shift.assignmentRevision + 1,
                documentRevision: shift.documentRevision + 1, updatedAt});
              if (predecessor &&
                predecessor.data.completion.state === "uncompleted") {
                updateShift(predecessor.ref.path, {...predecessor.data,
                  helperUserId: actorId,
                  documentRevision: predecessor.data.documentRevision + 1,
                  updatedAt});
              }
              next.status = "accepted";
              next.acceptedUserId = actorId;
              claimAction = "hold";
            } else {
              next.status = "open";
              next.offer = null;
            }
            break;
          }
          case "cancel":
            if ((!actor.admin && actorId !== current.openedByUserId) ||
                !["open", "offered"].includes(current.status)) {
              return rejectCoverage("coverage_state_conflict");
            }
            next.status = "cancelled";
            next.offer = null;
            // Retain a committed draw's vacancy through cancellation so a new
            // case cannot reset its seed. Explicit admin resume keeps evidence.
            releaseSlot = !current.selection?.draw;
            break;
          case "fail": case "complete": {
            if (current.status !== "accepted" || !candidateId ||
                claim?.data()?.caseId !== command.caseId ||
                claim.data()?.state !== "accepted" ||
                shift.assignedUserIds[positionIndex] !== candidateId) {
              return rejectCoverage("coverage_state_conflict");
            }
            if (command.action === "fail") {
              if (shift.completion.state !== "uncompleted") {
                return rejectCoverage("coverage_already_completed");
              }
              next.status = "failed";
              claimAction = "release";
            } else {
              if (now < shift.date.toMillis() || creditSnapshot.exists ||
                  shift.status === "swap_pending") {
                return rejectCoverage("coverage_completion_conflict");
              }
              let completion = shift.completion;
              if (completion.state === "uncompleted") {
                if (shift.type === "delivery" && (!successor ||
                    shift.helperUserId !== successor.data.assignedUserIds[0] ||
                    shift.assignedUserIds[0] === shift.helperUserId)) {
                  return rejectCoverage(
                    "coverage_delivery_neighborhood_conflict",
                  );
                }
                completion = {state: "completed", revision: 1,
                  completedAt: updatedAt,
                  actualHelperUserId: shift.type === "delivery" ?
                    shift.helperUserId : null,
                  helperSourceAssignmentRevision: shift.type === "delivery" ?
                    successor?.data.assignmentRevision ?? null : null};
                updateShift(target.ref.path, {...shift, completion,
                  documentRevision: shift.documentRevision + 1, updatedAt});
              }
              credit = {schemaVersion: 1,
                policyRevision: SHIFT_COVERAGE_POLICY_REVISION,
                id: command.caseId, caseId: command.caseId, shiftId,
                type: shift.type,
                userId: candidateId, state: "pending", earnedAtMillis: now,
                completionRevision: completion.revision};
              next.status = "completed";
              next.creditId = credit.id;
              claimAction = "credit";
            }
            releaseSlot = true;
            break;
          }
          }
        }
        const ledgerRevision = ledgerSnapshot.data()?.revision ?? 0;
        if (!Number.isSafeInteger(ledgerRevision) || ledgerRevision < 0 ||
            ledgerRevision === Number.MAX_SAFE_INTEGER) {
          return rejectCoverage("invalid_coverage_ledger");
        }
        if (claimAction !== null && !claimRef) {
          return rejectCoverage("coverage_claim_missing");
        }
        // Every read and validation precedes all writes. Firestore retries the
        // entire source/claim/ledger observation on concurrent modifications.
        if (command.action === "open") {
          transaction.create(slotRef,
            {caseId: next.id});
        }
        if (releaseSlot) transaction.delete(slotRef);
        if (claimAction === "release" && claimRef) transaction.delete(claimRef);
        if (claimRef && (claimAction === "hold" || claimAction === "credit")) {
          transaction.set(claimRef, {caseId: next.id, userId: candidateId,
            type: shift.type, state: claimAction === "hold" ?
              "accepted" : "creditPending"});
        }
        if (credit) {
          transaction.create(creditRef, credit);
          transaction.set(ledgerRef, {revision: ledgerRevision + 1});
        }
        writes.forEach((data, path) => transaction.set(db.doc(path), data));
        transaction.set(caseRef, {value: next, digest: digest(next),
          authority});
        transaction.create(receiptRef, {commandDigest, command,
          actorMemberId: actorId,
          result: next, previousRevision: previous?.revision ?? 0});
        return {case: next, replayed: false};
      });
    },
  };
};
