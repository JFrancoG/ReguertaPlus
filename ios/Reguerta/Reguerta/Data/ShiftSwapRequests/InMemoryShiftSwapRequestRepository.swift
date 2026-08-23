import Foundation

struct InMemoryShiftSwapCreateFixture {
    let requestedShiftId: String
    let requestId: String
    let requesterUserId: String
    let candidates: [ShiftSwapCandidate]
}

actor InMemoryShiftSwapRequestRepository: ShiftSwapRequestRepository {
    private var requests: [String: ShiftSwapRequest] = [:]
    private let createFixtures: [String: InMemoryShiftSwapCreateFixture]
    private let actorUserIdProvider: @Sendable () -> String?
    private let transitionMillisProvider: @Sendable () -> Int64

    init(
        createFixtures: [InMemoryShiftSwapCreateFixture] = [],
        actorUserIdProvider: @escaping @Sendable () -> String? = { nil },
        transitionMillisProvider: @escaping @Sendable () -> Int64 = {
            Int64(Date.now.timeIntervalSince1970 * 1_000)
        }
    ) {
        self.createFixtures = Dictionary(
            uniqueKeysWithValues: createFixtures.map { ($0.requestedShiftId, $0) }
        )
        self.actorUserIdProvider = actorUserIdProvider
        self.transitionMillisProvider = transitionMillisProvider
    }

    func allShiftSwapRequests(environment _: SessionEnvironment) async -> [ShiftSwapRequest] {
        requests.values.sorted { $0.requestedAtMillis > $1.requestedAtMillis }
    }

    func upsert(request: ShiftSwapRequest, environment _: SessionEnvironment) async -> ShiftSwapRequest {
        let persisted = ShiftSwapRequest(
            id: request.id.isEmpty ? "swap_\(request.requestedShiftId)_\(request.requesterUserId)" : request.id,
            requestedShiftId: request.requestedShiftId,
            requesterUserId: request.requesterUserId,
            reason: request.reason,
            status: request.status,
            candidates: request.candidates,
            responses: request.responses,
            selectedCandidateUserId: request.selectedCandidateUserId,
            selectedCandidateShiftId: request.selectedCandidateShiftId,
            requestedAtMillis: request.requestedAtMillis,
            confirmedAtMillis: request.confirmedAtMillis,
            appliedAtMillis: request.appliedAtMillis
        )
        requests[persisted.id] = persisted
        return persisted
    }

    func transition(
        _ command: ShiftSwapCommand,
        environment _: SessionEnvironment
    ) async throws -> ShiftSwapTransitionResult {
        switch command {
        case .create(let requestedShiftId, let reason):
            return try createCommand(requestedShiftId: requestedShiftId, reason: reason)
        case .respond(let requestId, let candidateShiftId, let response):
            return try respondCommand(
                requestId: requestId,
                candidateShiftId: candidateShiftId,
                response: response
            )
        case .cancel(let requestId):
            return try cancelCommand(requestId: requestId)
        case .apply(let requestId, let candidateShiftId):
            return try applyCommand(requestId: requestId, candidateShiftId: candidateShiftId)
        }
    }

    private func createCommand(requestedShiftId: String, reason: String) throws -> ShiftSwapTransitionResult {
        let actorUserId = try requiredActorUserId()
        guard let fixture = createFixtures[requestedShiftId] else {
            throw ShiftSwapCommandError.noCandidates
        }
        guard fixture.requesterUserId == actorUserId else { throw ShiftSwapCommandError.permissionDenied }
        guard !fixture.candidates.isEmpty else { throw ShiftSwapCommandError.noCandidates }
        let request = ShiftSwapRequest(
            id: fixture.requestId,
            requestedShiftId: fixture.requestedShiftId,
            requesterUserId: fixture.requesterUserId,
            reason: reason,
            status: .open,
            candidates: fixture.candidates,
            responses: [],
            selectedCandidateUserId: nil,
            selectedCandidateShiftId: nil,
            requestedAtMillis: transitionMillisProvider(),
            confirmedAtMillis: nil,
            appliedAtMillis: nil
        )
        requests[request.id] = request
        return ShiftSwapTransitionResult(requestId: request.id, candidateCount: request.candidates.count)
    }

    private func respondCommand(
        requestId: String,
        candidateShiftId: String,
        response: ShiftSwapResponseStatus
    ) throws -> ShiftSwapTransitionResult {
        let actorUserId = try requiredActorUserId()
        let request = try openRequest(id: requestId)
        guard let candidate = request.candidates.first(where: {
            $0.userId == actorUserId && $0.shiftId == candidateShiftId
        }) else {
            throw ShiftSwapCommandError.permissionDenied
        }
        requests[requestId] = request.responding(
            candidate: candidate,
            response: response,
            respondedAtMillis: transitionMillisProvider()
        )
        return ShiftSwapTransitionResult(requestId: requestId, candidateCount: nil)
    }

    private func cancelCommand(requestId: String) throws -> ShiftSwapTransitionResult {
        let actorUserId = try requiredActorUserId()
        let request = try openRequest(id: requestId)
        guard request.requesterUserId == actorUserId else { throw ShiftSwapCommandError.permissionDenied }
        requests[requestId] = request.cancelling()
        return ShiftSwapTransitionResult(requestId: requestId, candidateCount: nil)
    }

    private func applyCommand(requestId: String, candidateShiftId: String) throws -> ShiftSwapTransitionResult {
        let actorUserId = try requiredActorUserId()
        let request = try openRequest(id: requestId)
        guard request.requesterUserId == actorUserId else { throw ShiftSwapCommandError.permissionDenied }
        guard let candidate = request.candidates.first(where: { $0.shiftId == candidateShiftId }) else {
            throw ShiftSwapCommandError.conflict(code: "invalid_shift_swap_candidate")
        }
        guard request.responses.contains(where: {
            $0.userId == candidate.userId && $0.shiftId == candidate.shiftId && $0.status == .available
        }) else {
            throw ShiftSwapCommandError.conflict(code: "available_response_required")
        }
        requests[requestId] = request.applying(
            candidate: candidate,
            appliedAtMillis: transitionMillisProvider()
        )
        return ShiftSwapTransitionResult(requestId: requestId, candidateCount: nil)
    }

    private func requiredActorUserId() throws -> String {
        guard let actorUserId = actorUserIdProvider(), !actorUserId.isEmpty else {
            throw ShiftSwapCommandError.permissionDenied
        }
        return actorUserId
    }

    private func openRequest(id: String) throws -> ShiftSwapRequest {
        guard let request = requests[id] else {
            throw ShiftSwapCommandError.conflict(code: "shift_swap_not_found")
        }
        guard request.status == .open else {
            throw ShiftSwapCommandError.conflict(code: "shift_swap_closed")
        }
        return request
    }
}

