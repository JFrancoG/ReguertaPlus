import Foundation
import Testing

@testable import Reguerta

@Suite(.timeLimit(.minutes(1)))
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
        #expect(await repository.readCount == 0)
        #expect(viewModel.isSaving == false)
    }

    @Test func confirmedSavePreservesNewerDraftRevision() async throws {
        let repository = SuspendedProfileRepository()
        let viewModel = makeViewModel(member: makeMember(), repository: repository)
        viewModel.updateDraft(SharedProfileDraft(familyNames: "Versión enviada", about: "Primera"))

        let saveTask = Task { await viewModel.saveProfile() }
        defer {
            saveTask.cancel()
            repository.cancelAll()
        }
        try await repository.waitUntilWriteStarts()
        let newerDraft = SharedProfileDraft(familyNames: "Versión nueva", about: "Segunda")
        viewModel.updateDraft(newerDraft)
        repository.completeWrite()

        #expect(await saveTask.value == false)
        #expect(viewModel.profiles.first?.familyNames == "Versión enviada")
        #expect(viewModel.draft == newerDraft)
        #expect(viewModel.isSaving == false)
    }

    @Test func confirmedSavePublishesAfterTaskCancellation() async throws {
        let repository = SuspendedProfileRepository()
        let viewModel = makeViewModel(member: makeMember(), repository: repository)
        viewModel.updateDraft(SharedProfileDraft(familyNames: "Familia confirmada", about: "Guardado"))

        let saveTask = Task { await viewModel.saveProfile() }
        defer {
            saveTask.cancel()
            repository.cancelAll()
        }
        try await repository.waitUntilWriteStarts()
        saveTask.cancel()
        repository.completeWrite()

        #expect(await saveTask.value)
        #expect(viewModel.profiles.first?.familyNames == "Familia confirmada")
        #expect(viewModel.isSaving == false)
    }

    @Test func staleSaveFromPreviousLoginPublishesNothing() async throws {
        let member = makeMember()
        let repository = SuspendedProfileRepository()
        let viewModel = makeViewModel(member: member, repository: repository)
        viewModel.updateDraft(SharedProfileDraft(familyNames: "Sesión anterior", about: "Pendiente"))

        let saveTask = Task { await viewModel.saveProfile() }
        defer {
            saveTask.cancel()
            repository.cancelAll()
        }
        try await repository.waitUntilWriteStarts()
        viewModel.handleSessionModeChange(.signedOut)
        let replacement = makeSession(member: member)
        viewModel.handleSessionModeChange(.authorized(replacement))
        repository.completeWrite()

        #expect(await saveTask.value == false)
        #expect(viewModel.profiles.isEmpty)
        #expect(viewModel.draft == SharedProfileDraft())
        #expect(viewModel.feedbackCenter.messageKey == nil)
    }

    @Test func environmentChangeRejectsLateDevelopRefreshWithoutClearingProductionRefresh() async throws {
        let member = makeMember()
        let repository = EnvironmentSuspendedProfileRepository(suspendsReads: true)
        let viewModel = makeViewModel(member: member, repository: repository)
        let developProfile = makeProfile(familyNames: "Develop", about: "Respuesta obsoleta")
        let productionProfile = makeProfile(familyNames: "Production", about: "Respuesta vigente")

        let developRefresh = Task { await viewModel.refreshProfiles() }
        defer {
            developRefresh.cancel()
            repository.cancelAll()
        }
        try await repository.waitUntilReadStarts(environment: .develop)
        transition(viewModel, member: member, to: .production)
        try await repository.waitUntilReadStarts(environment: .production)

        repository.completeRead(environment: .develop, profiles: [developProfile])
        await developRefresh.value

        #expect(viewModel.profiles.isEmpty)
        #expect(viewModel.draft == SharedProfileDraft())
        #expect(viewModel.isLoading)

        repository.completeRead(environment: .production, profiles: [productionProfile])
        try await waitUntilLoadingFinishes(viewModel)

        #expect(viewModel.profiles == [productionProfile])
        #expect(viewModel.draft == productionProfile.toDraft())
    }

    @Test func environmentChangeRejectsLateDevelopSaveWithoutClearingProductionSave() async throws {
        let member = makeMember()
        let repository = EnvironmentSuspendedProfileRepository(suspendsReads: true)
        let viewModel = makeViewModel(member: member, repository: repository)
        viewModel.updateDraft(SharedProfileDraft(familyNames: "Develop", about: "Respuesta obsoleta"))

        let developSave = Task { await viewModel.saveProfile() }
        defer {
            developSave.cancel()
            repository.cancelAll()
        }
        try await repository.waitUntilUpsertStarts(environment: .develop)
        transition(viewModel, member: member, to: .production)
        try await repository.waitUntilReadStarts(environment: .production)
        viewModel.updateDraft(SharedProfileDraft(familyNames: "Production", about: "Respuesta vigente"))
        let productionSave = Task { await viewModel.saveProfile() }
        defer { productionSave.cancel() }
        try await repository.waitUntilUpsertStarts(environment: .production)

        repository.completeUpsert(environment: .develop)
        #expect(await developSave.value == false)
        #expect(viewModel.profiles.isEmpty)
        #expect(viewModel.draft.familyNames == "Production")
        #expect(viewModel.isSaving)

        repository.completeUpsert(environment: .production)
        #expect(await productionSave.value)
        #expect(viewModel.profiles.map(\.familyNames) == ["Production"])
        #expect(viewModel.draft.familyNames == "Production")
        #expect(viewModel.isSaving == false)

        repository.completeRead(environment: .production, profiles: [])
        try await waitUntilLoadingFinishes(viewModel)
    }

    @Test func environmentChangeRejectsLateDevelopDeleteWithoutClearingProductionDelete() async throws {
        let member = makeMember()
        let repository = EnvironmentSuspendedProfileRepository()
        let viewModel = makeViewModel(member: member, repository: repository)
        viewModel.profiles = [makeProfile(familyNames: "Develop", about: "Respuesta obsoleta")]

        let developDelete = Task { await viewModel.deleteProfile() }
        defer {
            developDelete.cancel()
            repository.cancelAll()
        }
        try await repository.waitUntilDeleteStarts(environment: .develop)
        transition(viewModel, member: member, to: .production)
        let productionDelete = Task { await viewModel.deleteProfile() }
        defer { productionDelete.cancel() }
        try await repository.waitUntilDeleteStarts(environment: .production)

        repository.completeDelete(environment: .develop)
        #expect(await developDelete.value == false)
        #expect(viewModel.isDeleting)
        #expect(viewModel.feedbackCenter.messageKey == nil)

        repository.completeDelete(environment: .production)
        #expect(await productionDelete.value)
        #expect(viewModel.isDeleting == false)
        #expect(viewModel.feedbackCenter.messageKey == AccessL10nKey.feedbackSharedProfileDeleted)
    }

    @Test func environmentChangeRejectsLateDevelopUploadWithoutClearingProductionUpload() async throws {
        let member = makeMember()
        let repository = EnvironmentSuspendedProfileRepository(suspendsReads: true)
        let imagePipeline = EnvironmentSuspendedImagePipelineManager()
        let viewModel = makeViewModel(
            member: member,
            repository: repository,
            imagePipelineManager: imagePipeline
        )

        let developUpload = Task { await viewModel.uploadImage(Data([1])) }
        defer {
            developUpload.cancel()
            repository.cancelAll()
            imagePipeline.cancelAll()
        }
        try await imagePipeline.waitUntilUploadStarts(environment: .develop)
        transition(viewModel, member: member, to: .production)
        try await repository.waitUntilReadStarts(environment: .production)
        viewModel.updateDraft(SharedProfileDraft(familyNames: "Production"))
        let productionUpload = Task { await viewModel.uploadImage(Data([2])) }
        defer { productionUpload.cancel() }
        try await imagePipeline.waitUntilUploadStarts(environment: .production)

        imagePipeline.completeUpload(environment: .develop, downloadURL: "https://develop.test/photo.jpg")
        await developUpload.value
        #expect(viewModel.draft.photoUrl != "https://develop.test/photo.jpg")
        #expect(viewModel.isUploadingImage)

        imagePipeline.completeUpload(environment: .production, downloadURL: "https://production.test/photo.jpg")
        await productionUpload.value
        #expect(viewModel.draft.photoUrl == "https://production.test/photo.jpg")
        #expect(viewModel.draft.familyNames == "Production")
        #expect(viewModel.isUploadingImage == false)

        repository.completeRead(environment: .production, profiles: [])
        try await waitUntilLoadingFinishes(viewModel)
    }

    private func waitUntilLoadingFinishes(_ viewModel: SharedProfileFeatureViewModel) async throws {
        try await SharedProfileLoadingWaiter().wait(untilLoadingFinishesIn: viewModel)
    }

    private func makeViewModel(
        member: Member,
        repository: any SharedProfileRepository,
        imagePipelineManager: any ImagePipelineManager = NoOpImagePipelineManager(),
        nowMillis: Int64 = 100
    ) -> SharedProfileFeatureViewModel {
        let sessionViewModel = SessionViewModel(dependencies: .preview())
        let session = makeSession(member: member)
        sessionViewModel.mode = .authorized(session)
        let viewModel = SharedProfileFeatureViewModel(
            sessionViewModel: sessionViewModel,
            sharedProfileRepository: repository,
            imagePipelineManager: imagePipelineManager,
            nowMillisProvider: { nowMillis }
        )
        viewModel.currentSession = session
        viewModel.currentMember = member
        return viewModel
    }

    private func makeSession(member: Member, environment: SessionEnvironment = .develop) -> AuthorizedSession {
        AuthorizedSession(
            principal: AuthPrincipal(uid: "auth_\(member.id)", email: member.normalizedEmail),
            authenticatedMember: member,
            member: member,
            members: [member],
            environment: environment
        )
    }

    private func transition(
        _ viewModel: SharedProfileFeatureViewModel,
        member: Member,
        to environment: SessionEnvironment
    ) {
        let session = makeSession(member: member, environment: environment)
        viewModel.sessionViewModel.mode = .authorized(session)
        viewModel.handleSessionModeChange(.authorized(session))
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
