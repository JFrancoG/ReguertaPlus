#if DEBUG
import Foundation

@MainActor
final class CoveragePreviewAccess: CoverageRehearsalAccess, ShiftCoverageRepository {
    var repository: any ShiftCoverageRepository { self }
    let snapshot = ShiftCoverageSnapshot(
        schemaVersion: 1,
        environment: "develop",
        memberId: "ana",
        isAdmin: true,
        eligible: true,
        serverTimeMillis: 1_800_000_000_000,
        policyRevision: "hu084-provisional-v1",
        availableShifts: [.init(
            shiftId: "market-next",
            type: .market,
            scheduledAtMillis: 1_800_100_000_000,
            shiftRevision: 1,
            writable: true,
            assignedUserIds: ["ana"]
        )],
        members: [.init(memberId: "ana", displayName: "Ana de prueba", offerCandidate: true)],
        policy: .init(maximumOfferWindowMillis: 86_400_000, volunteerWindowMillis: 3_600_000, drawAvailable: false),
        cases: [.init(
            caseId: "preview-case",
            shiftId: "market-next",
            type: .market,
            positionIndex: 0,
            status: .offered,
            revision: 2,
            shiftRevision: 1,
            scheduledAtMillis: 1_800_100_000_000,
            writable: true,
            absentUserId: "ana",
            acceptedUserId: nil,
            offer: .init(userId: "ana", source: .admin, expiresAtMillis: 1_800_080_000_000),
            selectionPhase: nil,
            volunteerClosesAtMillis: nil,
            volunteered: false,
            updatedAtMillis: 1_800_000_000_000,
            administration: .init(openedByUserId: "ana", reason: "Ausencia familiar de prueba", volunteerCount: 0),
            openedByMe: true,
            canResumeAdmin: false,
            hasVolunteered: false,
            drawCommitted: false,
            drawAvailableAtMillis: nil
        )],
        credits: [.init(
            creditId: "credit",
            shiftId: "market-previous",
            type: .market,
            state: .pending,
            earnedAtMillis: 1_790_000_000_000,
            consumedAtMillis: nil
        )],
        reserves: [.init(type: .delivery, active: true, enteredAtMillis: 1_790_000_000_000)],
        notifications: [.init(eventId: CoverageRemotePushRehearsal.eventID, sentAtMillis: 1_800_000_000_000)],
        notification: .init(eventId: CoverageRemotePushRehearsal.eventID, caseId: "preview-case", caseRevision: 2)
    )

    func signIn(email: String, password: String) async throws -> ShiftCoverageSession {
        ShiftCoverageSession(
            environment: .develop,
            uid: "preview",
            memberId: "ana",
            authorizationRevision: 1
        )
    }
    func signOut() {}
    func read(caseId: String?, session: ShiftCoverageSession) async throws -> ShiftCoverageSnapshot { snapshot }
    func readNotification(eventId: String, session: ShiftCoverageSession) async throws -> ShiftCoverageSnapshot {
        guard eventId == CoverageRemotePushRehearsal.eventID else { throw ShiftCoverageFailure.unavailable }
        return snapshot
    }
    func execute(_ command: ShiftCoverageCommand, session: ShiftCoverageSession) async throws {
        throw ShiftCoverageFailure.unavailable
    }

    func readAdministration(session: ShiftCoverageSession) async throws -> ShiftCoverageAdministrationSnapshot {
        Self.administration
    }

    static let administration = ShiftCoverageAdministrationSnapshot(
        schemaVersion: 1,
        environment: "develop",
        memberId: "ana",
        isAdmin: true,
        serverTimeMillis: 1_800_000_000_000,
        policyRevision: "hu084-provisional-v1",
        membershipWritable: true,
        members: [.init(
            userId: "beatriz",
            displayName: "Beatriz de prueba",
            membershipRevision: 2,
            sourceActive: false,
            eligible: false,
            permanentDeparture: false,
            pendingQueueTransition: false,
            contextDigest: "preview-member-context",
            reserves: [.init(
                type: .delivery,
                active: false,
                enteredAtMillis: 1_790_000_000_000,
                admissionAfterRound: 3
            )],
            credits: [.init(
                type: .delivery,
                pendingCount: 1,
                consumedCount: 0,
                cancelledCount: 0
            )]
        )],
        spacingCandidates: [.init(
            id: "preview-spacing",
            userId: "ana",
            displayName: "Ana de prueba",
            planningRequestId: "preview-plan",
            previousDate: "2027-01-06",
            previousRoundNumber: 3,
            date: "2027-02-17",
            roundNumber: 4,
            contextDigest: "preview-spacing-context"
        )],
        spacingUnavailableReason: nil
    )

    static func model() -> CoverageRehearsalViewModel {
        let model = CoverageRehearsalViewModel(access: CoveragePreviewAccess())
        model.coverage.bind(ShiftCoverageSession(
            environment: .develop,
            uid: "preview",
            memberId: "ana",
            authorizationRevision: 1
        ))
        return model
    }

    static func closedRoute() -> CoverageRouteViewModel {
        CoverageRouteViewModel(repository: CoveragePreviewAccess())
    }
}
#endif
