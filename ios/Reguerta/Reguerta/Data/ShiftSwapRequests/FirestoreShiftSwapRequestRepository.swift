import FirebaseFirestore
import Foundation

final class FirestoreShiftSwapRequestRepository: @unchecked Sendable, ShiftSwapRequestRepository {
    private let db: Firestore
    private let environment: ReguertaFirestoreEnvironment?
    private let functionsClient: AuthenticatedFirebaseFunctionsClient

    init(
        db: Firestore = Firestore.firestore(),
        environment: ReguertaFirestoreEnvironment? = nil,
        functionsClient: AuthenticatedFirebaseFunctionsClient
    ) {
        self.db = db
        self.environment = environment
        self.functionsClient = functionsClient
    }

    private var requestsCollection: CollectionReference {
        db.reguertaCollection(.shiftSwapRequests, environment: environment)
    }

    func allShiftSwapRequests() async -> [ShiftSwapRequest] {
        do {
            let snapshot = try await requestsCollection.getDocuments()
            return snapshot.documents
                .compactMap(Self.toShiftSwapRequest)
                .sorted { $0.requestedAtMillis > $1.requestedAtMillis }
        } catch {
            return []
        }
    }

    func transition(_ transition: ShiftSwapTransition) async throws -> ShiftSwapTransitionResult {
        let request = ShiftSwapTransitionRequest(
            environment: environment ?? ReguertaRuntimeEnvironment.currentFirestoreEnvironment,
            transition: transition
        )
        let response = try await functionsClient.post(
            function: .transitionShiftSwap,
            body: request,
            response: ShiftSwapTransitionResponse.self
        )
        let responseRequestId = response.requestId.trimmingCharacters(in: .whitespacesAndNewlines)
        guard response.ok,
              response.environment == request.environment,
              response.action == request.action,
              !responseRequestId.isEmpty,
              request.requestId == nil || request.requestId == responseRequestId else {
            throw FirebaseFunctionClientError.invalidResponse
        }
        return ShiftSwapTransitionResult(
            requestId: responseRequestId,
            candidateCount: response.candidateCount
        )
    }

    private static func toShiftSwapRequest(_ document: QueryDocumentSnapshot) -> ShiftSwapRequest? {
        let data = document.data()
        guard let requestedShiftId = nonEmptyTrimmedString(data["requestedShiftId"]),
              let requesterUserId = nonEmptyTrimmedString(data["requesterUserId"]),
              let statusRaw = nonEmptyTrimmedString(data["status"])?.lowercased(),
              let status = ShiftSwapRequestStatus(rawValue: statusRaw),
              let requestedAt = data["requestedAt"] as? Timestamp else {
            return nil
        }

        let candidates = ((data["candidates"] as? [[String: Any]]) ?? []).compactMap(Self.toShiftSwapCandidate)
        let responses = ((data["responses"] as? [[String: Any]]) ?? []).compactMap(Self.toShiftSwapResponse)

        return ShiftSwapRequest(
            id: document.documentID,
            requestedShiftId: requestedShiftId,
            requesterUserId: requesterUserId,
            reason: nonEmptyTrimmedString(data["reason"]) ?? "",
            status: status,
            candidates: candidates,
            responses: responses,
            selectedCandidateUserId: nonEmptyTrimmedString(data["selectedCandidateUserId"]),
            selectedCandidateShiftId: nonEmptyTrimmedString(data["selectedCandidateShiftId"]),
            requestedAtMillis: Int64(requestedAt.dateValue().timeIntervalSince1970 * 1_000),
            confirmedAtMillis: (data["confirmedAt"] as? Timestamp).map { Int64($0.dateValue().timeIntervalSince1970 * 1_000) },
            appliedAtMillis: (data["appliedAt"] as? Timestamp).map { Int64($0.dateValue().timeIntervalSince1970 * 1_000) }
        )
    }

    private static func toShiftSwapCandidate(_ item: [String: Any]) -> ShiftSwapCandidate? {
        guard let userId = nonEmptyTrimmedString(item["userId"]),
              let shiftId = nonEmptyTrimmedString(item["shiftId"]) else {
            return nil
        }
        return ShiftSwapCandidate(userId: userId, shiftId: shiftId)
    }

    private static func toShiftSwapResponse(_ item: [String: Any]) -> ShiftSwapResponse? {
        guard let userId = nonEmptyTrimmedString(item["userId"]),
              let shiftId = nonEmptyTrimmedString(item["shiftId"]),
              let statusRaw = nonEmptyTrimmedString(item["status"])?.lowercased(),
              let status = ShiftSwapResponseStatus(rawValue: statusRaw),
              let respondedAt = item["respondedAt"] as? Timestamp else {
            return nil
        }
        return ShiftSwapResponse(
            userId: userId,
            shiftId: shiftId,
            status: status,
            respondedAtMillis: Int64(respondedAt.dateValue().timeIntervalSince1970 * 1_000)
        )
    }

    private static func nonEmptyTrimmedString(_ value: Any?) -> String? {
        guard let text = value as? String else { return nil }
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }
}

nonisolated private struct ShiftSwapTransitionResponse: Decodable, Sendable {
    let ok: Bool
    let environment: SessionEnvironment
    let action: String
    let requestId: String
    let candidateCount: Int?
}

nonisolated private struct ShiftSwapTransitionRequest: Encodable, Sendable {
    let environment: SessionEnvironment
    let action: String
    let requestedShiftId: String?
    let reason: String?
    let requestId: String?
    let candidateShiftId: String?
    let response: String?

    init(environment: SessionEnvironment, transition: ShiftSwapTransition) {
        self.environment = environment
        switch transition {
        case .create(let request):
            action = "create"
            requestedShiftId = request.requestedShiftId
            reason = request.reason
            requestId = nil
            candidateShiftId = nil
            response = nil
        case .respond(let request, let candidateShiftId, let responseStatus):
            action = "respond"
            requestedShiftId = nil
            reason = nil
            requestId = request.id
            self.candidateShiftId = candidateShiftId
            response = responseStatus.rawValue
        case .cancel(let request):
            action = "cancel"
            requestedShiftId = nil
            reason = nil
            requestId = request.id
            candidateShiftId = nil
            response = nil
        case .apply(let request, let candidateShiftId):
            action = "apply"
            requestedShiftId = nil
            reason = nil
            requestId = request.id
            self.candidateShiftId = candidateShiftId
            response = nil
        }
    }
}
