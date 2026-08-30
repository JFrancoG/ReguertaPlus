import FirebaseCore
import FirebaseFirestore
import Foundation

actor FirestoreDeliveryCalendarRepository: DeliveryCalendarRepository {
    private let storedDB: Firestore
    private let functionsClient: AuthenticatedFirebaseFunctionsClient
    private let operationIDProvider: @Sendable () -> String

    init(
        firebaseAppName: String,
        functionsClient: AuthenticatedFirebaseFunctionsClient,
        operationIDProvider: @escaping @Sendable () -> String = { UUID().uuidString.lowercased() }
    ) {
        guard let app = FirebaseApp.app(name: firebaseAppName) else {
            preconditionFailure("Firebase app is required for delivery calendar")
        }
        self.storedDB = Firestore.firestore(app: app)
        self.functionsClient = functionsClient
        self.operationIDProvider = operationIDProvider
    }

    func defaultDeliveryDayOfWeek(environment: SessionEnvironment) async throws -> DeliveryWeekday {
        let path = ReguertaFirestorePath(environment: environment)
        let candidatePaths = [
            path.documentPath(in: .config, documentId: ReguertaFirestoreDocument.memberConfiguration.rawValue),
            path.documentPath(in: .config, documentId: ReguertaFirestoreDocument.global.rawValue)
        ]

        for documentPath in candidatePaths {
            do {
                try Task.checkCancellation()
                let snapshot = try await storedDB.document(documentPath).getDocument(source: .server)
                guard snapshot.exists else { continue }
                guard let data = snapshot.data() else { throw Self.invalidConfigurationError }
                return try Self.deliveryWeekday(data: data)
            } catch {
                throw FirestoreRepositoryErrorMapper.map(error, resource: "config.deliveryCalendar")
            }
        }
        throw RepositoryError.notFound(resource: "config.deliveryCalendar")
    }

    func allOverrides(environment: SessionEnvironment) async throws -> [DeliveryCalendarOverride] {
        let path = ReguertaFirestorePath(environment: environment)
        do {
            try Task.checkCancellation()
            let collection = storedDB.collection(path.collectionPath(.deliveryCalendar))
            let snapshot = try await collection.getDocuments(source: .server)
            return try snapshot.documents
                .map { document in
                    try Self.deliveryOverride(documentID: document.documentID, data: document.data())
                }
                .sorted { $0.weekKey < $1.weekKey }
        } catch {
            throw FirestoreRepositoryErrorMapper.map(error, resource: "deliveryCalendar")
        }
    }

    func upsertOverride(
        _ override: DeliveryCalendarOverride,
        environment: SessionEnvironment
    ) async throws -> DeliveryCalendarOverride {
        let weekday = try Self.deliveryWeekday(for: override.deliveryDateMillis)
        let result = try await transition(
            action: .upsert,
            weekKey: override.weekKey,
            deliveryWeekday: weekday,
            environment: environment
        )
        guard let persisted = result.override?.domainValue else { throw Self.invalidMutationResponse }
        return persisted
    }

    func deleteOverride(weekKey: String, environment: SessionEnvironment) async throws {
        let result = try await transition(
            action: .delete,
            weekKey: weekKey,
            deliveryWeekday: nil,
            environment: environment
        )
        guard result.override == nil else { throw Self.invalidMutationResponse }
    }

    private func transition(
        action: DeliveryCalendarMutationAction,
        weekKey: String,
        deliveryWeekday: DeliveryWeekday?,
        environment: SessionEnvironment
    ) async throws -> DeliveryCalendarMutationResponse {
        let normalizedWeekKey = weekKey.trimmingCharacters(in: .whitespacesAndNewlines)
        let operationID = operationIDProvider().trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalizedWeekKey.isEmpty, !operationID.isEmpty else { throw Self.invalidMutationResponse }
        do {
            try Task.checkCancellation()
            let context = try await functionsClient.post(
                function: .resolveDeliveryCalendarMutationContext,
                body: DeliveryCalendarMutationContextRequest(
                    schemaVersion: 1,
                    environment: environment,
                    weekKey: normalizedWeekKey
                ),
                response: DeliveryCalendarMutationContextResponse.self
            )
            try Self.validate(
                context,
                expectedEnvironment: environment,
                expectedWeekKey: normalizedWeekKey
            )
            let request = DeliveryCalendarMutationRequest(
                schemaVersion: 1,
                environment: environment,
                operationId: operationID,
                action: action,
                weekKey: normalizedWeekKey,
                expectedPlanningAuthority: context.planningAuthority,
                expectedOverrideDigest: context.overrideDigest,
                deliveryWeekday: deliveryWeekday
            )
            let response = try await functionsClient.post(
                function: .transitionDeliveryCalendarOverride,
                body: request,
                response: DeliveryCalendarMutationResponse.self
            )
            try Self.validate(response, expectedRequest: request)
            return response
        } catch {
            throw Self.mapMutationError(error)
        }
    }

    static func deliveryOverride(documentID: String, data: [String: Any]) throws -> DeliveryCalendarOverride {
        guard let weekKey = requiredString(data["weekKey"]),
              weekKey == documentID,
              let deliveryDate = data["deliveryDate"] as? Timestamp,
              let ordersBlockedDate = data["ordersBlockedDate"] as? Timestamp,
              let ordersOpenAt = data["ordersOpenAt"] as? Timestamp,
              let ordersCloseAt = data["ordersCloseAt"] as? Timestamp,
              let updatedBy = requiredString(data["updatedBy"]),
              let updatedAt = data["updatedAt"] as? Timestamp else {
            throw invalidDocumentError
        }

        return DeliveryCalendarOverride(
            weekKey: weekKey,
            deliveryDateMillis: millis(deliveryDate),
            ordersBlockedDateMillis: millis(ordersBlockedDate),
            ordersOpenAtMillis: millis(ordersOpenAt),
            ordersCloseAtMillis: millis(ordersCloseAt),
            updatedBy: updatedBy,
            updatedAtMillis: millis(updatedAt)
        )
    }

    static func deliveryWeekday(data: [String: Any]) throws -> DeliveryWeekday {
        for key in ["deliveryDayOfWeek", "deliveryDateOfWeek"] where data[key] != nil {
            return try weekday(from: data[key])
        }
        if let rawOtherConfig = data["otherConfig"] {
            guard let otherConfig = rawOtherConfig as? [String: Any] else { throw invalidConfigurationError }
            for key in ["deliveryDayOfWeek", "deliveryDateOfWeek"] where otherConfig[key] != nil {
                return try weekday(from: otherConfig[key])
            }
        }
        throw invalidConfigurationError
    }

    private static func weekday(from value: Any?) throws -> DeliveryWeekday {
        guard let rawValue = requiredString(value)?.uppercased(),
              let weekday = DeliveryWeekday(rawValue: rawValue) else {
            throw invalidConfigurationError
        }
        return weekday
    }

    private static func requiredString(_ value: Any?) -> String? {
        guard let value = value as? String else { return nil }
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }

    private static func millis(_ timestamp: Timestamp) -> Int64 {
        Int64(timestamp.dateValue().timeIntervalSince1970 * 1_000)
    }

    private static func deliveryWeekday(for deliveryDateMillis: Int64) throws -> DeliveryWeekday {
        var calendar = Calendar(identifier: .gregorian)
        guard let madridTimeZone = TimeZone(identifier: "Europe/Madrid") else { throw invalidMutationResponse }
        calendar.timeZone = madridTimeZone
        let date = Date(timeIntervalSince1970: TimeInterval(deliveryDateMillis) / 1_000)
        let weekday: DeliveryWeekday? = switch calendar.component(.weekday, from: date) {
        case 3: .tuesday
        case 5: .thursday
        case 6: .friday
        default: nil
        }
        guard let weekday else { throw invalidMutationResponse }
        return weekday
    }

    private static func validate(
        _ context: DeliveryCalendarMutationContextResponse,
        expectedEnvironment: SessionEnvironment,
        expectedWeekKey: String
    ) throws {
        guard context.ok,
              context.schemaVersion == 1,
              context.environment == expectedEnvironment,
              context.weekKey == expectedWeekKey,
              context.planningAuthority.isValid,
              isValidCalendarDigest(context.overrideDigest) else {
            throw invalidMutationResponse
        }
    }

    private static func validate(
        _ response: DeliveryCalendarMutationResponse,
        expectedRequest: DeliveryCalendarMutationRequest
    ) throws {
        guard response.ok,
              response.schemaVersion == 1,
              response.environment == expectedRequest.environment,
              response.operationId == expectedRequest.operationId,
              response.action == expectedRequest.action,
              response.weekKey == expectedRequest.weekKey,
              response.planningAuthority == expectedRequest.expectedPlanningAuthority,
              response.priorOverrideDigest == expectedRequest.expectedOverrideDigest,
              isValidCalendarDigest(response.commandDigest),
              isValidCalendarDigest(response.overrideDigest),
              (response.override == nil) == (response.overrideDigest == nil),
              (response.action == .upsert) == (response.override != nil),
              response.override?.weekKey == nil || response.override?.weekKey == expectedRequest.weekKey,
              response.override?.isValid != false else {
            throw invalidMutationResponse
        }
    }

    private static func isValidCalendarDigest(_ value: String?) -> Bool {
        guard let value else { return true }
        return value.wholeMatch(of: /^delivery-calendar:v1:sha256:[a-f0-9]{64}$/) != nil
    }

    private static func mapMutationError(_ error: any Error) -> any Error {
        if error is CancellationError { return error }
        if let repositoryError = error as? RepositoryError { return repositoryError }
        guard let functionError = error as? FirebaseFunctionClientError else {
            return RepositoryError.unknown(resource: "deliveryCalendar.mutation")
        }
        return mapMutationFunctionError(functionError)
    }

    private static func mapMutationFunctionError(_ error: FirebaseFunctionClientError) -> any Error {
        switch error {
        case .cancelled:
            return CancellationError()
        case .missingIDToken, .unauthorized, .forbidden:
            return RepositoryError.permissionDenied(resource: "deliveryCalendar.mutation")
        case .conflict, .timeout, .transport:
            return RepositoryError.unavailable(resource: "deliveryCalendar.mutation")
        case .http(let statusCode, _, _):
            return mapMutationHTTPError(statusCode: statusCode)
        case .invalidHTTPResponse, .invalidResponse:
            return invalidMutationResponse
        case .invalidEndpoint:
            return RepositoryError.unknown(resource: "deliveryCalendar.mutation")
        }
    }

    private static func mapMutationHTTPError(statusCode: Int) -> RepositoryError {
        if statusCode == 400 { return .invalidData(resource: "deliveryCalendar.mutation") }
        if statusCode == 404 { return .notFound(resource: "deliveryCalendar.mutation") }
        if statusCode == 408 || statusCode == 429 || statusCode >= 500 {
            return .unavailable(resource: "deliveryCalendar.mutation")
        }
        return .unknown(resource: "deliveryCalendar.mutation")
    }

    private static var invalidDocumentError: RepositoryError {
        .invalidData(resource: "deliveryCalendar.document")
    }

    private static var invalidConfigurationError: RepositoryError {
        .invalidData(resource: "config.deliveryCalendar")
    }

    private static var invalidMutationResponse: RepositoryError {
        .invalidData(resource: "deliveryCalendar.mutation.response")
    }
}

