import Foundation
import Synchronization

@testable import Reguerta

final class EnvironmentSuspendedProfileRepository: SharedProfileRepository, Sendable {
    private struct StartWaiter {
        let environment: SessionEnvironment
        let continuation: CheckedContinuation<Void, any Error>
    }

    private struct State {
        var pendingReads: [PendingRead] = []
        var pendingUpserts: [PendingUpsert] = []
        var pendingDeletes: [PendingDelete] = []
        var readWaiters: [UUID: StartWaiter] = [:]
        var upsertWaiters: [UUID: StartWaiter] = [:]
        var deleteWaiters: [UUID: StartWaiter] = [:]
    }

    private let suspendsReads: Bool
    private let state = Mutex(State())

    init(suspendsReads: Bool = false) {
        self.suspendsReads = suspendsReads
    }

    func allSharedProfiles(environment: SessionEnvironment) async throws -> [SharedProfile] {
        guard suspendsReads else { return [] }
        try Task.checkCancellation()
        let operationID = UUID()

        return try await withTaskCancellationHandler {
            try await withCheckedThrowingContinuation { continuation in
                let registration = state.withLock { state -> (Bool, [CheckedContinuation<Void, any Error>]) in
                    guard !Task.isCancelled else { return (false, []) }
                    state.pendingReads.append(
                        PendingRead(id: operationID, environment: environment, continuation: continuation)
                    )
                    return (true, Self.takeReadyWaiters(from: &state.readWaiters, environment: environment))
                }
                registration.1.forEach { $0.resume() }
                if !registration.0 {
                    continuation.resume(throwing: CancellationError())
                }
            }
        } onCancel: {
            cancelRead(operationID)
        }
    }

    func sharedProfile(userId _: String, environment _: SessionEnvironment) async -> SharedProfile? { nil }

    func upsert(profile: SharedProfile, environment: SessionEnvironment) async throws -> SharedProfile {
        try Task.checkCancellation()
        let operationID = UUID()

        return try await withTaskCancellationHandler {
            try await withCheckedThrowingContinuation { continuation in
                let registration = state.withLock { state -> (Bool, [CheckedContinuation<Void, any Error>]) in
                    guard !Task.isCancelled else { return (false, []) }
                    state.pendingUpserts.append(
                        PendingUpsert(
                            id: operationID,
                            environment: environment,
                            profile: profile,
                            continuation: continuation
                        )
                    )
                    return (true, Self.takeReadyWaiters(from: &state.upsertWaiters, environment: environment))
                }
                registration.1.forEach { $0.resume() }
                if !registration.0 {
                    continuation.resume(throwing: CancellationError())
                }
            }
        } onCancel: {
            cancelUpsert(operationID)
        }
    }

    func deleteSharedProfile(userId _: String, environment: SessionEnvironment) async throws -> Bool {
        try Task.checkCancellation()
        let operationID = UUID()

        return try await withTaskCancellationHandler {
            try await withCheckedThrowingContinuation { continuation in
                let registration = state.withLock { state -> (Bool, [CheckedContinuation<Void, any Error>]) in
                    guard !Task.isCancelled else { return (false, []) }
                    state.pendingDeletes.append(
                        PendingDelete(id: operationID, environment: environment, continuation: continuation)
                    )
                    return (true, Self.takeReadyWaiters(from: &state.deleteWaiters, environment: environment))
                }
                registration.1.forEach { $0.resume() }
                if !registration.0 {
                    continuation.resume(throwing: CancellationError())
                }
            }
        } onCancel: {
            cancelDelete(operationID)
        }
    }

    func waitUntilReadStarts(environment: SessionEnvironment) async throws {
        try await waitUntilStarted(environment: environment, kind: .read)
    }

    func waitUntilUpsertStarts(environment: SessionEnvironment) async throws {
        try await waitUntilStarted(environment: environment, kind: .upsert)
    }

    func waitUntilDeleteStarts(environment: SessionEnvironment) async throws {
        try await waitUntilStarted(environment: environment, kind: .delete)
    }

    func completeRead(environment: SessionEnvironment, profiles: [SharedProfile]) {
        let continuation = state.withLock { state -> CheckedContinuation<[SharedProfile], any Error>? in
            guard let index = state.pendingReads.firstIndex(where: { $0.environment == environment }) else {
                return nil
            }
            return state.pendingReads.remove(at: index).continuation
        }
        continuation?.resume(returning: profiles)
    }

    func completeUpsert(environment: SessionEnvironment) {
        let pending = state.withLock { state -> PendingUpsert? in
            guard let index = state.pendingUpserts.firstIndex(where: { $0.environment == environment }) else {
                return nil
            }
            return state.pendingUpserts.remove(at: index)
        }
        if let pending {
            pending.continuation.resume(returning: pending.profile)
        }
    }

