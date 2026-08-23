import FirebaseFirestore
import Foundation
import Testing

@testable import Reguerta

@MainActor
struct ShiftSwapCommandBoundaryTests {
    @Test func rejectsMismatchedBackendAction() async throws {
        let loader = RecordingHTTPDataLoader(
            data: try JSONEncoder().encode(
                TestShiftSwapTransitionResponse(
                    ok: true,
                    environment: .develop,
                    action: "cancel",
                    requestId: "swap_1",
                    candidateCount: 1
                )
            ),
            statusCode: 200
        )
        let repository = makeRepository(dataLoader: loader)

        await #expect(throws: ShiftSwapCommandError.invalidData) {
            try await repository.transition(
                .create(requestedShiftId: "shift_1", reason: "reason"),
                environment: .develop
            )
        }
    }

    @Test func mapsFunctionCancellationToTaskCancellation() async {
        let repository = makeRepository(
            dataLoader: RecordingHTTPDataLoader(error: URLError(.cancelled))
        )

        await #expect(throws: CancellationError.self) {
            try await repository.transition(
                .create(requestedShiftId: "shift_1", reason: "reason"),
                environment: .develop
            )
        }
    }

    @Test func inMemoryRejectsClosedCommandsAndApplyWithoutAcceptance() async {
        let candidate = ShiftSwapCandidate(userId: "candidate", shiftId: "candidate_shift")
        let repository = InMemoryShiftSwapRequestRepository(
            actorUserIdProvider: { "requester" }
        )
        _ = await repository.upsert(
            request: shiftSwapRequest(
                id: "closed_swap",
                requestedShiftId: "requested_shift",
                requesterUserId: "requester",
                candidates: [candidate],
                status: .cancelled
            ),
            environment: .develop
        )

        let closedCommands: [ShiftSwapCommand] = [
            .respond(requestId: "closed_swap", candidateShiftId: candidate.shiftId, response: .available),
            .cancel(requestId: "closed_swap"),
            .apply(requestId: "closed_swap", candidateShiftId: candidate.shiftId)
        ]
        for command in closedCommands {
            await #expect(throws: ShiftSwapCommandError.conflict(code: "shift_swap_closed")) {
                try await repository.transition(command, environment: .develop)
            }
        }

        _ = await repository.upsert(
            request: shiftSwapRequest(
                id: "open_swap",
                requestedShiftId: "requested_shift",
                requesterUserId: "requester",
                candidates: [candidate]
            ),
            environment: .develop
        )
        await #expect(throws: ShiftSwapCommandError.conflict(code: "available_response_required")) {
            try await repository.transition(
                .apply(requestId: "open_swap", candidateShiftId: candidate.shiftId),
                environment: .develop
            )
        }
    }

    @Test func inMemoryOwnsResponseAndApplyTimestamps() async throws {
        let transitionMillis: Int64 = 42
        let candidate = ShiftSwapCandidate(userId: "candidate", shiftId: "candidate_shift")
        let responseRepository = InMemoryShiftSwapRequestRepository(
            actorUserIdProvider: { candidate.userId },
            transitionMillisProvider: { transitionMillis }
        )
        _ = await responseRepository.upsert(
            request: shiftSwapRequest(
                id: "response_swap",
                requestedShiftId: "requested_shift",
                requesterUserId: "requester",
                candidates: [candidate]
            ),
            environment: .develop
        )

        _ = try await responseRepository.transition(
            .respond(requestId: "response_swap", candidateShiftId: candidate.shiftId, response: .available),
            environment: .develop
        )
        let responseRequest = try #require(
            await responseRepository.allShiftSwapRequests(environment: .develop).first
        )
        #expect(responseRequest.responses.first?.respondedAtMillis == transitionMillis)

        let applyRepository = InMemoryShiftSwapRequestRepository(
            actorUserIdProvider: { "requester" },
            transitionMillisProvider: { transitionMillis }
        )
        _ = await applyRepository.upsert(
            request: shiftSwapRequest(
                id: "apply_swap",
                requestedShiftId: "requested_shift",
                requesterUserId: "requester",
                candidates: [candidate],
                responses: [availableShiftSwapResponse(userId: candidate.userId, shiftId: candidate.shiftId)]
            ),
            environment: .develop
        )
        _ = try await applyRepository.transition(
            .apply(requestId: "apply_swap", candidateShiftId: candidate.shiftId),
            environment: .develop
        )

        let appliedRequest = try #require(
            await applyRepository.allShiftSwapRequests(environment: .develop).first
        )
        #expect(appliedRequest.confirmedAtMillis == transitionMillis)
        #expect(appliedRequest.appliedAtMillis == transitionMillis)
    }

    @Test func inMemoryAttributesSharedShiftResponseToAuthenticatedCandidate() async throws {
        let sharedShiftId = "shared_shift"
        let firstCandidate = ShiftSwapCandidate(userId: "candidate_a", shiftId: sharedShiftId)
        let authenticatedCandidate = ShiftSwapCandidate(userId: "candidate_b", shiftId: sharedShiftId)
        let repository = InMemoryShiftSwapRequestRepository(
            actorUserIdProvider: { authenticatedCandidate.userId },
            transitionMillisProvider: { 42 }
        )
        _ = await repository.upsert(
            request: shiftSwapRequest(
                id: "swap_1",
                requestedShiftId: "requested_shift",
                requesterUserId: "requester",
                candidates: [firstCandidate, authenticatedCandidate]
            ),
            environment: .develop
        )

        _ = try await repository.transition(
            .respond(requestId: "swap_1", candidateShiftId: sharedShiftId, response: .available),
            environment: .develop
        )

        let request = try #require(await repository.allShiftSwapRequests(environment: .develop).first)
        #expect(request.responses.map(\.userId) == [authenticatedCandidate.userId])
    }

    @Test(arguments: [
        ShiftSwapHTTPErrorScenario(
            statusCode: 403,
            code: "shift_not_owned",
            expectedError: .permissionDenied
        ),
        ShiftSwapHTTPErrorScenario(
            statusCode: 409,
            code: "no_shift_swap_candidates",
            expectedError: .noCandidates
        ),
        ShiftSwapHTTPErrorScenario(
            statusCode: 409,
            code: "shift_swap_closed",
            expectedError: .conflict(code: "shift_swap_closed")
        ),
        ShiftSwapHTTPErrorScenario(
            statusCode: 503,
            code: "service_unavailable",
            expectedError: .unavailable
        ),
        ShiftSwapHTTPErrorScenario(
            statusCode: 400,
            code: "invalid_shift_swap_payload",
            expectedError: .invalidData
        )
    ])
    func preservesFunctionErrorTaxonomy(_ scenario: ShiftSwapHTTPErrorScenario) async throws {
        let payload = FirebaseFunctionErrorResponse(
            error: FirebaseFunctionErrorPayload(
                code: scenario.code,
                message: "test"
            )
        )
        let repository = makeRepository(
            dataLoader: RecordingHTTPDataLoader(
                data: try JSONEncoder().encode(payload),
                statusCode: scenario.statusCode
            )
        )

        await #expect(throws: scenario.expectedError) {
            try await repository.transition(
                .create(requestedShiftId: "shift_1", reason: "reason"),
                environment: .develop
            )
        }
    }

    @Test(arguments: [
        ShiftSwapCommandPayloadScenario(
            command: .create(requestedShiftId: "shift_1", reason: "No puedo ir"),
            responseRequestId: "swap_server",
            responseCandidateCount: 2,
            expectedBody: TestShiftSwapTransitionBody(
                keys: ["environment", "action", "requestedShiftId", "reason"],
                environment: .develop,
                action: "create",
                requestedShiftId: "shift_1",
                reason: "No puedo ir",
                requestId: nil,
                candidateShiftId: nil,
                response: nil
            )
        ),
        ShiftSwapCommandPayloadScenario(
            command: .respond(
                requestId: "swap_1",
                candidateShiftId: "shift_2",
                response: .available
            ),
            responseRequestId: "swap_1",
            responseCandidateCount: nil,
            expectedBody: TestShiftSwapTransitionBody(
                keys: ["environment", "action", "requestId", "candidateShiftId", "response"],
                environment: .develop,
                action: "respond",
                requestedShiftId: nil,
                reason: nil,
                requestId: "swap_1",
                candidateShiftId: "shift_2",
                response: "available"
            )
        ),
        ShiftSwapCommandPayloadScenario(
            command: .cancel(requestId: "swap_1"),
            responseRequestId: "swap_1",
            responseCandidateCount: nil,
            expectedBody: TestShiftSwapTransitionBody(
                keys: ["environment", "action", "requestId"],
                environment: .develop,
                action: "cancel",
                requestedShiftId: nil,
                reason: nil,
                requestId: "swap_1",
                candidateShiftId: nil,
                response: nil
            )
        ),
        ShiftSwapCommandPayloadScenario(
            command: .apply(requestId: "swap_1", candidateShiftId: "shift_2"),
            responseRequestId: "swap_1",
            responseCandidateCount: nil,
            expectedBody: TestShiftSwapTransitionBody(
                keys: ["environment", "action", "requestId", "candidateShiftId"],
                environment: .develop,
                action: "apply",
                requestedShiftId: nil,
                reason: nil,
                requestId: "swap_1",
                candidateShiftId: "shift_2",
                response: nil
            )
        )
    ])
    func encodesOnlyTheFunctionsUnionFields(_ scenario: ShiftSwapCommandPayloadScenario) async throws {
        let loader = RecordingHTTPDataLoader(
            data: try JSONEncoder().encode(
                TestShiftSwapTransitionResponse(
                    ok: true,
                    environment: .develop,
                    action: scenario.expectedBody.action,
                    requestId: scenario.responseRequestId,
                    candidateCount: scenario.responseCandidateCount
                )
            ),
            statusCode: 200
        )
        let repository = makeRepository(dataLoader: loader)

        let result = try await repository.transition(scenario.command, environment: .develop)

        #expect(result.requestId == scenario.responseRequestId)
        #expect(result.candidateCount == scenario.responseCandidateCount)
        let request = try #require(loader.lastRequest)
        let body = try #require(request.httpBody)
        let decoded = try JSONDecoder().decode(TestShiftSwapTransitionBody.self, from: body)
        #expect(decoded == scenario.expectedBody)
    }

    private func makeRepository(dataLoader: any HTTPDataLoading) -> FirestoreShiftSwapRequestRepository {
        FirestoreShiftSwapRequestRepository(
            firebaseAppName: Firestore.firestore().app.name,
            functionsClient: AuthenticatedFirebaseFunctionsClient(
                baseURL: URL(string: "https://example.test")!,
                tokenProvider: RecordingFirebaseIDTokenProvider(token: "token"),
                dataLoader: dataLoader
            )
        )
    }
}

