import Foundation
import Testing

@testable import Reguerta

@MainActor
struct P101MemberFailureTests {
    @Test
    func confirmedMemberMutationUpdatesSessionWithoutDirectoryReadBack() async {
        let admin = makeAdmin()
        let target = makeMember()
        let repository = RejectingMemberRepository(members: [admin, target])
        let viewModel = makeViewModel(
            currentMember: admin,
            members: [admin, target],
            repository: repository,
            upserter: ImmediateMemberUpserter()
        )

        let saved = await viewModel.toggleActive(memberId: target.id)

        #expect(saved)
        #expect(viewModel.membersFeed.first { $0.id == target.id }?.isActive == false)
        #expect(await repository.readCount == 0)
        #expect(viewModel.isTogglingMember == false)
    }

    @Test
    func staleMemberMutationFromPreviousSessionPublishesNothing() async {
        let oldAdmin = makeAdmin()
        let target = makeMember()
        let upserter = SuspendedMemberUpserter()
        let viewModel = makeViewModel(
            currentMember: oldAdmin,
            members: [oldAdmin, target],
            repository: RejectingMemberRepository(members: [oldAdmin, target]),
            upserter: upserter
        )

        let mutationTask = Task { await viewModel.toggleActive(memberId: target.id) }
        await upserter.waitUntilWriteStarts()
        viewModel.handleSessionModeChange(.signedOut)
        let newAdmin = makeAdmin(id: "new_admin")
        let newSession = makeSession(member: newAdmin, members: [newAdmin])
        viewModel.sessionViewModel.mode = .authorized(newSession)
        viewModel.currentSession = newSession
        viewModel.currentMember = newAdmin
        viewModel.membersFeed = [newAdmin]
        await upserter.completeWrite()

        #expect(await mutationTask.value == false)
        #expect(viewModel.currentMember?.id == newAdmin.id)
        #expect(viewModel.membersFeed.map(\.id) == [newAdmin.id])
        #expect(viewModel.feedbackCenter.messageKey == nil)
    }

    @Test
    func revokedAdminReadCannotPublishFullMembersForSameIdentity() async {
        let admin = makeAdmin()
        let target = makeMember()
        let revokedAdmin = admin.replacingForTest(roles: [.member])
        let repository = FirstReadSuspendedMemberRepository(fallbackMembers: [revokedAdmin])
        let viewModel = makeViewModel(
            currentMember: admin,
            members: [admin, target],
            repository: repository,
            upserter: ImmediateMemberUpserter()
        )

        let staleRefresh = Task { await viewModel.refreshMembers() }
        await repository.waitUntilReadCount(1)
        let revokedSession = makeSession(member: revokedAdmin, members: [revokedAdmin])
        viewModel.sessionViewModel.mode = .authorized(revokedSession)
        viewModel.handleSessionModeChange(.authorized(revokedSession))
        await repository.waitUntilReadCount(2)
        await repository.completeFirstRead(with: [admin, target])
        await staleRefresh.value

        #expect(viewModel.currentMember == revokedAdmin)
        #expect(viewModel.membersFeed == [revokedAdmin])
        #expect(viewModel.canManageMembers == false)
    }

    @Test
    func confirmedMemberMutationPublishesAfterTaskCancellation() async {
        let admin = makeAdmin()
        let target = makeMember()
        let upserter = SuspendedMemberUpserter()
        let viewModel = makeViewModel(
            currentMember: admin,
            members: [admin, target],
            repository: RejectingMemberRepository(members: [admin, target]),
            upserter: upserter
        )

        let mutationTask = Task { await viewModel.toggleActive(memberId: target.id) }
        await upserter.waitUntilWriteStarts()
        mutationTask.cancel()
        await upserter.completeWrite()

        #expect(await mutationTask.value)
        #expect(viewModel.membersFeed.first { $0.id == target.id }?.isActive == false)
        #expect(viewModel.isTogglingMember == false)
    }

