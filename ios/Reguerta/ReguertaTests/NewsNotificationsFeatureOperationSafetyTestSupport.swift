import Testing

@testable import Reguerta

enum NewsReadOutcome: Sendable {
    case success([NewsArticle])
    case failure(RepositoryError)
    case cancellation
}

actor SequencedNewsRepository: NewsRepository {
    private var outcomes: [NewsReadOutcome]

    init(outcomes: [NewsReadOutcome]) {
        self.outcomes = outcomes
    }

    func news(visibleTo _: Member, environment _: SessionEnvironment) async throws -> [NewsArticle] {
        guard !outcomes.isEmpty else { return [] }
        switch outcomes.removeFirst() {
        case .success(let articles):
            return articles
        case .failure(let error):
            throw error
        case .cancellation:
            throw CancellationError()
        }
    }

    func allNews(environment _: SessionEnvironment) async throws -> [NewsArticle] { [] }
    func upsert(article: NewsArticle, environment _: SessionEnvironment) async throws -> NewsArticle { article }
    func delete(newsId _: String, environment _: SessionEnvironment) async throws -> Bool { true }
}

actor ControlledNewsRepository: NewsRepository {
    private var readCount = 0
    private var continuations: [Int: CheckedContinuation<[NewsArticle], any Error>] = [:]
    private var waiters: [(Int, CheckedContinuation<Void, Never>)] = []

    func news(visibleTo _: Member, environment _: SessionEnvironment) async throws -> [NewsArticle] {
        let index = readCount
        readCount += 1
        let satisfied = waiters.filter { $0.0 <= readCount }
        waiters.removeAll { $0.0 <= readCount }
        satisfied.forEach { $0.1.resume() }
        return try await withCheckedThrowingContinuation { continuations[index] = $0 }
    }

    func allNews(environment _: SessionEnvironment) async throws -> [NewsArticle] { [] }
    func upsert(article: NewsArticle, environment _: SessionEnvironment) async throws -> NewsArticle { article }
    func delete(newsId _: String, environment _: SessionEnvironment) async throws -> Bool { true }

    func waitForReadCount(_ count: Int) async {
        guard readCount < count else { return }
        await withCheckedContinuation { waiters.append((count, $0)) }
    }

    func completeRead(
        _ index: Int,
        with result: Result<[NewsArticle], RepositoryError>
    ) {
        guard let continuation = continuations.removeValue(forKey: index) else { return }
        continuation.resume(with: result.mapError { $0 as any Error })
    }

    func cancelRead(_ index: Int) {
        guard let continuation = continuations.removeValue(forKey: index) else { return }
        continuation.resume(throwing: CancellationError())
    }
}

enum NotificationReadOutcome: Sendable {
    case success([NotificationEvent])
    case failure(RepositoryError)
    case cancellation
}

enum NotificationIDsOutcome: Sendable {
    case success(Set<String>)
    case failure(RepositoryError)
}

actor SequencedNotificationRepository: NotificationRepository {
    private var notificationOutcomes: [NotificationReadOutcome]
    private var readOutcomes: [NotificationIDsOutcome]

    init(notificationOutcomes: [NotificationReadOutcome], readOutcomes: [NotificationIDsOutcome]) {
        self.notificationOutcomes = notificationOutcomes
        self.readOutcomes = readOutcomes
    }

    func notifications(visibleTo _: Member, environment _: SessionEnvironment) async throws -> [NotificationEvent] {
        guard !notificationOutcomes.isEmpty else { return [] }
        switch notificationOutcomes.removeFirst() {
        case .success(let events): return events
        case .failure(let error): throw error
        case .cancellation: throw CancellationError()
        }
    }

    func allNotifications(environment _: SessionEnvironment) async throws -> [NotificationEvent] { [] }

    func readNotificationIds(memberId _: String, environment _: SessionEnvironment) async throws -> Set<String> {
        guard !readOutcomes.isEmpty else { return [] }
        switch readOutcomes.removeFirst() {
        case .success(let ids): return ids
        case .failure(let error): throw error
        }
    }

    func markNotificationsRead(
        memberId _: String,
        notificationIds _: [String],
        readAtMillis _: Int64,
        environment _: SessionEnvironment
    ) async throws {}
    func send(event: NotificationEvent, environment _: SessionEnvironment) async throws -> NotificationEvent { event }
}

