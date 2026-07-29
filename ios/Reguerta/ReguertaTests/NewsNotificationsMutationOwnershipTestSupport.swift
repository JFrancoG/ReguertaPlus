import Testing

@testable import Reguerta

enum ReviewMutationCompletion: CaseIterable, Equatable, Sendable {
    case success
    case failure
}

actor ReviewControlledNewsWriteRepository: NewsRepository {
    private var upsertRequests: [NewsArticle] = []
    private var deleteRequests: [String] = []
    private var newsReads = 0
    private var upsertContinuations: [Int: CheckedContinuation<NewsArticle, any Error>] = [:]
    private var deleteContinuations: [Int: CheckedContinuation<Bool, any Error>] = [:]
    private var upsertWaiters: [(Int, CheckedContinuation<Void, Never>)] = []
    private var deleteWaiters: [(Int, CheckedContinuation<Void, Never>)] = []
    private var readWaiters: [(Int, CheckedContinuation<Void, Never>)] = []

    func news(visibleTo _: Member) async throws -> [NewsArticle] {
        newsReads += 1
        resumeWaiters(&readWaiters, count: newsReads)
        throw CancellationError()
    }

    func allNews() async throws -> [NewsArticle] { [] }

    func upsert(article: NewsArticle) async throws -> NewsArticle {
        let index = upsertRequests.count
        upsertRequests.append(article)
        resumeWaiters(&upsertWaiters, count: upsertRequests.count)
        return try await withCheckedThrowingContinuation {
            upsertContinuations[index] = $0
        }
    }

    func delete(newsId: String) async throws -> Bool {
        let index = deleteRequests.count
        deleteRequests.append(newsId)
        resumeWaiters(&deleteWaiters, count: deleteRequests.count)
        return try await withCheckedThrowingContinuation {
            deleteContinuations[index] = $0
        }
    }

    func waitForUpsertCount(_ count: Int) async {
        guard upsertRequests.count < count else { return }
        await withCheckedContinuation { upsertWaiters.append((count, $0)) }
    }

    func waitForDeleteCount(_ count: Int) async {
        guard deleteRequests.count < count else { return }
        await withCheckedContinuation { deleteWaiters.append((count, $0)) }
    }

    func waitForNewsReadCount(_ count: Int) async {
        guard newsReads < count else { return }
        await withCheckedContinuation { readWaiters.append((count, $0)) }
    }

    func upsertCount() -> Int { upsertRequests.count }
    func deleteCount() -> Int { deleteRequests.count }

    func completeUpsert(
        _ index: Int,
        with result: Result<NewsArticle, RepositoryError>
    ) {
        guard let continuation = upsertContinuations.removeValue(forKey: index) else { return }
        continuation.resume(with: result.mapError { $0 as any Error })
    }

    func completeDelete(
        _ index: Int,
        with result: Result<Bool, RepositoryError>
    ) {
        guard let continuation = deleteContinuations.removeValue(forKey: index) else { return }
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

actor ReviewControlledNotificationWriteRepository: NotificationRepository {
    private var sendRequests: [NotificationEvent] = []
    private var notificationReads = 0
    private var sendContinuations: [Int: CheckedContinuation<NotificationEvent, any Error>] = [:]
    private var sendWaiters: [(Int, CheckedContinuation<Void, Never>)] = []
    private var readWaiters: [(Int, CheckedContinuation<Void, Never>)] = []

    func notifications(visibleTo _: Member) async throws -> [NotificationEvent] {
        notificationReads += 1
        resumeWaiters(&readWaiters, count: notificationReads)
        throw CancellationError()
    }

    func allNotifications() async throws -> [NotificationEvent] { [] }
    func readNotificationIds(memberId _: String) async throws -> Set<String> { [] }
    func markNotificationsRead(memberId _: String, notificationIds _: [String], readAtMillis _: Int64) async throws {}

    func send(event: NotificationEvent) async throws -> NotificationEvent {
        let index = sendRequests.count
        sendRequests.append(event)
        resumeWaiters(&sendWaiters, count: sendRequests.count)
        return try await withCheckedThrowingContinuation {
            sendContinuations[index] = $0
        }
    }

    func waitForSendCount(_ count: Int) async {
        guard sendRequests.count < count else { return }
        await withCheckedContinuation { sendWaiters.append((count, $0)) }
    }

    func waitForNotificationReadCount(_ count: Int) async {
        guard notificationReads < count else { return }
        await withCheckedContinuation { readWaiters.append((count, $0)) }
    }

    func sendCount() -> Int { sendRequests.count }

    func completeSend(
        _ index: Int,
        with result: Result<NotificationEvent, RepositoryError>
    ) {
        guard let continuation = sendContinuations.removeValue(forKey: index) else { return }
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
