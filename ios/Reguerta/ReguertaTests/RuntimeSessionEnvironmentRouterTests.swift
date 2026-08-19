import Testing

@testable import Reguerta

@MainActor
struct RuntimeSessionEnvironmentRouterTests {
    @Test func applyMutatesOwnedStoreBeforePublishingTheEffectiveEnvironment() {
        let store = RuntimeSessionEnvironmentStore(baseEnvironment: .develop)
        let recorder = RuntimeRoutingTransitionRecorder(environmentProvider: store)
        store.transitionSignal.observe { transition in
            recorder.record(transition)
        }
        let router = RuntimeSessionEnvironmentRouter(environmentStore: store)

        router.applyResolvedEnvironment(.production, lease: SessionEnvironmentLease())

        #expect(store.snapshot().environment == .production)
        #expect(recorder.transition?.environment == .production)
        #expect(recorder.runtimeEnvironmentAtObservation == .production)
        #expect(ReguertaFirestorePath(environment: .production).collectionPath(.users).hasPrefix("production/"))
        #expect(ReguertaFirestorePath(environment: .develop).collectionPath(.users).hasPrefix("develop/"))
    }

    @Test func staleLeaseCannotResetTheEnvironmentOwnedByANewerLease() {
        let store = RuntimeSessionEnvironmentStore(baseEnvironment: .develop)
        let router = RuntimeSessionEnvironmentRouter(environmentStore: store)
        let staleLease = SessionEnvironmentLease()
        let currentLease = SessionEnvironmentLease()
        router.applyResolvedEnvironment(.production, lease: staleLease)
        router.applyResolvedEnvironment(.production, lease: currentLease)

        router.resetToBaseEnvironment(ifOwnedBy: staleLease)

        #expect(store.snapshot().environment == .production)
        #expect(router.transitionSignal.currentTransition.environment == .production)

        router.resetToBaseEnvironment(ifOwnedBy: currentLease)

        #expect(store.snapshot().environment == .develop)
        #expect(router.transitionSignal.currentTransition.environment == .develop)
    }

    @Test func resetsMutateRuntimeBeforePublishingTheBaseEnvironment() {
        let store = RuntimeSessionEnvironmentStore(baseEnvironment: .develop)
        let recorder = RuntimeRoutingTransitionRecorder(environmentProvider: store)
        store.transitionSignal.observe { transition in
            recorder.record(transition)
        }
        let router = RuntimeSessionEnvironmentRouter(environmentStore: store)
        let conditionalLease = SessionEnvironmentLease()
        router.applyResolvedEnvironment(.production, lease: conditionalLease)
        recorder.reset()

        router.resetToBaseEnvironment(ifOwnedBy: conditionalLease)

        #expect(store.snapshot().environment == .develop)
        #expect(recorder.transition?.environment == .develop)
        #expect(recorder.runtimeEnvironmentAtObservation == .develop)

        router.applyResolvedEnvironment(.production, lease: SessionEnvironmentLease())
        recorder.reset()

        router.resetToBaseEnvironment()

        #expect(store.snapshot().environment == .develop)
        #expect(recorder.transition?.environment == .develop)
        #expect(recorder.runtimeEnvironmentAtObservation == .develop)
    }

    @Test func independentlyComposedRoutersDoNotShareStateOrSignals() {
        let firstStore = RuntimeSessionEnvironmentStore(baseEnvironment: .develop)
        let secondStore = RuntimeSessionEnvironmentStore(baseEnvironment: .develop)
        let firstRouter = RuntimeSessionEnvironmentRouter(environmentStore: firstStore)
        let secondRouter = RuntimeSessionEnvironmentRouter(environmentStore: secondStore)

        firstRouter.applyResolvedEnvironment(.production, lease: SessionEnvironmentLease())

        #expect(firstStore.snapshot().environment == .production)
        #expect(secondStore.snapshot().environment == .develop)
        #expect(firstRouter.transitionSignal.currentTransition.generation == 1)
        #expect(secondRouter.transitionSignal.currentTransition.generation == 0)
    }

    @Test func routersSharingAStoreShareStateAndTransitions() {
        let store = RuntimeSessionEnvironmentStore(baseEnvironment: .develop)
        let firstRouter = RuntimeSessionEnvironmentRouter(environmentStore: store)
        let secondRouter = RuntimeSessionEnvironmentRouter(environmentStore: store)
        let recorder = RuntimeRoutingTransitionRecorder(environmentProvider: store)
        secondRouter.transitionSignal.observe { transition in
            recorder.record(transition)
        }

        firstRouter.applyResolvedEnvironment(.production, lease: SessionEnvironmentLease())

        #expect(firstRouter.transitionSignal === secondRouter.transitionSignal)
        #expect(store.snapshot().environment == .production)
        #expect(recorder.transition?.environment == .production)
        #expect(recorder.runtimeEnvironmentAtObservation == .production)
    }

    @Test func capturedSnapshotDoesNotChangeWithASuccessorRoute() {
        let store = RuntimeSessionEnvironmentStore(baseEnvironment: .develop)
        let router = RuntimeSessionEnvironmentRouter(environmentStore: store)
        let captured = store.snapshot()

        router.applyResolvedEnvironment(.production, lease: SessionEnvironmentLease())

        #expect(captured.environment == .develop)
        #expect(store.snapshot().environment == .production)
    }
}

@MainActor
private final class RuntimeRoutingTransitionRecorder {
    private let environmentProvider: any SessionEnvironmentSnapshotProviding
    private(set) var transition: SessionEnvironmentRoutingTransition?
    private(set) var runtimeEnvironmentAtObservation: SessionEnvironment?

    init(environmentProvider: any SessionEnvironmentSnapshotProviding) {
        self.environmentProvider = environmentProvider
    }

    func record(_ transition: SessionEnvironmentRoutingTransition) {
        self.transition = transition
        self.runtimeEnvironmentAtObservation = environmentProvider.snapshot().environment
    }

    func reset() {
        transition = nil
        runtimeEnvironmentAtObservation = nil
    }
}
