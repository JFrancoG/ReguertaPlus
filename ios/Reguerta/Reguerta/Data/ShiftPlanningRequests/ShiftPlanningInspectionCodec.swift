import FirebaseFirestore
import Foundation

enum ShiftPlanningInspectionCodec {
    static func observation(
        documentID: String,
        data: [String: Any]
    ) throws -> ShiftPlanningRequestObservation? {
        guard integer(data["schemaVersion"]) == 2 else { return nil }
        let requestID = try string(data, "requestId", resource: "shiftPlanningRequests.document")
        guard requestID == documentID else {
            throw RepositoryError.invalidData(resource: "shiftPlanningRequests.document")
        }
        guard let mode = ShiftPlanningMode(rawValue: try string(data, "mode")) else {
            throw RepositoryError.invalidData(resource: "shiftPlanningRequests.mode")
        }
        guard let status = ShiftPlanningRequestStatus(rawValue: try string(data, "status")) else {
            throw RepositoryError.invalidData(resource: "shiftPlanningRequests.status")
        }
        guard let environment = SessionEnvironment(rawValue: try string(data, "environment")) else {
            throw RepositoryError.invalidData(resource: "shiftPlanningRequests.environment")
        }
        let lifecycle = data["lifecycle"] as? [String: Any]
        if status == .requested, lifecycle != nil {
            throw RepositoryError.invalidData(resource: "shiftPlanningRequests.lifecycle")
        }
        if status != .requested,
           try string(lifecycle, "state", resource: "shiftPlanningRequests.lifecycle") != status.rawValue {
            throw RepositoryError.invalidData(resource: "shiftPlanningRequests.lifecycle")
        }
        let summary = lifecycle?["summary"] as? [String: Any]
        let bundleID = try string(data, "bundleId")
        let completedSummary = status == .completed
            ? try completedSummary(summary, mode: mode, bundleID: bundleID)
            : nil
        let failure = status == .failed ? try failure(summary, mode: mode, bundleID: bundleID) : nil
        let artifact = lifecycle?["artifact"] as? [String: Any]
        let candidateReference = try candidateReference(
            artifact: artifact,
            binding: data["binding"] as? [String: Any],
            summary: summary,
            completedSummary: completedSummary,
            environment: environment
        )
        guard let requestedAt = data["requestedAt"] as? Timestamp else {
            throw RepositoryError.invalidData(resource: "shiftPlanningRequests.requestedAt")
        }
        return ShiftPlanningRequestObservation(
            id: requestID,
            bundleId: bundleID,
            requestedByUserId: try string(data, "requestedByUserId"),
            requestedAtMillis: requestedAt.seconds * 1_000 + Int64(requestedAt.nanoseconds / 1_000_000),
            mode: mode,
            status: status,
            completedSummary: completedSummary,
            failure: failure,
            candidateReference: candidateReference
        )
    }

    static func candidate(
        documentID: String,
        data: [String: Any],
        positionDocuments: [(id: String, data: [String: Any])],
        reference: ShiftPlanningCandidateReference
    ) throws -> ShiftPlanningCandidate {
        guard integer(data["schemaVersion"]) == 1,
              try string(data, "status") == "staged",
              documentID == reference.candidateId,
              try string(data, "bundleId") == reference.candidateId,
              try string(data, "environment") == reference.environment.rawValue,
              try string(data, "bundleRevision") == reference.bundleRevision,
              try string(data, "bundleDigest") == reference.bundleDigest,
              try string(data, "candidateDigest") == reference.candidateDigest else {
            throw RepositoryError.invalidData(resource: "shiftPlanningCandidates.document")
        }
        guard let candidate = data["candidate"] as? [String: Any],
              try string(candidate, "candidateId") == reference.candidateId,
              let manifest = candidate["positionManifest"] as? [String: Any] else {
            throw RepositoryError.invalidData(resource: "shiftPlanningCandidates.candidate")
        }
        let positionDocumentCount = try nonNegativeInteger(manifest, "positionDocumentCount")
        let assignmentPositionCount = try nonNegativeInteger(manifest, "assignmentPositionCount")
        guard positionDocuments.count == positionDocumentCount,
              Set(positionDocuments.map(\.id)).count == positionDocumentCount else {
            throw RepositoryError.invalidData(resource: "shiftPlanningCandidates.positions")
        }
        let decodedPositions: [ShiftPlanningCandidatePosition] = try positionDocuments.map { document in
            try position(documentID: document.id, data: document.data, reference: reference)
        }
        let positions = decodedPositions.sorted { lhs, rhs in
            lhs.scheduledDate == rhs.scheduledDate ? lhs.id < rhs.id : lhs.scheduledDate < rhs.scheduledDate
        }
        guard positions.reduce(0, { $0 + $1.assignedUserIds.count }) == assignmentPositionCount else {
            throw RepositoryError.invalidData(resource: "shiftPlanningCandidates.assignmentPositions")
        }
        return ShiftPlanningCandidate(
            id: documentID,
            bundleRevision: reference.bundleRevision,
            bundleDigest: reference.bundleDigest,
            candidateDigest: reference.candidateDigest,
            positionDocumentCount: positionDocumentCount,
            assignmentPositionCount: assignmentPositionCount,
            positions: positions
        )
    }

