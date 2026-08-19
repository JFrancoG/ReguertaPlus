import Foundation
import Synchronization
import Testing

@testable import Reguerta

@Suite(.timeLimit(.minutes(1)))
@MainActor
struct UsersEnvironmentFenceTests {
    @Test func signedOutModeRejectsLateRefreshWithoutResurrectingAndReleasesItsProgress() async throws {
        let repository = ControlledUsersMemberRepository()
        let scenario = makeUsersEnvironmentScenario(
            repository: repository,
            upserter: ImmediateUsersMemberUpserter()
        )
        let initialMembers = scenario.viewModel.membersFeed
        let staleMember = usersFenceMember(id: "stale_member", displayName: "Stale Member")
        let staleRefresh = Task { await scenario.viewModel.refreshMembers() }
        defer {
            staleRefresh.cancel()
            repository.cancelAll()
        }
        try await repository.waitUntilReadCount(1)

        scenario.viewModel.sessionViewModel.mode = .signedOut
        repository.completeRead(at: 0, with: [scenario.admin, staleMember])
        await staleRefresh.value

        #expect(scenario.viewModel.sessionViewModel.mode == .signedOut)
        #expect(scenario.viewModel.currentSession?.environment == .develop)
        #expect(scenario.viewModel.membersFeed == initialMembers)
        #expect(scenario.viewModel.activeRefreshOperationId == nil)
        #expect(scenario.viewModel.isLoadingMembers == false)
    }

    @Test func reloginModeRejectsLateMutationWithoutPublishingAndReleasesItsProgress() async throws {
        let upserter = ControlledUsersMemberUpserter()
        let scenario = makeUsersEnvironmentScenario(
            repository: InMemoryMemberRepository(),
            upserter: upserter
        )
        let initialSession = try #require(scenario.viewModel.currentSession)
        let initialMembers = scenario.viewModel.membersFeed
        let staleMutation = Task { await scenario.viewModel.toggleActive(memberId: scenario.target.id) }
        defer {
            staleMutation.cancel()
            upserter.cancelAll()
        }
        try await upserter.waitUntilWriteCount(1)

        let reloggedAdmin = Member(
            id: "relogged_admin",
            displayName: "Relogged Admin",
            normalizedEmail: "relogged-admin@reguerta.test",
            authUid: "auth_relogged_admin",
            roles: [.member, .admin],
            isActive: true,
            producerCatalogEnabled: true
        )
        let reloggedSession = usersFenceSession(
            environment: .develop,
            admin: reloggedAdmin,
            members: [reloggedAdmin]
        )
        scenario.viewModel.sessionViewModel.mode = .authorized(reloggedSession)
        upserter.completeWrite(at: 0)

        #expect(await staleMutation.value == false)
        #expect(scenario.viewModel.sessionViewModel.mode == .authorized(reloggedSession))
        #expect(scenario.viewModel.currentSession == initialSession)
        #expect(scenario.viewModel.membersFeed == initialMembers)
        #expect(scenario.viewModel.activeMutationOperationId == nil)
        #expect(scenario.viewModel.isTogglingMember == false)
        #expect(scenario.viewModel.highlightedMemberId == nil)
    }

    @Test func environmentSwitchRejectsLateRefreshWithoutClearingSuccessorProgress() async throws {
        let repository = ControlledUsersMemberRepository()
        let scenario = makeUsersEnvironmentScenario(
            repository: repository,
            upserter: ImmediateUsersMemberUpserter()
        )
        let staleMember = usersFenceMember(id: "stale_member", displayName: "Stale Member")
        let currentMember = usersFenceMember(id: "current_member", displayName: "Current Member")
        let staleRefresh = Task { await scenario.viewModel.refreshMembers() }
        defer {
            staleRefresh.cancel()
            repository.cancelAll()
        }
        try await repository.waitUntilReadCount(1)

        let previousEpoch = scenario.viewModel.sessionIdentityEpoch
        let productionSession = usersFenceSession(
            environment: .production,
            admin: scenario.admin,
            members: [scenario.admin, scenario.target]
        )
        scenario.viewModel.adoptAuthorizedSession(productionSession, sourceMayContainPrivateMembers: true)
        #expect(scenario.viewModel.sessionIdentityEpoch == previousEpoch + 1)

        let currentRefresh = Task { await scenario.viewModel.refreshMembers() }
        defer { currentRefresh.cancel() }
        try await repository.waitUntilReadCount(2)
        repository.completeRead(at: 0, with: [scenario.admin, staleMember])
        await staleRefresh.value

        #expect(scenario.viewModel.currentSession?.environment == .production)
        #expect(scenario.viewModel.membersFeed.contains(where: { $0.id == staleMember.id }) == false)
        #expect(scenario.viewModel.isLoadingMembers)

        repository.completeRead(at: 1, with: [scenario.admin, currentMember])
        await currentRefresh.value

        #expect(scenario.viewModel.membersFeed.map(\.id) == [scenario.admin.id, currentMember.id])
        #expect(scenario.viewModel.isLoadingMembers == false)
        #expect(repository.recordedEnvironments() == [.develop, .production])
    }

