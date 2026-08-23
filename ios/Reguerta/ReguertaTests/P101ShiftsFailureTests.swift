import FirebaseFirestore
import Foundation
import Testing

@testable import Reguerta

@MainActor
struct P101ShiftsFailureTests {
    @Test func firestoreShiftContractsRejectCorruptDocuments() throws {
        let timestamp = Timestamp(date: Date(timeIntervalSince1970: 123))
        let validShift: [String: Any] = [
            "type": "delivery",
            "date": timestamp,
            "assignedUserIds": ["member_1"],
            "helperUserId": NSNull(),
            "status": "confirmed",
            "source": "app",
            "createdAt": timestamp,
            "updatedAt": timestamp
        ]

        #expect(
            try FirestoreShiftRepository.shift(
                documentID: "shift_1",
                data: validShift
            ).assignedUserIds == ["member_1"]
        )

        var missingSource = validShift
        missingSource.removeValue(forKey: "source")
        #expect(throws: RepositoryError.invalidData(resource: "shifts.document")) {
            try FirestoreShiftRepository.shift(documentID: "shift_1", data: missingSource)
        }

        var blankAssignee = validShift
        blankAssignee["assignedUserIds"] = ["member_1", " "]
        #expect(throws: RepositoryError.invalidData(resource: "shifts.document")) {
            try FirestoreShiftRepository.shift(documentID: "shift_1", data: blankAssignee)
        }
    }

    @Test func firestoreSwapContractRejectsPartialDocuments() throws {
        let timestamp = Timestamp(date: Date(timeIntervalSince1970: 123))
        let validSwap: [String: Any] = [
            "requestedShiftId": "shift_1",
            "requesterUserId": "member_1",
            "reason": "",
            "status": "open",
            "candidates": [["userId": "member_2", "shiftId": "shift_2"]],
            "responses": [],
            "selectedCandidateUserId": NSNull(),
            "selectedCandidateShiftId": NSNull(),
            "requestedAt": timestamp,
            "confirmedAt": NSNull(),
            "appliedAt": NSNull()
        ]
        var corruptSwap = validSwap
        corruptSwap["candidates"] = [
            ["userId": "member_2", "shiftId": "shift_2"],
            ["userId": "member_3"]
        ]
        #expect(throws: RepositoryError.invalidData(resource: "shiftSwapRequests.document")) {
            try FirestoreShiftSwapRequestRepository.shiftSwapRequest(
                documentID: "swap_1",
                data: corruptSwap
            )
        }
    }

    @Test func firestoreCalendarContractsRejectPartialDocuments() throws {
        let timestamp = Timestamp(date: Date(timeIntervalSince1970: 123))
        let validOverride: [String: Any] = [
            "weekKey": "2026-W20",
            "deliveryDate": timestamp,
            "ordersBlockedDate": timestamp,
            "ordersOpenAt": timestamp,
            "ordersCloseAt": timestamp,
            "updatedBy": "admin_1",
            "updatedAt": timestamp
        ]
        #expect(
            try FirestoreDeliveryCalendarRepository.deliveryOverride(
                documentID: "2026-W20",
                data: validOverride
            ).weekKey == "2026-W20"
        )

        var mismatchedWeek = validOverride
        mismatchedWeek["weekKey"] = "2026-W21"
        #expect(throws: RepositoryError.invalidData(resource: "deliveryCalendar.document")) {
            try FirestoreDeliveryCalendarRepository.deliveryOverride(
                documentID: "2026-W20",
                data: mismatchedWeek
            )
        }

        #expect(
            try FirestoreDeliveryCalendarRepository.deliveryWeekday(
                data: ["deliveryDayOfWeek": "WED"]
            ) == .wednesday
        )
        #expect(throws: RepositoryError.invalidData(resource: "config.deliveryCalendar")) {
            try FirestoreDeliveryCalendarRepository.deliveryWeekday(
                data: ["deliveryDayOfWeek": "someday"]
            )
        }
        #expect(throws: RepositoryError.invalidData(resource: "config.deliveryCalendar")) {
            try FirestoreDeliveryCalendarRepository.deliveryWeekday(data: [:])
        }
    }

    @Test func refreshShiftsPreservesLastSnapshotWhenEitherReadFails() async {
        let member = shiftMember(id: "member_1", displayName: "Carmen")
        let previousShift = shift(
            id: "previous",
            type: .delivery,
            dateMillis: 10,
            assignedUserIds: [member.id]
        )
        let previousRequest = shiftSwapRequest(
            id: "previous_swap",
            requestedShiftId: previousShift.id,
            requesterUserId: member.id,
            candidates: []
        )
        let viewModel = makeShiftsViewModel(
            currentMember: member,
            members: [member],
            shiftRepository: ThrowingShiftRepository()
        )
        viewModel.shiftsFeed = [previousShift]
        viewModel.shiftSwapRequests = [previousRequest]

        await viewModel.refreshShifts()

        #expect(viewModel.shiftsFeed == [previousShift])
        #expect(viewModel.shiftSwapRequests == [previousRequest])
        #expect(viewModel.isLoadingShifts == false)
        #expect(viewModel.feedbackCenter.messageKey == AccessL10nKey.feedbackUnableLoadData)
    }

    @Test func legitimateEmptyShiftReadsReplaceThePreviousSnapshot() async {
        let member = shiftMember(id: "member_1", displayName: "Carmen")
        let previousShift = shift(
            id: "previous",
            type: .delivery,
            dateMillis: 10,
            assignedUserIds: [member.id]
        )
        let viewModel = makeShiftsViewModel(
            currentMember: member,
            members: [member]
        )
        viewModel.shiftsFeed = [previousShift]

        await viewModel.refreshShifts()

        #expect(viewModel.shiftsFeed.isEmpty)
        #expect(viewModel.feedbackCenter.messageKey == nil)
    }

    @Test func refreshCalendarPreservesSnapshotWhenAReadFails() async throws {
        let admin = adminMember(id: "admin_1", displayName: "Admin")
        let existing = try #require(
            DeliveryCalendarOverride.weeklyException(
                weekKey: "2026-W20",
                weekday: .friday,
                updatedByUserId: admin.id,
                updatedAtMillis: 1
            )
        )
        let viewModel = makeShiftsViewModel(
            currentMember: admin,
            members: [admin],
            deliveryCalendarRepository: ThrowingDeliveryCalendarRepository()
        )
        viewModel.defaultDeliveryDayOfWeek = .wednesday
        viewModel.deliveryCalendarOverrides = [existing]

        await viewModel.refreshDeliveryCalendar()

        #expect(viewModel.defaultDeliveryDayOfWeek == .wednesday)
        #expect(viewModel.deliveryCalendarOverrides == [existing])
        #expect(viewModel.isLoadingDeliveryCalendar == false)
        #expect(viewModel.feedbackCenter.messageKey == AccessL10nKey.feedbackUnableLoadData)
    }

    @Test func confirmedCalendarWriteSurvivesFailedReadBack() async throws {
        let admin = adminMember(id: "admin_1", displayName: "Admin")
        let repository = ConfirmingCalendarWithFailingReadsRepository()
        let viewModel = makeShiftsViewModel(
            currentMember: admin,
            members: [admin],
            deliveryCalendarRepository: repository,
            nowMillisProvider: { 1 }
        )
        viewModel.defaultDeliveryDayOfWeek = .wednesday
        viewModel.selectedDeliveryCalendarWeekKey = "2026-W20"
        viewModel.selectedDeliveryCalendarWeekday = .friday
        viewModel.originalDeliveryCalendarWeekday = .wednesday
        viewModel.isDeliveryCalendarWeekPickerPresented = true

        await viewModel.saveDeliveryCalendarOverride()

        #expect(viewModel.deliveryCalendarOverrides.map(\.weekKey) == ["2026-W20"])
        #expect(viewModel.isDeliveryCalendarWeekPickerPresented == false)
        #expect(viewModel.selectedDeliveryCalendarWeekKey == nil)
        #expect(viewModel.feedbackCenter.messageKey == AccessL10nKey.feedbackUnableLoadData)
    }

    @Test func confirmedSwapCreateIsNotReportedAsSaveFailureWhenReadBackFails() async {
        let requester = shiftMember(id: "requester", displayName: "Rosa")
        let candidate = shiftMember(id: "candidate", displayName: "Luis")
        let requestedShift = shift(
            id: "requested",
            type: .market,
            dateMillis: 100,
            assignedUserIds: [requester.id]
        )
        let candidateShift = shift(
            id: "candidate",
            type: .market,
            dateMillis: 200,
            assignedUserIds: [candidate.id]
        )
        let repository = ConfirmingSwapWithFailingReadsRepository()
        let viewModel = makeShiftsViewModel(
            currentMember: requester,
            members: [requester, candidate],
            shiftRepository: ThrowingShiftRepository(),
            shiftSwapRequestRepository: repository,
            nowMillisProvider: { 0 }
        )
        viewModel.shiftsFeed = [requestedShift, candidateShift]
        viewModel.startCreatingShiftSwap(shiftId: requestedShift.id)

        let saved = await awaitShiftSwapSave(in: viewModel)
        await awaitCurrentShiftsRefresh(in: viewModel)

        #expect(saved)
        #expect(viewModel.shiftSwapDraft == ShiftSwapDraft())
        #expect(viewModel.shiftsFeed == [requestedShift, candidateShift])
        #expect(
            viewModel.canRequestSwapForShift(
                requestedShift,
                currentMemberId: requester.id
            ) == false
        )
        viewModel.startCreatingShiftSwap(shiftId: requestedShift.id)
        #expect(await awaitShiftSwapSave(in: viewModel) == false)
        #expect(repository.transitionCount == 1)
        #expect(viewModel.feedbackCenter.messageKey == AccessL10nKey.feedbackUnableLoadData)
    }

    @Test func rejectedSwapCreatePreservesTheDraftAndReportsSaveFailure() async {
        let requester = shiftMember(id: "requester", displayName: "Rosa")
        let candidate = shiftMember(id: "candidate", displayName: "Luis")
        let requestedShift = shift(
            id: "requested",
            type: .market,
            dateMillis: 100,
            assignedUserIds: [requester.id]
        )
        let candidateShift = shift(
            id: "candidate",
            type: .market,
            dateMillis: 200,
            assignedUserIds: [candidate.id]
        )
        let viewModel = makeShiftsViewModel(
            currentMember: requester,
            members: [requester, candidate],
            shiftSwapRequestRepository: RejectingSwapRepository(),
            nowMillisProvider: { 0 }
        )
        viewModel.shiftsFeed = [requestedShift, candidateShift]
        viewModel.startCreatingShiftSwap(shiftId: requestedShift.id)
        viewModel.updateShiftSwapDraft { $0.reason = "No puedo ir" }
        let originalDraft = viewModel.shiftSwapDraft

        let saved = await awaitShiftSwapSave(in: viewModel)

        #expect(saved == false)
        #expect(viewModel.shiftSwapDraft == originalDraft)
        #expect(viewModel.isSavingShiftSwapRequest == false)
        #expect(viewModel.feedbackCenter.messageKey == AccessL10nKey.feedbackShiftSwapUnavailable)
    }

    @Test func confirmedSwapUpdateSuppressesRetryWhenReadBackFails() async {
        let requester = shiftMember(id: "requester", displayName: "Rosa")
        let request = shiftSwapRequest(
            id: "swap_1",
            requestedShiftId: "requested",
            requesterUserId: requester.id,
            candidates: []
        )
        let repository = ConfirmingSwapWithFailingReadsRepository()
        let viewModel = makeShiftsViewModel(
            currentMember: requester,
            members: [requester],
            shiftRepository: ThrowingShiftRepository(),
            shiftSwapRequestRepository: repository
        )
        viewModel.shiftSwapRequests = [request]

        _ = await awaitShiftSwapCancellation(requestId: request.id, in: viewModel)
        await awaitCurrentShiftsRefresh(in: viewModel)

        #expect(viewModel.shiftSwapRequests == [request])
        #expect(viewModel.acknowledgedShiftSwapRequestIds == [request.id])
        #expect(viewModel.hasVisibleShiftSwapActivity == false)
        #expect(viewModel.isUpdatingShiftSwapRequest == false)
        #expect(repository.transitionCount == 1)
        #expect(viewModel.feedbackCenter.messageKey == AccessL10nKey.feedbackUnableLoadData)

        _ = await awaitShiftSwapCancellation(requestId: request.id, in: viewModel)
        #expect(repository.transitionCount == 1)
    }

}