struct ShiftSwapCommandPayloadScenario {
    let command: ShiftSwapCommand
    let responseRequestId: String
    let responseCandidateCount: Int?
    let expectedBody: TestShiftSwapTransitionBody
}

struct ShiftSwapHTTPErrorScenario {
    let statusCode: Int
    let code: String
    let expectedError: ShiftSwapCommandError
}

struct TestShiftSwapTransitionBody: Equatable {
    let keys: Set<String>
    let environment: SessionEnvironment
    let action: String
    let requestedShiftId: String?
    let reason: String?
    let requestId: String?
    let candidateShiftId: String?
    let response: String?

    private enum CodingKeys: String, CodingKey {
        case environment
        case action
        case requestedShiftId
        case reason
        case requestId
        case candidateShiftId
        case response
    }
}

extension TestShiftSwapTransitionBody: Decodable {
    init(from decoder: any Decoder) throws {
        let allFields = try decoder.container(keyedBy: TestJSONKey.self)
        let fields = try decoder.container(keyedBy: CodingKeys.self)
        self.keys = Set(allFields.allKeys.map(\.stringValue))
        self.environment = try fields.decode(SessionEnvironment.self, forKey: .environment)
        self.action = try fields.decode(String.self, forKey: .action)
        self.requestedShiftId = try fields.decodeIfPresent(String.self, forKey: .requestedShiftId)
        self.reason = try fields.decodeIfPresent(String.self, forKey: .reason)
        self.requestId = try fields.decodeIfPresent(String.self, forKey: .requestId)
        self.candidateShiftId = try fields.decodeIfPresent(String.self, forKey: .candidateShiftId)
        self.response = try fields.decodeIfPresent(String.self, forKey: .response)
    }
}

struct TestJSONKey: CodingKey {
    let stringValue: String
    let intValue: Int?
}

extension TestJSONKey {
    init?(stringValue: String) {
        self.stringValue = stringValue
        self.intValue = nil
    }

    init?(intValue: Int) {
        self.stringValue = String(intValue)
        self.intValue = intValue
    }
}
