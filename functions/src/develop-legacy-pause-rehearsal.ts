import {AsyncLocalStorage} from "node:async_hooks";
import {createHash, randomUUID} from "node:crypto";
import {Firestore, Transaction} from "@google-cloud/firestore";

export const DEPLOYED_LEGACY_SOURCE_SHA256 =
  "405d00ce204f64565d553649e1786fb968818024bf437c250c73514f1ffc1883";
export const DEVELOP_PAUSE_REHEARSAL_PROJECT =
  "demo-reguerta-writer-controls";
const CONTROL_PATH = "shiftWriterPauses/develop";
const HTTP_HANDLERS = [
  "syncShiftsFromGoogleSheets", "exportShiftsToGoogleSheets",
];
const EVENT_HANDLERS = [
  "onShiftPlanningRequestCreated", "onShiftWritten",
  "onDeliveryCalendarOverrideWritten", "onNotificationEventCreated",
];
type State = {
  schemaVersion: 1; mode: "open" | "paused"; generation: number;
  active: number; deferred: number; uncertain: number;
  legacyUntracked: true;
};
type Attempt = {
  sealed: boolean; effects: number; uncertain: boolean; settled: boolean;
  digest?: string; envelope?: string;
};
type Context = {
  store: DevelopLegacyPauseRehearsal; id: string; sealed: boolean;
};
const invocation = new AsyncLocalStorage<Context>();

/** A local rejection never certifies a shared writer barrier. */
export class DevelopLegacyPauseRehearsalError extends Error {
  /** @param {string} code Fixed sanitized rejection code. */
  constructor(readonly code: string) {
    super(code);
  }
}

/**
 * Require the isolated emulator before constructing any SDK client.
 * @return {DevelopLegacyPauseRehearsal} Local journal.
 */
export function createDevelopLegacyPauseRehearsal():
DevelopLegacyPauseRehearsal {
  if (process.env.GCLOUD_PROJECT !== DEVELOP_PAUSE_REHEARSAL_PROJECT ||
      process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8897") {
    throw new DevelopLegacyPauseRehearsalError("local_emulator_required");
  }
  return new DevelopLegacyPauseRehearsal();
}

/**
 * Demo-only journal. No reopen, drain checkpoint, lease expiry or live adapter
 * is provided: legacy revisions and deferred deliveries remain unproven.
 */
export class DevelopLegacyPauseRehearsal {
  private readonly control;
  private readonly db: Firestore;
  /** Construct only the fixed isolated emulator connection. */
  constructor() {
    if (process.env.GCLOUD_PROJECT !== DEVELOP_PAUSE_REHEARSAL_PROJECT ||
        process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8897") {
      throw new DevelopLegacyPauseRehearsalError("local_emulator_required");
    }
    this.db = new Firestore({
      projectId: DEVELOP_PAUSE_REHEARSAL_PROJECT,
      host: "127.0.0.1:8897", ssl: false,
    });
    this.control = this.db.doc(CONTROL_PATH);
  }

  /** Explicit fixture setup; absence must never imply open admission. */
  async initializeOpen(): Promise<void> {
    await this.control.create(this.initialState("open"));
  }

  /** Serialize admission; previously running legacy code stays unproven. */
  async pause(): Promise<void> {
    await this.db.runTransaction(async (tx) => {
      const state = this.state((await tx.get(this.control)).data());
      if (!state) throw new DevelopLegacyPauseRehearsalError("state_missing");
      tx.update(this.control, {
        mode: "paused", generation: state.generation + 1,
      });
    });
  }

  /**
   * Counts are diagnostic only; legacyUntracked always prevents closure.
   * @return {Promise<object>} Unqualified local diagnostics.
   */
  async assess(): Promise<{
    state: State | null; trackedIdle: boolean;
    canClaimClosure: false; canApply: false;
  }> {
    const state = this.state((await this.control.get()).data());
    return {
      state,
      trackedIdle: state !== null && state.active === 0 &&
        state.deferred === 0 && state.uncertain === 0,
      canClaimClosure: false, canApply: false,
    };
  }

  /** Release only the local SDK connection; this does not reopen writers. */
  async dispose(): Promise<void> {
    await this.db.terminate();
  }

