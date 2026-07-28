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

    func allShiftSwapRequests() async throws -> [ShiftSwapRequest] {
        do {
            let snapshot = try await requestsCollection.getDocuments(source: .server)
            return try snapshot.documents
                .map { document in
                    try Self.shiftSwapRequest(documentID: document.documentID, data: document.data())
                }
                .sorted { $0.requestedAtMillis > $1.requestedAtMillis }
        } catch {
            throw FirestoreRepositoryErrorMapper.map(error, resource: "shiftSwapRequests")
        }
    }

    func transition(_ transition: ShiftSwapTransition) async throws -> ShiftSwapTransitionResult {
        let request = ShiftSwapTransitionRequest(
            environment: environment ?? ReguertaRuntimeEnvironment.currentFirestoreEnvironment,
            transition: transition
        )
        let response: ShiftSwapTransitionResponse
        do {
            response = try await functionsClient.post(
                function: .transitionShiftSwap,
                body: request,
                response: ShiftSwapTransitionResponse.self
            )
        } catch {
            throw Self.mapFunctionError(error)
        }
        let responseRequestId = response.requestId.trimmingCharacters(in: .whitespacesAndNewlines)
        guard response.ok,
              response.environment == request.environment,
              response.action == request.action,
              !responseRequestId.isEmpty,
              request.requestId == nil || request.requestId == responseRequestId else {
            throw RepositoryError.invalidData(resource: "shiftSwapRequests.transition")
        }
        return ShiftSwapTransitionResult(
            requestId: responseRequestId,
            candidateCount: response.candidateCount
        )
    }

    static func shiftSwapRequest(documentID: String, data: [String: Any]) throws -> ShiftSwapRequest {
        guard !documentID.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
              let requestedShiftId = nonEmptyTrimmedString(data["requestedShiftId"]),
              let requesterUserId = nonEmptyTrimmedString(data["requesterUserId"]),
              let reason = data["reason"] as? String,
              let statusRaw = nonEmptyTrimmedString(data["status"])?.lowercased(),
              let status = ShiftSwapRequestStatus(rawValue: statusRaw),
              let rawCandidates = data["candidates"] as? [[String: Any]],
              let rawResponses = data["responses"] as? [[String: Any]],
              let requestedAt = data["requestedAt"] as? Timestamp else {
            throw invalidDocumentError
        }

        let candidates = try rawCandidates.map(Self.shiftSwapCandidate)
        let responses = try rawResponses.map(Self.shiftSwapResponse)

        return ShiftSwapRequest(
            id: documentID,
            requestedShiftId: requestedShiftId,
            requesterUserId: requesterUserId,
            reason: reason.trimmingCharacters(in: .whitespacesAndNewlines),
            status: status,
            candidates: candidates,
            responses: responses,
            selectedCandidateUserId: try optionalNonEmptyString(data["selectedCandidateUserId"]),
            selectedCandidateShiftId: try optionalNonEmptyString(data["selectedCandidateShiftId"]),
            requestedAtMillis: Int64(requestedAt.dateValue().timeIntervalSince1970 * 1_000),
            confirmedAtMillis: try optionalTimestampMillis(data["confirmedAt"]),
            appliedAtMillis: try optionalTimestampMillis(data["appliedAt"])
        )
    }

    private static func shiftSwapCandidate(_ item: [String: Any]) throws -> ShiftSwapCandidate {
        guard let userId = nonEmptyTrimmedString(item["userId"]),
              let shiftId = nonEmptyTrimmedString(item["shiftId"]) else {
            throw invalidDocumentError
        }
        return ShiftSwapCandidate(userId: userId, shiftId: shiftId)
    }

    private static func shiftSwapResponse(_ item: [String: Any]) throws -> ShiftSwapResponse {
        guard let userId = nonEmptyTrimmedString(item["userId"]),
              let shiftId = nonEmptyTrimmedString(item["shiftId"]),
              let statusRaw = nonEmptyTrimmedString(item["status"])?.lowercased(),
              let status = ShiftSwapResponseStatus(rawValue: statusRaw),
              let respondedAt = item["respondedAt"] as? Timestamp else {
            throw invalidDocumentError
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

    private static func optionalNonEmptyString(_ value: Any?) throws -> String? {
        guard let value else { return nil }
        if value is NSNull { return nil }
        guard let parsed = nonEmptyTrimmedString(value) else { throw invalidDocumentError }
        return parsed
    }

    private static func optionalTimestampMillis(_ value: Any?) throws -> Int64? {
        guard let value else { return nil }
        if value is NSNull { return nil }
        guard let timestamp = value as? Timestamp else { throw invalidDocumentError }
        return Int64(timestamp.dateValue().timeIntervalSince1970 * 1_000)
    }

    private static func mapFunctionError(_ error: any Error) -> any Error {
        if error is CancellationError {
            return error
        }
        if let repositoryError = error as? RepositoryError {
            return repositoryError
        }
        guard let functionError = error as? FirebaseFunctionClientError else {
            return RepositoryError.unknown(resource: "shiftSwapRequests.transition")
        }
        switch functionError {
        case .cancelled:
            return CancellationError()
        case .missingIDToken, .unauthorized, .forbidden:
            return RepositoryError.permissionDenied(resource: "shiftSwapRequests.transition")
        case .timeout, .transport:
            return RepositoryError.unavailable(resource: "shiftSwapRequests.transition")
        case .http(let statusCode, _, _) where statusCode == 408 || statusCode == 429 || statusCode >= 500:
            return RepositoryError.unavailable(resource: "shiftSwapRequests.transition")
        case .invalidHTTPResponse, .invalidResponse:
            return RepositoryError.invalidData(resource: "shiftSwapRequests.transition")
        case .invalidEndpoint, .conflict, .http:
            return RepositoryError.unknown(resource: "shiftSwapRequests.transition")
        }
    }

    private static var invalidDocumentError: RepositoryError {
        .invalidData(resource: "shiftSwapRequests.document")
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
