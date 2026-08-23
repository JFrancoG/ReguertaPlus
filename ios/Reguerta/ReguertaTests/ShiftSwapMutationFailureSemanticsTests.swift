import Testing

@testable import Reguerta

enum ControlledDefinitiveShiftSwapFailure: CaseIterable {
    case noCandidates
    case permissionDenied
    case conflict

    var error: ShiftSwapCommandError {
        switch self {
        case .noCandidates:
            .noCandidates
        case .permissionDenied:
            .permissionDenied
        case .conflict:
            .conflict(code: "definitive_matrix_rejection")
        }
    }

    var messageKey: String {
        switch self {
        case .noCandidates:
            AccessL10nKey.feedbackShiftSwapNoCandidates
        case .permissionDenied:
            AccessL10nKey.feedbackShiftSwapPermissionDenied
        case .conflict:
            AccessL10nKey.feedbackShiftSwapConflict
        }
    }

    var suffix: String {
        switch self {
        case .noCandidates:
            "no_candidates"
        case .permissionDenied:
            "permission_denied"
        case .conflict:
            "conflict"
        }
    }
}

enum ControlledAmbiguousShiftSwapFailure: CaseIterable {
    case unavailable
    case invalidData
    case unknown

    var error: ShiftSwapCommandError {
        switch self {
        case .unavailable:
            .unavailable
        case .invalidData:
            .invalidData
        case .unknown:
            .unknown
        }
    }

    var messageKey: String {
        switch self {
        case .unavailable:
            AccessL10nKey.feedbackShiftSwapUnavailable
        case .invalidData:
            AccessL10nKey.feedbackShiftSwapInvalidData
        case .unknown:
            AccessL10nKey.feedbackUnableSaveChanges
        }
    }

    var suffix: String {
        switch self {
        case .unavailable:
            "unavailable"
        case .invalidData:
            "invalid_data"
        case .unknown:
            "unknown"
        }
    }
}

@Suite(.timeLimit(.minutes(1)))
@MainActor
struct ShiftSwapMutationDefinitiveFailureTests {
    @Test(
        arguments: ControlledShiftSwapMutationKind.allCases,
        ControlledDefinitiveShiftSwapFailure.allCases
    )
    func definitiveFailureReleasesItsExactKeyForRetry(
        _ kind: ControlledShiftSwapMutationKind,
        _ failure: ControlledDefinitiveShiftSwapFailure
    ) async throws {
        let repository = ControlledShiftSwapMutationRepository(operationCount: 2)
        let fixture = makeControlledShiftSwapMutationFixture(repository: repository)
        let suffix = "_definitive_\(failure.suffix)"
        let intent = controlledShiftSwapIntent(kind, member: fixture.member, suffix: suffix)
        seedControlledPublicMutationState(kind, fixture: fixture, suffix: suffix)
        let firstTask = try #require(startControlledPublicMutation(kind, fixture: fixture, suffix: suffix))
        try await repository.waitUntilTransitionStarts(0)

        await repository.completeTransition(0, with: .failure(failure.error))
        #expect(await firstTask.value == false)
        #expect(fixture.viewModel.uncertainShiftSwapMutationIntents[intent.uncertaintyKey] == nil)
        #expect(fixture.viewModel.feedbackCenter.messageKey == failure.messageKey)
        expectControlledShiftSwapOwnerIsReleased(fixture.viewModel)

        fixture.viewModel.feedbackCenter.clear()
        seedControlledPublicMutationState(kind, fixture: fixture, suffix: suffix)
        let retryTask = try #require(startControlledPublicMutation(kind, fixture: fixture, suffix: suffix))
        try await repository.waitUntilTransitionStarts(1)
        await repository.completeTransition(
            1,
            with: .success(controlledShiftSwapResult(kind, suffix: suffix))
        )

        #expect(await retryTask.value)
        #expect(repository.records().map(\.kind) == [kind, kind])
        #expect(
            fixture.viewModel.shiftSwapAcknowledgements[controlledShiftSwapRequestId(suffix)] ==
                expectedControlledShiftSwapAcknowledgement(kind, member: fixture.member, suffix: suffix)
        )
        expectControlledShiftSwapOwnerIsReleased(fixture.viewModel)
    }
}

@Suite(.timeLimit(.minutes(1)))
@MainActor
struct ShiftSwapMutationAmbiguousFailureTests {
    @Test(
        arguments: ControlledShiftSwapMutationKind.allCases,
        ControlledAmbiguousShiftSwapFailure.allCases
    )
    func ambiguousFailureQuarantinesItsExactKey(
        _ kind: ControlledShiftSwapMutationKind,
        _ failure: ControlledAmbiguousShiftSwapFailure
    ) async throws {
        let repository = ControlledShiftSwapMutationRepository()
        let fixture = makeControlledShiftSwapMutationFixture(repository: repository)
        let suffix = "_ambiguous_\(failure.suffix)"
        let intent = controlledShiftSwapIntent(kind, member: fixture.member, suffix: suffix)
        seedControlledPublicMutationState(kind, fixture: fixture, suffix: suffix)
        let mutationTask = try #require(startControlledPublicMutation(kind, fixture: fixture, suffix: suffix))
        try await repository.waitUntilTransitionStarts()

        await repository.completeTransition(with: .failure(failure.error))

        #expect(await mutationTask.value == false)
        #expect(fixture.viewModel.uncertainShiftSwapMutationIntents[intent.uncertaintyKey] != nil)
        #expect(fixture.viewModel.feedbackCenter.messageKey == failure.messageKey)
        expectControlledShiftSwapOwnerIsReleased(fixture.viewModel)
        seedControlledPublicMutationState(kind, fixture: fixture, suffix: suffix)
        #expect(startControlledPublicMutation(kind, fixture: fixture, suffix: suffix) == nil)
        #expect(repository.records().map(\.kind) == [kind])
    }
}