    func completeDelete(environment: SessionEnvironment) {
        let continuation = state.withLock { state -> CheckedContinuation<Bool, any Error>? in
            guard let index = state.pendingDeletes.firstIndex(where: { $0.environment == environment }) else {
                return nil
            }
            return state.pendingDeletes.remove(at: index).continuation
        }
        continuation?.resume(returning: true)
    }

    func cancelAll() {
        let continuations = state.withLock { state in
            let reads = state.pendingReads.map(\.continuation)
            let upserts = state.pendingUpserts.map(\.continuation)
            let deletes = state.pendingDeletes.map(\.continuation)
            let waiters = state.readWaiters.values.map(\.continuation) +
                state.upsertWaiters.values.map(\.continuation) +
                state.deleteWaiters.values.map(\.continuation)
            state.pendingReads.removeAll()
            state.pendingUpserts.removeAll()
            state.pendingDeletes.removeAll()
            state.readWaiters.removeAll()
            state.upsertWaiters.removeAll()
            state.deleteWaiters.removeAll()
            return (reads, upserts, deletes, waiters)
        }
        continuations.0.forEach { $0.resume(throwing: CancellationError()) }
        continuations.1.forEach { $0.resume(throwing: CancellationError()) }
        continuations.2.forEach { $0.resume(throwing: CancellationError()) }
        continuations.3.forEach { $0.resume(throwing: CancellationError()) }
    }

    private struct PendingRead {
        let id: UUID
        let environment: SessionEnvironment
        let continuation: CheckedContinuation<[SharedProfile], any Error>
    }

    private struct PendingUpsert {
        let id: UUID
        let environment: SessionEnvironment
        let profile: SharedProfile
        let continuation: CheckedContinuation<SharedProfile, any Error>
    }

    private struct PendingDelete {
        let id: UUID
        let environment: SessionEnvironment
        let continuation: CheckedContinuation<Bool, any Error>
    }

    private enum OperationKind {
        case read
        case upsert
        case delete
    }

