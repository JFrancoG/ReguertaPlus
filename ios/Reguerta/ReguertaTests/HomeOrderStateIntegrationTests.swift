import Foundation
import Testing

@testable import Reguerta

@MainActor
@Suite("Home order-state integration", .timeLimit(.minutes(1)))
struct HomeOrderStateIntegrationTests {
    @Test func injectedInMemoryStoreReachesRootAndPublishesDraft() async throws {
        let nowMillis = testMillis(year: 2026, month: 5, day: 9)
        let cartStore = InMemoryMyOrderCartStore()
        let rootViewModel = makeRootViewModel(cartStore: cartStore, nowMillis: nowMillis)
        let session = authorizedSession(memberID: "member_1", environment: .develop)
        rootViewModel.sessionViewModel.mode = .authorized(session)
        let scope = try #require(rootViewModel.currentHomeOrderStateScope)
        await cartStore.seedCart(
            orderSnapshot(productID: "draft_product", quantity: 2),
            storageKey: scope.localStateScope.storageKey
        )

        await rootViewModel.refreshHomeOrderState(for: scope)

        let myOrderCartStore = try #require(
            rootViewModel.myOrderViewModel.cartStore as? InMemoryMyOrderCartStore
        )
        #expect(myOrderCartStore === cartStore)
        #expect(rootViewModel.resolvedHomeOrderStateScope == scope)
        #expect(rootViewModel.homeOrderLocalState == .draft)
        #expect(rootViewModel.homeWeeklySummary(for: session).orderState == .unconfirmed)
    }

    @Test func lateReadsCannotPublishAfterANewerGenerationOrDashboardExit() async throws {
        let nowMillis = testMillis(year: 2026, month: 5, day: 9)
        let cartStore = ControlledHomeOrderCartStore()
        let rootViewModel = makeRootViewModel(cartStore: cartStore, nowMillis: nowMillis)
        rootViewModel.sessionViewModel.mode = .authorized(
            authorizedSession(memberID: "member_1", environment: .develop)
        )
        let scope = try #require(rootViewModel.currentHomeOrderStateScope)

        try await withControlledStoreCleanup(cartStore) {
            let obsoleteRefresh = Task {
                await rootViewModel.refreshHomeOrderState(for: scope)
            }
            try await cartStore.waitForReadCount(1)

            let currentRefresh = Task {
                await rootViewModel.refreshHomeOrderState(for: scope)
            }
            try await cartStore.waitForReadCount(2)
            try await cartStore.completeRead(at: 1, with: .empty)
            try await cartStore.waitForReadCount(3)
            try await cartStore.completeRead(
                at: 2,
                with: orderSnapshot(productID: "current_draft")
            )
            await currentRefresh.value

            #expect(rootViewModel.resolvedHomeOrderStateScope == scope)
            #expect(rootViewModel.homeOrderLocalState == .draft)

            try await cartStore.completeRead(
                at: 0,
                with: orderSnapshot(productID: "obsolete_confirmation")
            )
            await obsoleteRefresh.value

            #expect(rootViewModel.resolvedHomeOrderStateScope == scope)
            #expect(rootViewModel.homeOrderLocalState == .draft)

            let exitedDashboardRefresh = Task {
                await rootViewModel.refreshHomeOrderState(for: scope)
            }
            try await cartStore.waitForReadCount(4)
            rootViewModel.homeDestination = .news
            try await cartStore.completeRead(
                at: 3,
                with: orderSnapshot(productID: "late_confirmation")
            )
            await exitedDashboardRefresh.value

            #expect(rootViewModel.currentHomeOrderStateScope == nil)
            #expect(rootViewModel.resolvedHomeOrderStateScope == scope)
            #expect(rootViewModel.homeOrderLocalState == .draft)
        }
    }

    @Test func sessionRevisionFenceRejectsALateReadForTheSameNominalScope() async throws {
        let nowMillis = testMillis(year: 2026, month: 5, day: 9)
        let cartStore = ControlledHomeOrderCartStore()
        let rootViewModel = makeRootViewModel(cartStore: cartStore, nowMillis: nowMillis)
        let session = authorizedSession(memberID: "member_1", environment: .develop)
        rootViewModel.sessionViewModel.mode = .authorized(session)
        let obsoleteScope = try #require(rootViewModel.currentHomeOrderStateScope)

        try await withControlledStoreCleanup(cartStore) {
            let obsoleteRefresh = Task {
                await rootViewModel.refreshHomeOrderState(for: obsoleteScope)
            }
            try await cartStore.waitForReadCount(1)

            rootViewModel.sessionViewModel.mode = .signedOut
            rootViewModel.sessionViewModel.mode = .authorized(session)
            let currentScope = try #require(rootViewModel.currentHomeOrderStateScope)

            #expect(currentScope.localStateScope == obsoleteScope.localStateScope)
            #expect(currentScope.sessionStateRevision != obsoleteScope.sessionStateRevision)

            try await cartStore.completeRead(
                at: 0,
                with: orderSnapshot(productID: "obsolete_confirmation")
            )
            await obsoleteRefresh.value

            #expect(rootViewModel.resolvedHomeOrderStateScope == nil)
            #expect(rootViewModel.homeOrderLocalState == .empty)
        }
    }

    @Test func inactiveAuthorizedModeDoesNotReadOrPublishHomeOrderState() async {
        let nowMillis = testMillis(year: 2026, month: 5, day: 9)
        let cartStore = InactiveAuthorizationHomeOrderCartStore()
        let rootViewModel = makeRootViewModel(cartStore: cartStore, nowMillis: nowMillis)
        var session = authorizedSession(memberID: "member_1", environment: .develop)
        session.principal = AuthPrincipal(uid: "revoked_auth", email: "member_1@reguerta.test")
        rootViewModel.sessionViewModel.mode = .authorized(session)

        let scope = rootViewModel.currentHomeOrderStateScope
        await rootViewModel.refreshHomeOrderState(for: scope)

        #expect(!session.representsActiveAuthorization)
        #expect(scope == nil)
        #expect(await cartStore.readCount == 0)
        #expect(rootViewModel.resolvedHomeOrderStateScope == nil)
        #expect(rootViewModel.homeOrderLocalState == .empty)
    }

    @Test func obsoleteScopeCannotReadOrInvalidateTheCurrentOwnerBeforeTheFence() async throws {
        let nowMillis = testMillis(year: 2026, month: 5, day: 9)
        let cartStore = ControlledHomeOrderCartStore()
        let rootViewModel = makeRootViewModel(cartStore: cartStore, nowMillis: nowMillis)
        rootViewModel.sessionViewModel.mode = .authorized(
            authorizedSession(memberID: "member_1", environment: .develop)
        )
        let obsoleteScope = try #require(rootViewModel.currentHomeOrderStateScope)

        rootViewModel.sessionViewModel.mode = .authorized(
            authorizedSession(memberID: "member_1", environment: .production)
        )
        let currentScope = try #require(rootViewModel.currentHomeOrderStateScope)
        await cartStore.returnImmediately(for: obsoleteScope.localStateScope.storageKey)

        try await withControlledStoreCleanup(cartStore) {
            let currentRefresh = Task {
                await rootViewModel.refreshHomeOrderState(for: currentScope)
            }
            try await cartStore.waitForReadCount(1)
            let currentGeneration = rootViewModel.homeOrderStateGeneration

            await rootViewModel.refreshHomeOrderState(for: obsoleteScope)

            #expect(await cartStore.registeredReadCount() == 1)
            #expect(rootViewModel.homeOrderStateGeneration == currentGeneration)

            try await cartStore.completeRead(
                at: 0,
                with: orderSnapshot(productID: "current_confirmation")
            )
            await currentRefresh.value

            #expect(currentScope != obsoleteScope)
            #expect(rootViewModel.resolvedHomeOrderStateScope == currentScope)
            #expect(rootViewModel.homeOrderLocalState == .confirmed)
        }
    }

    private func makeRootViewModel(cartStore: any MyOrderCartStore, nowMillis: Int64) -> AccessRootViewModel {
        let sessionViewModel = SessionViewModel(dependencies: .preview())
        let ordersDependencies = OrdersFeatureDependencies(
            ordersRepository: InMemoryOrdersRepository(),
            cartStore: cartStore,
            nowMillisProvider: { nowMillis }
        )
        return AccessRootViewModel(
            sessionViewModel: sessionViewModel,
            productsFeatureDependencies: .preview(nowMillisProvider: { nowMillis }),
            ordersFeatureDependencies: ordersDependencies,
            shiftsFeatureDependencies: .preview(nowMillisProvider: { nowMillis }),
            newsNotificationsFeatureDependencies: .preview(nowMillisProvider: { nowMillis }),
            sharedProfileFeatureDependencies: .preview(nowMillisProvider: { nowMillis }),
            usersFeatureDependencies: .preview(),
            myOrderFreshnessFeatureDependencies: .preview(nowProvider: { nowMillis }),
            bylawsFeatureDependencies: .preview(),
            developmentTimeMachine: .transient(initialOverrideNowMillis: nowMillis),
            startupVersionGateUseCase: ResolveStartupVersionGateUseCase(
                repository: FixedStartupVersionPolicyRepository(policy: nil),
                environment: .develop
            ),
            shouldSkipSplashProvider: { true }
        )
    }

    private func authorizedSession(memberID: String, environment: SessionEnvironment) -> AuthorizedSession {
        let currentMember = member(id: memberID, ecoCommitmentMode: .weekly)
        return AuthorizedSession(
            principal: AuthPrincipal(uid: "auth_\(memberID)", email: "\(memberID)@reguerta.test"),
            authenticatedMember: currentMember,
            member: currentMember,
            members: [currentMember],
            environment: environment
        )
    }

    private func orderSnapshot(productID: String, quantity: Int = 1) -> MyOrderCartSnapshot {
        MyOrderCartSnapshot(selectedQuantities: [productID: quantity], selectedEcoBasketOptions: [:])
    }

    private func withControlledStoreCleanup(
        _ store: ControlledHomeOrderCartStore,
        operation: () async throws -> Void
    ) async throws {
        try await withTaskCancellationHandler {
            do {
                try await operation()
            } catch {
                await store.cancelAllReads()
                throw error
            }
            await store.cancelAllReads()
        } onCancel: {
            Task { await store.cancelAllReads() }
        }
    }
}