    @Test func environmentSwitchRejectsLateMutationWithoutClearingSuccessorProgress() async throws {
        let upserter = ControlledUsersMemberUpserter()
        let scenario = makeUsersEnvironmentScenario(
            repository: InMemoryMemberRepository(),
            upserter: upserter
        )
        let staleMutation = Task { await scenario.viewModel.toggleActive(memberId: scenario.target.id) }
        defer {
            staleMutation.cancel()
            upserter.cancelAll()
        }
        try await upserter.waitUntilWriteCount(1)

        let previousEpoch = scenario.viewModel.sessionIdentityEpoch
        let productionSession = usersFenceSession(
            environment: .production,
            admin: scenario.admin,
            members: [scenario.admin, scenario.target]
        )
        scenario.viewModel.adoptAuthorizedSession(productionSession, sourceMayContainPrivateMembers: true)
        #expect(scenario.viewModel.sessionIdentityEpoch == previousEpoch + 1)

        let currentMutation = Task { await scenario.viewModel.toggleActive(memberId: scenario.target.id) }
        defer { currentMutation.cancel() }
        try await upserter.waitUntilWriteCount(2)
        upserter.completeWrite(at: 0)

        #expect(await staleMutation.value == false)
        #expect(scenario.viewModel.currentSession?.environment == .production)
        #expect(scenario.viewModel.membersFeed.first(where: { $0.id == scenario.target.id })?.isActive == true)
        #expect(scenario.viewModel.isTogglingMember)

        upserter.completeWrite(at: 1)

        #expect(await currentMutation.value)
        #expect(scenario.viewModel.membersFeed.first(where: { $0.id == scenario.target.id })?.isActive == false)
        #expect(scenario.viewModel.isTogglingMember == false)
        #expect(upserter.recordedEnvironments() == [.develop, .production])
    }
}

private struct UsersEnvironmentScenario {
    let viewModel: UsersFeatureViewModel
    let admin: Member
    let target: Member
}

@MainActor
private func makeUsersEnvironmentScenario(
    repository: any MemberRepository,
    upserter: any MemberAdminUpserting
) -> UsersEnvironmentScenario {
    let admin = Member(
        id: "admin",
        displayName: "Admin",
        normalizedEmail: "admin@reguerta.test",
        authUid: "auth_admin",
        roles: [.member, .admin],
        isActive: true,
        producerCatalogEnabled: true
    )
    let target = usersFenceMember(id: "member_1", displayName: "Member One")
    let session = usersFenceSession(environment: .develop, admin: admin, members: [admin, target])
    let sessionViewModel = SessionViewModel(dependencies: .preview())
    sessionViewModel.mode = .authorized(session)
    let viewModel = UsersFeatureViewModel(
        sessionViewModel: sessionViewModel,
        memberRepository: repository,
        upsertMemberByAdmin: upserter
    )
    viewModel.currentSession = session
    viewModel.currentMember = admin
    viewModel.membersFeed = [admin, target]
    return UsersEnvironmentScenario(viewModel: viewModel, admin: admin, target: target)
}

private func usersFenceSession(environment: SessionEnvironment, admin: Member, members: [Member]) -> AuthorizedSession {
    AuthorizedSession(
        principal: AuthPrincipal(uid: admin.authUid ?? "auth_admin", email: admin.normalizedEmail),
        authenticatedMember: admin,
        member: admin,
        members: members,
        environment: environment
    )
}

