import Foundation
import Observation

/// Owns a single coverage inbox and serial mutation for one authorization revision.
/// A lost command response retains its exact intent for explicit replay; it never implies rollback.
@MainActor
@Observable
final class ShiftCoverageViewModel {
    private(set) var session: ShiftCoverageSession?
    private(set) var snapshot: ShiftCoverageSnapshot?
    private(set) var pendingCommand: ShiftCoverageCommand?
    private(set) var failure: ShiftCoverageFailure?
    private(set) var isBusy = false
    @ObservationIgnored private let repository: any ShiftCoverageRepository
    @ObservationIgnored private var receivedAt = ContinuousClock.now
    @ObservationIgnored private var generation: UInt64 = 0

    init(repository: any ShiftCoverageRepository) {
        self.repository = repository
    }

    func bind(_ session: ShiftCoverageSession?) {
        guard self.session != session else { return }
        generation &+= 1
        self.session = session
        snapshot = nil
        pendingCommand = nil
        failure = nil
        isBusy = false
    }

    var nowMillis: Int64 {
        guard let snapshot else { return 0 }
        let elapsed = receivedAt.duration(to: .now).components
        return snapshot.serverTimeMillis + elapsed.seconds * 1000 + elapsed.attoseconds / 1_000_000_000_000_000
    }

    func refresh() async {
        guard let session, !isBusy else { return }
        let owner = generation
        isBusy = true
        snapshot = nil
        failure = nil
        do {
            let result = try await repository.read(caseId: nil, session: session)
            guard generation == owner else { return }
            try Task.checkCancellation()
            receivedAt = .now
            snapshot = result
        } catch {
            guard generation == owner else { return }
            record(error)
        }
        guard generation == owner else { return }
        isBusy = false
    }

    func submit(_ command: ShiftCoverageCommand) async {
        guard let session, !isBusy, snapshot != nil, pendingCommand == nil else { return }
        pendingCommand = command
        await executePending(session: session)
    }

    func retryPending() async {
        guard let session, !isBusy, pendingCommand != nil else { return }
        await executePending(session: session)
    }

    private func executePending(session: ShiftCoverageSession) async {
        guard let command = pendingCommand else { return }
        let owner = generation
        isBusy = true
        snapshot = nil
        failure = nil
        do {
            try await repository.execute(command, session: session)
            guard generation == owner else { return }
            // An acknowledged write stays acknowledged even if read-back fails or the task is cancelled.
            pendingCommand = nil
            try Task.checkCancellation()
            let result = try await repository.read(caseId: nil, session: session)
            guard generation == owner else { return }
            try Task.checkCancellation()
            receivedAt = .now
            snapshot = result
        } catch {
            guard generation == owner else { return }
            if case .rejected(let status, _) = error as? ShiftCoverageFailure,
               [400, 401, 403, 409].contains(status) {
                pendingCommand = nil
            }
            record(error)
        }
        guard generation == owner else { return }
        isBusy = false
    }

    private func record(_ error: any Error) {
        failure = (error as? ShiftCoverageFailure) ?? .unavailable
        if failure == .sessionChanged {
            bind(nil)
            failure = .sessionChanged
        } else if case .rejected(let status, _) = failure, [401, 403].contains(status) {
            let rejection = failure
            bind(nil)
            failure = rejection
        }
    }
}