    @Test
    func confirmedMemberSavePreservesNewerEditorRevision() async {
        let admin = makeAdmin()
        let target = makeMember()
        let upserter = SuspendedMemberUpserter()
        let viewModel = makeViewModel(
            currentMember: admin,
            members: [admin, target],
            repository: RejectingMemberRepository(members: [admin, target]),
            upserter: upserter
        )
        viewModel.startEditing(memberId: target.id)
        var submittedDraft = viewModel.draft
        submittedDraft.displayName = "Submitted Member"
        viewModel.updateDraft(submittedDraft)

        let saveTask = Task { await viewModel.saveDraft() }
        await upserter.waitUntilWriteStarts()
        var newerDraft = submittedDraft
        newerDraft.displayName = "Newer Pending Edit"
        viewModel.updateDraft(newerDraft)
        await upserter.completeWrite()

        #expect(await saveTask.value)
        #expect(viewModel.membersFeed.first { $0.id == target.id }?.displayName == "Submitted Member")
        #expect(viewModel.draft == newerDraft)
        #expect(viewModel.editingMemberId == target.id)
        #expect(viewModel.isEditorOpen)
    }

    @Test
    func staleMutationCannotClearNewMutationProgress() async {
        let oldAdmin = makeAdmin(id: "old_admin")
        let target = makeMember()
        let upserter = MultiSuspendedMemberUpserter()
        let repository = StaticMemberRepository(members: [oldAdmin, target])
        let viewModel = makeViewModel(
            currentMember: oldAdmin,
            members: [oldAdmin, target],
            repository: repository,
            upserter: upserter
        )

        let staleMutation = Task { await viewModel.toggleActive(memberId: target.id) }
        await upserter.waitUntilWriteCount(1)
        let newAdmin = makeAdmin(id: "new_admin")
        let newSession = makeSession(member: newAdmin, members: [newAdmin, target])
        viewModel.sessionViewModel.mode = .authorized(newSession)
        viewModel.handleSessionModeChange(.authorized(newSession))
        let currentMutation = Task { await viewModel.toggleActive(memberId: target.id) }
        await upserter.waitUntilWriteCount(2)

        await upserter.completeWrite(at: 0)
        #expect(await staleMutation.value == false)
        #expect(viewModel.isTogglingMember)

        await upserter.completeWrite(at: 1)
        #expect(await currentMutation.value)
        #expect(viewModel.isTogglingMember == false)
    }

