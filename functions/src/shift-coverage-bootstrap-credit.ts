import {coverageId, ShiftCoverageCredit} from "./shift-coverage.js";
import {parseShiftCoverageCredit} from "./shift-credit-unit.js";
import {isReleasedShiftCoverageClaim} from "./shift-credit-publication.js";
import {createShiftPlanningDigest as digest} from "./shift-planning-digest.js";

type Document = {id: string; data: unknown};
type Collection = "shiftCoverageCredits" | "shiftCoverageMemberClaims" |
  "shiftCoverageLedgerState";
type Data = Record<string, unknown>;
type Kind = "delivery" | "market";

export type ShiftCoverageBootstrapCreditBlocker = {
  code: string; collection: Collection; id: string;
};
export type ShiftCoverageBootstrapLedgerCreate = {
  collection: "shiftCoverageLedgerState";
  id: Kind;
  data: {revision: 0};
};

const types = ["delivery", "market"] as const;
const record = (value: unknown): value is Data =>
  value !== null && typeof value === "object" &&
  Object.getPrototypeOf(value) === Object.prototype &&
  Object.getOwnPropertySymbols(value).length === 0;
const exactKeys = (value: Data, expected: string[]) =>
  Object.keys(value).sort().join() === [...expected].sort().join();
const kind = (value: unknown): value is Kind =>
  value === "delivery" || value === "market";
const claimId = (type: Kind, userId: string) =>
  digest([type, userId]).split(":").at(-1);

/**
 * Validate an explicitly declared zero opening balance without reconstructing
 * past coverage. Existing consumed/cancelled rows and their released claims
 * remain untouched. Missing generations can start at zero only when no credit
 * history exists for that type; history never justifies an invented generation.
 * Any blocker suppresses all creates. Source-set CAS and apply ownership belong
 * to the enclosing bootstrap plan, not to this pure semantic validator.
 * @param {object} input Complete decoded credit, claim and ledger collections.
 * @return {object} Reviewable blockers or create-only missing zero ledgers.
 */
export const planZeroShiftCoverageCredits = (input: {
  credits: readonly Document[];
  claims: readonly Document[];
  ledgers: readonly Document[];
}): {
  blockers: ShiftCoverageBootstrapCreditBlocker[];
  creates: ShiftCoverageBootstrapLedgerCreate[];
} => {
  const blockers: ShiftCoverageBootstrapCreditBlocker[] = [];
  const credits = new Map<string, ShiftCoverageCredit>();
  const ledgers = new Map<Kind, number>();
  const block = (code: string, collection: Collection, id: string) => {
    blockers.push({code, collection, id});
  };
  const duplicate = (rows: readonly Document[], collection: Collection) => {
    const seen = new Set<string>();
    for (const row of rows) {
      if (seen.has(row.id)) {
        block("bootstrap_credit_duplicate_source", collection, row.id);
      }
      seen.add(row.id);
    }
  };
  duplicate(input.credits, "shiftCoverageCredits");
  duplicate(input.claims, "shiftCoverageMemberClaims");
  duplicate(input.ledgers, "shiftCoverageLedgerState");
  for (const row of input.credits) {
    try {
      if (!record(row.data)) throw new Error("Invalid credit record");
      const credit = parseShiftCoverageCredit(row.data);
      if (credit.id !== row.id) throw new Error("Credit identity changed");
      credits.set(row.id, credit);
      if (credit.state === "pending") {
        block("bootstrap_credit_pending_conflicts_with_zero",
          "shiftCoverageCredits", row.id);
      }
    } catch {
      block("bootstrap_credit_source_invalid", "shiftCoverageCredits", row.id);
    }
  }
  for (const row of input.ledgers) {
    const data = row.data;
    if (!kind(row.id) || !record(data) || !exactKeys(data, ["revision"]) ||
      !Number.isSafeInteger(data.revision) || (data.revision as number) < 0 ||
      (data.revision as number) >= Number.MAX_SAFE_INTEGER - 1) {
      block("bootstrap_credit_ledger_invalid",
        "shiftCoverageLedgerState", row.id);
      continue;
    }
    ledgers.set(row.id, data.revision as number);
  }
  for (const row of input.claims) {
    const data = row.data;
    try {
      if (!record(data) || !kind(data.type) ||
          claimId(data.type, coverageId(data.userId)) !== row.id) {
        throw new Error("Invalid claim identity");
      }
      coverageId(data.caseId);
      const credit = credits.get(data.caseId as string);
      if (data.state === "accepted" || data.state === "creditPending") {
        if (!exactKeys(data, ["caseId", "state", "type", "userId"]) ||
            (data.state === "accepted" && credit) ||
            (data.state === "creditPending" &&
              (credit?.state !== "pending" || credit.type !== data.type ||
                credit.userId !== data.userId))) {
          throw new Error("Invalid active claim");
        }
        block("bootstrap_credit_active_claim_conflicts_with_zero",
          "shiftCoverageMemberClaims", row.id);
        continue;
      }
      if (!isReleasedShiftCoverageClaim(data) || !credit ||
          credit.type !== data.type || credit.userId !== data.userId ||
          (credit.state === "consumed" ?
            credit.consumedByPlanId !== data.consumedByPlanId ||
              credit.consumedAtMillis !== data.consumedAtMillis :
            credit.state !== "cancelled" ||
              credit.cancelledByMembershipOperationId !==
                data.cancelledByMembershipOperationId ||
              credit.cancelledAtMillis !== data.cancelledAtMillis)) {
        throw new Error("Released claim lacks matching credit history");
      }
    } catch {
      block("bootstrap_credit_claim_invalid",
        "shiftCoverageMemberClaims", row.id);
    }
  }
  const creates: ShiftCoverageBootstrapLedgerCreate[] = [];
  for (const type of types) {
    const history = [...credits.values()].some((credit) =>
      credit.type === type);
    const revision = ledgers.get(type);
    if (history && (revision === undefined || revision === 0)) {
      block("bootstrap_credit_history_generation_missing",
        "shiftCoverageLedgerState", type);
    } else if (revision === undefined) {
      creates.push({collection: "shiftCoverageLedgerState", id: type,
        data: {revision: 0}});
    }
  }
  blockers.sort((a, b) => {
    const left = `${a.collection}/${a.id}/${a.code}`;
    const right = `${b.collection}/${b.id}/${b.code}`;
    return left < right ? -1 : left > right ? 1 : 0;
  });
  return {blockers, creates: blockers.length ? [] : creates};
};
