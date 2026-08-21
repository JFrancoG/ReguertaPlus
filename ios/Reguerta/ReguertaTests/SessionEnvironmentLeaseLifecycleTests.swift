import Testing

@testable import Reguerta

@MainActor
struct SessionEnvironmentLeaseLifecycleTests {
    @Test("La sesión autorizada retiene el lease y logout lo libera de forma condicional")
    func authorizedSessionRetainsLeaseUntilConditionalSignOutReset() async throws {
        let member = leaseLifecycleMember()
        let repository = LeaseLifecycleMemberRepository(member: member)
        let router = LeaseRecordingSessionEnvironmentRouter(baseEnvironment: .develop)
        let viewModel = makeLeaseLifecycleViewModel(
            member: member,
            repository: repository,
            router: router
        )

        await viewModel.applyAuthorizedSession(principal: leaseLifecyclePrincipal(for: member))

        let appliedLease = try #require(router.appliedLeases.only)
        #expect(viewModel.authorizedEnvironmentLease == appliedLease)
        #expect(router.activeLease == appliedLease)
        #expect(router.currentEnvironment == .production)
        guard case .authorized(let session) = viewModel.mode else {
            Issue.record("La hidratación completa debería autorizar la sesión")
            return
        }
        #expect(session.environment == .production)

        viewModel.signOut()
        if let cleanup = viewModel.sessionOperationTask {
            await cleanup.value
        }

        #expect(viewModel.mode == .signedOut)
        #expect(viewModel.authorizedEnvironmentLease == nil)
        #expect(router.conditionalResetLeases == [appliedLease])
        #expect(router.failSafeResetCount == 0)
        #expect(router.activeLease == nil)
        #expect(router.currentEnvironment == .develop)
    }

    @Test("El cleanup obsoleto no borra el lease de una sesión sucesora")
    func staleSignOutCleanupDoesNotResetSuccessorLease() async throws {
        let member = leaseLifecycleMember()
        let repository = LeaseLifecycleMemberRepository(member: member)
        let router = LeaseRecordingSessionEnvironmentRouter(baseEnvironment: .develop)
        let staleViewModel = makeLeaseLifecycleViewModel(
            member: member,
            repository: repository,
            router: router
        )
        let successorViewModel = makeLeaseLifecycleViewModel(
            member: member,
            repository: repository,
            router: router
        )

        await staleViewModel.applyAuthorizedSession(principal: leaseLifecyclePrincipal(for: member))
        let staleLease = try #require(staleViewModel.authorizedEnvironmentLease)
        await successorViewModel.applyAuthorizedSession(principal: leaseLifecyclePrincipal(for: member))
        let successorLease = try #require(successorViewModel.authorizedEnvironmentLease)

        staleViewModel.signOut()
        if let cleanup = staleViewModel.sessionOperationTask {
            await cleanup.value
        }

        #expect(staleLease != successorLease)
        #expect(router.appliedLeases == [staleLease, successorLease])
        #expect(router.conditionalResetLeases == [staleLease])
        #expect(router.failSafeResetCount == 0)
        #expect(router.activeLease == successorLease)
        #expect(router.currentEnvironment == .production)
        #expect(staleViewModel.authorizedEnvironmentLease == nil)
        #expect(staleViewModel.mode == .signedOut)
        #expect(successorViewModel.authorizedEnvironmentLease == successorLease)
        #expect(successorViewModel.mode.isAuthenticatedSession)
    }

    @Test("Un fallo al cargar miembros no publica el entorno candidato")
    func memberListFailureDoesNotPublishCandidateEnvironment() async {
        let member = leaseLifecycleMember()
        let repository = LeaseLifecycleMemberRepository(member: member, memberListFails: true)
        let router = LeaseRecordingSessionEnvironmentRouter(baseEnvironment: .develop)
        let viewModel = makeLeaseLifecycleViewModel(
            member: member,
            repository: repository,
            router: router
        )

        await viewModel.applyAuthorizedSession(principal: leaseLifecyclePrincipal(for: member))

        #expect(await repository.memberReadEnvironments() == [.production])
        #expect(await repository.memberListEnvironments() == [.production])
        #expect(router.appliedLeases.isEmpty)
        #expect(router.conditionalResetLeases.isEmpty)
        #expect(router.failSafeResetCount == 0)
        #expect(router.activeLease == nil)
        #expect(router.currentEnvironment == .develop)
        #expect(viewModel.authorizedEnvironmentLease == nil)
        #expect(viewModel.mode == .signedOut)
        #expect(viewModel.feedbackCenter.messageKey == AccessL10nKey.authErrorSessionData)
    }
}

