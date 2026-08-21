import Foundation
import Synchronization

final class AuthorizedDeviceLeaseHandoffEventCounter: Sendable {
    private enum WaitRegistration {
        case satisfied
        case suspended
        case cancelled
    }

    private struct Waiter {
        let expectedCount: Int
        let continuation: CheckedContinuation<Void, any Error>
    }

    private struct State {
        var eventCount = 0
        var isCancelled = false
        var waiters: [UUID: Waiter] = [:]
    }

    private let state = Mutex(State())

    func recordEvent() {
        let continuations = state.withLock { state in
            state.eventCount += 1
            let satisfiedIDs = state.waiters.compactMap { id, waiter in
                waiter.expectedCount <= state.eventCount ? id : nil
            }
            return satisfiedIDs.compactMap { state.waiters.removeValue(forKey: $0)?.continuation }
        }
        continuations.forEach { $0.resume() }
    }

    func waitForEventCount(_ expectedCount: Int) async throws {
        let waiterID = UUID()
        try await withTaskCancellationHandler {
            try await withCheckedThrowingContinuation { continuation in
                let registration = state.withLock { state -> WaitRegistration in
                    guard !Task.isCancelled, !state.isCancelled else { return .cancelled }
                    guard state.eventCount < expectedCount else { return .satisfied }
                    state.waiters[waiterID] = Waiter(
                        expectedCount: expectedCount,
                        continuation: continuation
                    )
                    return .suspended
                }
                switch registration {
                case .satisfied:
                    continuation.resume()
                case .suspended:
                    break
                case .cancelled:
                    continuation.resume(throwing: CancellationError())
                }
            }
        } onCancel: {
            self.cancel(waiterID)
        }
    }

    func cancelAll() {
        let continuations = state.withLock { state in
            state.isCancelled = true
            let continuations = state.waiters.values.map(\.continuation)
            state.waiters.removeAll()
            return continuations
        }
        continuations.forEach { $0.resume(throwing: CancellationError()) }
    }

    private func cancel(_ waiterID: UUID) {
        let continuation = state.withLock { $0.waiters.removeValue(forKey: waiterID)?.continuation }
        continuation?.resume(throwing: CancellationError())
    }
}

final class AuthorizedDeviceLeaseHandoffGate: Sendable {
    private struct State {
        var isOpen = false
        var continuations: [CheckedContinuation<Void, Never>] = []
    }

    private let state = Mutex(State())

    func waitIgnoringCancellation() async {
        await withCheckedContinuation { continuation in
            let isOpen = state.withLock { state in
                guard !state.isOpen else { return true }
                state.continuations.append(continuation)
                return false
            }
            if isOpen {
                continuation.resume()
            }
        }
    }

    func open() {
        let continuations = state.withLock { state in
            state.isOpen = true
            let continuations = state.continuations
            state.continuations = []
            return continuations
        }
        continuations.forEach { $0.resume() }
    }
}

final class AuthorizedDeviceLeaseHandoffTimeoutWaiter: Sendable {
    private enum WaitRegistration {
        case suspended
        case cancelled
    }

    private struct State {
        var isCancelled = false
        var continuations: [UUID: CheckedContinuation<Void, any Error>] = [:]
    }

    private let state = Mutex(State())

    func waitUntilCancelled() async throws {
        let waiterID = UUID()
        try await withTaskCancellationHandler {
            try await withCheckedThrowingContinuation { continuation in
                let registration = state.withLock { state -> WaitRegistration in
                    guard !Task.isCancelled, !state.isCancelled else { return .cancelled }
                    state.continuations[waiterID] = continuation
                    return .suspended
                }
                switch registration {
                case .suspended:
                    break
                case .cancelled:
                    continuation.resume(throwing: CancellationError())
                }
            }
        } onCancel: {
            self.cancel(waiterID)
        }
    }

    func cancelAll() {
        let continuations = state.withLock { state in
            state.isCancelled = true
            let continuations = Array(state.continuations.values)
            state.continuations.removeAll()
            return continuations
        }
        continuations.forEach { $0.resume(throwing: CancellationError()) }
    }

    private func cancel(_ waiterID: UUID) {
        let continuation = state.withLock { $0.continuations.removeValue(forKey: waiterID) }
        continuation?.resume(throwing: CancellationError())
    }
}
