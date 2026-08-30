import Foundation

@MainActor
struct FirebaseShiftNotificationDetailRepository: ShiftNotificationDetailRepository {
    private let storedFunctionsClient: AuthenticatedFirebaseFunctionsClient

    func currentDetail(
        eventID: String,
        memberID: String,
        environment: SessionEnvironment
    ) async throws -> ShiftNotificationDetail {
        let normalizedEventID = eventID.trimmingCharacters(in: .whitespacesAndNewlines)
        let normalizedMemberID = memberID.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalizedEventID.isEmpty, !normalizedMemberID.isEmpty else { throw Self.invalidData }

        let response: ShiftNotificationDetailResponse
        do {
            response = try await storedFunctionsClient.post(
                function: .resolveShiftNotificationDetail,
                body: ShiftNotificationDetailRequest(environment: environment, eventId: normalizedEventID),
                response: ShiftNotificationDetailResponse.self
            )
        } catch {
            throw Self.map(error)
        }

        return try response.detail(expectedEventID: normalizedEventID, expectedMemberID: normalizedMemberID)
    }

    nonisolated fileprivate static var invalidData: RepositoryError {
        RepositoryError.invalidData(resource: "notifications.shiftDetail.response")
    }

    private static func map(_ error: any Error) -> any Error {
        if error is CancellationError { return error }
        guard let clientError = error as? FirebaseFunctionClientError else {
            return RepositoryError.unknown(resource: "notifications.shiftDetail")
        }
        switch clientError {
        case .cancelled:
            return CancellationError()
        case .unauthorized, .forbidden, .missingIDToken:
            return RepositoryError.permissionDenied(resource: "notifications.shiftDetail")
        case .http(let statusCode, _, _) where statusCode == 404:
            return RepositoryError.notFound(resource: "notifications.shiftDetail")
        case .timeout, .transport:
            return RepositoryError.unavailable(resource: "notifications.shiftDetail")
        case .http(let statusCode, _, _) where statusCode == 408 || statusCode == 429 || statusCode >= 500:
            return RepositoryError.unavailable(resource: "notifications.shiftDetail")
        case .invalidResponse:
            return invalidData
        case .invalidEndpoint, .conflict, .http, .invalidHTTPResponse:
            return RepositoryError.unknown(resource: "notifications.shiftDetail")
        }
    }
}

extension FirebaseShiftNotificationDetailRepository {
    init(functionsClient: AuthenticatedFirebaseFunctionsClient) {
        storedFunctionsClient = functionsClient
    }
}

nonisolated private struct ShiftNotificationDetailRequest: Encodable {
    let environment: SessionEnvironment
    let eventId: String
}

nonisolated private struct ShiftNotificationDetailResponse {
    let schemaVersion: Int64
    let eventId: String
    let assignmentRevision: Int64
    let documentRevision: Int64
    let shift: ShiftNotificationDetailShiftResponse

    func detail(expectedEventID: String, expectedMemberID: String) throws -> ShiftNotificationDetail {
        guard schemaVersion == 1,
              eventId == expectedEventID,
              assignmentRevision > 0,
              documentRevision > 0,
              assignmentRevision <= documentRevision else {
            throw FirebaseShiftNotificationDetailRepository.invalidData
        }
        return try ShiftNotificationDetail(
            eventID: eventId,
            assignmentRevision: assignmentRevision,
            documentRevision: documentRevision,
            shift: shift.assignment(expectedMemberID: expectedMemberID)
        )
    }
}

extension ShiftNotificationDetailResponse: Decodable {
    init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: ShiftNotificationDetailCodingKey.self)
        try container.requireExactKeys([
            "schemaVersion", "eventId", "assignmentRevision", "documentRevision", "shift"
        ])
        schemaVersion = try container.decode(Int64.self, forKey: .key("schemaVersion"))
        eventId = try container.decode(String.self, forKey: .key("eventId"))
        assignmentRevision = try container.decode(Int64.self, forKey: .key("assignmentRevision"))
        documentRevision = try container.decode(Int64.self, forKey: .key("documentRevision"))
        shift = try container.decode(ShiftNotificationDetailShiftResponse.self, forKey: .key("shift"))
    }
}

