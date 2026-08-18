import Foundation
import Testing

@testable import Reguerta

enum ReviewStaleNotificationOutcome: Sendable {
    case success
    case failure
}

enum ReviewNewsMutation: Equatable, Sendable {
    case save
    case delete
}

enum ReviewEditorTransition: CaseIterable, Sendable {
    case create
    case edit
    case clear
}

actor ReviewControlledNotificationRepository: NotificationRepository {
    private let completesFirstRefreshOnSend: Bool
    private var notificationRequests = 0
    private var readIDRequests = 0
    private var markRequests = 0
    private var notificationContinuations: [Int: CheckedContinuation<[NotificationEvent], any Error>] = [:]
    private var readIDContinuations: [Int: CheckedContinuation<Set<String>, any Error>] = [:]
    private var markContinuations: [Int: CheckedContinuation<Void, any Error>] = [:]
    private var notificationWaiters: [(Int, CheckedContinuation<Void, Never>)] = []
    private var readIDWaiters: [(Int, CheckedContinuation<Void, Never>)] = []
    private var markWaiters: [(Int, CheckedContinuation<Void, Never>)] = []

    init(completesFirstRefreshOnSend: Bool = false) {
        self.completesFirstRefreshOnSend = completesFirstRefreshOnSend
    }

    func notifications(visibleTo _: Member) async throws -> [NotificationEvent] {
        let index = notificationRequests
        notificationRequests += 1
        resumeWaiters(&notificationWaiters, count: notificationRequests)
        return try await withCheckedThrowingContinuation {
            notificationContinuations[index] = $0
        }
    }

    func allNotifications() async throws -> [NotificationEvent] { [] }

    func readNotificationIds(memberId _: String) async throws -> Set<String> {
        let index = readIDRequests
        readIDRequests += 1
        resumeWaiters(&readIDWaiters, count: readIDRequests)
        return try await withCheckedThrowingContinuation {
            readIDContinuations[index] = $0
        }
    }

    func markNotificationsRead(memberId _: String, notificationIds _: [String], readAtMillis _: Int64) async throws {
        let index = markRequests
        markRequests += 1
        resumeWaiters(&markWaiters, count: markRequests)
        try await withCheckedThrowingContinuation {
            markContinuations[index] = $0
        }
    }

    func send(event: NotificationEvent) async throws -> NotificationEvent {
        if completesFirstRefreshOnSend {
            resumeNotification(0, with: .success([]))
            resumeReadIDs(0, with: .success([]))
        }
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

    func waitForNotificationCount(_ count: Int) async {
        guard notificationRequests < count else { return }
        await withCheckedContinuation { notificationWaiters.append((count, $0)) }
    }

    func waitForReadIDCount(_ count: Int) async {
        guard readIDRequests < count else { return }
        await withCheckedContinuation { readIDWaiters.append((count, $0)) }
    }

    func waitForMarkCount(_ count: Int) async {
        guard markRequests < count else { return }
        await withCheckedContinuation { markWaiters.append((count, $0)) }
    }

    func notificationRequestCount() -> Int { notificationRequests }
    func readIDRequestCount() -> Int { readIDRequests }

    func completeNotification(
        _ index: Int,
        with result: Result<[NotificationEvent], RepositoryError>
    ) {
        resumeNotification(index, with: result)
    }

    func cancelNotification(_ index: Int) {
        guard let continuation = notificationContinuations.removeValue(forKey: index) else {
            return
        }
        continuation.resume(throwing: CancellationError())
    }

    func completeReadIDs(
        _ index: Int,
        with result: Result<Set<String>, RepositoryError>
    ) {
        resumeReadIDs(index, with: result)
    }

    func completeMark(_ index: Int, with result: Result<Void, RepositoryError>) {
        guard let continuation = markContinuations.removeValue(forKey: index) else {
            return
        }
        continuation.resume(with: result.mapError { $0 as any Error })
    }

    private func resumeNotification(
        _ index: Int,
        with result: Result<[NotificationEvent], RepositoryError>
    ) {
        guard let continuation = notificationContinuations.removeValue(forKey: index) else {
            return
        }
        continuation.resume(with: result.mapError { $0 as any Error })
    }

    private func resumeReadIDs(
        _ index: Int,
        with result: Result<Set<String>, RepositoryError>
    ) {
        guard let continuation = readIDContinuations.removeValue(forKey: index) else {
            return
        }
        continuation.resume(with: result.mapError { $0 as any Error })
    }

    private func resumeWaiters(
        _ waiters: inout [(Int, CheckedContinuation<Void, Never>)],
        count: Int
    ) {
        let satisfied = waiters.filter { $0.0 <= count }
        waiters.removeAll { $0.0 <= count }
        satisfied.forEach { $0.1.resume() }
    }
}

actor ReviewNewsMutationRepository: NewsRepository {
    private let mutation: ReviewNewsMutation
    private let staleArticle: NewsArticle?
    private var readRequests = 0
    private var readContinuations: [Int: CheckedContinuation<[NewsArticle], any Error>] = [:]
    private var readWaiters: [(Int, CheckedContinuation<Void, Never>)] = []

    init(mutation: ReviewNewsMutation, staleArticle: NewsArticle? = nil) {
        self.mutation = mutation
        self.staleArticle = staleArticle
    }

    func news(visibleTo _: Member) async throws -> [NewsArticle] {
        let index = readRequests
        readRequests += 1
        let satisfied = readWaiters.filter { $0.0 <= readRequests }
        readWaiters.removeAll { $0.0 <= readRequests }
        satisfied.forEach { $0.1.resume() }
        return try await withCheckedThrowingContinuation { readContinuations[index] = $0 }
    }

    func allNews() async throws -> [NewsArticle] { [] }

    func upsert(article: NewsArticle) async throws -> NewsArticle {
        let saved = await MainActor.run {
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
        if mutation == .save {
            resumeRead(0, with: [])
        }
        return saved
    }

    func delete(newsId _: String) async throws -> Bool {
        if mutation == .delete {
            resumeRead(0, with: staleArticle.map { [$0] } ?? [])
        }
        return true
    }

    func waitForReadCount(_ count: Int) async {
        guard readRequests < count else { return }
        await withCheckedContinuation { readWaiters.append((count, $0)) }
    }

    func completeRead(_ index: Int, with articles: [NewsArticle]) {
        resumeRead(index, with: articles)
    }

    private func resumeRead(_ index: Int, with articles: [NewsArticle]) {
        guard let continuation = readContinuations.removeValue(forKey: index) else {
            return
        }
        continuation.resume(returning: articles)
    }
}

actor ReviewControlledImagePipelineManager: ImagePipelineManager {
    private var requests = 0
    private var continuations: [Int: CheckedContinuation<ImageUploadResult, any Error>] = [:]
    private var waiters: [(Int, CheckedContinuation<Void, Never>)] = []

    func processAndUpload(imageData _: Data, request _: ImageUploadRequest) async throws -> ImageUploadResult {
        let index = requests
        requests += 1
        let satisfied = waiters.filter { $0.0 <= requests }
        waiters.removeAll { $0.0 <= requests }
        satisfied.forEach { $0.1.resume() }
        return try await withCheckedThrowingContinuation { continuations[index] = $0 }
    }

    func waitForRequestCount(_ count: Int) async {
        guard requests < count else { return }
        await withCheckedContinuation { waiters.append((count, $0)) }
    }

    func requestCount() -> Int { requests }

    func complete(_ index: Int, downloadURL: String) {
        guard let continuation = continuations.removeValue(forKey: index) else { return }
        continuation.resume(
            returning: ImageUploadResult(
                downloadURL: downloadURL,
                widthPx: 1,
                heightPx: 1,
                byteSize: 1,
                mimeType: "image/jpeg"
            )
        )
    }

    func fail(_ index: Int) {
        guard let continuation = continuations.removeValue(forKey: index) else { return }
        continuation.resume(throwing: ImagePipelineError.uploadFailed)
    }
}

@MainActor func reviewNotification(id: String, targetRole: MemberRole? = nil) -> NotificationEvent {
    NotificationEvent(
        id: id,
        title: "Title",
        body: "Body",
        type: "admin_broadcast",
        target: targetRole == nil ? "all" : "segment",
        userIds: [],
        segmentType: targetRole == nil ? nil : "role",
        targetRole: targetRole,
        createdBy: "admin_1",
        sentAtMillis: 1,
        weekKey: nil
    )
}
