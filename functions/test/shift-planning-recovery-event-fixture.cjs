"use strict";

const {Timestamp} = require("@google-cloud/firestore");
const {materializeShiftPlanningForwardActivation} =
  require("../lib/shift-planning-forward-materializer.js");
const {materializeShiftPlanningInverseRecovery} =
  require("../lib/shift-planning-inverse-materializer.js");
const {attemptedAt, predecessorFixture, materializerInput, readDocument} =
  require("./shift-planning-activation-fixture.cjs");

// The event snapshots come from the real forward/inverse write sets, including
// the predecessor update. No test reimplements a recovery terminal or digest.
const recoveryEventFixture = () => {
  const prior = predecessorFixture();
  const forwardInput = materializerInput(prior.value);
  forwardInput.beforeImageDocuments.push(readDocument(
    prior.predecessorPath, prior.predecessorDocument,
    attemptedAt.toMillis() - 2_000,
  ));
  const activation = materializeShiftPlanningForwardActivation(forwardInput);
  const current = (path) => readDocument(path,
    activation.mutations.find((mutation) => mutation.documentPath === path).data,
    attemptedAt.toMillis(),
  );
  const excluded = new Set([
    activation.operationPath, forwardInput.requestDocument.targetPath,
    ...activation.beforeImages.map((envelope) => envelope.envelopePath),
  ]);
  const inverseInput = {
    recoveryOperationId: "recovery-event-1",
    recoveredAt: Timestamp.fromMillis(attemptedAt.toMillis() + 1_000),
    bundle: forwardInput.preflight.bundle,
    activationOperationDocument: current(activation.operationPath),
    requestDocument: current(forwardInput.requestDocument.targetPath),
    beforeImageDocuments: activation.beforeImages.map((envelope) =>
      current(envelope.envelopePath)),
    currentDocuments: activation.mutations
      .filter((mutation) => !excluded.has(mutation.documentPath))
      .map((mutation) => current(mutation.documentPath)),
  };
  const recovery = materializeShiftPlanningInverseRecovery(inverseInput);
  const targetPath = prior.predecessorPath;
  return {
    forwardInput, inverseInput, activation, recovery,
    recoveryBeforeImage: activation.beforeImages.find((envelope) =>
      envelope.targetPath === targetPath),
    input: {
      eventId: "recovery-update-1",
      eventTime: Timestamp.fromMillis(attemptedAt.toMillis() + 2_000),
      targetPath,
      before: current(targetPath).data,
      after: recovery.restoredDocuments.find((item) =>
        item.targetPath === targetPath).document,
    },
  };
};

module.exports = {recoveryEventFixture};