nonisolated private struct ShiftNotificationDetailShiftResponse {
    let id: String
    let type: ShiftType
    let dateMillis: Int64
    let assignedUserIds: [String]
    let helperUserId: String?
    let status: ShiftStatus
    let source: String
    let createdAtMillis: Int64
    let updatedAtMillis: Int64

    func assignment(expectedMemberID: String) throws -> ShiftAssignment {
        let normalizedID = id.trimmingCharacters(in: .whitespacesAndNewlines)
        let normalizedAssignedIDs = assignedUserIds.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
        let expectedCount = type == .delivery ? 1 : 3
        guard !normalizedID.isEmpty,
              normalizedAssignedIDs.count == expectedCount,
              normalizedAssignedIDs.allSatisfy({ !$0.isEmpty }),
              Set(normalizedAssignedIDs).count == normalizedAssignedIDs.count,
              normalizedAssignedIDs.contains(expectedMemberID),
              source == "app",
              updatedAtMillis >= createdAtMillis else {
            throw FirebaseShiftNotificationDetailRepository.invalidData
        }
        let normalizedHelperID = helperUserId?.trimmingCharacters(in: .whitespacesAndNewlines)
        guard (type == .delivery && normalizedHelperID?.isEmpty == false) ||
                (type == .market && helperUserId == nil) else {
            throw FirebaseShiftNotificationDetailRepository.invalidData
        }
        return ShiftAssignment(
            id: normalizedID,
            type: type,
            dateMillis: dateMillis,
            assignedUserIds: normalizedAssignedIDs,
            helperUserId: normalizedHelperID,
            status: status,
            source: source,
            createdAtMillis: createdAtMillis,
            updatedAtMillis: updatedAtMillis
        )
    }
}

extension ShiftNotificationDetailShiftResponse: Decodable {
    init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: ShiftNotificationDetailCodingKey.self)
        try container.requireExactKeys([
            "id", "type", "dateMillis", "assignedUserIds", "helperUserId", "status", "source",
            "createdAtMillis", "updatedAtMillis"
        ])
        id = try container.decode(String.self, forKey: .key("id"))
        let rawType = try container.decode(String.self, forKey: .key("type"))
        guard let type = ShiftType(rawValue: rawType) else {
            throw FirebaseShiftNotificationDetailRepository.invalidData
        }
        self.type = type
        dateMillis = try container.decode(Int64.self, forKey: .key("dateMillis"))
        assignedUserIds = try container.decode([String].self, forKey: .key("assignedUserIds"))
        helperUserId = try container.decodeIfPresent(String.self, forKey: .key("helperUserId"))
        let rawStatus = try container.decode(String.self, forKey: .key("status"))
        guard let status = ShiftStatus(rawValue: rawStatus) else {
            throw FirebaseShiftNotificationDetailRepository.invalidData
        }
        self.status = status
        source = try container.decode(String.self, forKey: .key("source"))
        createdAtMillis = try container.decode(Int64.self, forKey: .key("createdAtMillis"))
        updatedAtMillis = try container.decode(Int64.self, forKey: .key("updatedAtMillis"))
    }
}

nonisolated private struct ShiftNotificationDetailCodingKey: CodingKey, Hashable {
    let stringValue: String
    let intValue: Int?

    static func key(_ value: String) -> ShiftNotificationDetailCodingKey {
        ShiftNotificationDetailCodingKey(stringValue: value, intValue: nil)
    }
}

extension ShiftNotificationDetailCodingKey {
    init?(stringValue: String) {
        self.stringValue = stringValue
        intValue = nil
    }

    init?(intValue: Int) {
        stringValue = String(intValue)
        self.intValue = intValue
    }

}

nonisolated private extension KeyedDecodingContainer where Key == ShiftNotificationDetailCodingKey {
    func requireExactKeys(_ expected: Set<String>) throws {
        guard Set(allKeys.map(\.stringValue)) == expected else {
            throw FirebaseShiftNotificationDetailRepository.invalidData
        }
    }
}