private actor InactiveAuthorizationHomeOrderCartStore: MyOrderCartStore {
    private(set) var readCount = 0

    func readCart(storageKey _: String) -> MyOrderCartSnapshot {
        readCount += 1
        return .empty
    }

    func persistCart(storageKey _: String, snapshot _: MyOrderCartSnapshot) {}

    func readConfirmed(storageKey _: String) -> MyOrderCartSnapshot {
        readCount += 1
        return .empty
    }

    func persistConfirmed(storageKey _: String, snapshot _: MyOrderCartSnapshot) {}
}

private enum ControlledHomeOrderCartStoreError: Error {
    case missingRead(index: Int)
}

private actor ControlledHomeOrderCartStore: MyOrderCartStore {
    private struct ReadCountWaiter {
        let id: UUID
        let expectedCount: Int
        let continuation: CheckedContinuation<Void, any Error>
    }

    private var readCount = 0
    private var readContinuations: [Int: CheckedContinuation<MyOrderCartSnapshot, Never>] = [:]
    private var readCountWaiters: [UUID: ReadCountWaiter] = [:]
    private var immediateStorageKeys: Set<String> = []
    private var isCancelled = false

    func readCart(storageKey: String) async -> MyOrderCartSnapshot {
        await read(storageKey: storageKey)
    }

    func persistCart(storageKey _: String, snapshot _: MyOrderCartSnapshot) async {}

    func readConfirmed(storageKey: String) async -> MyOrderCartSnapshot {
        await read(storageKey: storageKey)
    }

    func persistConfirmed(storageKey _: String, snapshot _: MyOrderCartSnapshot) async {}

    func returnImmediately(for storageKey: String) {
        immediateStorageKeys.insert(storageKey)
    }

    func registeredReadCount() -> Int { readCount }

    func waitForReadCount(_ expectedCount: Int) async throws {
        guard readCount < expectedCount else { return }
        let waiterID = UUID()
        try await withTaskCancellationHandler {
            try Task.checkCancellation()
            try await withCheckedThrowingContinuation { continuation in
                readCountWaiters[waiterID] = ReadCountWaiter(
                    id: waiterID,
                    expectedCount: expectedCount,
                    continuation: continuation
                )
            }
        } onCancel: {
            Task { await self.cancelReadCountWaiter(waiterID) }
        }
    }

    func completeRead(at index: Int, with snapshot: MyOrderCartSnapshot) throws {
        guard let continuation = readContinuations.removeValue(forKey: index) else {
            throw ControlledHomeOrderCartStoreError.missingRead(index: index)
        }
        continuation.resume(returning: snapshot)
    }

    func cancelAllReads() {
        isCancelled = true
        let suspendedReads = readContinuations.values
        readContinuations.removeAll()
        suspendedReads.forEach { $0.resume(returning: .empty) }

        let suspendedWaiters = readCountWaiters.values
        readCountWaiters.removeAll()
        suspendedWaiters.forEach { $0.continuation.resume(throwing: CancellationError()) }
    }

    private func read(storageKey: String) async -> MyOrderCartSnapshot {
        guard !isCancelled else { return .empty }
        let index = readCount
        readCount += 1
        if immediateStorageKeys.contains(storageKey) {
            resumeSatisfiedReadCountWaiters()
            return .empty
        }
        return await withCheckedContinuation { continuation in
            readContinuations[index] = continuation
            resumeSatisfiedReadCountWaiters()
        }
    }

    private func resumeSatisfiedReadCountWaiters() {
        let satisfiedWaiterIDs = readCountWaiters.values.compactMap { waiter in
            readCount >= waiter.expectedCount ? waiter.id : nil
        }
        for waiterID in satisfiedWaiterIDs {
            readCountWaiters.removeValue(forKey: waiterID)?.continuation.resume()
        }
    }

    private func cancelReadCountWaiter(_ waiterID: UUID) {
        readCountWaiters.removeValue(forKey: waiterID)?.continuation.resume(throwing: CancellationError())
    }
}
