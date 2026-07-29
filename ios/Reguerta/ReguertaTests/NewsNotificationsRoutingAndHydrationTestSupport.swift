import Testing

@testable import Reguerta

actor ReviewHydrationNewsRepository: NewsRepository {
    private var requests = 0
    private var continuations: [Int: CheckedContinuation<[NewsArticle], Never>] = [:]
    private var requestWaiters: [(Int, CheckedContinuation<Void, Never>)] = []
    private var returnedReads: Set<Int> = []
    private var returnWaiters: [(Int, CheckedContinuation<Void, Never>)] = []

    func news(visibleTo _: Member) async throws -> [NewsArticle] {
        let index = requests
        requests += 1
        resumeRequestWaiters()
        let articles = await withCheckedContinuation { continuations[index] = $0 }
        returnedReads.insert(index)
        let satisfied = returnWaiters.filter { returnedReads.contains($0.0) }
        returnWaiters.removeAll { returnedReads.contains($0.0) }
        satisfied.forEach { $0.1.resume() }
        return articles
    }

    func allNews() async throws -> [NewsArticle] { [] }
    func upsert(article: NewsArticle) async throws -> NewsArticle { article }
    func delete(newsId _: String) async throws -> Bool { true }

    func waitForRequestCount(_ count: Int) async {
        guard requests < count else { return }
        await withCheckedContinuation { requestWaiters.append((count, $0)) }
    }

    func waitForReturnedRead(_ index: Int) async {
        guard !returnedReads.contains(index) else { return }
        await withCheckedContinuation { returnWaiters.append((index, $0)) }
    }

    func complete(_ index: Int, with articles: [NewsArticle]) {
        guard let continuation = continuations.removeValue(forKey: index) else { return }
        continuation.resume(returning: articles)
    }

    private func resumeRequestWaiters() {
        let satisfied = requestWaiters.filter { $0.0 <= requests }
        requestWaiters.removeAll { $0.0 <= requests }
        satisfied.forEach { $0.1.resume() }
    }
}
