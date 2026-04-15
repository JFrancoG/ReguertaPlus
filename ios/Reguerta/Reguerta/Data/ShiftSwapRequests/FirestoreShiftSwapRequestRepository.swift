import FirebaseFirestore
import Foundation

final class FirestoreShiftSwapRequestRepository: @unchecked Sendable, ShiftSwapRequestRepository {
    private let db: Firestore
    private let environment: ReguertaFirestoreEnvironment?

    init(
        db: Firestore = Firestore.firestore(),
        environment: ReguertaFirestoreEnvironment? = nil
    ) {
        self.db = db
        self.environment = environment
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

    func upsert(request: ShiftSwapRequest) async -> ShiftSwapRequest {
        let documentId = request.id.isEmpty ? requestsCollection.document().documentID : request.id
        let persisted = ShiftSwapRequest(
            id: documentId,
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

        var payload: [String: Any] = [
            "requestedShiftId": persisted.requestedShiftId,
            "requesterUserId": persisted.requesterUserId,
            "reason": persisted.reason,
            "status": persisted.status.rawValue,
            "candidates": persisted.candidates.map { candidate in
                [
                    "userId": candidate.userId,
                    "shiftId": candidate.shiftId,
                ]
            },
            "responses": persisted.responses.map { response in
                [
                    "userId": response.userId,
                    "shiftId": response.shiftId,
                    "status": response.status.rawValue,
                    "respondedAt": Timestamp(date: Date(timeIntervalSince1970: TimeInterval(response.respondedAtMillis) / 1_000)),
                ]
            },
            "selectedCandidateUserId": persisted.selectedCandidateUserId as Any,
            "selectedCandidateShiftId": persisted.selectedCandidateShiftId as Any,
            "requestedAt": Timestamp(date: Date(timeIntervalSince1970: TimeInterval(persisted.requestedAtMillis) / 1_000)),
        ]
        payload["confirmedAt"] = persisted.confirmedAtMillis.map { Timestamp(date: Date(timeIntervalSince1970: TimeInterval($0) / 1_000)) }
        payload["appliedAt"] = persisted.appliedAtMillis.map { Timestamp(date: Date(timeIntervalSince1970: TimeInterval($0) / 1_000)) }

        do {
            try await requestsCollection.document(documentId).setData(payload, merge: true)
            return persisted
        } catch {
            return persisted
        }
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