private extension ShiftSwapRequest {
    func responding(
        candidate: ShiftSwapCandidate,
        response: ShiftSwapResponseStatus,
        respondedAtMillis: Int64
    ) -> ShiftSwapRequest {
        let updatedResponses = responses
            .filter { $0.userId != candidate.userId || $0.shiftId != candidate.shiftId }
            + [ShiftSwapResponse(
                userId: candidate.userId,
                shiftId: candidate.shiftId,
                status: response,
                respondedAtMillis: respondedAtMillis
            )]
        return replacing(responses: updatedResponses.sorted { $0.respondedAtMillis > $1.respondedAtMillis })
    }

    func cancelling() -> ShiftSwapRequest { replacing(status: .cancelled) }

    func applying(candidate: ShiftSwapCandidate, appliedAtMillis: Int64) -> ShiftSwapRequest {
        replacing(
            status: .applied,
            selectedCandidateUserId: candidate.userId,
            selectedCandidateShiftId: candidate.shiftId,
            confirmedAtMillis: appliedAtMillis,
            appliedAtMillis: appliedAtMillis
        )
    }

    func replacing(
        status: ShiftSwapRequestStatus? = nil,
        responses: [ShiftSwapResponse]? = nil,
        selectedCandidateUserId: String? = nil,
        selectedCandidateShiftId: String? = nil,
        confirmedAtMillis: Int64? = nil,
        appliedAtMillis: Int64? = nil
    ) -> ShiftSwapRequest {
        ShiftSwapRequest(
            id: id,
            requestedShiftId: requestedShiftId,
            requesterUserId: requesterUserId,
            reason: reason,
            status: status ?? self.status,
            candidates: candidates,
            responses: responses ?? self.responses,
            selectedCandidateUserId: selectedCandidateUserId ?? self.selectedCandidateUserId,
            selectedCandidateShiftId: selectedCandidateShiftId ?? self.selectedCandidateShiftId,
            requestedAtMillis: requestedAtMillis,
            confirmedAtMillis: confirmedAtMillis ?? self.confirmedAtMillis,
            appliedAtMillis: appliedAtMillis ?? self.appliedAtMillis
        )
    }
}
