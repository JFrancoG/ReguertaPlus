import Foundation
import Testing

@testable import Reguerta

@MainActor
struct P101SharedProfileFailureTests {
    @Test func failedRefreshPreservesProfilesAndDraftAndReportsLoadError() async {
        let member = makeMember()
        let existing = makeProfile(familyNames: "Familia existente", about: "Último estado válido")
        let pendingDraft = SharedProfileDraft(familyNames: "Edición pendiente", about: "No debe perderse")
        let repository = ControlledProfileRepository(items: [existing], rejectsReads: true)
        let viewModel = makeViewModel(member: member, repository: repository)
        viewModel.profiles = [existing]
        viewModel.updateDraft(pendingDraft)

        await viewModel.refreshProfiles()

        #expect(viewModel.profiles == [existing])
        #expect(viewModel.draft == pendingDraft)
        #expect(viewModel.isLoading == false)
        #expect(viewModel.feedbackCenter.messageKey == AccessL10nKey.feedbackUnableLoadData)
    }

    @Test func confirmedSaveUpdatesLocalProfileWithoutReadBack() async {
        let member = makeMember()
        let repository = ControlledProfileRepository(items: [], rejectsReads: true)
        let viewModel = makeViewModel(member: member, repository: repository, nowMillis: 123)
        viewModel.updateDraft(SharedProfileDraft(familyNames: "Familia", about: "Perfil confirmado"))

        let saved = await viewModel.saveProfile()

        #expect(saved)
        #expect(viewModel.profiles.map(\.userId) == [member.id])
        #expect(viewModel.profiles.first?.about == "Perfil confirmado")
        #expect(viewModel.draft.about == "Perfil confirmado")
        #expect(repository.readCount == 0)
        #expect(viewModel.isSaving == false)
    }

    @Test func confirmedSavePreservesNewerDraftRevision() async {
        let repository = SuspendedProfileRepository()
        let viewModel = makeViewModel(member: makeMember(), repository: repository)
        viewModel.updateDraft(SharedProfileDraft(familyNames: "Versión enviada", about: "Primera"))

        let saveTask = Task { await viewModel.saveProfile() }
        await repository.waitUntilWriteStarts()
        let newerDraft = SharedProfileDraft(familyNames: "Versión nueva", about: "Segunda")
        viewModel.updateDraft(newerDraft)
        repository.completeWrite()

        #expect(await saveTask.value == false)
        #expect(viewModel.profiles.first?.familyNames == "Versión enviada")
        #expect(viewModel.draft == newerDraft)
        #expect(viewModel.isSaving == false)
    }

    @Test func confirmedSavePublishesAfterTaskCancellation() async {
        let repository = SuspendedProfileRepository()
        let viewModel = makeViewModel(member: makeMember(), repository: repository)
        viewModel.updateDraft(SharedProfileDraft(familyNames: "Familia confirmada", about: "Guardado"))

        let saveTask = Task { await viewModel.saveProfile() }
        await repository.waitUntilWriteStarts()
        saveTask.cancel()
        repository.completeWrite()

        #expect(await saveTask.value)
        #expect(viewModel.profiles.first?.familyNames == "Familia confirmada")
        #expect(viewModel.isSaving == false)
    }

    @Test func staleSaveFromPreviousLoginPublishesNothing() async {
        let member = makeMember()
        let repository = SuspendedProfileRepository()
        let viewModel = makeViewModel(member: member, repository: repository)
        viewModel.updateDraft(SharedProfileDraft(familyNames: "Sesión anterior", about: "Pendiente"))

        let saveTask = Task { await viewModel.saveProfile() }
        await repository.waitUntilWriteStarts()
        viewModel.handleSessionModeChange(.signedOut)
        let replacement = makeSession(member: member)
        viewModel.handleSessionModeChange(.authorized(replacement))
        repository.completeWrite()

        #expect(await saveTask.value == false)
        #expect(viewModel.profiles.isEmpty)
        #expect(viewModel.draft == SharedProfileDraft())
        #expect(viewModel.feedbackCenter.messageKey == nil)
    }

