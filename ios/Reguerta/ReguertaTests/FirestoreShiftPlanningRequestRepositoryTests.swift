import FirebaseFirestore
import Foundation
import Testing

@testable import Reguerta

@MainActor
struct FirestoreShiftPlanningRequestRepositoryTests {
    @Test func createsOnlyWhenAbsentAndAcknowledgesCompatibleExistingState() throws {
        let request = planningRequest()

        #expect(
            try FirestoreShiftPlanningRequestRepository.transactionDecision(
                documentID: request.id,
                data: nil,
                requested: request
            ) == .create(request)
        )

        for status in [
            ShiftPlanningRequestStatus.requested,
            .processing,
            .completed,
            .failed
        ] {
            let existing = requestWithStatus(status, basedOn: request)
            #expect(
                try FirestoreShiftPlanningRequestRepository.transactionDecision(
                    documentID: request.id,
                    data: firestoreData(for: existing),
                    requested: request
                ) == .acknowledge(existing)
            )
        }
    }

    @Test func rejectsAnIncompatibleOrMalformedExistingRequest() {
        let request = planningRequest()
        let validData = firestoreData(for: requestWithStatus(.completed, basedOn: request))
        let invalidVariants: [[String: Any]] = [
            validData.merging(["type": "delivery"]) { _, replacement in replacement },
            validData.merging(["requestedByUserId": "admin_2"]) { _, replacement in replacement },
            validData.merging(
                ["requestedAt": Timestamp(seconds: 124, nanoseconds: 0)]
            ) { _, replacement in replacement },
            validData.merging(["status": "unknown"]) { _, replacement in replacement },
            validData.filter { $0.key != "requestedAt" }
        ]

        for data in invalidVariants {
            #expect(throws: RepositoryError.invalidData(resource: "shiftPlanningRequests.document")) {
                try FirestoreShiftPlanningRequestRepository.transactionDecision(
                    documentID: request.id,
                    data: data,
                    requested: request
                )
            }
        }

        for status in [
            ShiftPlanningRequestStatus.processing,
            .completed,
            .failed
        ] {
            let invalidIntent = requestWithStatus(status, basedOn: request)
            #expect(throws: RepositoryError.invalidData(resource: "shiftPlanningRequests.document")) {
                try FirestoreShiftPlanningRequestRepository.transactionDecision(
                    documentID: invalidIntent.id,
                    data: nil,
                    requested: invalidIntent
                )
            }
        }

        let blankIdentifier = ShiftPlanningRequest(
            id: " ",
            type: request.type,
            requestedByUserId: request.requestedByUserId,
            requestedAtMillis: request.requestedAtMillis,
            status: .requested
        )
        #expect(throws: RepositoryError.invalidData(resource: "shiftPlanningRequests.document")) {
            try FirestoreShiftPlanningRequestRepository.transactionDecision(
                documentID: blankIdentifier.id,
                data: nil,
                requested: blankIdentifier
            )
        }
    }

    @Test func usesAnOnlineCreateIfAbsentTransaction() throws {
        let sourceURL = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .appending(path: "Reguerta/Data/ShiftPlanningRequests/FirestoreShiftPlanningRequestRepository.swift")
        let source = try String(contentsOf: sourceURL, encoding: .utf8)

        #expect(source.contains("db.runTransaction"))
        #expect(source.contains("transaction.getDocument"))
        #expect(source.contains("transaction.setData"))
        #expect(source.contains("merge: true") == false)
        #expect(source.contains("document().documentID") == false)
    }

    private func planningRequest() -> ShiftPlanningRequest {
        ShiftPlanningRequest(
            id: "planning_1",
            type: .market,
            requestedByUserId: "admin_1",
            requestedAtMillis: 123_456,
            status: .requested
        )
    }

    private func requestWithStatus(
        _ status: ShiftPlanningRequestStatus,
        basedOn request: ShiftPlanningRequest
    ) -> ShiftPlanningRequest {
        ShiftPlanningRequest(
            id: request.id,
            type: request.type,
            requestedByUserId: request.requestedByUserId,
            requestedAtMillis: request.requestedAtMillis,
            status: status
        )
    }

    private func firestoreData(for request: ShiftPlanningRequest) -> [String: Any] {
        [
            "type": request.type.rawValue,
            "requestedByUserId": request.requestedByUserId,
            "requestedAt": Timestamp(
                seconds: request.requestedAtMillis / 1_000,
                nanoseconds: Int32((request.requestedAtMillis % 1_000) * 1_000_000)
            ),
            "status": request.status.rawValue
        ]
    }
}
