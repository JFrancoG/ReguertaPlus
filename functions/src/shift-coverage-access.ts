import {Firestore, Transaction} from "@google-cloud/firestore";
import {AppEnvironment, HttpRequestError, resolveLinkedMember,
  VerifiedIdentity} from
  "./backend-security.js";
import {coverageId, coverageMember} from "./shift-coverage.js";

/**
 * Resolve both sides of the account link in the caller's transaction.
 * @param {Firestore} db Fixed-emulator database.
 * @param {Transaction} transaction Caller-owned read/write transaction.
 * @param {VerifiedIdentity} identity Identity from a verified token.
 * @param {string} environment Canonical authenticated environment.
 * @return {object} Current linked member, role and eligibility.
 */
export const readShiftCoverageActor = async (
  db: Firestore, transaction: Transaction, identity: VerifiedIdentity,
  environment: AppEnvironment = "develop",
) => {
  if (!identity.uid || identity.uid.length > 128 ||
      identity.uid.includes("/")) {
    throw new HttpRequestError(401, "unauthenticated", "Invalid identity");
  }
  const root = `${environment}/plus-collections`;
  const link = await transaction.get(
    db.doc(`${root}/authLinks/${identity.uid}`));
  const memberId = link.data()?.memberId;
  if (typeof memberId !== "string" || !memberId || memberId.includes("/")) {
    throw new HttpRequestError(403, "unlinked_account",
      "Account is not linked");
  }
  coverageId(memberId);
  const member = await transaction.get(db.doc(`${root}/users/${memberId}`));
  resolveLinkedMember(identity.uid, link.data(), member.data());
  return {memberId, ...coverageMember(member.data())};
};
