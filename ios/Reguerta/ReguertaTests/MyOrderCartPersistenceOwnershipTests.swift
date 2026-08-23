import Foundation
import Testing

@testable import Reguerta

@Suite("My Order cart persistence ownership", .timeLimit(.minutes(1)))
@MainActor
struct MyOrderCartPersistenceOwnershipTests {
    @Test("Serializa el store y coalesce al ultimo snapshot mientras una escritura esta suspendida")
    func serializesAndCoalescesLatestSnapshot() async throws {
        let scenario = makeCartPersistenceScenario()
        try await withCartPersistenceStoreCleanup(scenario.store) {
            scenario.viewModel.selectedQuantities = ["product": 1]
            scenario.viewModel.persistCurrentCartSnapshotIfNeeded()
            let workerTask = try #require(scenario.viewModel.cartPersistenceTask)
            try await scenario.store.waitForRequestCount(1)

            scenario.viewModel.selectedQuantities = ["product": 2]
            scenario.viewModel.persistCurrentCartSnapshotIfNeeded()
            scenario.viewModel.selectedQuantities = ["product": 3]
            scenario.viewModel.persistCurrentCartSnapshotIfNeeded()

            #expect(await scenario.store.requestCount() == 1)
            await scenario.store.completeRequest(at: 0)
            try await scenario.store.waitForRequestCount(2)
            #expect(await scenario.store.requestSnapshot(at: 1).selectedQuantities == ["product": 3])

            await scenario.store.completeRequest(at: 1)
            await workerTask.value

            #expect(
                await scenario.store.persistedSnapshot(storageKey: scenario.context.cartStorageKey)
                    .selectedQuantities == ["product": 3]
            )
            #expect(scenario.viewModel.cartPersistenceTask == nil)
        }
    }

    @Test("Una nueva sesion espera al owner cancelado y persiste despues su snapshot")
    func sessionSuccessorPersistsAfterCancelledOwner() async throws {
        let scenario = makeCartPersistenceScenario()
        try await withCartPersistenceStoreCleanup(scenario.store) {
            scenario.viewModel.selectedQuantities = ["product": 1]
            scenario.viewModel.persistCurrentCartSnapshotIfNeeded()
            let obsoleteWorkerTask = try #require(scenario.viewModel.cartPersistenceTask)
            let obsoleteGeneration = scenario.viewModel.cartPersistenceTaskGeneration
            try await scenario.store.waitForRequestCount(1)

            scenario.sessionViewModel.mode = .signedOut
            scenario.viewModel.invalidateCartPersistenceForSessionChange()
            scenario.sessionViewModel.mode = .authorized(scenario.session)
            _ = scenario.viewModel.beginContextOperation(scenario.context)
            scenario.viewModel.hasRestoredCartState = true
            scenario.viewModel.selectedQuantities = ["product": 2]
            scenario.viewModel.persistCurrentCartSnapshotIfNeeded()

            #expect(await scenario.store.requestCount() == 1)
            await scenario.store.completeRequest(at: 0)
            await obsoleteWorkerTask.value
            try await scenario.store.waitForRequestCount(2)
            let successorWorkerTask = try #require(scenario.viewModel.cartPersistenceTask)
            #expect(scenario.viewModel.cartPersistenceTaskGeneration > obsoleteGeneration)

            await scenario.store.completeRequest(at: 1)
            await successorWorkerTask.value

            #expect(
                await scenario.store.persistedSnapshot(storageKey: scenario.context.cartStorageKey)
                    .selectedQuantities == ["product": 2]
            )
            #expect(scenario.viewModel.cartPersistenceTask == nil)
        }
    }
}

private struct CartPersistenceScenario {
    let sessionViewModel: SessionViewModel
    let session: AuthorizedSession
    let context: MyOrderRouteContext
    let store: ControlledMyOrderCartPersistenceStore
    let viewModel: MyOrderRouteViewModel
}

@MainActor
private func makeCartPersistenceScenario() -> CartPersistenceScenario {
    let sessionViewModel = SessionViewModel(dependencies: .preview())
    let currentMember = member(
        id: "cart_persistence_member",
        ecoCommitmentMode: .weekly,
        authUID: "cart_persistence_principal"
    )
    let session = AuthorizedSession(
        principal: AuthPrincipal(
            uid: "cart_persistence_principal",
            email: currentMember.normalizedEmail
        ),
        authenticatedMember: currentMember,
        member: currentMember,
        members: [currentMember],
        environment: .develop
    )
    sessionViewModel.mode = .authorized(session)
    let context = MyOrderRouteContext(
        products: [],
        seasonalCommitments: [],
        shifts: [],
        defaultDeliveryDayOfWeek: nil,
        deliveryCalendarOverrides: [],
        nowMillis: 1_780_000_000_000,
        isLoading: false,
        currentMember: currentMember,
        members: [currentMember],
        environment: .develop
    )
    let store = ControlledMyOrderCartPersistenceStore()
    let viewModel = MyOrderRouteViewModel(
        sessionViewModel: sessionViewModel,
        ordersRepository: InMemoryOrdersRepository(),
        cartStore: store,
        nowMillisProvider: { context.nowMillis }
    )
    _ = viewModel.beginContextOperation(context)
    viewModel.hasRestoredCartState = true
    return CartPersistenceScenario(
        sessionViewModel: sessionViewModel,
        session: session,
        context: context,
        store: store,
        viewModel: viewModel
    )
}

