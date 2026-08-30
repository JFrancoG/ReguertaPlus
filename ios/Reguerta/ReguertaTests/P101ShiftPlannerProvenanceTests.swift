import FirebaseFirestore
import Foundation
import Testing

@testable import Reguerta

@MainActor
struct P101ShiftPlannerProvenanceTests {
    @Test func installedShiftReaderStaysOnThePublicFlatCollection() {
        let readerPath = FirestoreShiftRepository.collectionPath(environment: .develop)
        let candidatePath = ReguertaFirestorePath(environment: .develop).collectionPath(.shiftPlanningCandidates)

        #expect(readerPath == "develop/plus-collections/shifts")
        #expect(readerPath != candidatePath)
    }

    @Test func plannerProvenanceIsAdditiveAndKeepsAppSource() throws {
        let timestamp = Timestamp(date: Date(timeIntervalSince1970: 123))
        let plannerShift: [String: Any] = [
            "planningSchemaVersion": 1,
            "type": "delivery",
            "date": timestamp,
            "assignedUserIds": ["member_1"],
            "helperUserId": "member_2",
            "status": "planned",
            "source": "app",
            "origin": "planner",
            "planningRequestId": "bundle-2026",
            "bundleRevision": "bundle-v2-1234567890abcdef12345678",
            "bundleDigest": "shift-planning:v1:sha256:\(String(repeating: "a", count: 64))",
            "writeEpoch": 8,
            "projectionSeasonStartYear": 2026,
            "rotationOwnerUserId": "member_1",
            "rotationOwnerUserIds": NSNull(),
            "roundNumber": 2,
            "positionInRound": 4,
            "rotationPositions": NSNull(),
            "planningReason": "target",
            "assignmentRevision": 1,
            "completion": [
                "state": "uncompleted",
                "revision": 0,
                "actualHelperUserId": NSNull(),
                "helperSourceAssignmentRevision": NSNull(),
                "completedAt": NSNull()
            ],
            "documentRevision": 1,
            "lastBackendMutation": ["kind": "activation"],
            "createdAt": timestamp,
            "updatedAt": timestamp
        ]

        let decoded = try FirestoreShiftRepository.shift(
            documentID: "shift-delivery-1",
            data: plannerShift
        )

        #expect(decoded.id == "shift-delivery-1")
        #expect(decoded.source == "app")
        #expect(decoded.assignedUserIds == ["member_1"])
        #expect(decoded.helperUserId == "member_2")

        var invalidSource = plannerShift
        invalidSource["source"] = "planner"
        #expect(throws: RepositoryError.invalidData(resource: "shifts.document")) {
            try FirestoreShiftRepository.shift(documentID: "shift-delivery-1", data: invalidSource)
        }
    }
}
