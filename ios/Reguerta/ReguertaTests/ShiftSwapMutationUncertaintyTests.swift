import Testing

@testable import Reguerta

@Suite(.timeLimit(.minutes(1)))
@MainActor
struct ShiftSwapMutationUncertaintyTests {
    @Test(arguments: ControlledShiftSwapMutationKind.allCases)
    func ambiguousOutcomeBlocksOnlyItsOwnUncertaintyKey(_ kind: ControlledShiftSwapMutationKind) async throws {
        let repository = ControlledShiftSwapMutationRepository(operationCount: 2)
        let fixture = makeControlledShiftSwapMutationFixture(repository: repository)
        let uncertainSuffix = "_uncertain_key"
        seedControlledPublicMutationState(kind, fixture: fixture, suffix: uncertainSuffix)
        let uncertainIntent = controlledShiftSwapIntent(kind, member: fixture.member, suffix: uncertainSuffix)
        let firstTask = try #require(
            startControlledPublicMutation(kind, fixture: fixture, suffix: uncertainSuffix)
        )
        try await repository.waitUntilTransitionStarts(0)

        await repository.completeTransition(0, with: .failure(.unavailable))
        #expect(await firstTask.value == false)
        #expect(fixture.viewModel.uncertainShiftSwapMutationIntents[uncertainIntent.uncertaintyKey] != nil)
        #expect(canSubmitControlledPublicMutation(kind, viewModel: fixture.viewModel, suffix: uncertainSuffix) == false)
        seedControlledPublicMutationState(kind, fixture: fixture, suffix: uncertainSuffix)
        #expect(startControlledPublicMutation(kind, fixture: fixture, suffix: uncertainSuffix) == nil)

        let independentSuffix = "_independent_key"
        let independentIntent = controlledShiftSwapIntent(kind, member: fixture.member, suffix: independentSuffix)
        seedControlledPublicMutationState(kind, fixture: fixture, suffix: independentSuffix)
        #expect(canSubmitControlledPublicMutation(kind, viewModel: fixture.viewModel, suffix: independentSuffix))
        let secondTask = try #require(
            startControlledPublicMutation(kind, fixture: fixture, suffix: independentSuffix)
        )
        try await repository.waitUntilTransitionStarts(1)
        await repository.completeTransition(
            1,
            with: .failure(.conflict(code: "definitive_independent_rejection"))
        )

        #expect(await secondTask.value == false)
        #expect(fixture.viewModel.uncertainShiftSwapMutationIntents[uncertainIntent.uncertaintyKey] != nil)
        #expect(fixture.viewModel.uncertainShiftSwapMutationIntents[independentIntent.uncertaintyKey] == nil)
        #expect(repository.records().map(\.kind) == [kind, kind])
        expectControlledShiftSwapOwnerIsReleased(fixture.viewModel)
    }
}