@MainActor
private func makeLeaseLifecycleViewModel(
    member: Member,
    repository: LeaseLifecycleMemberRepository,
    router: LeaseRecordingSessionEnvironmentRouter
) -> SessionViewModel {
    SessionViewModel(
        repository: repository,
        authSessionProvider: TestAuthSessionProvider(),
        resolveAuthorizedSession: ResolveAuthorizedSessionUseCase(
            repository: repository,
            resolver: LeaseLifecycleAuthorizedMemberResolver(member: member, environment: .production)
        ),
        environmentRouter: router
    )
}

@MainActor
private func leaseLifecycleMember() -> Member {
    Member(
        id: "lease_member",
        displayName: "Lease Member",
        normalizedEmail: "lease-member@example.com",
        authUid: "lease_auth_uid",
        roles: [.member],
        isActive: true,
        producerCatalogEnabled: true
    )
}

private func leaseLifecyclePrincipal(for member: Member) -> AuthPrincipal {
    AuthPrincipal(uid: member.authUid ?? "", email: member.normalizedEmail)
}

private struct LeaseLifecycleAuthorizedMemberResolver: AuthorizedMemberResolving {
    let member: Member
    let environment: SessionEnvironment

    func resolve(
        authPrincipal _: AuthPrincipal,
        requestedEnvironment _: SessionEnvironment
    ) async throws -> AuthorizedMemberResolution {
        AuthorizedMemberResolution(
            memberId: member.id,
            roles: member.roles,
            isActive: member.isActive,
            environment: environment,
            firstLoginLinked: false
        )
    }
}

private actor LeaseLifecycleMemberRepository: MemberRepository {
    let memberValue: Member
    let memberListFails: Bool
    private var recordedMemberReadEnvironments: [SessionEnvironment] = []
    private var recordedMemberListEnvironments: [SessionEnvironment] = []

    init(member: Member, memberListFails: Bool = false) {
        memberValue = member
        self.memberListFails = memberListFails
    }

    func member(id: String, environment: SessionEnvironment) async throws -> Member? {
        recordedMemberReadEnvironments.append(environment)
        return id == memberValue.id ? memberValue : nil
    }

    func members(visibleTo _: Member, environment: SessionEnvironment) async throws -> [Member] {
        recordedMemberListEnvironments.append(environment)
        if memberListFails {
            throw LeaseLifecycleTestError.memberListFailed
        }
        return [memberValue]
    }

    func updateOwnProducerCatalogEnabled(
        member _: Member,
        enabled _: Bool,
        environment _: SessionEnvironment
    ) async throws -> Member {
        memberValue
    }

    func memberReadEnvironments() -> [SessionEnvironment] {
        recordedMemberReadEnvironments
    }

    func memberListEnvironments() -> [SessionEnvironment] {
        recordedMemberListEnvironments
    }
}

private enum LeaseLifecycleTestError: Error {
    case memberListFailed
}

@MainActor
private final class LeaseRecordingSessionEnvironmentRouter: SessionEnvironmentRouting {
    let baseEnvironment: SessionEnvironment
    let environmentStore: RuntimeSessionEnvironmentStore
    private(set) var appliedLeases: [SessionEnvironmentLease] = []
    private(set) var conditionalResetLeases: [SessionEnvironmentLease] = []
    private(set) var failSafeResetCount = 0
    private(set) var activeLease: SessionEnvironmentLease?

    var currentEnvironment: SessionEnvironment { environmentStore.snapshot().environment }
    var environmentSnapshotProvider: any SessionEnvironmentSnapshotProviding { environmentStore }
    var transitionSignal: SessionEnvironmentRoutingSignal { environmentStore.transitionSignal }

    init(baseEnvironment: SessionEnvironment) {
        self.baseEnvironment = baseEnvironment
        self.environmentStore = RuntimeSessionEnvironmentStore(baseEnvironment: baseEnvironment)
    }

    func applyResolvedEnvironment(_ environment: SessionEnvironment, lease: SessionEnvironmentLease) {
        appliedLeases.append(lease)
        activeLease = lease
        let snapshot = environmentStore.apply(environment, lease: lease)
        transitionSignal.publish(environment: snapshot.environment)
    }

    func resetToBaseEnvironment(ifOwnedBy lease: SessionEnvironmentLease) {
        conditionalResetLeases.append(lease)
        guard let snapshot = environmentStore.reset(ifOwnedBy: lease) else { return }
        activeLease = nil
        transitionSignal.publish(environment: snapshot.environment)
    }

    func resetToBaseEnvironment() {
        failSafeResetCount += 1
        activeLease = nil
        let snapshot = environmentStore.reset()
        transitionSignal.publish(environment: snapshot.environment)
    }
}

private extension Array {
    var only: Element? {
        count == 1 ? first : nil
    }
}