    private func makeViewModel(
        member: Member,
        repository: any SharedProfileRepository,
        nowMillis: Int64 = 100
    ) -> SharedProfileFeatureViewModel {
        let sessionViewModel = SessionViewModel(dependencies: .preview())
        let session = makeSession(member: member)
        sessionViewModel.mode = .authorized(session)
        let viewModel = SharedProfileFeatureViewModel(
            sessionViewModel: sessionViewModel,
            sharedProfileRepository: repository,
            imagePipelineManager: NoOpImagePipelineManager(),
            nowMillisProvider: { nowMillis }
        )
        viewModel.currentSession = session
        viewModel.currentMember = member
        return viewModel
    }

    private func makeSession(member: Member) -> AuthorizedSession {
        AuthorizedSession(
            principal: AuthPrincipal(uid: "auth_\(member.id)", email: member.normalizedEmail),
            authenticatedMember: member,
            member: member,
            members: [member],
            environment: .develop
        )
    }

    private func makeMember() -> Member {
        Member(
            id: "member_1",
            displayName: "Member One",
            normalizedEmail: "member_1@reguerta.test",
            authUid: "auth_member_1",
            roles: [.member],
            isActive: true,
            producerCatalogEnabled: true
        )
    }

    private func makeProfile(familyNames: String, about: String) -> SharedProfile {
        SharedProfile(
            userId: "member_1",
            familyNames: familyNames,
            photoUrl: nil,
            about: about,
            updatedAtMillis: 1
        )
    }
}

@MainActor
private final class ControlledProfileRepository: SharedProfileRepository {
    private var items: [String: SharedProfile]
    private let rejectsReads: Bool
    private(set) var readCount = 0

    init(items: [SharedProfile], rejectsReads: Bool) {
        self.items = Dictionary(uniqueKeysWithValues: items.map { ($0.userId, $0) })
        self.rejectsReads = rejectsReads
    }

    func allSharedProfiles() async throws -> [SharedProfile] {
        readCount += 1
        if rejectsReads { throw ProfileTestError.rejected }
        return items.values.sorted { $0.updatedAtMillis > $1.updatedAtMillis }
    }

    func sharedProfile(userId: String) async throws -> SharedProfile? {
        readCount += 1
        if rejectsReads { throw ProfileTestError.rejected }
        return items[userId]
    }

    func upsert(profile: SharedProfile) async -> SharedProfile {
        items[profile.userId] = profile
        return profile
    }

    func deleteSharedProfile(userId: String) async -> Bool {
        items.removeValue(forKey: userId) != nil
    }
}

@MainActor
private final class SuspendedProfileRepository: SharedProfileRepository {
    private var submittedProfile: SharedProfile?
    private var writeContinuation: CheckedContinuation<SharedProfile, Never>?
    private var writeStartedWaiters: [CheckedContinuation<Void, Never>] = []

    func allSharedProfiles() async -> [SharedProfile] { [] }
    func sharedProfile(userId _: String) async -> SharedProfile? { nil }

    func upsert(profile: SharedProfile) async -> SharedProfile {
        submittedProfile = profile
        return await withCheckedContinuation { continuation in
            writeContinuation = continuation
            writeStartedWaiters.forEach { $0.resume() }
            writeStartedWaiters.removeAll()
        }
    }

    func deleteSharedProfile(userId _: String) async -> Bool { true }

    func waitUntilWriteStarts() async {
        guard writeContinuation == nil else { return }
        await withCheckedContinuation { writeStartedWaiters.append($0) }
    }

    func completeWrite() {
        guard let submittedProfile, let writeContinuation else { return }
        self.writeContinuation = nil
        writeContinuation.resume(returning: submittedProfile)
    }
}

private enum ProfileTestError: Error {
    case rejected
}
