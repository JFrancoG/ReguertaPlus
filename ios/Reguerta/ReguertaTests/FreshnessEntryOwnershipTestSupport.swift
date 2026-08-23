import Testing

@testable import Reguerta

@MainActor
func withControlledFreshnessCleanup(
    remoteRepository: OwnedFreshnessRemoteRepository,
    sleeper: OwnedFreshnessSleeper? = nil,
    operation: @MainActor () async throws -> Void
) async throws {
    try await withTaskCancellationHandler {
        do {
            try await operation()
        } catch {
            await terminateControlledFreshness(remoteRepository: remoteRepository, sleeper: sleeper)
            throw error
        }
        await terminateControlledFreshness(remoteRepository: remoteRepository, sleeper: sleeper)
    } onCancel: {
        Task {
            await terminateControlledFreshness(remoteRepository: remoteRepository, sleeper: sleeper)
        }
    }
}

private func terminateControlledFreshness(
    remoteRepository: OwnedFreshnessRemoteRepository,
    sleeper: OwnedFreshnessSleeper?
) async {
    await remoteRepository.terminate()
    if let sleeper {
        await sleeper.terminate()
    }
}

actor OwnedFreshnessRemoteRepository: CriticalDataFreshnessRemoteRepository {
    private var nextRequestIndex = 0
    private var registeredRequestCount = 0
    private var requestContinuations: [Int: CheckedContinuation<CriticalDataFreshnessConfig?, Never>] = [:]
    private var requestCountWaiters: [Int: (count: Int, continuation: CheckedContinuation<Void, any Error>)] = [:]
    private var cancelledRequestCountWaiters: Set<Int> = []
    private var nextRequestCountWaiterID = 0
    private var isTerminated = false

    func getConfig(environment _: SessionEnvironment) async throws -> CriticalDataFreshnessConfig {
        guard !isTerminated else { throw CancellationError() }
        let requestIndex = nextRequestIndex
        nextRequestIndex += 1
        let config: CriticalDataFreshnessConfig? = await withCheckedContinuation { continuation in
            if isTerminated {
                continuation.resume(returning: nil)
            } else {
                requestContinuations[requestIndex] = continuation
                registeredRequestCount += 1
                resumeSatisfiedRequestCountWaiters()
            }
        }
        guard !isTerminated else { throw CancellationError() }
        guard let config else { throw RepositoryError.notFound(resource: "config.member") }
        return config
    }

    func waitForRequestCount(_ expectedCount: Int) async throws {
        guard !isTerminated else { throw CancellationError() }
        guard registeredRequestCount < expectedCount else { return }
        let waiterID = nextRequestCountWaiterID
        nextRequestCountWaiterID += 1
        try await withTaskCancellationHandler {
            try Task.checkCancellation()
            try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, any Error>) in
                if isTerminated {
                    continuation.resume(throwing: CancellationError())
                } else if registeredRequestCount >= expectedCount {
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

    func requestCount() -> Int { nextRequestIndex }

    func completeRequest(at index: Int, with config: CriticalDataFreshnessConfig?) {
        guard !isTerminated else { return }
        guard let continuation = requestContinuations.removeValue(forKey: index) else {
            Issue.record("No existe la solicitud de freshness numero \(index)")
            return
        }
        continuation.resume(returning: config)
    }

    func terminate() {
        guard !isTerminated else { return }
        isTerminated = true
        let requests = Array(requestContinuations.values)
        requestContinuations.removeAll()
        for continuation in requests {
            continuation.resume(returning: nil)
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
            waiter.count <= registeredRequestCount ? waiterID : nil
        }
        for waiterID in waiterIDs {
            requestCountWaiters.removeValue(forKey: waiterID)?.continuation.resume()
        }
    }

    private func cancelRequestCountWaiter(_ waiterID: Int) {
        guard !isTerminated else { return }
        guard let waiter = requestCountWaiters.removeValue(forKey: waiterID) else {
            cancelledRequestCountWaiters.insert(waiterID)
            return
        }
        waiter.continuation.resume(throwing: CancellationError())
    }
}

actor OwnedFreshnessSleeper {
    private var nextRequestIndex = 0
    private var registeredRequestCount = 0
    private var requestContinuations: [Int: CheckedContinuation<Void, any Error>] = [:]
    private var cancelledRequests: Set<Int> = []
    private var requestCountWaiters: [Int: (count: Int, continuation: CheckedContinuation<Void, any Error>)] = [:]
    private var cancelledRequestCountWaiters: Set<Int> = []
    private var nextRequestCountWaiterID = 0
    private var isTerminated = false

    func sleep(for _: Duration) async throws {
        guard !isTerminated else { throw CancellationError() }
        let requestIndex = nextRequestIndex
        nextRequestIndex += 1
        try await withTaskCancellationHandler {
            try Task.checkCancellation()
            try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, any Error>) in
                if isTerminated || cancelledRequests.remove(requestIndex) != nil {
                    continuation.resume(throwing: CancellationError())
                } else {
                    requestContinuations[requestIndex] = continuation
                    registeredRequestCount += 1
                    resumeSatisfiedRequestCountWaiters()
                }
            }
        } onCancel: {
            Task { await self.cancelRequest(at: requestIndex) }
        }
    }

    func waitForRequestCount(_ expectedCount: Int) async throws {
        guard !isTerminated else { throw CancellationError() }
        guard registeredRequestCount < expectedCount else { return }
        let waiterID = nextRequestCountWaiterID
        nextRequestCountWaiterID += 1
        try await withTaskCancellationHandler {
            try Task.checkCancellation()
            try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, any Error>) in
                if isTerminated {
                    continuation.resume(throwing: CancellationError())
                } else if registeredRequestCount >= expectedCount {
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

    func requestCount() -> Int { nextRequestIndex }

    func completeRequest(at index: Int) {
        guard !isTerminated else { return }
        guard let continuation = requestContinuations.removeValue(forKey: index) else {
            Issue.record("No existe el timeout de freshness numero \(index)")
            return
        }
        continuation.resume()
    }

    func terminate() {
        guard !isTerminated else { return }
        isTerminated = true
        let requests = Array(requestContinuations.values)
        requestContinuations.removeAll()
        for continuation in requests {
            continuation.resume(throwing: CancellationError())
        }
        let waiters = Array(requestCountWaiters.values)
        requestCountWaiters.removeAll()
        for waiter in waiters {
            waiter.continuation.resume(throwing: CancellationError())
        }
        cancelledRequests.removeAll()
        cancelledRequestCountWaiters.removeAll()
    }

    private func resumeSatisfiedRequestCountWaiters() {
        guard !isTerminated else { return }
        let waiterIDs = requestCountWaiters.compactMap { waiterID, waiter in
            waiter.count <= registeredRequestCount ? waiterID : nil
        }
        for waiterID in waiterIDs {
            requestCountWaiters.removeValue(forKey: waiterID)?.continuation.resume()
        }
    }

    private func cancelRequest(at index: Int) {
        guard !isTerminated else { return }
        guard let continuation = requestContinuations.removeValue(forKey: index) else {
            cancelledRequests.insert(index)
            return
        }
        continuation.resume(throwing: CancellationError())
    }

    private func cancelRequestCountWaiter(_ waiterID: Int) {
        guard !isTerminated else { return }
        guard let waiter = requestCountWaiters.removeValue(forKey: waiterID) else {
            cancelledRequestCountWaiters.insert(waiterID)
            return
        }
        waiter.continuation.resume(throwing: CancellationError())
    }
}