@MainActor
private func withCartPersistenceStoreCleanup(
    _ store: ControlledMyOrderCartPersistenceStore,
    operation: @MainActor () async throws -> Void
) async throws {
    try await withTaskCancellationHandler {
        do {
            try await operation()
        } catch {
            await store.terminate()
            throw error
        }
        await store.terminate()
    } onCancel: {
        Task { await store.terminate() }
    }
}

private actor ControlledMyOrderCartPersistenceStore: MyOrderCartStore {
    private struct Request {
        let storageKey: String
        let snapshot: MyOrderCartSnapshot
    }

    private var persistedSnapshots: [String: MyOrderCartSnapshot] = [:]
    private var requests: [Request] = []
    private var requestContinuations: [Int: CheckedContinuation<Void, Never>] = [:]
    private var requestCountWaiters: [
        UUID: (count: Int, continuation: CheckedContinuation<Void, any Error>)
    ] = [:]
    private var cancelledRequestCountWaiters: Set<UUID> = []
    private var isTerminated = false

    func readCart(storageKey: String) async -> MyOrderCartSnapshot {
        persistedSnapshots[storageKey] ?? .empty
    }

    func persistCart(storageKey: String, snapshot: MyOrderCartSnapshot) async {
        guard !isTerminated else { return }
        let requestIndex = requests.count
        requests.append(Request(storageKey: storageKey, snapshot: snapshot))
        resumeSatisfiedRequestCountWaiters()
        await withCheckedContinuation { continuation in
            requestContinuations[requestIndex] = continuation
        }
        guard !isTerminated else { return }
        persistedSnapshots[storageKey] = snapshot.normalized
    }

    func readConfirmed(storageKey: String) async -> MyOrderCartSnapshot {
        persistedSnapshots[storageKey] ?? .empty
    }

    func persistConfirmed(storageKey: String, snapshot: MyOrderCartSnapshot) async {
        guard !isTerminated else { return }
        persistedSnapshots[storageKey] = snapshot.normalized
    }

    func requestCount() -> Int { requests.count }

    func requestSnapshot(at index: Int) -> MyOrderCartSnapshot { requests[index].snapshot }

    func persistedSnapshot(storageKey: String) -> MyOrderCartSnapshot {
        persistedSnapshots[storageKey] ?? .empty
    }

    func completeRequest(at index: Int) {
        guard !isTerminated else { return }
        guard let continuation = requestContinuations.removeValue(forKey: index) else {
            Issue.record("No existe la escritura de carrito numero \(index)")
            return
        }
        continuation.resume()
    }

    func waitForRequestCount(_ expectedCount: Int) async throws {
        guard !isTerminated else { throw CancellationError() }
        guard requests.count < expectedCount else { return }
        let waiterID = UUID()
        try await withTaskCancellationHandler {
            try Task.checkCancellation()
            try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, any Error>) in
                if isTerminated {
                    continuation.resume(throwing: CancellationError())
                } else if requests.count >= expectedCount {
                    continuation.resume()
                } else if cancelledRequestCountWaiters.remove(waiterID) != nil {
                    continuation.resume(throwing: CancellationError())
                } else {
                    requestCountWaiters[waiterID] = (expectedCount, continuation)
                }
            }
        } onCancel: {
            Task { await self.cancelRequestCountWaiter(waiterID) }
        }
    }

    func terminate() {
        guard !isTerminated else { return }
        isTerminated = true
        let continuations = Array(requestContinuations.values)
        requestContinuations.removeAll()
        for continuation in continuations {
            continuation.resume()
        }
        let waiters = Array(requestCountWaiters.values)
        requestCountWaiters.removeAll()
        for waiter in waiters {
            waiter.continuation.resume(throwing: CancellationError())
        }
        cancelledRequestCountWaiters.removeAll()
    }

    private func resumeSatisfiedRequestCountWaiters() {
        guard !isTerminated else { return }
        let waiterIDs = requestCountWaiters.compactMap { waiterID, waiter in
            waiter.count <= requests.count ? waiterID : nil
        }
        for waiterID in waiterIDs {
            requestCountWaiters.removeValue(forKey: waiterID)?.continuation.resume()
        }
    }

    private func cancelRequestCountWaiter(_ waiterID: UUID) {
        guard !isTerminated else { return }
        guard let waiter = requestCountWaiters.removeValue(forKey: waiterID) else {
            cancelledRequestCountWaiters.insert(waiterID)
            return
        }
        waiter.continuation.resume(throwing: CancellationError())
    }
}