    private func waitUntilStarted(environment: SessionEnvironment, kind: OperationKind) async throws {
        try Task.checkCancellation()
        guard !hasPendingOperation(environment: environment, kind: kind) else { return }
        let waiterID = UUID()

        try await withTaskCancellationHandler {
            try await withCheckedThrowingContinuation { continuation in
                let shouldResume = state.withLock { state in
                    guard !Self.hasPendingOperation(in: state, environment: environment, kind: kind),
                          !Task.isCancelled else {
                        return true
                    }
                    let waiter = StartWaiter(environment: environment, continuation: continuation)
                    Self.register(waiter, id: waiterID, in: &state, kind: kind)
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
            cancelWaiter(waiterID, kind: kind)
        }
    }

    private func hasPendingOperation(environment: SessionEnvironment, kind: OperationKind) -> Bool {
        state.withLock { Self.hasPendingOperation(in: $0, environment: environment, kind: kind) }
    }

    private func cancelRead(_ operationID: UUID) {
        let continuation = state.withLock { state -> CheckedContinuation<[SharedProfile], any Error>? in
            guard let index = state.pendingReads.firstIndex(where: { $0.id == operationID }) else { return nil }
            return state.pendingReads.remove(at: index).continuation
        }
        continuation?.resume(throwing: CancellationError())
    }

    private func cancelUpsert(_ operationID: UUID) {
        let continuation = state.withLock { state -> CheckedContinuation<SharedProfile, any Error>? in
            guard let index = state.pendingUpserts.firstIndex(where: { $0.id == operationID }) else { return nil }
            return state.pendingUpserts.remove(at: index).continuation
        }
        continuation?.resume(throwing: CancellationError())
    }

    private func cancelDelete(_ operationID: UUID) {
        let continuation = state.withLock { state -> CheckedContinuation<Bool, any Error>? in
            guard let index = state.pendingDeletes.firstIndex(where: { $0.id == operationID }) else { return nil }
            return state.pendingDeletes.remove(at: index).continuation
        }
        continuation?.resume(throwing: CancellationError())
    }

    private func cancelWaiter(_ waiterID: UUID, kind: OperationKind) {
        let continuation = state.withLock { state in
            Self.removeWaiter(id: waiterID, from: &state, kind: kind)?.continuation
        }
        continuation?.resume(throwing: CancellationError())
    }

    private static func register(_ waiter: StartWaiter, id: UUID, in state: inout State, kind: OperationKind) {
        switch kind {
        case .read: state.readWaiters[id] = waiter
        case .upsert: state.upsertWaiters[id] = waiter
        case .delete: state.deleteWaiters[id] = waiter
        }
    }

    private static func removeWaiter(id: UUID, from state: inout State, kind: OperationKind) -> StartWaiter? {
        switch kind {
        case .read: state.readWaiters.removeValue(forKey: id)
        case .upsert: state.upsertWaiters.removeValue(forKey: id)
        case .delete: state.deleteWaiters.removeValue(forKey: id)
        }
    }

    private static func hasPendingOperation(
        in state: State,
        environment: SessionEnvironment,
        kind: OperationKind
    ) -> Bool {
        switch kind {
        case .read: state.pendingReads.contains { $0.environment == environment }
        case .upsert: state.pendingUpserts.contains { $0.environment == environment }
        case .delete: state.pendingDeletes.contains { $0.environment == environment }
        }
    }

    private static func takeReadyWaiters(
        from waiters: inout [UUID: StartWaiter],
        environment: SessionEnvironment
    ) -> [CheckedContinuation<Void, any Error>] {
        let readyIDs = waiters.compactMap { id, waiter in waiter.environment == environment ? id : nil }
        return readyIDs.compactMap { waiters.removeValue(forKey: $0)?.continuation }
    }
}

final class EnvironmentSuspendedImagePipelineManager: ImagePipelineManager, Sendable {
    private struct StartWaiter {
        let environment: SessionEnvironment
        let continuation: CheckedContinuation<Void, any Error>
    }

    private struct State {
        var pendingUploads: [PendingUpload] = []
        var startWaiters: [UUID: StartWaiter] = [:]
    }

    private let state = Mutex(State())

    func processAndUpload(imageData _: Data, request: ImageUploadRequest) async throws -> ImageUploadResult {
        try Task.checkCancellation()
        let operationID = UUID()

        return try await withTaskCancellationHandler {
            try await withCheckedThrowingContinuation { continuation in
                let registration = state.withLock { state -> (Bool, [CheckedContinuation<Void, any Error>]) in
                    guard !Task.isCancelled else { return (false, []) }
                    state.pendingUploads.append(
                        PendingUpload(id: operationID, request: request, continuation: continuation)
                    )
                    let readyIDs = state.startWaiters.compactMap { id, waiter in
                        waiter.environment == request.environment ? id : nil
                    }
                    let waiters = readyIDs.compactMap {
                        state.startWaiters.removeValue(forKey: $0)?.continuation
                    }
                    return (true, waiters)
                }
                registration.1.forEach { $0.resume() }
                if !registration.0 {
                    continuation.resume(throwing: CancellationError())
                }
            }
        } onCancel: {
            cancelUpload(operationID)
        }
    }

    func waitUntilUploadStarts(environment: SessionEnvironment) async throws {
        try Task.checkCancellation()
        guard !state.withLock({ $0.pendingUploads.contains { $0.request.environment == environment } }) else {
            return
        }
        let waiterID = UUID()

        try await withTaskCancellationHandler {
            try await withCheckedThrowingContinuation { continuation in
                let shouldResume = state.withLock { state in
                    guard !state.pendingUploads.contains(where: { $0.request.environment == environment }),
                          !Task.isCancelled else {
                        return true
                    }
                    state.startWaiters[waiterID] = StartWaiter(
                        environment: environment,
                        continuation: continuation
                    )
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
            let continuation = state.withLock { $0.startWaiters.removeValue(forKey: waiterID)?.continuation }
            continuation?.resume(throwing: CancellationError())
        }
    }

    func completeUpload(environment: SessionEnvironment, downloadURL: String) {
        let continuation = state.withLock { state -> CheckedContinuation<ImageUploadResult, any Error>? in
            guard let index = state.pendingUploads.firstIndex(where: { $0.request.environment == environment }) else {
                return nil
            }
            return state.pendingUploads.remove(at: index).continuation
        }
        continuation?.resume(
            returning: ImageUploadResult(
                downloadURL: downloadURL,
                widthPx: 1,
                heightPx: 1,
                byteSize: 1,
                mimeType: "image/jpeg"
            )
        )
    }

    func cancelAll() {
        let continuations = state.withLock { state in
            let uploads = state.pendingUploads.map(\.continuation)
            let waiters = state.startWaiters.values.map(\.continuation)
            state.pendingUploads.removeAll()
            state.startWaiters.removeAll()
            return (uploads, waiters)
        }
        continuations.0.forEach { $0.resume(throwing: CancellationError()) }
        continuations.1.forEach { $0.resume(throwing: CancellationError()) }
    }

    private func cancelUpload(_ operationID: UUID) {
        let continuation = state.withLock { state -> CheckedContinuation<ImageUploadResult, any Error>? in
            guard let index = state.pendingUploads.firstIndex(where: { $0.id == operationID }) else { return nil }
            return state.pendingUploads.remove(at: index).continuation
        }
        continuation?.resume(throwing: CancellationError())
    }

    private struct PendingUpload {
        let id: UUID
        let request: ImageUploadRequest
        let continuation: CheckedContinuation<ImageUploadResult, any Error>
    }
}
