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
        let normalizedIntent = try normalizedIntent(request.intent, requestID: normalizedID)
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
                marketTargetSeasonStartYear: request.marketTargetSeasonStartYear,
                intent: normalizedIntent
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
              data["mode"] as? String == mode(for: intent.intent),
              let statusValue = data["status"] as? String,
              ShiftPlanningRequestStatus(rawValue: statusValue) != nil,
              binding(data["binding"], matches: intent.intent),
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
            "mode": mode(for: intent.intent),
            "status": "requested",
            "expectedWriteEpoch": request.context.expectedWriteEpoch,
            "expectedActiveRevision": (request.context.expectedActiveRevision as Any?) ?? NSNull(),
            "subplans": [
                "delivery": ["targetSeasonStartYear": intent.deliveryTargetSeasonStartYear],
                "market": ["targetSeasonStartYear": intent.marketTargetSeasonStartYear]
            ],
            "binding": bindingData(for: intent.intent)
        ]
    }

    private static func normalizedIntent(
        _ intent: ShiftPlanningRequestIntent,
        requestID: String
    ) throws -> ShiftPlanningRequestIntent {
        switch intent {
        case .preview:
            return .preview
        case .stage(let preview):
            let sourceRequestID = preview.sourceRequestId.trimmingCharacters(in: .whitespacesAndNewlines)
            let bundleRevision = preview.bundleRevision.trimmingCharacters(in: .whitespacesAndNewlines)
            let bundleDigest = preview.bundleDigest.trimmingCharacters(in: .whitespacesAndNewlines)
            guard isValidShiftPlanningIdentifier(sourceRequestID),
                  sourceRequestID != requestID,
                  isValidShiftPlanningIdentifier(bundleRevision),
                  isValidShiftPlanningDigest(bundleDigest) else {
                throw RepositoryError.invalidData(resource: "shiftPlanningRequests.document")
            }
            return .stage(
                ShiftPlanningPreviewReference(
                    sourceRequestId: sourceRequestID,
                    bundleRevision: bundleRevision,
                    bundleDigest: bundleDigest
                )
            )
        }
    }

    private static func mode(for intent: ShiftPlanningRequestIntent) -> String {
        switch intent {
        case .preview: "preview"
        case .stage: "stage"
        }
    }

    private static func bindingData(for intent: ShiftPlanningRequestIntent) -> Any {
        switch intent {
        case .preview:
            NSNull()
        case .stage(let preview):
            [
                "kind": "preview",
                "sourceRequestId": preview.sourceRequestId,
                "bundleRevision": preview.bundleRevision,
                "bundleDigest": preview.bundleDigest
            ]
        }
    }

    private static func binding(_ value: Any?, matches intent: ShiftPlanningRequestIntent) -> Bool {
        switch intent {
        case .preview:
            return value is NSNull
        case .stage(let preview):
            guard let binding = value as? [String: Any],
                  Set(binding.keys) == ["kind", "sourceRequestId", "bundleRevision", "bundleDigest"] else {
                return false
            }
            return binding["kind"] as? String == "preview" &&
                binding["sourceRequestId"] as? String == preview.sourceRequestId &&
                binding["bundleRevision"] as? String == preview.bundleRevision &&
                binding["bundleDigest"] as? String == preview.bundleDigest
        }
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

private func isValidShiftPlanningDigest(_ value: String) -> Bool {
    value.wholeMatch(of: /^shift-planning:v1:sha256:[a-f0-9]{64}$/) != nil
}