    @Test
    func selfRevocationImmediatelyRemovesPrivateMemberData() async {
        let admin = makeAdmin()
        let target = makeMember()
        let viewModel = makeViewModel(
            currentMember: admin,
            members: [admin, target],
            repository: RejectingMemberRepository(members: [admin, target]),
            upserter: ImmediateMemberUpserter()
        )

        let saved = await viewModel.toggleAdmin(memberId: admin.id)

        #expect(saved)
        #expect(viewModel.canManageMembers == false)
        #expect(!viewModel.membersFeed.contains {
            $0.id == target.id && (!$0.normalizedEmail.isEmpty || $0.authUid != nil)
        })
    }

    @Test
    func selfDeactivationImmediatelyRemovesPrivateMemberData() async {
        let admin = makeAdmin()
        let otherAdmin = makeAdmin(id: "other_admin")
        let target = makeMember()
        let viewModel = makeViewModel(
            currentMember: admin,
            members: [admin, otherAdmin, target],
            repository: RejectingMemberRepository(members: [admin, otherAdmin, target]),
            upserter: ImmediateMemberUpserter()
        )

        let saved = await viewModel.toggleActive(memberId: admin.id)

        #expect(saved)
        #expect(viewModel.currentMember?.isActive == false)
        #expect(viewModel.canManageMembers == false)
        #expect(!viewModel.membersFeed.contains {
            $0.id == target.id && (!$0.normalizedEmail.isEmpty || $0.authUid != nil)
        })
    }

    @Test
    func refreshContainingSelfRevocationImmediatelyRemovesPrivateMemberData() async {
        let admin = makeAdmin()
        let target = makeMember()
        let revokedAdmin = admin.replacingForTest(roles: [.member])
        let repository = FirstReadSuspendedMemberRepository(fallbackMembers: [revokedAdmin])
        let viewModel = makeViewModel(
            currentMember: admin,
            members: [admin, target],
            repository: repository,
            upserter: ImmediateMemberUpserter()
        )

        let refreshTask = Task { await viewModel.refreshMembers() }
        await repository.waitUntilReadCount(1)
        await repository.completeFirstRead(with: [revokedAdmin, target])
        await refreshTask.value

        #expect(viewModel.currentMember == revokedAdmin)
        #expect(viewModel.canManageMembers == false)
        #expect(!viewModel.membersFeed.contains {
            $0.id == target.id && !$0.normalizedEmail.isEmpty
        })
        #expect(viewModel.isLoadingMembers == false)
    }

    @Test
    func staleConfirmationCannotClearNewSessionSelection() async {
        let oldAdmin = makeAdmin(id: "old_admin")
        let oldTarget = makeMember(id: "old_target")
        let upserter = MultiSuspendedMemberUpserter()
        let viewModel = makeViewModel(
            currentMember: oldAdmin,
            members: [oldAdmin, oldTarget],
            repository: StaticMemberRepository(members: [oldAdmin, oldTarget]),
            upserter: upserter
        )
        viewModel.requestToggleActive(memberId: oldTarget.id)

        let staleConfirmation = Task { await viewModel.confirmToggleActive() }
        await upserter.waitUntilWriteCount(1)
        let newAdmin = makeAdmin(id: "new_admin")
        let newTarget = makeMember(id: "new_target")
        let newSession = makeSession(member: newAdmin, members: [newAdmin, newTarget])
        viewModel.sessionViewModel.mode = .authorized(newSession)
        viewModel.handleSessionModeChange(.authorized(newSession))
        viewModel.requestToggleActive(memberId: newTarget.id)
        await upserter.completeWrite(at: 0)

        #expect(await staleConfirmation.value == false)
        #expect(viewModel.pendingToggleActiveMemberId == newTarget.id)
    }

    private func makeViewModel(
        currentMember: Member,
        members: [Member],
        repository: any MemberRepository,
        upserter: any MemberAdminUpserting
    ) -> UsersFeatureViewModel {
        let sessionViewModel = SessionViewModel(dependencies: .preview())
        let session = makeSession(member: currentMember, members: members)
        sessionViewModel.mode = .authorized(session)
        let viewModel = UsersFeatureViewModel(
            sessionViewModel: sessionViewModel,
            memberRepository: repository,
            upsertMemberByAdmin: upserter
        )
        viewModel.currentSession = session
        viewModel.currentMember = currentMember
        viewModel.membersFeed = members
        return viewModel
    }

    private func makeSession(member: Member, members: [Member]) -> AuthorizedSession {
        AuthorizedSession(
            principal: AuthPrincipal(uid: member.authUid ?? "auth_\(member.id)", email: member.normalizedEmail),
            authenticatedMember: member,
            member: member,
            members: members
        )
    }

    private func makeAdmin(id: String = "admin") -> Member {
        Member(
            id: id,
            displayName: "Admin",
            normalizedEmail: "\(id)@reguerta.test",
            authUid: "auth_\(id)",
            roles: [.member, .admin],
            isActive: true,
            producerCatalogEnabled: true
        )
    }

    private func makeMember(id: String = "member_1") -> Member {
        Member(
            id: id,
            displayName: "Member",
            normalizedEmail: "\(id)@reguerta.test",
            authUid: nil,
            roles: [.member],
            isActive: true,
            producerCatalogEnabled: true
        )
    }
}

private actor RejectingMemberRepository: MemberRepository {
    private let storedMembers: [Member]
    private(set) var readCount = 0

    init(members: [Member]) {
        storedMembers = members
    }

    func member(id: String) async -> Member? {
        storedMembers.first { $0.id == id }
    }

    func members(visibleTo _: Member) async throws -> [Member] {
        readCount += 1
        throw MemberTestError.rejected
    }

    func updateOwnProducerCatalogEnabled(member: Member, enabled: Bool) async -> Member {
        member.copy(producerCatalogEnabled: enabled)
    }
}

private actor StaticMemberRepository: MemberRepository {
    private let storedMembers: [Member]

    init(members: [Member]) {
        storedMembers = members
    }

    func member(id: String) async -> Member? {
        storedMembers.first { $0.id == id }
    }

    func members(visibleTo _: Member) async throws -> [Member] {
        storedMembers
    }

    func updateOwnProducerCatalogEnabled(member: Member, enabled: Bool) async -> Member {
        member.copy(producerCatalogEnabled: enabled)
    }
}