nonisolated private enum DeliveryCalendarMutationAction: String, Codable {
    case upsert
    case delete
}

nonisolated private struct DeliveryCalendarPlanningAuthority: Codable, Equatable {
    let schemaVersion: Int
    let stateRevision: Int64
    let writeEpoch: Int64
    let activeRevision: String?
    let activeDigest: String?

    var isValid: Bool {
        let normalizedRevision = activeRevision?.trimmingCharacters(in: .whitespacesAndNewlines)
        return schemaVersion == 1 &&
            stateRevision >= 0 &&
            writeEpoch >= 0 &&
            ((normalizedRevision == nil) == (activeDigest == nil)) &&
            (normalizedRevision == nil || normalizedRevision?.isEmpty == false) &&
            (activeDigest == nil || activeDigest?.wholeMatch(of: /^shift-planning:v1:sha256:[a-f0-9]{64}$/) != nil)
    }
}

nonisolated private struct DeliveryCalendarMutationContextRequest: Encodable {
    let schemaVersion: Int
    let environment: SessionEnvironment
    let weekKey: String
}

nonisolated private struct DeliveryCalendarMutationContextResponse: Decodable {
    let ok: Bool
    let schemaVersion: Int
    let environment: SessionEnvironment
    let weekKey: String
    let planningAuthority: DeliveryCalendarPlanningAuthority
    let overrideDigest: String?
}

