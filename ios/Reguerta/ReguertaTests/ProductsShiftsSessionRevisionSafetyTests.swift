import Foundation
import Synchronization
import Testing

@testable import Reguerta

@Suite(.timeLimit(.minutes(1)))
@MainActor
struct ProductsShiftsSessionRevisionSafetyTests {
    @Test func liveCatalogRevocationFencesASuspendedProductSaveWithoutRouteHandler() async throws {
        let producer = producer(id: "producer_even", parity: .even)
        let repository = SessionRevisionProductRepository()
        let viewModel = await makeProductsViewModel(
            currentMember: producer,
            members: [producer],
            productRepository: repository
        )
        viewModel.startCreating()
        viewModel.updateDraft { draft in
            draft.name = "Tomates"
            draft.price = "3"
            draft.unitName = "unidad"
            draft.unitPlural = "unidades"
        }
        let submittedDraft = viewModel.draft
        let save = Task { await viewModel.save() }
        defer {
            save.cancel()
            repository.cancelAll()
        }
        try await repository.waitUntilSaveStarts()

        let capturedRevision = viewModel.sessionViewModel.sessionStateRevision
        let revokedProducer = replacingRoles(in: producer, with: [.member])
        viewModel.sessionViewModel.applyUpdatedAuthorizedMember(revokedProducer, members: [revokedProducer])
        #expect(viewModel.sessionViewModel.sessionStateRevision != capturedRevision)

        repository.completeSave()
        #expect(await save.value == false)
        #expect(viewModel.isSaving == false)
        #expect(viewModel.activeSaveOperationId == nil)
        #expect(viewModel.catalogProducts.isEmpty)
        #expect(viewModel.draft == submittedDraft)
        #expect(viewModel.feedbackCenter.messageKey == nil)
    }

    @Test func liveAdminRevocationFencesASuspendedPlanningRequestWithoutRouteHandler() async throws {
        let admin = adminMember(id: "admin_1", displayName: "Admin")
        let repository = SessionRevisionPlanningRepository()
        let viewModel = makeShiftsViewModel(
            currentMember: admin,
            members: [admin],
            shiftPlanningRequestRepository: repository,
            nowMillisProvider: { 123 }
        )
        viewModel.shiftPlanningDeliverySeasonInput = "2026"
        viewModel.shiftPlanningMarketSeasonInput = "2027"
        viewModel.requestShiftPlanningPreview()
        let requestID = viewModel.pendingShiftPlanningRequest?.id
        let submission = Task { await viewModel.confirmShiftPlanningRequest() }
        defer {
            submission.cancel()
            repository.cancelAll()
        }
        try await repository.waitUntilSubmissionStarts()

        let capturedRevision = viewModel.sessionViewModel.sessionStateRevision
        let revokedAdmin = replacingRoles(in: admin, with: [.member])
        viewModel.sessionViewModel.applyUpdatedAuthorizedMember(revokedAdmin, members: [revokedAdmin])
        #expect(viewModel.sessionViewModel.sessionStateRevision != capturedRevision)

        repository.completeSubmission()
        await submission.value
        #expect(viewModel.isSubmittingShiftPlanningRequest == false)
        #expect(viewModel.activePlanningSubmissionOperationId == nil)
        #expect(viewModel.pendingShiftPlanningRequest?.marketTargetSeasonStartYear == 2027)
        #expect(viewModel.pendingShiftPlanningRequest?.id == requestID)
        #expect(viewModel.feedbackCenter.messageKey == nil)
    }

    @Test func benignSessionRevisionStillReleasesTheOwningProductSave() async throws {
        let producer = producer(id: "producer_save_cleanup", parity: .even)
        let repository = SessionRevisionProductRepository()
        let viewModel = await makeProductsViewModel(
            currentMember: producer,
            members: [producer],
            productRepository: repository
        )
        viewModel.startCreating()
        viewModel.updateDraft { draft in
            draft.name = "Tomates"
            draft.price = "3"
            draft.unitName = "unidad"
            draft.unitPlural = "unidades"
        }
        let save = Task { await viewModel.save() }
        defer {
            save.cancel()
            repository.cancelAll()
        }
        try await repository.waitUntilSaveStarts()

        let refreshedProducer = replacingDisplayName(in: producer, with: "Productor actualizado")
        viewModel.sessionViewModel.applyUpdatedAuthorizedMember(refreshedProducer, members: [refreshedProducer])
        repository.completeSave()

        #expect(await save.value == false)
        #expect(viewModel.isSaving == false)
        #expect(viewModel.activeSaveOperationId == nil)
        #expect(viewModel.catalogProducts.isEmpty)
    }

    @Test func benignSessionRevisionStillReleasesTheOwningPlanningSubmission() async throws {
        let admin = adminMember(id: "admin_cleanup", displayName: "Admin")
        let repository = SessionRevisionPlanningRepository()
        let viewModel = makeShiftsViewModel(
            currentMember: admin,
            members: [admin],
            shiftPlanningRequestRepository: repository,
            nowMillisProvider: { 123 }
        )
        viewModel.shiftPlanningDeliverySeasonInput = "2026"
        viewModel.shiftPlanningMarketSeasonInput = "2027"
        viewModel.requestShiftPlanningPreview()
        let submission = Task { await viewModel.confirmShiftPlanningRequest() }
        defer {
            submission.cancel()
            repository.cancelAll()
        }
        try await repository.waitUntilSubmissionStarts()

        let refreshedAdmin = replacingDisplayName(in: admin, with: "Admin actualizado")
        viewModel.sessionViewModel.applyUpdatedAuthorizedMember(refreshedAdmin, members: [refreshedAdmin])
        repository.completeSubmission()
        await submission.value

        #expect(viewModel.isSubmittingShiftPlanningRequest == false)
        #expect(viewModel.activePlanningSubmissionOperationId == nil)
        #expect(viewModel.pendingShiftPlanningRequest?.marketTargetSeasonStartYear == 2027)
    }

}