private func usersFenceMember(id: String, displayName: String) -> Member {
    Member(
        id: id,
        displayName: displayName,
        normalizedEmail: "\(id)@reguerta.test",
        authUid: nil,
        roles: [.member],
        isActive: true,
        producerCatalogEnabled: true
    )
}

private final class ControlledUsersMemberRepository: MemberRepository, Sendable {
    private struct PendingRead {
        let id: UUID
        let continuation: CheckedContinuation<[Member], any Error>
    }

    private struct CountWaiter {
        let expectedCount: Int
        let continuation: CheckedContinuation<Void, any Error>
    }

    private struct State {
        var reads: [PendingRead?] = []
        var environments: [SessionEnvironment] = []
        var countWaiters: [UUID: CountWaiter] = [:]
    }

    private let state = Mutex(State())

    func member(id _: String, environment _: SessionEnvironment) async -> Member? { nil }

    func members(visibleTo _: Member, environment: SessionEnvironment) async throws -> [Member] {
        try Task.checkCancellation()
        let operationID = UUID()

        return try await withTaskCancellationHandler {
            try await withCheckedThrowingContinuation { continuation in
                let registration = state.withLock { state -> (Bool, [CheckedContinuation<Void, any Error>]) in
                    guard !Task.isCancelled else { return (false, []) }
                    state.environments.append(environment)
                    state.reads.append(PendingRead(id: operationID, continuation: continuation))
                    return (true, Self.takeReadyCountWaiters(from: &state))
                }
                registration.1.forEach { $0.resume() }
                if !registration.0 {
                    continuation.resume(throwing: CancellationError())
                }
            }
        } onCancel: {
            cancelRead(operationID)
        }
    }

    func updateOwnProducerCatalogEnabled(
        member: Member,
        enabled _: Bool,
        environment _: SessionEnvironment
    ) async -> Member {
        member
    }

