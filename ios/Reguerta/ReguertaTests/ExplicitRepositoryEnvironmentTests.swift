import Foundation
import Synchronization
import Testing

@testable import Reguerta

@Suite(.timeLimit(.minutes(1)))
@MainActor
struct ExplicitRepositoryEnvironmentTests {
    @Test func queuedOperationKeepsItsCapturedEnvironmentAfterTheRuntimeOwnerTransitions() async throws {
        let store = RuntimeSessionEnvironmentStore(baseEnvironment: .develop)
        let router = RuntimeSessionEnvironmentRouter(environmentStore: store)
        let repository = MailboxBlockedProductRepository()
        let mailboxBlocker = Task { await repository.blockMailbox() }
        defer {
            repository.releaseMailbox()
            mailboxBlocker.cancel()
        }
        try await repository.waitUntilMailboxIsBlocked()

        let capturedEnvironment = store.snapshot().environment
        let operation = Task {
            await repository.products(
                vendorId: "vendor",
                environment: capturedEnvironment
            )
        }
        defer { operation.cancel() }
        try await repository.waitUntilOperationIsSubmitted()

        router.applyResolvedEnvironment(.production, lease: SessionEnvironmentLease())
        repository.releaseMailbox()

        await mailboxBlocker.value
        _ = await operation.value

        #expect(store.snapshot().environment == .production)
        #expect(await repository.recordedEnvironment() == .develop)
        #expect(await repository.recordedPath() == "develop/plus-collections/products")
    }

