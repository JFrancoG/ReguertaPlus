import Foundation
import Testing

@testable import Reguerta

@MainActor
struct ShiftNotificationDetailPresentationTests {
    @Test func currentGenericNotificationPublishesFreshAuthorizedDetail() async {
        let fixture = makeFixture(repository: ImmediateShiftNotificationDetailRepository(detail: detail))

        await fixture.viewModel.openNotificationDetail(eventID: "event_1")

        #expect(fixture.viewModel.notificationShiftDetail == detail)
        #expect(fixture.viewModel.loadingNotificationDetailEventID == nil)
    }

    @Test func lateDetailCannotCrossSessionReplacement() async throws {
        let repository = SuspendedShiftNotificationDetailRepository(detail: detail)
        let fixture = makeFixture(repository: repository)
        let opening = Task { await fixture.viewModel.openNotificationDetail(eventID: "event_1") }
        try await repository.waitUntilRequestStarts()

        fixture.sessionViewModel.mode = .signedOut
        fixture.viewModel.handleSessionModeChange(.signedOut)
        repository.completeRequest()
        await opening.value

        #expect(fixture.viewModel.notificationShiftDetail == nil)
        #expect(fixture.viewModel.loadingNotificationDetailEventID == nil)
    }

    @Test func routeExitClearsEphemeralDetail() async {
        let fixture = makeFixture(repository: ImmediateShiftNotificationDetailRepository(detail: detail))
        await fixture.viewModel.openNotificationDetail(eventID: "event_1")

        await fixture.viewModel.markVisibleNotificationsReadOnExit()

        #expect(fixture.viewModel.notificationShiftDetail == nil)
    }

    private var detail: ShiftNotificationDetail {
        ShiftNotificationDetail(
            eventID: "event_1",
            assignmentRevision: 4,
            documentRevision: 5,
            shift: ShiftAssignment(
                id: "delivery_1",
                type: .delivery,
                dateMillis: 1_788_127_200_000,
                assignedUserIds: ["member_1"],
                helperUserId: "member_2",
                status: .planned,
                source: "app",
                createdAtMillis: 1,
                updatedAtMillis: 2
            )
        )
    }

    private func makeFixture(
        repository: any ShiftNotificationDetailRepository
    ) -> (viewModel: NewsNotificationsFeatureViewModel, sessionViewModel: SessionViewModel) {
        let member = Member(
            id: "member_1",
            displayName: "Member One",
            normalizedEmail: "member1@reguerta.test",
            authUid: "auth_member_1",
            roles: [.member],
            isActive: true,
            producerCatalogEnabled: true
        )
        let helper = Member(
            id: "member_2",
            displayName: "Member Two",
            normalizedEmail: "member2@reguerta.test",
            authUid: "auth_member_2",
            roles: [.member],
            isActive: true,
            producerCatalogEnabled: true
        )
        let session = AuthorizedSession(
            principal: AuthPrincipal(uid: "auth_member_1", email: member.normalizedEmail),
            authenticatedMember: member,
            member: member,
            members: [member, helper],
            environment: .develop
        )
        let sessionViewModel = SessionViewModel(dependencies: .preview())
        sessionViewModel.mode = .authorized(session)
        let viewModel = NewsNotificationsFeatureViewModel(
            sessionViewModel: sessionViewModel,
            newsRepository: InMemoryNewsRepository(),
            notificationRepository: InMemoryNotificationRepository(),
            shiftNotificationDetailRepository: repository,
            imagePipelineManager: NoOpImagePipelineManager(),
            nowMillisProvider: { 0 }
        )
        viewModel.currentSession = session
        viewModel.currentMember = member
        viewModel.currentEnvironment = .develop
        viewModel.notificationsFeed = [genericShiftNotification]
        return (viewModel, sessionViewModel)
    }

    private var genericShiftNotification: NotificationEvent {
        NotificationEvent(
            id: "event_1",
            title: "Turnos actualizados",
            body: "Consulta la aplicación para ver la información actualizada.",
            type: "shift_updated",
            target: "users",
            userIds: ["member_1"],
            segmentType: nil,
            targetRole: nil,
            createdBy: "system",
            sentAtMillis: 1,
            weekKey: nil,
            contentPolicy: .authorizedFetchRequired
        )
    }
}

@MainActor
private struct ImmediateShiftNotificationDetailRepository: ShiftNotificationDetailRepository {
    let detail: ShiftNotificationDetail

    func currentDetail(
        eventID _: String,
        memberID _: String,
        environment _: SessionEnvironment
    ) async -> ShiftNotificationDetail {
        detail
    }
}

@MainActor
private final class SuspendedShiftNotificationDetailRepository: ShiftNotificationDetailRepository {
    private let operation = SessionRevisionOperation()
    private let detail: ShiftNotificationDetail

    init(detail: ShiftNotificationDetail) {
        self.detail = detail
    }

    func currentDetail(
        eventID _: String,
        memberID _: String,
        environment _: SessionEnvironment
    ) async throws -> ShiftNotificationDetail {
        try await operation.suspend()
        return detail
    }

    func waitUntilRequestStarts() async throws { try await operation.waitUntilStarted() }
    func completeRequest() { operation.complete() }
}