private actor FirstReadSuspendedMemberRepository: MemberRepository {
    private let fallbackMembers: [Member]
    private var readCount = 0
    private var firstReadContinuation: CheckedContinuation<[Member], Never>?
    private var readCountWaiters: [(Int, CheckedContinuation<Void, Never>)] = []

    init(fallbackMembers: [Member]) {
        self.fallbackMembers = fallbackMembers
    }

    func member(id: String) async -> Member? {
        fallbackMembers.first { $0.id == id }
    }

    func members(visibleTo _: Member) async throws -> [Member] {
        readCount += 1
        resumeReadCountWaiters()
        guard readCount == 1 else { return fallbackMembers }
        return await withCheckedContinuation { firstReadContinuation = $0 }
    }

    func updateOwnProducerCatalogEnabled(member: Member, enabled: Bool) async -> Member {
        member.copy(producerCatalogEnabled: enabled)
    }

    func waitUntilReadCount(_ expectedCount: Int) async {
        guard readCount < expectedCount else { return }
        await withCheckedContinuation { readCountWaiters.append((expectedCount, $0)) }
    }

    func completeFirstRead(with members: [Member]) {
        guard let firstReadContinuation else { return }
        self.firstReadContinuation = nil
        firstReadContinuation.resume(returning: members)
    }

    private func resumeReadCountWaiters() {
        let ready = readCountWaiters.filter { readCount >= $0.0 }
        readCountWaiters.removeAll { readCount >= $0.0 }
        ready.forEach { $0.1.resume() }
    }
}

private struct ImmediateMemberUpserter: MemberAdminUpserting {
    func execute(target: Member) async -> Member { target }
}

private actor SuspendedMemberUpserter: MemberAdminUpserting {
    private var submittedMember: Member?
    private var writeContinuation: CheckedContinuation<Member, Never>?
    private var writeStartedWaiters: [CheckedContinuation<Void, Never>] = []

    func execute(target: Member) async -> Member {
        submittedMember = target
        return await withCheckedContinuation { continuation in
            writeContinuation = continuation
            writeStartedWaiters.forEach { $0.resume() }
            writeStartedWaiters.removeAll()
        }
    }

    func waitUntilWriteStarts() async {
        guard writeContinuation == nil else { return }
        await withCheckedContinuation { writeStartedWaiters.append($0) }
    }

    func completeWrite() {
        guard let submittedMember, let writeContinuation else { return }
        self.writeContinuation = nil
        writeContinuation.resume(returning: submittedMember)
    }
}

private actor MultiSuspendedMemberUpserter: MemberAdminUpserting {
    private struct PendingWrite {
        let submittedMember: Member
        let continuation: CheckedContinuation<Member, Never>
    }

    private var writes: [PendingWrite?] = []
    private var writeCountWaiters: [(Int, CheckedContinuation<Void, Never>)] = []

    func execute(target: Member) async -> Member {
        await withCheckedContinuation { continuation in
            writes.append(PendingWrite(submittedMember: target, continuation: continuation))
            resumeWriteCountWaiters()
        }
    }

    func waitUntilWriteCount(_ expectedCount: Int) async {
        guard writes.count < expectedCount else { return }
        await withCheckedContinuation { writeCountWaiters.append((expectedCount, $0)) }
    }

    func completeWrite(at index: Int) {
        guard writes.indices.contains(index), let pending = writes[index] else { return }
        writes[index] = nil
        pending.continuation.resume(returning: pending.submittedMember)
    }

    private func resumeWriteCountWaiters() {
        let ready = writeCountWaiters.filter { writes.count >= $0.0 }
        writeCountWaiters.removeAll { writes.count >= $0.0 }
        ready.forEach { $0.1.resume() }
    }
}

private extension Member {
    func replacingForTest(roles: Set<MemberRole>) -> Member {
        Member(
            id: id,
            displayName: displayName,
            companyName: companyName,
            phoneNumber: phoneNumber,
            normalizedEmail: normalizedEmail,
            authUid: authUid,
            roles: roles,
            isActive: isActive,
            producerCatalogEnabled: producerCatalogEnabled,
            isCommonPurchaseManager: isCommonPurchaseManager,
            producerParity: producerParity,
            ecoCommitmentMode: ecoCommitmentMode,
            ecoCommitmentParity: ecoCommitmentParity
        )
    }
}

private enum MemberTestError: Error {
    case rejected
}
