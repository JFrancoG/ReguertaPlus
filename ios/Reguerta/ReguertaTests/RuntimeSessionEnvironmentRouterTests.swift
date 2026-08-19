import Testing

@testable import Reguerta

@MainActor
@Suite(.serialized)
struct RuntimeSessionEnvironmentRouterTests {
    @Test func applyMutatesRuntimeBeforePublishingTheEffectiveEnvironment() {
        ReguertaRuntimeEnvironment.setBaseEnvironmentForTesting(.develop)
        defer { ReguertaRuntimeEnvironment.setBaseEnvironmentForTesting(nil) }

        let signal = SessionEnvironmentRoutingSignal(environment: .develop)
        let recorder = RuntimeRoutingTransitionRecorder()
        signal.observe { transition in
            recorder.record(transition)
        }
        let router = RuntimeSessionEnvironmentRouter(transitionSignal: signal)

        router.applyResolvedEnvironment(.production, lease: SessionEnvironmentLease())

        #expect(ReguertaRuntimeEnvironment.currentFirestoreEnvironment == .production)
        #expect(recorder.transition?.environment == .production)
        #expect(recorder.runtimeEnvironmentAtObservation == .production)
        #expect(ReguertaFirestorePath().collectionPath(.users).hasPrefix("production/"))
        #expect(ReguertaFirestorePath(environment: .develop).collectionPath(.users).hasPrefix("develop/"))
    }

    @Test func staleLeaseCannotResetTheEnvironmentOwnedByANewerLease() {
        ReguertaRuntimeEnvironment.setBaseEnvironmentForTesting(.develop)
        defer { ReguertaRuntimeEnvironment.setBaseEnvironmentForTesting(nil) }

        let router = RuntimeSessionEnvironmentRouter()
        let staleLease = SessionEnvironmentLease()
        let currentLease = SessionEnvironmentLease()
        router.applyResolvedEnvironment(.production, lease: staleLease)
        router.applyResolvedEnvironment(.production, lease: currentLease)

        router.resetToBaseEnvironment(ifOwnedBy: staleLease)

        #expect(ReguertaRuntimeEnvironment.currentFirestoreEnvironment == .production)
        #expect(router.transitionSignal.currentTransition.environment == .production)

        router.resetToBaseEnvironment(ifOwnedBy: currentLease)

        #expect(ReguertaRuntimeEnvironment.currentFirestoreEnvironment == .develop)
        #expect(router.transitionSignal.currentTransition.environment == .develop)
    }

    @Test func resetsMutateRuntimeBeforePublishingTheBaseEnvironment() {
        ReguertaRuntimeEnvironment.setBaseEnvironmentForTesting(.develop)
        defer { ReguertaRuntimeEnvironment.setBaseEnvironmentForTesting(nil) }

        let signal = SessionEnvironmentRoutingSignal(environment: .develop)
        let recorder = RuntimeRoutingTransitionRecorder()
        signal.observe { transition in
            recorder.record(transition)
        }
        let router = RuntimeSessionEnvironmentRouter(transitionSignal: signal)
        let conditionalLease = SessionEnvironmentLease()
        router.applyResolvedEnvironment(.production, lease: conditionalLease)
        recorder.reset()

        router.resetToBaseEnvironment(ifOwnedBy: conditionalLease)

        #expect(ReguertaRuntimeEnvironment.currentFirestoreEnvironment == .develop)
        #expect(recorder.transition?.environment == .develop)
        #expect(recorder.runtimeEnvironmentAtObservation == .develop)

        router.applyResolvedEnvironment(.production, lease: SessionEnvironmentLease())
        recorder.reset()

        router.resetToBaseEnvironment()

        #expect(ReguertaRuntimeEnvironment.currentFirestoreEnvironment == .develop)
        #expect(recorder.transition?.environment == .develop)
        #expect(recorder.runtimeEnvironmentAtObservation == .develop)
    }

    @Test func changingTheTestingBaseClearsTheOverrideAndItsLease() {
        ReguertaRuntimeEnvironment.setBaseEnvironmentForTesting(.develop)
        defer { ReguertaRuntimeEnvironment.setBaseEnvironmentForTesting(nil) }

        let router = RuntimeSessionEnvironmentRouter()
        let obsoleteLease = SessionEnvironmentLease()
        router.applyResolvedEnvironment(.production, lease: obsoleteLease)

        ReguertaRuntimeEnvironment.setBaseEnvironmentForTesting(.production)

        #expect(ReguertaRuntimeEnvironment.baseFirestoreEnvironment == .production)
        #expect(ReguertaRuntimeEnvironment.currentFirestoreEnvironment == .production)

        let currentLease = SessionEnvironmentLease()
        router.applyResolvedEnvironment(.develop, lease: currentLease)
        router.resetToBaseEnvironment(ifOwnedBy: obsoleteLease)

        #expect(ReguertaRuntimeEnvironment.currentFirestoreEnvironment == .develop)

        router.resetToBaseEnvironment(ifOwnedBy: currentLease)

        #expect(ReguertaRuntimeEnvironment.currentFirestoreEnvironment == .production)
    }
}

@MainActor
private final class RuntimeRoutingTransitionRecorder {
    private(set) var transition: SessionEnvironmentRoutingTransition?
    private(set) var runtimeEnvironmentAtObservation: SessionEnvironment?

    func record(_ transition: SessionEnvironmentRoutingTransition) {
        self.transition = transition
        self.runtimeEnvironmentAtObservation = ReguertaRuntimeEnvironment.currentFirestoreEnvironment
    }

    func reset() {
        transition = nil
        runtimeEnvironmentAtObservation = nil
    }
}