nonisolated private struct DeliveryCalendarMutationRequest {
    let schemaVersion: Int
    let environment: SessionEnvironment
    let operationId: String
    let action: DeliveryCalendarMutationAction
    let weekKey: String
    let expectedPlanningAuthority: DeliveryCalendarPlanningAuthority
    let expectedOverrideDigest: String?
    let deliveryWeekday: DeliveryWeekday?
}

extension DeliveryCalendarMutationRequest: Encodable {
    private enum CodingKeys: String, CodingKey {
        case schemaVersion
        case environment
        case operationId
        case action
        case weekKey
        case expectedPlanningAuthority
        case expectedOverrideDigest
        case deliveryWeekday
    }

    func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(schemaVersion, forKey: .schemaVersion)
        try container.encode(environment, forKey: .environment)
        try container.encode(operationId, forKey: .operationId)
        try container.encode(action, forKey: .action)
        try container.encode(weekKey, forKey: .weekKey)
        try container.encode(expectedPlanningAuthority, forKey: .expectedPlanningAuthority)
        if let expectedOverrideDigest {
            try container.encode(expectedOverrideDigest, forKey: .expectedOverrideDigest)
        } else {
            try container.encodeNil(forKey: .expectedOverrideDigest)
        }
        try container.encodeIfPresent(deliveryWeekday?.rawValue, forKey: .deliveryWeekday)
    }
}