actor ControlledNotificationRepository: NotificationRepository {
    private var markCount = 0
    private var markContinuation: CheckedContinuation<Void, any Error>?
    private var waiters: [(Int, CheckedContinuation<Void, Never>)] = []

    func notifications(visibleTo _: Member, environment _: SessionEnvironment) async throws -> [NotificationEvent] {
        []
    }
    func allNotifications(environment _: SessionEnvironment) async throws -> [NotificationEvent] { [] }
    func readNotificationIds(memberId _: String, environment _: SessionEnvironment) async throws -> Set<String> { [] }

    func markNotificationsRead(
        memberId _: String,
        notificationIds _: [String],
        readAtMillis _: Int64,
        environment _: SessionEnvironment
    ) async throws {
        markCount += 1
        let satisfied = waiters.filter { $0.0 <= markCount }
        waiters.removeAll { $0.0 <= markCount }
        satisfied.forEach { $0.1.resume() }
        try await withCheckedThrowingContinuation { markContinuation = $0 }
    }

    func send(event: NotificationEvent, environment _: SessionEnvironment) async throws -> NotificationEvent { event }

    func waitForMarkCount(_ count: Int) async {
        guard markCount < count else { return }
        await withCheckedContinuation { waiters.append((count, $0)) }
    }

    func completeMark(with result: Result<Void, RepositoryError>) {
        guard let markContinuation else { return }
        self.markContinuation = nil
        markContinuation.resume(with: result.mapError { $0 as any Error })
    }
}

actor ConfirmedMutationNewsRepository: NewsRepository {
    private var reads = 0
    private var upserts = 0
    private var deletes = 0
    private var readWaiters: [(Int, CheckedContinuation<Void, Never>)] = []

    func news(visibleTo _: Member, environment _: SessionEnvironment) async throws -> [NewsArticle] {
        reads += 1
        let satisfied = readWaiters.filter { $0.0 <= reads }
        readWaiters.removeAll { $0.0 <= reads }
        satisfied.forEach { $0.1.resume() }
        throw RepositoryError.unavailable(resource: "news")
    }

    func allNews(environment _: SessionEnvironment) async throws -> [NewsArticle] {
        throw RepositoryError.unavailable(resource: "news")
    }

    func upsert(article: NewsArticle, environment _: SessionEnvironment) async throws -> NewsArticle {
        upserts += 1
        return await MainActor.run {
            NewsArticle(
                id: "saved",
                title: article.title,
                body: article.body,
                active: article.active,
                publishedBy: article.publishedBy,
                publishedAtMillis: article.publishedAtMillis,
                urlImage: article.urlImage
            )
        }
    }

    func delete(newsId _: String, environment _: SessionEnvironment) async throws -> Bool {
        deletes += 1
        return true
    }

    func waitForReadCount(_ count: Int) async {
        guard reads < count else { return }
        await withCheckedContinuation { readWaiters.append((count, $0)) }
    }

    func upsertCount() -> Int { upserts }
    func deleteCount() -> Int { deletes }
}

actor ConfirmedMutationNotificationRepository: NotificationRepository {
    private var reads = 0
    private var sends = 0
    private var readWaiters: [(Int, CheckedContinuation<Void, Never>)] = []

    func notifications(visibleTo _: Member, environment _: SessionEnvironment) async throws -> [NotificationEvent] {
        reads += 1
        let satisfied = readWaiters.filter { $0.0 <= reads }
        readWaiters.removeAll { $0.0 <= reads }
        satisfied.forEach { $0.1.resume() }
        throw RepositoryError.unavailable(resource: "notificationInbox")
    }

    func allNotifications(environment _: SessionEnvironment) async throws -> [NotificationEvent] { [] }
    func readNotificationIds(memberId _: String, environment _: SessionEnvironment) async throws -> Set<String> { [] }
    func markNotificationsRead(
        memberId _: String,
        notificationIds _: [String],
        readAtMillis _: Int64,
        environment _: SessionEnvironment
    ) async throws {}

    func send(event: NotificationEvent, environment _: SessionEnvironment) async throws -> NotificationEvent {
        sends += 1
        return await MainActor.run {
            NotificationEvent(
                id: "sent",
                title: event.title,
                body: event.body,
                type: event.type,
                target: event.target,
                userIds: event.userIds,
                segmentType: event.segmentType,
                targetRole: event.targetRole,
                createdBy: event.createdBy,
                sentAtMillis: event.sentAtMillis,
                weekKey: event.weekKey
            )
        }
    }

    func waitForReadCount(_ count: Int) async {
        guard reads < count else { return }
        await withCheckedContinuation { readWaiters.append((count, $0)) }
    }

    func sendCount() -> Int { sends }
}

struct ControlledSafetyPermissionProvider: PushNotificationPermissionProvider {
    private let state = ControlledSafetyPermissionState()

    func isPushNotificationPermissionActive() async -> Bool {
        await state.value()
    }

    @MainActor func openSettings() {}

    func waitForRequest() async {
        await state.waitForRequest()
    }

    func complete(isActive: Bool) async {
        await state.complete(isActive: isActive)
    }
}

