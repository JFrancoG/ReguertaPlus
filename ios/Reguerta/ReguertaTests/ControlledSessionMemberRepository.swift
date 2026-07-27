import Testing

@testable import Reguerta

@MainActor
final class ControlledSessionMemberRepository: MemberRepository {
    let memberValue: Member
    private var memberContinuations: [CheckedContinuation<Member?, any Error>?] = []
    private(set) var memberRequestCount = 0

    init(member: Member) {
        memberValue = member
    }

    func member(id _: String) async throws -> Member? {
        memberRequestCount += 1
        return try await withCheckedThrowingContinuation { continuation in
            memberContinuations.append(continuation)
        }
    }

    func members(visibleTo _: Member) async throws -> [Member] {
        [memberValue]
    }

    func updateOwnProducerCatalogEnabled(member _: Member, enabled _: Bool) async throws -> Member {
        memberValue
    }

    func waitForMemberRequestCount(_ expectedCount: Int) async -> Bool {
        for _ in 0 ..< 1_000 {
            if memberRequestCount >= expectedCount {
                return true
            }
            await Task.yield()
        }
        Issue.record("No se iniciaron \(expectedCount) lecturas de miembro")
        return false
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
}
