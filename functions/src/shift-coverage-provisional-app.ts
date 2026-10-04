import {randomUUID} from "node:crypto";
import {deleteApp, initializeApp} from "firebase-admin/app";
import {getAuth} from "firebase-admin/auth";
import {requireProvisionalCreditPublication} from
  "./shift-credit-publication.js";
import {rejectCoverage} from "./shift-coverage.js";
import {createShiftCoverageHttpHandler} from "./shift-coverage-http.js";
import {createProvisionalShiftCoverageStore} from
  "./shift-coverage-provisional-store.js";

const requireLocalEnvironment = () => {
  requireProvisionalCreditPublication("develop");
  if (process.env.FIREBASE_AUTH_EMULATOR_HOST !== "127.0.0.1:9098") {
    return rejectCoverage("coverage_provisional_auth_emulator_required");
  }
};

/**
 * Compose actual Admin Auth verification and Firestore against fixed emulators.
 * No bypass verifier, client actor ID, production project or function export is
 * accepted. Close releases only these owned local SDK clients.
 * @param {object} options Explicit provisional policy and trusted clock.
 * @return {object} Local handler and cleanup; no listener starts.
 */
export const createProvisionalShiftCoverageApp = (
  options: Parameters<typeof createProvisionalShiftCoverageStore>[0],
) => {
  requireLocalEnvironment();
  const store = createProvisionalShiftCoverageStore(options);
  const app = initializeApp({projectId: "demo-reguerta-hu084-coverage"},
    `hu084-app-${randomUUID()}`);
  const auth = getAuth(app);
  return {
    handle: createShiftCoverageHttpHandler({requireLocalEnvironment,
      verifyToken: (token, checkRevoked) =>
        auth.verifyIdToken(token, checkRevoked),
      execute: (command, identity) => store.execute(command, identity),
      read: (query, identity) => store.readClient(query, identity)}),
    close: async () => {
      try {
        await store.close();
      } finally {
        await deleteApp(app);
      }
    },
  };
};