extension P101ShiftsFailureTests {
    @Test func firestoreCalendarContractRequiresCanonicalOrdersCloseField() throws {
        let timestamp = Timestamp(date: Date(timeIntervalSince1970: 123))
        let missingOrdersClose: [String: Any] = [
            "weekKey": "2026-W20",
            "deliveryDate": timestamp,
            "ordersBlockedDate": timestamp,
            "ordersOpenAt": timestamp,
            "updatedBy": "admin_1",
            "updatedAt": timestamp
        ]

        #expect(throws: RepositoryError.invalidData(resource: "deliveryCalendar.document")) {
            try FirestoreDeliveryCalendarRepository.deliveryOverride(
                documentID: "2026-W20",
                data: missingOrdersClose
            )
        }
    }
}

@MainActor
private final class ThrowingShiftRepository: ShiftRepository {
    func allShifts(environment _: SessionEnvironment) async throws -> [ShiftAssignment] {
        throw RepositoryError.unavailable(resource: "shifts")
    }

    func upsert(shift: ShiftAssignment, environment _: SessionEnvironment) async throws -> ShiftAssignment {
        shift
    }
}

@MainActor
private final class ThrowingDeliveryCalendarRepository: DeliveryCalendarRepository {
    func defaultDeliveryDayOfWeek(environment _: SessionEnvironment) async throws -> DeliveryWeekday {
        throw RepositoryError.unavailable(resource: "config.deliveryCalendar")
    }

