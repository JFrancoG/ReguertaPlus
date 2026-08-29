import FirebaseFirestore
import Foundation

enum ShiftPlanningRequestTransactionCodec {
    static func resolve(
        request: ShiftPlanningRequest,
        context: ShiftPlanningRequestContext
    ) throws -> ResolvedShiftPlanningRequest {
        let normalizedID = request.id.trimmingCharacters(in: .whitespacesAndNewlines)
        let normalizedBundleID = request.bundleId.trimmingCharacters(in: .whitespacesAndNewlines)
        let normalizedRequester = request.requestedByUserId.trimmingCharacters(in: .whitespacesAndNewlines)
        guard isValidShiftPlanningIdentifier(normalizedID),
              isValidShiftPlanningIdentifier(normalizedBundleID),
              isValidShiftPlanningIdentifier(normalizedRequester),
              request.requestedAtMillis >= 0,
              validSeasonRange.contains(request.deliveryTargetSeasonStartYear),
              validSeasonRange.contains(request.marketTargetSeasonStartYear),
              context.expectedWriteEpoch >= 0,
              context.expectedActiveRevision == nil ||
                context.expectedActiveRevision.map(isValidShiftPlanningIdentifier) == true else {
            throw RepositoryError.invalidData(resource: "shiftPlanningRequests.document")
        }
        return ResolvedShiftPlanningRequest(
            request: ShiftPlanningRequest(
                id: normalizedID,
                bundleId: normalizedBundleID,
                requestedByUserId: normalizedRequester,
                requestedAtMillis: request.requestedAtMillis,
                deliveryTargetSeasonStartYear: request.deliveryTargetSeasonStartYear,
                marketTargetSeasonStartYear: request.marketTargetSeasonStartYear
            ),
            context: context
        )
    }

    static func transactionDecision(
        documentID: String,
        data: [String: Any]?,
        requested: ResolvedShiftPlanningRequest
    ) throws -> ShiftPlanningRequestTransactionDecision {
        let intent = requested.request
        guard intent.id == documentID else {
            throw RepositoryError.invalidData(resource: "shiftPlanningRequests.document")
        }
        guard let data else { return .create(requested) }

        guard integer(data["schemaVersion"]) == 2,
              data["requestId"] as? String == intent.id,
              data["bundleId"] as? String == intent.bundleId,
              data["environment"] as? String == requested.context.environment.rawValue,
              data["requestedByUserId"] as? String == intent.requestedByUserId,
              let requestedAt = data["requestedAt"] as? Timestamp,
              data["mode"] as? String == "preview",
              let statusValue = data["status"] as? String,
              ShiftPlanningRequestStatus(rawValue: statusValue) != nil,
              data["binding"] is NSNull,
              let subplans = data["subplans"] as? [String: Any],
              targetSeason(in: subplans, type: "delivery") == intent.deliveryTargetSeasonStartYear,
              targetSeason(in: subplans, type: "market") == intent.marketTargetSeasonStartYear else {
            throw RepositoryError.invalidData(resource: "shiftPlanningRequests.document")
        }
        let expectedRequestedAt = timestamp(for: intent.requestedAtMillis)
        guard requestedAt.seconds == expectedRequestedAt.seconds,
              requestedAt.nanoseconds == expectedRequestedAt.nanoseconds else {
            throw RepositoryError.invalidData(resource: "shiftPlanningRequests.document")
        }
        return .acknowledge(intent)
    }

    static func firestoreData(for request: ResolvedShiftPlanningRequest) -> [String: Any] {
        let intent = request.request
        return [
            "schemaVersion": 2,
            "requestId": intent.id,
            "bundleId": intent.bundleId,
            "environment": request.context.environment.rawValue,
            "requestedByUserId": intent.requestedByUserId,
            "requestedAt": timestamp(for: intent.requestedAtMillis),
            "mode": "preview",
            "status": "requested",
            "expectedWriteEpoch": request.context.expectedWriteEpoch,
            "expectedActiveRevision": (request.context.expectedActiveRevision as Any?) ?? NSNull(),
            "subplans": [
                "delivery": ["targetSeasonStartYear": intent.deliveryTargetSeasonStartYear],
                "market": ["targetSeasonStartYear": intent.marketTargetSeasonStartYear]
            ],
            "binding": NSNull()
        ]
    }

    private static func integer(_ value: Any?) -> Int64? {
        if let value = value as? Int64 { return value }
        if let value = value as? Int { return Int64(value) }
        if let value = value as? NSNumber { return value.int64Value }
        return nil
    }

    private static func targetSeason(in subplans: [String: Any], type: String) -> Int? {
        guard let subplan = subplans[type] as? [String: Any],
              Set(subplan.keys) == ["targetSeasonStartYear"],
              let value = integer(subplan["targetSeasonStartYear"]),
              let year = Int(exactly: value),
              validSeasonRange.contains(year) else {
            return nil
        }
        return year
    }

    private static func timestamp(for millis: Int64) -> Timestamp {
        Timestamp(
            seconds: millis / 1_000,
            nanoseconds: Int32((millis % 1_000) * 1_000_000)
        )
    }
}

private let validSeasonRange = 2000...9998