  /**
   * Admission and pause share one transaction serialization point.
   * @param {string} id Invocation identity.
   * @param {string} envelope Stable event wire payload when applicable.
   * @return {Promise<string>} Local admission decision.
   */
  async admit(
    id: string,
    envelope?: string,
  ): Promise<"admitted" | "paused" | "duplicate"> {
    const attempt = this.control.collection("attempts").doc(id);
    const deferred = this.control.collection("deferred").doc(id);
    return this.db.runTransaction(async (tx) => {
      const [control, previous, pending] = await tx.getAll(
        this.control, attempt, deferred,
      );
      const state = this.state(control.data());
      if (previous.exists || pending.exists) {
        const prior = previous.exists ? previous : pending;
        if (envelope && prior.get("digest") !== sha256(envelope)) {
          throw new DevelopLegacyPauseRehearsalError("event_payload_conflict");
        }
        return "duplicate";
      }
      if (!state || state.mode === "paused") return "paused";
      tx.create(attempt, {
        sealed: false, effects: 0, uncertain: false, settled: false,
        ...(envelope ? {digest: sha256(envelope), envelope} : {}),
      });
      tx.update(this.control, {active: state.active + 1});
      return "admitted";
    });
  }

  /**
   * Persist the original wire event before acknowledging deferral. This is a
   * reconciliation record, not an automatic replay claim. Duplicates cannot
   * replace a payload or erase a previous uncertainty.
   * @param {string} id Event identity digest.
   * @param {string} envelope Complete original event wire payload.
   */
  async retain(id: string, envelope: string): Promise<void> {
    const ref = this.control.collection("deferred").doc(id);
    const digest = sha256(envelope);
    await this.db.runTransaction(async (tx) => {
      const [control, previous] = await tx.getAll(this.control, ref);
      const state = this.state(control.data());
      if (previous.exists) {
        if (previous.get("digest") !== digest) {
          throw new DevelopLegacyPauseRehearsalError("event_payload_conflict");
        }
        return;
      }
      tx.create(ref, {
        envelope, digest, sourceSha256: DEPLOYED_LEGACY_SOURCE_SHA256,
        replayable: false, requiresGovernedReconciliation: true,
      });
      if (state) {
        tx.update(this.control, {deferred: state.deferred + 1});
      } else {
        tx.create(this.control, {
          ...this.initialState("paused"), deferred: 1,
        });
      }
    });
  }

  /**
   * Record an outbound mutation before allowing the port to execute.
   * @param {string} id Admitted invocation identity.
   */
  async startEffect(id: string): Promise<void> {
    await this.changeAttempt(id, (attempt) => {
      if (attempt.sealed || attempt.settled) {
        throw new DevelopLegacyPauseRehearsalError("late_effect_rejected");
      }
      return {...attempt, effects: attempt.effects + 1};
    });
  }

  /**
   * A rejected port stays uncertain even if legacy catches its failure.
   * @param {string} id Admitted invocation identity.
   * @param {boolean} uncertain Whether acknowledgment was uncertain.
   */
  async finishEffect(id: string, uncertain: boolean): Promise<void> {
    await this.changeAttempt(id, (attempt) => {
      if (attempt.effects < 1) {
        throw new DevelopLegacyPauseRehearsalError("effect_state_invalid");
      }
      return {
        ...attempt, effects: attempt.effects - 1,
        uncertain: attempt.uncertain || uncertain,
      };
    });
  }

  /**
   * Callback settlement cannot release still-running outbound effects.
   * @param {string} id Admitted invocation identity.
   * @param {boolean} uncertain Whether callback failed.
   */
  async seal(id: string, uncertain: boolean): Promise<void> {
    await this.changeAttempt(id, (attempt) => ({
      ...attempt, sealed: true, uncertain: attempt.uncertain || uncertain,
    }));
  }

  /**
   * Atomically settle the local invocation once all tracked effects finish.
   * @param {string} id Invocation identity.
   * @param {Function} change State transition.
   */
  private async changeAttempt(
    id: string,
    change: (attempt: Attempt) => Attempt,
  ): Promise<void> {
    const ref = this.control.collection("attempts").doc(id);
    await this.db.runTransaction(async (tx: Transaction) => {
      const [control, snapshot] = await tx.getAll(this.control, ref);
      const state = this.state(control.data());
      const original = snapshot.data() as Attempt | undefined;
      if (!state || !original || original.settled) {
        throw new DevelopLegacyPauseRehearsalError("attempt_state_invalid");
      }
      const next = change(original);
      if (next.sealed && next.effects === 0) {
        if (state.active < 1) {
          throw new DevelopLegacyPauseRehearsalError("active_state_invalid");
        }
        next.settled = true;
        tx.update(this.control, {
          active: state.active - 1,
          uncertain: state.uncertain + (next.uncertain ? 1 : 0),
        });
      }
      tx.set(ref, next);
    });
  }

  /**
   * @param {string} mode Explicit initial admission mode.
   * @return {State} Unverified legacy state.
   */
  private initialState(mode: "open" | "paused"): State {
    return {
      schemaVersion: 1, mode, generation: 0, active: 0,
      deferred: 0, uncertain: 0, legacyUntracked: true,
    };
  }

