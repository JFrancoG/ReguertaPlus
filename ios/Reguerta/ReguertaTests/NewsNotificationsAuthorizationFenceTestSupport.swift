import Foundation
import Synchronization

@testable import Reguerta

final class NewsNotificationsAuthorizationNewsRepository: NewsRepository, Sendable {
    private let readOperation = SessionRevisionOperation()
    private let articles: [NewsArticle]

    init(articles: [NewsArticle] = []) {
        self.articles = articles
    }

    func news(visibleTo _: Member, environment _: SessionEnvironment) async throws -> [NewsArticle] {
        try await readOperation.suspend()
        return articles
    }

    func allNews(environment _: SessionEnvironment) async throws -> [NewsArticle] { articles }

    func upsert(article: NewsArticle, environment _: SessionEnvironment) async throws -> NewsArticle { article }
    func delete(newsId _: String, environment _: SessionEnvironment) async throws -> Bool { true }

    func waitUntilReadStarts() async throws { try await readOperation.waitUntilStarted() }
    func completeRead() { readOperation.complete() }
    func cancelAll() { readOperation.cancelAll() }
}

final class AuthorizationFenceNotificationRepository: NotificationRepository, Sendable {
    private let sendOperation = SessionRevisionOperation()

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
    ) async throws {}

    func send(event: NotificationEvent, environment _: SessionEnvironment) async throws -> NotificationEvent {
        try await sendOperation.suspend()
        return event
    }

    func waitUntilSendStarts() async throws { try await sendOperation.waitUntilStarted() }
    func completeSend() { sendOperation.complete() }
    func cancelAll() { sendOperation.cancelAll() }
}

final class NewsNotificationsAuthorizationImagePipeline: ImagePipelineManager, Sendable {
    private let uploadOperations = [SessionRevisionOperation(), SessionRevisionOperation()]
    private let nextOperationIndex = Mutex(0)

    func processAndUpload(imageData _: Data, request _: ImageUploadRequest) async throws -> ImageUploadResult {
        let index = nextOperationIndex.withLock { index in
            defer { index += 1 }
            return index
        }
        guard uploadOperations.indices.contains(index) else {
            throw CancellationError()
        }
        try await uploadOperations[index].suspend()
        return ImageUploadResult(
            downloadURL: index == 0
                ? "https://stale.test/news.jpg"
                : "https://current.test/news.jpg",
            widthPx: 1,
            heightPx: 1,
            byteSize: 1,
            mimeType: "image/jpeg"
        )
    }

    func waitUntilUploadStarts(_ index: Int = 0) async throws {
        try await uploadOperations[index].waitUntilStarted()
    }

    func completeUpload(_ index: Int = 0) { uploadOperations[index].complete() }
    func cancelAll() { uploadOperations.forEach { $0.cancelAll() } }
}

actor EntryGuardNewsRepository: NewsRepository {
    private var calls = 0

    func news(visibleTo _: Member, environment _: SessionEnvironment) async -> [NewsArticle] {
        calls += 1
        return []
    }

    func allNews(environment _: SessionEnvironment) async -> [NewsArticle] {
        calls += 1
        return []
    }

    func upsert(article: NewsArticle, environment _: SessionEnvironment) async -> NewsArticle {
        calls += 1
        return article
    }

    func delete(newsId _: String, environment _: SessionEnvironment) async -> Bool {
        calls += 1
        return true
    }

    func invocationCount() -> Int { calls }
}

actor EntryGuardNotificationRepository: NotificationRepository {
    private var calls = 0

    func notifications(visibleTo _: Member, environment _: SessionEnvironment) async -> [NotificationEvent] {
        calls += 1
        return []
    }

    func allNotifications(environment _: SessionEnvironment) async -> [NotificationEvent] {
        calls += 1
        return []
    }

    func readNotificationIds(memberId _: String, environment _: SessionEnvironment) async -> Set<String> {
        calls += 1
        return []
    }

    func markNotificationsRead(
        memberId _: String,
        notificationIds _: [String],
        readAtMillis _: Int64,
        environment _: SessionEnvironment
    ) async {
        calls += 1
    }

    func send(event: NotificationEvent, environment _: SessionEnvironment) async -> NotificationEvent {
        calls += 1
        return event
    }

    func invocationCount() -> Int { calls }
}

actor EntryGuardNewsImagePipeline: ImagePipelineManager {
    private var calls = 0

    func processAndUpload(imageData _: Data, request _: ImageUploadRequest) async -> ImageUploadResult {
        calls += 1
        return ImageUploadResult(
            downloadURL: "https://unexpected.test/news.jpg",
            widthPx: 1,
            heightPx: 1,
            byteSize: 1,
            mimeType: "image/jpeg"
        )
    }

    func invocationCount() -> Int { calls }
}

@MainActor
func makeNewsNotificationsAuthorizationViewModel(
    authenticatedMember: Member,
    currentMember: Member,
    newsRepository: any NewsRepository = InMemoryNewsRepository(items: []),
    notificationRepository: any NotificationRepository = InMemoryNotificationRepository(items: []),
    imagePipelineManager: any ImagePipelineManager = NoOpImagePipelineManager()
) -> NewsNotificationsFeatureViewModel {
    let sessionViewModel = SessionViewModel(dependencies: .preview())
    let session = newsNotificationsAuthorizationSession(
        authenticatedMember: authenticatedMember,
        currentMember: currentMember
    )
    sessionViewModel.mode = .authorized(session)
    let viewModel = NewsNotificationsFeatureViewModel(
        sessionViewModel: sessionViewModel,
        newsRepository: newsRepository,
        notificationRepository: notificationRepository,
        imagePipelineManager: imagePipelineManager,
        nowMillisProvider: { 100 }
    )
    viewModel.currentSession = session
    viewModel.currentMember = currentMember
    viewModel.currentEnvironment = session.environment
    return viewModel
}

func newsNotificationsAuthorizationSession(authenticatedMember: Member, currentMember: Member) -> AuthorizedSession {
    AuthorizedSession(
        principal: AuthPrincipal(
            uid: authenticatedMember.authUid ?? "auth_\(authenticatedMember.id)",
            email: authenticatedMember.normalizedEmail
        ),
        authenticatedMember: authenticatedMember,
        member: currentMember,
        members: authenticatedMember.id == currentMember.id
            ? [currentMember]
            : [authenticatedMember, currentMember],
        environment: .develop
    )
}

func replacingNewsNotificationsAuthorizationMember(
    _ member: Member,
    authUID: String? = nil,
    roles: Set<MemberRole>? = nil,
    isActive: Bool? = nil
) -> Member {
    Member(
        id: member.id,
        displayName: member.displayName,
        companyName: member.companyName,
        phoneNumber: member.phoneNumber,
        normalizedEmail: member.normalizedEmail,
        authUid: authUID ?? member.authUid,
        roles: roles ?? member.roles,
        isActive: isActive ?? member.isActive,
        producerCatalogEnabled: member.producerCatalogEnabled,
        isCommonPurchaseManager: member.isCommonPurchaseManager,
        producerParity: member.producerParity,
        ecoCommitmentMode: member.ecoCommitmentMode,
        ecoCommitmentParity: member.ecoCommitmentParity
    )
}
