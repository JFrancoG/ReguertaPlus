import Foundation
import Observation

@MainActor
@Observable
final class CoverageAdministrationDraft: Identifiable {
    let id = UUID()
    let subject: Subject
    let environment: SessionEnvironment
    let expectedPolicyRevision: String
    var reason = ""
    var confirmsCreditCancellation = false

    enum Subject {
        case reconcile(ShiftCoverageAdministrationSnapshot.Member)
        case permanentDeparture(ShiftCoverageAdministrationSnapshot.Member)
        case spacing(ShiftCoverageAdministrationSnapshot.SpacingCandidate)
    }

    init(subject: Subject, environment: SessionEnvironment, expectedPolicyRevision: String) {
        self.subject = subject
        self.environment = environment
        self.expectedPolicyRevision = expectedPolicyRevision
    }

    var titleKey: String {
        switch subject {
        case .reconcile: "admin_reconcile"
        case .permanentDeparture: "admin_departure"
        case .spacing: "admin_spacing"
        }
    }

    var noteKey: String {
        switch subject {
        case .reconcile: "admin_note"
        case .permanentDeparture: "admin_departure_note"
        case .spacing: "admin_spacing_note"
        }
    }

    var memberName: String {
        switch subject {
        case .reconcile(let member), .permanentDeparture(let member): member.displayName
        case .spacing(let candidate): candidate.displayName
        }
    }

    var needsReason: Bool {
        switch subject {
        case .reconcile: false
        case .permanentDeparture, .spacing: true
        }
    }

    var isPermanentDeparture: Bool {
        switch subject {
        case .permanentDeparture: true
        case .reconcile, .spacing: false
        }
    }

    var spacingCandidate: ShiftCoverageAdministrationSnapshot.SpacingCandidate? {
        switch subject {
        case .spacing(let candidate): candidate
        case .reconcile, .permanentDeparture: nil
        }
    }

    var command: ShiftCoverageAdministrationCommand? {
        let reason = reason.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !needsReason || (!reason.isEmpty && reason.utf16.count <= 500) else { return nil }
        switch subject {
        case .reconcile(let member):
            return membershipCommand(member, reason: nil)
        case .permanentDeparture(let member):
            guard confirmsCreditCancellation, member.allowsPermanentDeparture else { return nil }
            return membershipCommand(member, reason: reason)
        case .spacing(let candidate):
            return ShiftCoverageAdministrationCommand(
                expectedPolicyRevision: expectedPolicyRevision,
                environment: environment,
                operationId: id.uuidString,
                userId: candidate.userId,
                intent: .spacing(candidate: candidate, reason: reason)
            )
        }
    }

    func isCurrent(in snapshot: ShiftCoverageAdministrationSnapshot, nowMillis: Int64) -> Bool {
        guard snapshot.environment == environment.rawValue else { return false }
        switch subject {
        case .reconcile(let member), .permanentDeparture(let member):
            return snapshot.membershipWritable && snapshot.members.contains(member)
        case .spacing(let candidate):
            guard let date = CoverageCopy.ordinaryDate(candidate.date) else { return false }
            return snapshot.spacingCandidates.contains(candidate) &&
                date.timeIntervalSince1970 * 1000 > Double(nowMillis)
        }
    }

    private func membershipCommand(
        _ member: ShiftCoverageAdministrationSnapshot.Member,
        reason: String?
    ) -> ShiftCoverageAdministrationCommand {
        ShiftCoverageAdministrationCommand(
            expectedPolicyRevision: expectedPolicyRevision,
            environment: environment,
            operationId: id.uuidString,
            userId: member.userId,
            intent: .membership(
                expectedRevision: member.membershipRevision,
                contextDigest: member.contextDigest,
                permanentDepartureReason: reason
            )
        )
    }
}
