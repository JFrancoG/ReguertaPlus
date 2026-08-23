import Testing

@testable import Reguerta

@MainActor
struct InMemoryShiftSwapAuthorizationTests {
    @Test(arguments: [
        ShiftSwapCommand.create(requestedShiftId: "requested_shift", reason: "reason"),
        ShiftSwapCommand.respond(
            requestId: "swap_1",
            candidateShiftId: "candidate_shift",
            response: .available
        ),
        ShiftSwapCommand.cancel(requestId: "swap_1"),
        ShiftSwapCommand.apply(requestId: "swap_1", candidateShiftId: "candidate_shift")
    ])
    func inMemoryRejectsCommandsFromAnUnrelatedActor(_ command: ShiftSwapCommand) async {
        let candidate = ShiftSwapCandidate(userId: "candidate", shiftId: "candidate_shift")
        let repository = InMemoryShiftSwapRequestRepository(
            createFixtures: [InMemoryShiftSwapCreateFixture(
                requestedShiftId: "requested_shift",
                requestId: "created_swap",
                requesterUserId: "requester",
                candidates: [candidate]
            )],
            actorUserIdProvider: { "unrelated_actor" }
        )
        _ = await repository.upsert(
            request: shiftSwapRequest(
                id: "swap_1",
                requestedShiftId: "requested_shift",
                requesterUserId: "requester",
                candidates: [candidate],
                responses: [availableShiftSwapResponse(userId: candidate.userId, shiftId: candidate.shiftId)]
            ),
            environment: .develop
        )

        await #expect(throws: ShiftSwapCommandError.permissionDenied) {
            try await repository.transition(command, environment: .develop)
        }
    }
}