    func allOverrides(environment _: SessionEnvironment) async throws -> [DeliveryCalendarOverride] {
        throw RepositoryError.unavailable(resource: "deliveryCalendar")
    }

    func upsertOverride(
        _ override: DeliveryCalendarOverride,
        environment _: SessionEnvironment
    ) async throws -> DeliveryCalendarOverride {
        override
    }

    func deleteOverride(weekKey _: String, environment _: SessionEnvironment) async throws {}
}

@MainActor
private final class ConfirmingCalendarWithFailingReadsRepository: DeliveryCalendarRepository {
    func defaultDeliveryDayOfWeek(environment _: SessionEnvironment) async throws -> DeliveryWeekday {
        throw RepositoryError.unavailable(resource: "config.deliveryCalendar")
    }

    func allOverrides(environment _: SessionEnvironment) async throws -> [DeliveryCalendarOverride] {
        throw RepositoryError.unavailable(resource: "deliveryCalendar")
    }

    func upsertOverride(
        _ override: DeliveryCalendarOverride,
        environment _: SessionEnvironment
    ) async throws -> DeliveryCalendarOverride {
        override
    }

    func deleteOverride(weekKey _: String, environment _: SessionEnvironment) async throws {}
}

@MainActor
private final class ConfirmingSwapWithFailingReadsRepository: ShiftSwapRequestRepository {
    private(set) var transitionCount = 0

    func allShiftSwapRequests(environment _: SessionEnvironment) async throws -> [ShiftSwapRequest] {
        throw RepositoryError.unavailable(resource: "shiftSwapRequests")
    }

    @MainActor
    func transition(
        _ command: ShiftSwapCommand,
        environment _: SessionEnvironment
    ) async throws -> ShiftSwapTransitionResult {
        transitionCount += 1
        let requestId = switch command {
        case .create:
            "swap_server"
        case .respond(let requestId, _, _), .cancel(let requestId), .apply(let requestId, _):
            requestId
        }
        return ShiftSwapTransitionResult(requestId: requestId, candidateCount: 1)
    }
}

@MainActor
private final class RejectingSwapRepository: ShiftSwapRequestRepository {
    func allShiftSwapRequests(environment _: SessionEnvironment) async throws -> [ShiftSwapRequest] {
        []
    }

    func transition(
        _ command: ShiftSwapCommand,
        environment _: SessionEnvironment
    ) async throws -> ShiftSwapTransitionResult {
        throw ShiftSwapCommandError.unavailable
    }
}