    func waitUntilReadCount(_ expectedCount: Int) async throws {
        try Task.checkCancellation()
        guard state.withLock({ $0.reads.count < expectedCount }) else { return }
        let waiterID = UUID()

        try await withTaskCancellationHandler {
            try await withCheckedThrowingContinuation { continuation in
                let shouldResume = state.withLock { state in
                    guard state.reads.count < expectedCount, !Task.isCancelled else { return true }
                    state.countWaiters[waiterID] = CountWaiter(
                        expectedCount: expectedCount,
                        continuation: continuation
                    )
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
            cancelCountWaiter(waiterID)
        }
    }

    func completeRead(at index: Int, with members: [Member]) {
        let continuation = state.withLock { state -> CheckedContinuation<[Member], any Error>? in
            guard state.reads.indices.contains(index), let pending = state.reads[index] else { return nil }
            state.reads[index] = nil
            return pending.continuation
        }
        continuation?.resume(returning: members)
    }

    func recordedEnvironments() -> [SessionEnvironment] {
        state.withLock { $0.environments }
    }

    func cancelAll() {
        let continuations = state.withLock { state in
            let operations = state.reads.compactMap { $0?.continuation }
            let waiters = state.countWaiters.values.map(\.continuation)
            state.reads = state.reads.map { _ in nil }
            state.countWaiters.removeAll()
            return (operations, waiters)
        }
        continuations.0.forEach { $0.resume(throwing: CancellationError()) }
        continuations.1.forEach { $0.resume(throwing: CancellationError()) }
    }

    private func cancelRead(_ operationID: UUID) {
        let continuation = state.withLock { state -> CheckedContinuation<[Member], any Error>? in
            guard let index = state.reads.firstIndex(where: { $0?.id == operationID }),
                  let pending = state.reads[index] else {
                return nil
            }
            state.reads[index] = nil
            return pending.continuation
        }
        continuation?.resume(throwing: CancellationError())
    }

    private func cancelCountWaiter(_ waiterID: UUID) {
        let continuation = state.withLock { $0.countWaiters.removeValue(forKey: waiterID)?.continuation }
        continuation?.resume(throwing: CancellationError())
    }

    private static func takeReadyCountWaiters(from state: inout State) -> [CheckedContinuation<Void, any Error>] {
        let readyIDs = state.countWaiters.compactMap { id, waiter in
            state.reads.count >= waiter.expectedCount ? id : nil
        }
        return readyIDs.compactMap { state.countWaiters.removeValue(forKey: $0)?.continuation }
    }
}

private struct ImmediateUsersMemberUpserter: MemberAdminUpserting {
    func execute(target: Member, environment _: SessionEnvironment) async -> Member { target }
}

private final class ControlledUsersMemberUpserter: MemberAdminUpserting, Sendable {
    private struct PendingWrite {
        let id: UUID
        let member: Member
        let continuation: CheckedContinuation<Member, any Error>
    }

    private struct CountWaiter {
        let expectedCount: Int
        let continuation: CheckedContinuation<Void, any Error>
    }

    private struct State {
        var writes: [PendingWrite?] = []
        var environments: [SessionEnvironment] = []
        var countWaiters: [UUID: CountWaiter] = [:]
    }

    private let state = Mutex(State())

    func execute(target: Member, environment: SessionEnvironment) async throws -> Member {
        try Task.checkCancellation()
        let operationID = UUID()

        return try await withTaskCancellationHandler {
            try await withCheckedThrowingContinuation { continuation in
                let registration = state.withLock { state -> (Bool, [CheckedContinuation<Void, any Error>]) in
                    guard !Task.isCancelled else { return (false, []) }
                    state.environments.append(environment)
                    state.writes.append(
                        PendingWrite(id: operationID, member: target, continuation: continuation)
                    )
                    return (true, Self.takeReadyCountWaiters(from: &state))
                }
                registration.1.forEach { $0.resume() }
                if !registration.0 {
                    continuation.resume(throwing: CancellationError())
                }
            }
        } onCancel: {
            cancelWrite(operationID)
        }
    }

    func waitUntilWriteCount(_ expectedCount: Int) async throws {
        try Task.checkCancellation()
        guard state.withLock({ $0.writes.count < expectedCount }) else { return }
        let waiterID = UUID()

        try await withTaskCancellationHandler {
            try await withCheckedThrowingContinuation { continuation in
                let shouldResume = state.withLock { state in
                    guard state.writes.count < expectedCount, !Task.isCancelled else { return true }
                    state.countWaiters[waiterID] = CountWaiter(
                        expectedCount: expectedCount,
                        continuation: continuation
                    )
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
            cancelCountWaiter(waiterID)
        }
    }

    func completeWrite(at index: Int) {
        let pending = state.withLock { state -> PendingWrite? in
            guard state.writes.indices.contains(index), let pending = state.writes[index] else { return nil }
            state.writes[index] = nil
            return pending
        }
        if let pending {
            pending.continuation.resume(returning: pending.member)
        }
    }

    func recordedEnvironments() -> [SessionEnvironment] {
        state.withLock { $0.environments }
    }

    func cancelAll() {
        let continuations = state.withLock { state in
            let operations = state.writes.compactMap { $0?.continuation }
            let waiters = state.countWaiters.values.map(\.continuation)
            state.writes = state.writes.map { _ in nil }
            state.countWaiters.removeAll()
            return (operations, waiters)
        }
        continuations.0.forEach { $0.resume(throwing: CancellationError()) }
        continuations.1.forEach { $0.resume(throwing: CancellationError()) }
    }

    private func cancelWrite(_ operationID: UUID) {
        let continuation = state.withLock { state -> CheckedContinuation<Member, any Error>? in
            guard let index = state.writes.firstIndex(where: { $0?.id == operationID }),
                  let pending = state.writes[index] else {
                return nil
            }
            state.writes[index] = nil
            return pending.continuation
        }
        continuation?.resume(throwing: CancellationError())
    }

    private func cancelCountWaiter(_ waiterID: UUID) {
        let continuation = state.withLock { $0.countWaiters.removeValue(forKey: waiterID)?.continuation }
        continuation?.resume(throwing: CancellationError())
    }

    private static func takeReadyCountWaiters(from state: inout State) -> [CheckedContinuation<Void, any Error>] {
        let readyIDs = state.countWaiters.compactMap { id, waiter in
            state.writes.count >= waiter.expectedCount ? id : nil
        }
        return readyIDs.compactMap { state.countWaiters.removeValue(forKey: $0)?.continuation }
    }
}