actor ControlledSafetyPermissionState {
    private var didRequest = false
    private var requestWaiter: CheckedContinuation<Void, Never>?
    private var valueContinuation: CheckedContinuation<Bool, Never>?

    func value() async -> Bool {
        didRequest = true
        requestWaiter?.resume()
        requestWaiter = nil
        return await withCheckedContinuation { valueContinuation = $0 }
    }

    func waitForRequest() async {
        guard !didRequest else { return }
        await withCheckedContinuation { requestWaiter = $0 }
    }

    func complete(isActive: Bool) {
        guard let valueContinuation else { return }
        self.valueContinuation = nil
        valueContinuation.resume(returning: isActive)
    }
}

@MainActor
final class MutableSafetyEnvironment {
    var value: SessionEnvironment

    init(_ value: SessionEnvironment) {
        self.value = value
    }
}

@MainActor
func makeSafetyViewModel(
    member: Member = safetyMember(),
    newsRepository: any NewsRepository = InMemoryNewsRepository(items: []),
    notificationRepository: any NotificationRepository = InMemoryNotificationRepository(items: []),
    pushNotificationPermissionProvider: any PushNotificationPermissionProvider =
        FixedPushNotificationPermissionProvider(isActive: true),
    imagePipelineManager: any ImagePipelineManager = NoOpImagePipelineManager(),
    environmentProvider: @escaping @MainActor () -> SessionEnvironment = { .develop },
    environmentRoutingSignal: SessionEnvironmentRoutingSignal? = nil
) -> NewsNotificationsFeatureViewModel {
    let sessionViewModel = SessionViewModel(dependencies: .preview())
    let session = safetySession(member: member, environment: environmentProvider())
    sessionViewModel.mode = .authorized(session)
    let viewModel = NewsNotificationsFeatureViewModel(
        sessionViewModel: sessionViewModel,
        newsRepository: newsRepository,
        notificationRepository: notificationRepository,
        pushNotificationPermissionProvider: pushNotificationPermissionProvider,
        imagePipelineManager: imagePipelineManager,
        nowMillisProvider: { 100 },
        environmentProvider: environmentProvider,
        environmentRoutingSignal: environmentRoutingSignal
    )
    viewModel.currentSession = session
    viewModel.currentMember = member
    viewModel.currentEnvironment = session.environment
    return viewModel
}

func safetySession(member: Member, environment: SessionEnvironment) -> AuthorizedSession {
    AuthorizedSession(
        principal: AuthPrincipal(uid: "auth_\(member.id)", email: member.normalizedEmail),
        authenticatedMember: member,
        member: member,
        members: [member],
        environment: environment
    )
}

func safetyMember(id: String = "member_1", roles: Set<MemberRole> = [.member]) -> Member {
    Member(
        id: id,
        displayName: "Member",
        normalizedEmail: "\(id)@reguerta.test",
        authUid: "auth_\(id)",
        roles: roles,
        isActive: true,
        producerCatalogEnabled: true
    )
}

func safetyNewsArticle(id: String, publishedAtMillis: Int64 = 1) -> NewsArticle {
    NewsArticle(
        id: id,
        title: "Title",
        body: "Body",
        active: true,
        publishedBy: "Publisher",
        publishedAtMillis: publishedAtMillis,
        urlImage: nil
    )
}

func safetyNotification(id: String) -> NotificationEvent {
    NotificationEvent(
        id: id,
        title: "Title",
        body: "Body",
        type: "admin_broadcast",
        target: "all",
        userIds: [],
        segmentType: nil,
        targetRole: nil,
        createdBy: "system",
        sentAtMillis: 1,
        weekKey: nil
    )
}

@MainActor func seedPrivateCommunityState(_ viewModel: NewsNotificationsFeatureViewModel) {
    viewModel.latestNews = [safetyNewsArticle(id: "latest")]
    viewModel.newsFeed = [safetyNewsArticle(id: "news")]
    viewModel.notificationsFeed = [safetyNotification(id: "notification")]
    viewModel.readNotificationIds = ["notification"]
    viewModel.newsDraft = NewsDraft(title: "Private", body: "Draft")
    viewModel.notificationDraft = NotificationDraft(title: "Private", body: "Draft")
    viewModel.editingNewsId = "news"
    viewModel.pendingNewsDeletionId = "news"
}

@MainActor func expectCommunityStateCleared(_ viewModel: NewsNotificationsFeatureViewModel) {
    #expect(viewModel.latestNews.isEmpty)
    #expect(viewModel.newsFeed.isEmpty)
    #expect(viewModel.notificationsFeed.isEmpty)
    #expect(viewModel.readNotificationIds.isEmpty)
    #expect(viewModel.newsDraft == NewsDraft())
    #expect(viewModel.notificationDraft == NotificationDraft())
    #expect(viewModel.editingNewsId == nil)
    #expect(viewModel.pendingNewsDeletionId == nil)
}

@MainActor
func waitForSafetyCondition(
    attempts: Int = 1_000,
    condition: @MainActor () -> Bool
) async {
    for _ in 0..<attempts {
        if condition() { return }
        await Task.yield()
    }
    Issue.record("Condition did not become true")
}