  /**
   * @param {object|undefined} value Stored control data.
   * @return {State|null} Validated control data.
   */
  private state(value: FirebaseFirestore.DocumentData | undefined):
  State | null {
    if (!value) return null;
    if (value.schemaVersion !== 1 || value.legacyUntracked !== true ||
        !["open", "paused"].includes(value.mode) ||
        ![value.generation, value.active, value.deferred, value.uncertain]
          .every((count) => Number.isSafeInteger(count) && count >= 0)) {
      throw new DevelopLegacyPauseRehearsalError("control_state_invalid");
    }
    return value as State;
  }
}

/**
 * Exact production dispatch bypasses every journal operation. The caller must
 * use the deployed resolver: only exact canonical environments are accepted.
 * Deferred events are retained locally, never acknowledged as executed.
 * @param {object} options Resolved dispatch and callback dependencies.
 * @return {Promise<unknown>} Original result or durable deferral decision.
 */
export async function runDevelopLegacyPauseRehearsal<T>(options: {
  environment: string;
  entryPoint: string;
  kind: "http" | "event";
  event?: {id: string; payload: unknown};
  store: () => DevelopLegacyPauseRehearsal;
  invoke: () => Promise<T>;
}): Promise<T | {kind: "deferred" | "duplicate"}> {
  if (!["http", "event"].includes(options.kind)) {
    throw new DevelopLegacyPauseRehearsalError("entry_point_invalid");
  }
  const handlers = options.kind === "http" ? HTTP_HANDLERS : EVENT_HANDLERS;
  if (!handlers.includes(options.entryPoint)) {
    throw new DevelopLegacyPauseRehearsalError("entry_point_invalid");
  }
  if (options.environment === "production") {
    return invocation.exit(options.invoke);
  }
  if (options.environment !== "develop") {
    throw new DevelopLegacyPauseRehearsalError("environment_invalid");
  }
  let envelope: string | undefined;
  let id: string;
  if (options.kind === "event") {
    if (!options.event || !options.event.id || options.event.id.length > 512) {
      throw new DevelopLegacyPauseRehearsalError("event_identity_invalid");
    }
    envelope = encodeEnvelope(options.entryPoint, options.event);
    id = sha256(options.entryPoint + ":" + options.event.id);
  } else {
    id = randomUUID();
  }
  const store = options.store();
  const admission = await store.admit(id, envelope);
  if (admission === "duplicate") return {kind: "duplicate"};
  if (admission === "paused") {
    if (envelope) {
      await store.retain(id, envelope);
      return {kind: "deferred"};
    }
    throw new DevelopLegacyPauseRehearsalError("develop_paused");
  }
  const context: Context = {store, id, sealed: false};
  return invocation.run(context, async () => {
    let failed = true;
    try {
      const result = await options.invoke();
      failed = false;
      return result;
    } finally {
      context.sealed = true;
      await store.seal(id, failed);
    }
  });
}

/**
 * Wrap mutating dependency ports in the local harness. Outside a develop
 * invocation (including production), the port runs without journal I/O.
 * @param {Function} work Actual mutating dependency port.
 * @return {Promise<unknown>} Original dependency result.
 */
export async function runDevelopLegacyRehearsalEffect<T>(
  work: () => Promise<T>,
): Promise<T> {
  const context = invocation.getStore();
  if (!context) return work();
  if (context.sealed) {
    throw new DevelopLegacyPauseRehearsalError("late_effect_rejected");
  }
  await context.store.startEffect(context.id);
  let failed = true;
  try {
    const result = await work();
    failed = false;
    return result;
  } finally {
    await context.store.finishEffect(context.id, failed);
  }
}

/**
 * @param {string} value Stable wire data.
 * @return {string} SHA-256 digest.
 */
function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * @param {string} entryPoint Legacy callback identity.
 * @param {object} event Complete synthetic wire event.
 * @return {string} Bounded original event envelope.
 */
function encodeEnvelope(
  entryPoint: string,
  event: {id: string; payload: unknown},
): string {
  const envelope = JSON.stringify({
    entryPoint, id: event.id, payload: event.payload,
    sourceSha256: DEPLOYED_LEGACY_SOURCE_SHA256,
  }, (_key, value: unknown) => {
    if (value === undefined || typeof value === "function" ||
        typeof value === "symbol" || typeof value === "bigint" ||
        (typeof value === "number" && !Number.isFinite(value))) {
      throw new DevelopLegacyPauseRehearsalError("event_payload_invalid");
    }
    return value;
  });
  if (Buffer.byteLength(envelope) > 131072) {
    throw new DevelopLegacyPauseRehearsalError("event_payload_too_large");
  }
  return envelope;
}