nonisolated private struct DeliveryCalendarMutationResponse: Decodable {
    let ok: Bool
    let schemaVersion: Int
    let environment: SessionEnvironment
    let operationId: String
    let action: DeliveryCalendarMutationAction
    let weekKey: String
    let commandDigest: String
    let planningAuthority: DeliveryCalendarPlanningAuthority
    let priorOverrideDigest: String?
    let overrideDigest: String?
    let override: DeliveryCalendarOverrideResponse?
    let replayed: Bool
}

nonisolated private struct DeliveryCalendarOverrideResponse: Decodable {
    let weekKey: String
    let deliveryDateMillis: Int64
    let ordersBlockedDateMillis: Int64
    let ordersOpenAtMillis: Int64
    let ordersCloseAtMillis: Int64
    let updatedBy: String
    let updatedAtMillis: Int64

    var isValid: Bool {
        !weekKey.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
            deliveryDateMillis >= 0 &&
            ordersBlockedDateMillis >= 0 &&
            ordersOpenAtMillis >= 0 &&
            ordersCloseAtMillis >= 0 &&
            !updatedBy.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
            updatedAtMillis >= 0
    }

    var domainValue: DeliveryCalendarOverride {
        DeliveryCalendarOverride(
            weekKey: weekKey,
            deliveryDateMillis: deliveryDateMillis,
            ordersBlockedDateMillis: ordersBlockedDateMillis,
            ordersOpenAtMillis: ordersOpenAtMillis,
            ordersCloseAtMillis: ordersCloseAtMillis,
            updatedBy: updatedBy,
            updatedAtMillis: updatedAtMillis
        )
    }
}
