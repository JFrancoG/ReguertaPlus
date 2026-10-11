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
    @ObservationIgnored private var detailEventId: String?
    @ObservationIgnored private var overviewRequested = false
    @ObservationIgnored private var generation: UInt64 = 0

    init(repository: any ShiftCoverageRepository) {
        self.repository = repository
    }

    func bind(_ session: ShiftCoverageSession?) {
        guard self.session != session else { return }
        generation &+= 1
        self.session = session
        detailEventId = nil
        overviewRequested = false
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
        _ = await load(notificationEventId: detailEventId)
    }

    func refreshOverview() async {
        overviewRequested = true
        guard !isBusy else { return }
        overviewRequested = false
        detailEventId = nil
        _ = await load(notificationEventId: nil)
    }

    func openNotification(_ eventId: String) async -> String? {
        guard pendingCommand == nil else { return nil }
        return await load(notificationEventId: eventId)
    }

    private func load(notificationEventId: String?) async -> String? {
        guard let session, !isBusy else { return nil }
        let owner = generation
        isBusy = true
        snapshot = nil
        failure = nil
        var selectedCaseId: String?
        do {
            let result: ShiftCoverageSnapshot
            if let notificationEventId {
                result = try await repository.readNotification(eventId: notificationEventId, session: session)
            } else {
                result = try await repository.read(caseId: nil, session: session)
            }
            guard generation == owner else { return nil }
            try Task.checkCancellation()
            receivedAt = .now
            snapshot = result
            detailEventId = notificationEventId
            selectedCaseId = result.notification?.caseId
        } catch {
            guard generation == owner else { return nil }
            record(error)
        }
        guard generation == owner else { return nil }
        isBusy = false
        if overviewRequested {
            await refreshOverview()
            return nil
        }
        return selectedCaseId
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
            let result: ShiftCoverageSnapshot
            if let detailEventId {
                result = try await repository.readNotification(eventId: detailEventId, session: session)
            } else {
                result = try await repository.read(caseId: nil, session: session)
            }
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
        if overviewRequested {
            await refreshOverview()
        }
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