    @Test func firestoreOrdersSDKReferencesRemainInsideTheRepositoryActor() throws {
        let sourceNames = [
            "FirestoreOrdersRepository.swift",
            "FirestoreMyOrderCheckout.swift",
            "FirestoreMyOrderPreviousOrder.swift",
            "FirestoreOrderHistoryWeekKeys.swift",
            "FirestoreReceivedOrdersData.swift"
        ]
        let sources = try Dictionary(uniqueKeysWithValues: sourceNames.map { sourceName in
            let sourceURL = ordersSourceDirectoryURL().appending(path: sourceName)
            return (sourceName, try String(contentsOf: sourceURL, encoding: .utf8))
        })
        let repositorySource = try #require(sources["FirestoreOrdersRepository.swift"])

        #expect(repositorySource.contains("actor FirestoreOrdersRepository: OrdersRepository"))
        #expect(repositorySource.contains("let storedDB: Firestore"))

        for sourceName in sourceNames.dropFirst() {
            let source = try #require(sources[sourceName])
            #expect(source.contains("extension FirestoreOrdersRepository"))
            #expect(source.contains("db: Firestore") == false)
        }
        let operationSources = try sourceNames.dropFirst().map { try #require(sources[$0]) }.joined(separator: "\n")
        #expect(operationSources.contains("storedDB"))

        let forbiddenSDKParameterTypes = ["Firestore", "DocumentReference", "Query", "Transaction"]
        for (sourceName, source) in sources {
            let violatingHeaders = asyncFunctionHeaders(in: source).filter { header in
                forbiddenSDKParameterTypes.contains { header.contains(": \($0)") }
            }
            #expect(violatingHeaders.isEmpty, "\(sourceName) exports Firebase SDK references: \(violatingHeaders)")
        }
    }
}

private func ordersSourceDirectoryURL() -> URL {
    URL(fileURLWithPath: #filePath)
        .deletingLastPathComponent()
        .deletingLastPathComponent()
        .appending(path: "Reguerta/Data/Orders")
}

private func asyncFunctionHeaders(in source: String) -> [String] {
    source.components(separatedBy: "func ").dropFirst().compactMap { functionRemainder in
        guard let bodyStart = functionRemainder.firstIndex(of: "{") else { return nil }
        let header = "func \(functionRemainder[..<bodyStart])"
        return header.contains(" async") ? header : nil
    }
}

private actor MailboxBlockedProductRepository: ProductRepository {
    private let gate = SynchronousActorMailboxGate()
    private let operationSubmission = OperationSubmissionSignal()
    private var environment: SessionEnvironment?
    private var path: String?

    func blockMailbox() {
        gate.block()
    }

    nonisolated func waitUntilMailboxIsBlocked() async throws {
        try await gate.waitUntilBlocked()
    }

    nonisolated func releaseMailbox() {
        gate.release()
    }

    nonisolated func waitUntilOperationIsSubmitted() async throws {
        try await operationSubmission.waitUntilSubmitted()
    }

    func allProducts(environment _: SessionEnvironment) async -> [Product] { [] }

    nonisolated func products(vendorId _: String, environment: SessionEnvironment) async -> [Product] {
        operationSubmission.markSubmitted()
        return await recordProducts(environment: environment)
    }

    private func recordProducts(environment: SessionEnvironment) -> [Product] {
        self.environment = environment
        self.path = ReguertaFirestorePath(environment: environment).collectionPath(.products)
        return []
    }

    func upsert(product: Product, environment _: SessionEnvironment) async -> Product { product }

    func recordedEnvironment() -> SessionEnvironment? { environment }
    func recordedPath() -> String? { path }
}

private final class OperationSubmissionSignal: Sendable {
    private struct State {
        var isSubmitted = false
        var waiters: [UUID: CheckedContinuation<Void, any Error>] = [:]
    }

    private let state = Mutex(State())

    func markSubmitted() {
        let waiters = state.withLock { state in
            state.isSubmitted = true
            let waiters = Array(state.waiters.values)
            state.waiters.removeAll()
            return waiters
        }
        waiters.forEach { $0.resume() }
    }

    func waitUntilSubmitted() async throws {
        try Task.checkCancellation()
        guard !state.withLock({ $0.isSubmitted }) else { return }
        let waiterID = UUID()

        try await withTaskCancellationHandler {
            try await withCheckedThrowingContinuation { continuation in
                let shouldResume = state.withLock { state in
                    guard !state.isSubmitted, !Task.isCancelled else { return true }
                    state.waiters[waiterID] = continuation
                    return false
                }
                if shouldResume {
                    if Task.isCancelled {
                        continuation.resume(throwing: CancellationError())
                    } else {
                        continuation.resume()
                    }
                }
            }
        } onCancel: {
            let continuation = state.withLock { $0.waiters.removeValue(forKey: waiterID) }
            continuation?.resume(throwing: CancellationError())
        }
    }
}

private final class SynchronousActorMailboxGate: Sendable {
    private struct State {
        var isBlocked = false
        var isReleased = false
        var blockedWaiters: [UUID: CheckedContinuation<Void, any Error>] = [:]
    }

    private let state = Mutex(State())
    private let releaseCondition = NSCondition()

    func block() {
        let waiters = state.withLock { state in
            state.isBlocked = true
            let waiters = Array(state.blockedWaiters.values)
            state.blockedWaiters.removeAll()
            return waiters
        }
        waiters.forEach { $0.resume() }

        releaseCondition.lock()
        while !state.withLock({ $0.isReleased }) {
            releaseCondition.wait()
        }
        releaseCondition.unlock()
    }

    func waitUntilBlocked() async throws {
        try Task.checkCancellation()
        guard !state.withLock({ $0.isBlocked }) else { return }
        let waiterID = UUID()

        try await withTaskCancellationHandler {
            try await withCheckedThrowingContinuation { continuation in
                let shouldResume = state.withLock { state in
                    guard !state.isBlocked, !Task.isCancelled else { return true }
                    state.blockedWaiters[waiterID] = continuation
                    return false
                }
                if shouldResume {
                    if Task.isCancelled {
                        continuation.resume(throwing: CancellationError())
                    } else {
                        continuation.resume()
                    }
                }
            }
        } onCancel: {
            let continuation = state.withLock { $0.blockedWaiters.removeValue(forKey: waiterID) }
            continuation?.resume(throwing: CancellationError())
        }
    }

    func release() {
        releaseCondition.lock()
        state.withLock { $0.isReleased = true }
        releaseCondition.broadcast()
        releaseCondition.unlock()
    }
}
