import Foundation

struct FirebaseShiftPlanningRequestContextResolver {
    let functionsClient: AuthenticatedFirebaseFunctionsClient

    func resolve(environment: SessionEnvironment) async throws -> ShiftPlanningRequestContext {
        do {
            let response = try await functionsClient.post(
                function: .resolveShiftPlanningRequestContext,
                body: ShiftPlanningRequestContextRequest(schemaVersion: 1, environment: environment),
                response: ShiftPlanningRequestContextResponse.self
            )
            guard response.ok,
                  response.schemaVersion == 1,
                  response.environment == environment,
                  response.expectedWriteEpoch >= 0,
                  response.expectedActiveRevision == nil ||
                    response.expectedActiveRevision.map(isValidShiftPlanningIdentifier) == true else {
                throw RepositoryError.invalidData(resource: "shiftPlanningRequests.context.response")
            }
            return ShiftPlanningRequestContext(
                environment: environment,
                expectedWriteEpoch: response.expectedWriteEpoch,
                expectedActiveRevision: response.expectedActiveRevision
            )
        } catch {
            throw mapShiftPlanningContextError(error)
        }
    }
}

func isValidShiftPlanningIdentifier(_ value: String) -> Bool {
    value.wholeMatch(of: /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/) != nil
}

private struct ShiftPlanningRequestContextRequest: Encodable {
    let schemaVersion: Int
    let environment: SessionEnvironment
}

private struct ShiftPlanningRequestContextResponse {
    let ok: Bool
    let schemaVersion: Int
    let environment: SessionEnvironment
    let expectedWriteEpoch: Int64
    let expectedActiveRevision: String?
}

extension ShiftPlanningRequestContextResponse: Decodable {
    init(from decoder: any Decoder) throws {
        let allFields = try decoder.container(keyedBy: ShiftPlanningRequestContextCodingKey.self)
        guard Set(allFields.allKeys.map(\.stringValue)) == Self.responseFields else {
            throw RepositoryError.invalidData(resource: "shiftPlanningRequests.context.response")
        }
        let fields = try decoder.container(keyedBy: CodingKeys.self)
        self.ok = try fields.decode(Bool.self, forKey: .ok)
        self.schemaVersion = try fields.decode(Int.self, forKey: .schemaVersion)
        self.environment = try fields.decode(SessionEnvironment.self, forKey: .environment)
        self.expectedWriteEpoch = try fields.decode(Int64.self, forKey: .expectedWriteEpoch)
        self.expectedActiveRevision = try fields.decodeIfPresent(String.self, forKey: .expectedActiveRevision)
    }

    private enum CodingKeys: String, CodingKey, CaseIterable {
        case ok
        case schemaVersion
        case environment
        case expectedWriteEpoch
        case expectedActiveRevision
    }

    private static let responseFields = Set(CodingKeys.allCases.map(\.rawValue))
}

private struct ShiftPlanningRequestContextCodingKey: CodingKey {
    let stringValue: String
    let intValue: Int?
}

extension ShiftPlanningRequestContextCodingKey {
    init?(stringValue: String) {
        self.stringValue = stringValue
        intValue = nil
    }

    init?(intValue: Int) {
        stringValue = String(intValue)
        self.intValue = intValue
    }
}

private func mapShiftPlanningContextError(_ error: any Error) -> any Error {
    if error is CancellationError { return error }
    if let repositoryError = error as? RepositoryError { return repositoryError }
    guard let functionError = error as? FirebaseFunctionClientError else {
        return RepositoryError.unknown(resource: "shiftPlanningRequests.context")
    }
    return mapShiftPlanningFunctionError(functionError)
}

private func mapShiftPlanningFunctionError(_ error: FirebaseFunctionClientError) -> any Error {
    switch error {
    case .cancelled:
        CancellationError()
    case .missingIDToken, .unauthorized, .forbidden:
        RepositoryError.permissionDenied(resource: "shiftPlanningRequests.context")
    case .conflict, .timeout, .transport:
        RepositoryError.unavailable(resource: "shiftPlanningRequests.context")
    case .http(let statusCode, _, _):
        mapShiftPlanningHTTPError(statusCode)
    case .invalidHTTPResponse, .invalidResponse:
        RepositoryError.invalidData(resource: "shiftPlanningRequests.context.response")
    case .invalidEndpoint:
        RepositoryError.unknown(resource: "shiftPlanningRequests.context")
    }
}

private func mapShiftPlanningHTTPError(_ statusCode: Int) -> RepositoryError {
    if statusCode == 400 { return .invalidData(resource: "shiftPlanningRequests.context") }
    if statusCode == 404 { return .notFound(resource: "shiftPlanningRequests.context") }
    if statusCode == 408 || statusCode == 429 || statusCode >= 500 {
        return .unavailable(resource: "shiftPlanningRequests.context")
    }
    return .unknown(resource: "shiftPlanningRequests.context")
}
