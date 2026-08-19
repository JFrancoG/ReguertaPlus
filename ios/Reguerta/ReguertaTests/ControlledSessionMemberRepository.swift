import Testing

@testable import Reguerta

actor ControlledSessionMemberRepository: MemberRepository {
    let memberValue: Member
    private var memberContinuations: [CheckedContinuation<Member?, any Error>?] = []
    private var memberRequestWaiters: [Int: (count: Int, continuation: CheckedContinuation<Bool, Never>)] = [:]
    private var nextMemberRequestWaiterID = 0
    private(set) var memberRequestCount = 0

    init(member: Member) {
        memberValue = member
    }

    func member(id _: String, environment _: SessionEnvironment) async throws -> Member? {
        memberRequestCount += 1
        resumeSatisfiedMemberRequestWaiters()
        return try await withCheckedThrowingContinuation { continuation in
            memberContinuations.append(continuation)
        }
    }

    func members(visibleTo _: Member, environment _: SessionEnvironment) async throws -> [Member] {
        [memberValue]
    }

    func updateOwnProducerCatalogEnabled(
        member _: Member,
        enabled _: Bool,
        environment _: SessionEnvironment
    ) async throws -> Member {
        memberValue
    }

    func waitForMemberRequestCount(_ expectedCount: Int) async -> Bool {
        if memberRequestCount >= expectedCount {
            return true
        }

        let waiterID = nextMemberRequestWaiterID
        nextMemberRequestWaiterID += 1
        return await withTaskCancellationHandler {
            await withCheckedContinuation { continuation in
                guard !Task.isCancelled else {
                    continuation.resume(returning: false)
                    return
                }
                memberRequestWaiters[waiterID] = (expectedCount, continuation)
            }
        } onCancel: {
            Task {
                await self.cancelMemberRequestWaiter(id: waiterID)
            }
        }
    }

    func completeMemberRead(at index: Int, with member: Member?) {
        guard memberContinuations.indices.contains(index),
              let continuation = memberContinuations[index] else {
            Issue.record("No existe la lectura de miembro \(index)")
            return
        }
        memberContinuations[index] = nil
        continuation.resume(returning: member)
    }

    private func resumeSatisfiedMemberRequestWaiters() {
        let satisfiedIDs = memberRequestWaiters.compactMap { id, waiter in
            memberRequestCount >= waiter.count ? id : nil
        }
        for id in satisfiedIDs {
            memberRequestWaiters.removeValue(forKey: id)?.continuation.resume(returning: true)
        }
    }

    private func cancelMemberRequestWaiter(id: Int) {
        memberRequestWaiters.removeValue(forKey: id)?.continuation.resume(returning: false)
    }
}
