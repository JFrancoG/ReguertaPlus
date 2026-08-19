import Foundation
import Observation
import Synchronization

@testable import Reguerta

actor ControlledProfileRepository: SharedProfileRepository {
    private var items: [String: SharedProfile]
    private let rejectsReads: Bool
    private(set) var readCount = 0

    init(items: [SharedProfile], rejectsReads: Bool) {
        self.items = Dictionary(uniqueKeysWithValues: items.map { ($0.userId, $0) })
        self.rejectsReads = rejectsReads
    }

    func allSharedProfiles(environment _: SessionEnvironment) async throws -> [SharedProfile] {
        readCount += 1
        if rejectsReads { throw ProfileTestError.rejected }
        return items.values.sorted { $0.updatedAtMillis > $1.updatedAtMillis }
    }

    func sharedProfile(userId: String, environment _: SessionEnvironment) async throws -> SharedProfile? {
        readCount += 1
        if rejectsReads { throw ProfileTestError.rejected }
        return items[userId]
    }

    func upsert(profile: SharedProfile, environment _: SessionEnvironment) async -> SharedProfile {
        items[profile.userId] = profile
        return profile
    }

    func deleteSharedProfile(userId: String, environment _: SessionEnvironment) async -> Bool {
        items.removeValue(forKey: userId) != nil
    }
}

actor EntryGuardProfileRepository: SharedProfileRepository {
    private var calls = 0

    func allSharedProfiles(environment _: SessionEnvironment) async -> [SharedProfile] {
        calls += 1
        return []
    }

    func sharedProfile(userId _: String, environment _: SessionEnvironment) async -> SharedProfile? {
        calls += 1
        return nil
    }

    func upsert(profile: SharedProfile, environment _: SessionEnvironment) async -> SharedProfile {
        calls += 1
        return profile
    }

    func deleteSharedProfile(userId _: String, environment _: SessionEnvironment) async -> Bool {
        calls += 1
        return true
    }

    func invocationCount() -> Int { calls }
}

actor EntryGuardProfileImagePipeline: ImagePipelineManager {
    private var calls = 0

    func processAndUpload(imageData _: Data, request _: ImageUploadRequest) async -> ImageUploadResult {
        calls += 1
        return ImageUploadResult(
            downloadURL: "https://unexpected.test/profile.jpg",
            widthPx: 1,
            heightPx: 1,
            byteSize: 1,
            mimeType: "image/jpeg"
        )
    }

    func invocationCount() -> Int { calls }
}

final class SuspendedProfileRepository: SharedProfileRepository, Sendable {
    private struct PendingWrite {
        let profile: SharedProfile
        let continuation: CheckedContinuation<SharedProfile, any Error>
    }

    private struct State {
        var pendingWrite: PendingWrite?
        var startedWaiters: [UUID: CheckedContinuation<Void, any Error>] = [:]
    }

    private let state = Mutex(State())

    func allSharedProfiles(environment _: SessionEnvironment) async -> [SharedProfile] { [] }
    func sharedProfile(userId _: String, environment _: SessionEnvironment) async -> SharedProfile? { nil }

    func upsert(profile: SharedProfile, environment _: SessionEnvironment) async throws -> SharedProfile {
        try await withCheckedThrowingContinuation { continuation in
            let waiters = state.withLock { state in
                state.pendingWrite = PendingWrite(profile: profile, continuation: continuation)
                let waiters = Array(state.startedWaiters.values)
                state.startedWaiters.removeAll()
                return waiters
            }
            waiters.forEach { $0.resume() }
        }
    }

    func deleteSharedProfile(userId _: String, environment _: SessionEnvironment) async -> Bool { true }

    func waitUntilWriteStarts() async throws {
        try Task.checkCancellation()
        guard state.withLock({ $0.pendingWrite == nil }) else { return }
        let waiterID = UUID()

        try await withTaskCancellationHandler {
            try await withCheckedThrowingContinuation { continuation in
                let shouldResume = state.withLock { state in
                    guard state.pendingWrite == nil, !Task.isCancelled else { return true }
                    state.startedWaiters[waiterID] = continuation
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
            let continuation = state.withLock { $0.startedWaiters.removeValue(forKey: waiterID) }
            continuation?.resume(throwing: CancellationError())
        }
    }

    func completeWrite() {
        let pending = state.withLock { state in
            let pending = state.pendingWrite
            state.pendingWrite = nil
            return pending
        }
        if let pending {
            pending.continuation.resume(returning: pending.profile)
        }
    }

    func cancelAll() {
        let pending = state.withLock { state in
            let write = state.pendingWrite
            let waiters = Array(state.startedWaiters.values)
            state.pendingWrite = nil
            state.startedWaiters.removeAll()
            return (write, waiters)
        }
        pending.0?.continuation.resume(throwing: CancellationError())
        pending.1.forEach { $0.resume(throwing: CancellationError()) }
    }
}

final class SharedProfileLoadingWaiter: Sendable {
    private struct Waiter {
        let continuation: CheckedContinuation<Void, any Error>
    }

    private struct State {
        var waiters: [UUID: Waiter] = [:]
        var cancelledWaiterIDs: Set<UUID> = []
    }

    private let state = Mutex(State())

    @MainActor
    func wait(untilLoadingFinishesIn viewModel: SharedProfileFeatureViewModel) async throws {
        try Task.checkCancellation()
        guard viewModel.isLoading else { return }
        let waiterID = UUID()

        try await withTaskCancellationHandler {
            try await withCheckedThrowingContinuation { continuation in
                let wasCancelled = state.withLock { state in
                    guard state.cancelledWaiterIDs.remove(waiterID) == nil, !Task.isCancelled else { return true }
                    state.waiters[waiterID] = Waiter(continuation: continuation)
                    return false
                }
                if wasCancelled {
                    continuation.resume(throwing: CancellationError())
                } else {
                    observe(viewModel, waiterID: waiterID)
                }
            }
        } onCancel: {
            cancel(waiterID)
        }
    }

    @MainActor
    private func observe(_ viewModel: SharedProfileFeatureViewModel, waiterID: UUID) {
        guard state.withLock({ $0.waiters[waiterID] != nil }) else { return }
        let isLoading = withObservationTracking {
            viewModel.isLoading
        } onChange: { [weak self, weak viewModel] in
            guard let self, let viewModel else { return }
            Task { @MainActor in
                self.observe(viewModel, waiterID: waiterID)
            }
        }
        guard !isLoading else { return }
        let continuation = state.withLock { $0.waiters.removeValue(forKey: waiterID)?.continuation }
        continuation?.resume()
    }

    private func cancel(_ waiterID: UUID) {
        let continuation = state.withLock { state -> CheckedContinuation<Void, any Error>? in
            state.cancelledWaiterIDs.insert(waiterID)
            return state.waiters.removeValue(forKey: waiterID)?.continuation
        }
        continuation?.resume(throwing: CancellationError())
    }
}

private enum ProfileTestError: Error {
    case rejected
}
