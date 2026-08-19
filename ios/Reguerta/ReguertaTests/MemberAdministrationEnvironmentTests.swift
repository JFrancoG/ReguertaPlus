import Foundation
import Synchronization
import Testing

@testable import Reguerta

@Suite(.timeLimit(.minutes(1)))
@MainActor
struct MemberAdministrationEnvironmentTests {
    @Test func queuedMemberMutationKeepsTheAuthorizedSessionEnvironmentAfterRuntimeTransition() async throws {
        let scenario = makeMemberAdministrationScenario()
        let mailboxBlocker = Task { await scenario.upserter.blockMailbox() }
        defer {
            scenario.upserter.releaseMailbox()
            mailboxBlocker.cancel()
        }
        try await scenario.upserter.waitUntilMailboxIsBlocked()

        let mutation = Task { await scenario.viewModel.toggleActive(memberId: scenario.member.id) }
        defer { mutation.cancel() }
        try await scenario.upserter.waitUntilMutationIsSubmitted()
        scenario.environmentRouter.applyResolvedEnvironment(.production, lease: SessionEnvironmentLease())
        scenario.upserter.releaseMailbox()

        await mailboxBlocker.value
        #expect(await mutation.value)
        #expect(scenario.environmentStore.snapshot().environment == .production)
        #expect(await scenario.upserter.recordedEnvironment() == .develop)
    }
}

private struct MemberAdministrationScenario {
    let environmentStore: RuntimeSessionEnvironmentStore
    let environmentRouter: RuntimeSessionEnvironmentRouter
    let upserter: MailboxBlockedMemberAdminUpserter
    let viewModel: UsersFeatureViewModel
    let member: Member
}

@MainActor
private func makeMemberAdministrationScenario() -> MemberAdministrationScenario {
    let environmentStore = RuntimeSessionEnvironmentStore(baseEnvironment: .develop)
    let environmentRouter = RuntimeSessionEnvironmentRouter(environmentStore: environmentStore)
    let upserter = MailboxBlockedMemberAdminUpserter()
    let admin = memberAdministrationMember(id: "admin", roles: [.member, .admin], authUid: "auth_admin")
    let member = memberAdministrationMember(id: "member_1", roles: [.member], authUid: nil)
    let session = AuthorizedSession(
        principal: AuthPrincipal(uid: "auth_admin", email: admin.normalizedEmail),
        authenticatedMember: admin,
        member: admin,
        members: [admin, member],
        environment: environmentStore.snapshot().environment
    )
    let sessionViewModel = SessionViewModel(dependencies: .preview())
    sessionViewModel.mode = .authorized(session)
    let viewModel = UsersFeatureViewModel(
        sessionViewModel: sessionViewModel,
        memberRepository: InMemoryMemberRepository(items: [admin, member]),
        upsertMemberByAdmin: upserter
    )
    viewModel.currentSession = session
    viewModel.currentMember = admin
    viewModel.membersFeed = [admin, member]
    return MemberAdministrationScenario(
        environmentStore: environmentStore,
        environmentRouter: environmentRouter,
        upserter: upserter,
        viewModel: viewModel,
        member: member
    )
}

private func memberAdministrationMember(id: String, roles: Set<MemberRole>, authUid: String?) -> Member {
    Member(
        id: id,
        displayName: id == "admin" ? "Admin" : "Member One",
        normalizedEmail: id == "admin" ? "admin@reguerta.test" : "member@reguerta.test",
        authUid: authUid,
        roles: roles,
        isActive: true,
        producerCatalogEnabled: true
    )
}

private actor MailboxBlockedMemberAdminUpserter: MemberAdminUpserting {
    private let mailboxGate = MemberAdminMailboxGate()
    private let mutationSubmission = MemberMutationSubmissionSignal()
    private var environment: SessionEnvironment?

    func blockMailbox() {
        mailboxGate.block()
    }

    nonisolated func waitUntilMailboxIsBlocked() async throws {
        try await mailboxGate.waitUntilBlocked()
    }

    nonisolated func releaseMailbox() {
        mailboxGate.release()
    }

    nonisolated func waitUntilMutationIsSubmitted() async throws {
        try await mutationSubmission.waitUntilSubmitted()
    }

    nonisolated func execute(target: Member, environment: SessionEnvironment) async -> Member {
        mutationSubmission.markSubmitted()
        return await record(target: target, environment: environment)
    }

    private func record(target: Member, environment: SessionEnvironment) -> Member {
        self.environment = environment
        return target
    }

    func recordedEnvironment() -> SessionEnvironment? { environment }
}

private final class MemberMutationSubmissionSignal: Sendable {
    private struct State {
        var isSubmitted = false
        var waiters: [UUID: CheckedContinuation<Void, any Error>] = [:]
    }

    private let state = Mutex(State())

    func markSubmitted() {
        let waiters = state.withLock { state in
            state.isSubmitted = true
            let waiters = Array(state.waiters.values)
            state.waiters.removeAll()
            return waiters
        }
        waiters.forEach { $0.resume() }
    }

    func waitUntilSubmitted() async throws {
        try Task.checkCancellation()
        guard !state.withLock({ $0.isSubmitted }) else { return }
        let waiterID = UUID()

        try await withTaskCancellationHandler {
            try await withCheckedThrowingContinuation { continuation in
                let shouldResume = state.withLock { state in
                    guard !state.isSubmitted, !Task.isCancelled else { return true }
                    state.waiters[waiterID] = continuation
                    return false
                }
                if shouldResume {
                    if Task.isCancelled {
                        continuation.resume(throwing: CancellationError())
                    } else {
                        continuation.resume()
                    }
                }
            }
        } onCancel: {
            let continuation = state.withLock { $0.waiters.removeValue(forKey: waiterID) }
            continuation?.resume(throwing: CancellationError())
        }
    }
}

private final class MemberAdminMailboxGate: Sendable {
    private struct State {
        var isBlocked = false
        var isReleased = false
        var blockedWaiters: [UUID: CheckedContinuation<Void, any Error>] = [:]
    }

    private let state = Mutex(State())
    private let releaseCondition = NSCondition()

    func block() {
        let waiters = state.withLock { state in
            state.isBlocked = true
            let waiters = Array(state.blockedWaiters.values)
            state.blockedWaiters.removeAll()
            return waiters
        }
        waiters.forEach { $0.resume() }

        releaseCondition.lock()
        while !state.withLock({ $0.isReleased }) {
            releaseCondition.wait()
        }
        releaseCondition.unlock()
    }

    func waitUntilBlocked() async throws {
        try Task.checkCancellation()
        guard !state.withLock({ $0.isBlocked }) else { return }
        let waiterID = UUID()

        try await withTaskCancellationHandler {
            try await withCheckedThrowingContinuation { continuation in
                let shouldResume = state.withLock { state in
                    guard !state.isBlocked, !Task.isCancelled else { return true }
                    state.blockedWaiters[waiterID] = continuation
                    return false
                }
                if shouldResume {
                    if Task.isCancelled {
                        continuation.resume(throwing: CancellationError())
                    } else {
                        continuation.resume()
                    }
                }
            }
        } onCancel: {
            let continuation = state.withLock { $0.blockedWaiters.removeValue(forKey: waiterID) }
            continuation?.resume(throwing: CancellationError())
        }
    }

    func release() {
        releaseCondition.lock()
        state.withLock { $0.isReleased = true }
        releaseCondition.broadcast()
        releaseCondition.unlock()
    }
}