    private static func candidateReference(
        artifact: [String: Any]?,
        binding: [String: Any]?,
        summary: [String: Any]?,
        completedSummary: ShiftPlanningCompletedSummary?,
        environment: SessionEnvironment
    ) throws -> ShiftPlanningCandidateReference? {
        guard let artifact else { return nil }
        guard try string(artifact, "kind") == "candidate" else { return nil }
        let lineage = completedSummary == nil ? binding : summary
        guard let lineage else {
            throw RepositoryError.invalidData(resource: "shiftPlanningRequests.candidateReference")
        }
        return ShiftPlanningCandidateReference(
            candidateId: try string(artifact, "candidateId"),
            candidateDigest: try string(artifact, "candidateDigest"),
            bundleRevision: try string(lineage, "bundleRevision"),
            bundleDigest: try string(lineage, "bundleDigest"),
            environment: environment
        )
    }

    private static func completedSummary(
        _ summary: [String: Any]?,
        mode: ShiftPlanningMode,
        bundleID: String
    ) throws -> ShiftPlanningCompletedSummary {
        guard let summary,
              integer(summary["schemaVersion"]) == 1,
              try string(summary, "status") == "completed",
              try string(summary, "mode") == mode.rawValue,
              try string(summary, "bundleId") == bundleID else {
            throw RepositoryError.invalidData(resource: "shiftPlanningRequests.summary")
        }
        return ShiftPlanningCompletedSummary(
            bundleRevision: try string(summary, "bundleRevision"),
            bundleDigest: try string(summary, "bundleDigest"),
            delivery: try subplan(summary["delivery"] as? [String: Any]),
            market: try subplan(summary["market"] as? [String: Any])
        )
    }

    private static func subplan(_ value: [String: Any]?) throws -> ShiftPlanningSubplanSummary {
        guard let value,
              let seasonValues = value["affectedProjectionSeasonStartYears"] as? [Any] else {
            throw RepositoryError.invalidData(resource: "shiftPlanningRequests.subplan")
        }
        let seasons = try seasonValues.map { value in
            guard let season = integer(value), season >= 0 else {
                throw RepositoryError.invalidData(resource: "shiftPlanningRequests.seasons")
            }
            return season
        }
        return ShiftPlanningSubplanSummary(
            targetSeasonStartYear: try nonNegativeInteger(value, "targetSeasonStartYear"),
            generatedShiftCount: try nonNegativeInteger(value, "generatedShiftCount"),
            affectedProjectionSeasonStartYears: seasons
        )
    }

    private static func failure(
        _ summary: [String: Any]?,
        mode: ShiftPlanningMode,
        bundleID: String
    ) throws -> ShiftPlanningFailure {
        guard let summary,
              integer(summary["schemaVersion"]) == 1,
              try string(summary, "status") == "failed",
              try string(summary, "mode") == mode.rawValue,
              try string(summary, "bundleId") == bundleID,
              let failure = summary["failure"] as? [String: Any] else {
            throw RepositoryError.invalidData(resource: "shiftPlanningRequests.summary")
        }
        return ShiftPlanningFailure(
            scope: try string(failure, "scope"),
            code: try string(failure, "code"),
            messageKey: try string(failure, "messageKey")
        )
    }

    private static func position(
        documentID: String,
        data: [String: Any],
        reference: ShiftPlanningCandidateReference
    ) throws -> ShiftPlanningCandidatePosition {
        guard let position = data["position"] as? [String: Any],
              integer(data["schemaVersion"]) == 1,
              try string(data, "candidateId") == reference.candidateId,
              try string(data, "candidateDigest") == reference.candidateDigest,
              try string(data, "positionId") == documentID,
              try string(position, "positionId") == documentID,
              try string(position, "candidateId") == reference.candidateId,
              try string(position, "bundleRevision") == reference.bundleRevision,
              try string(position, "bundleDigest") == reference.bundleDigest,
              let type = ShiftPlanningRequestType(rawValue: try string(position, "type")),
              let assignees = position["assignedUserIds"] as? [String],
              !assignees.isEmpty,
              assignees.allSatisfy({ !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }) else {
            throw RepositoryError.invalidData(resource: "shiftPlanningCandidates.position")
        }
        let helperUserID: String?
        if let helper = position["helperUserId"] {
            guard let string = helper as? String,
                  !string.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
                throw RepositoryError.invalidData(resource: "shiftPlanningCandidates.position.helper")
            }
            helperUserID = string
        } else {
            helperUserID = nil
        }
        return ShiftPlanningCandidatePosition(
            id: documentID,
            type: type,
            scheduledDate: try string(position, "scheduledDate"),
            assignedUserIds: assignees,
            helperUserId: helperUserID
        )
    }

    private static func string(
        _ data: [String: Any]?,
        _ field: String,
        resource: String? = nil
    ) throws -> String {
        let resolvedResource = resource ?? "shiftPlanning.\(field)"
        guard let value = data?[field] as? String else {
            throw RepositoryError.invalidData(resource: resolvedResource)
        }
        let normalized = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalized.isEmpty else { throw RepositoryError.invalidData(resource: resolvedResource) }
        return normalized
    }

    private static func nonNegativeInteger(_ data: [String: Any], _ field: String) throws -> Int {
        guard let value = integer(data[field]), value >= 0 else {
            throw RepositoryError.invalidData(resource: "shiftPlanning.\(field)")
        }
        return value
    }

    private static func integer(_ value: Any?) -> Int? {
        switch value {
        case is Bool:
            nil
        case let value as Int:
            value
        case let value as Int64 where value >= Int64(Int.min) && value <= Int64(Int.max):
            Int(value)
        case let value as NSNumber:
            value.intValue
        default:
            nil
        }
    }
}
