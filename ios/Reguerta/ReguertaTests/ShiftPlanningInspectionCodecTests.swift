import FirebaseFirestore
import Foundation
import Testing

@testable import Reguerta

@Suite(.timeLimit(.minutes(1)))
struct ShiftPlanningInspectionCodecTests {
    @Test func legacyRequestIsNotExposedAsV2Observation() throws {
        let observation = try ShiftPlanningInspectionCodec.observation(
            documentID: "legacy-request",
            data: ["type": "delivery", "status": "completed"]
        )

        #expect(observation == nil)
    }

    @Test func completedStageExposesExactSummaryAndCandidateReference() throws {
        let observation = try #require(
            try ShiftPlanningInspectionCodec.observation(
                documentID: "stage-request",
                data: completedStageRequest()
            )
        )

        #expect(observation.mode == .stage)
        #expect(observation.status == .completed)
        #expect(observation.completedSummary?.delivery.generatedShiftCount == 52)
        #expect(observation.candidateReference?.candidateId == "bundle-2026")
        #expect(observation.candidateReference?.candidateDigest == "candidate-digest")
    }

    @Test func candidateRejectsPositionCountDifferentFromManifest() throws {
        let reference = try #require(
            try ShiftPlanningInspectionCodec.observation(
                documentID: "stage-request",
                data: completedStageRequest()
            )?.candidateReference
        )

        #expect(throws: RepositoryError.invalidData(resource: "shiftPlanningCandidates.positions")) {
            try ShiftPlanningInspectionCodec.candidate(
                documentID: "bundle-2026",
                data: candidateHeader(positionDocumentCount: 2),
                positionDocuments: [("delivery-1", candidatePosition(id: "delivery-1"))],
                reference: reference
            )
        }
    }

    private func completedStageRequest() -> [String: Any] {
        [
            "schemaVersion": 2,
            "requestId": "stage-request",
            "bundleId": "bundle-2026",
            "environment": "develop",
            "requestedByUserId": "admin-1",
            "requestedAt": Timestamp(seconds: 1_800_000_000, nanoseconds: 0),
            "mode": "stage",
            "status": "completed",
            "lifecycle": [
                "state": "completed",
                "summary": [
                    "schemaVersion": 1,
                    "status": "completed",
                    "mode": "stage",
                    "bundleId": "bundle-2026",
                    "bundleRevision": "revision-1",
                    "bundleDigest": "bundle-digest",
                    "delivery": subplan(target: 2026, count: 52, seasons: [2026, 2027]),
                    "market": subplan(target: 2026, count: 12, seasons: [2026])
                ],
                "artifact": [
                    "kind": "candidate",
                    "candidateId": "bundle-2026",
                    "candidateDigest": "candidate-digest",
                    "bundleArtifactDigest": "artifact-digest"
                ]
            ]
        ]
    }

    private func subplan(target: Int, count: Int, seasons: [Int]) -> [String: Any] {
        [
            "targetSeasonStartYear": target,
            "generatedShiftCount": count,
            "affectedProjectionSeasonStartYears": seasons
        ]
    }

    private func candidateHeader(positionDocumentCount: Int) -> [String: Any] {
        [
            "schemaVersion": 1,
            "status": "staged",
            "environment": "develop",
            "bundleId": "bundle-2026",
            "bundleRevision": "revision-1",
            "bundleDigest": "bundle-digest",
            "candidateDigest": "candidate-digest",
            "candidate": [
                "candidateId": "bundle-2026",
                "positionManifest": [
                    "positionDocumentCount": positionDocumentCount,
                    "assignmentPositionCount": 2
                ]
            ]
        ]
    }

    private func candidatePosition(id: String) -> [String: Any] {
        [
            "schemaVersion": 1,
            "candidateId": "bundle-2026",
            "candidateDigest": "candidate-digest",
            "positionId": id,
            "position": [
                "positionId": id,
                "candidateId": "bundle-2026",
                "type": "delivery",
                "scheduledDate": "2026-09-02",
                "assignedUserIds": ["member-1"],
                "helperUserId": "member-2",
                "bundleRevision": "revision-1",
                "bundleDigest": "bundle-digest"
            ]
        ]
    }
}
