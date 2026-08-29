import Foundation

nonisolated enum FirebaseFunctionEndpoint: String, Sendable {
    case resolveAuthorizedMember
    case resolveShiftNotificationDetail
    case resolveDeliveryCalendarMutationContext
    case resolveShiftPlanningRequestContext
    case transitionDeliveryCalendarOverride
    case upsertMemberByAdmin
    case transitionShiftSwap
}

nonisolated struct FirebaseFunctionErrorPayload: Codable, Equatable {
    let code: String
    let message: String
}

nonisolated struct FirebaseFunctionErrorResponse: Codable, Equatable {
    let error: FirebaseFunctionErrorPayload
}

nonisolated enum FirebaseFunctionClientError: Error, Equatable, Sendable {
    case invalidEndpoint
    case missingIDToken
    case unauthorized(code: String, message: String)
    case forbidden(code: String, message: String)
    case conflict(code: String, message: String)
    case http(statusCode: Int, code: String, message: String)
    case invalidHTTPResponse
    case invalidResponse
    case timeout
    case cancelled
    case transport(message: String)
}

@MainActor
protocol HTTPDataLoading {
    func data(for request: URLRequest) async throws -> (Data, URLResponse)
}

@MainActor
struct URLSessionHTTPDataLoader: HTTPDataLoading {
    private let storedSession: URLSession

    func data(for request: URLRequest) async throws -> (Data, URLResponse) {
        try await storedSession.data(for: request)
    }
}

@MainActor
struct AuthenticatedFirebaseFunctionsClient {
    private let storedBaseURL: URL
    private let tokenProvider: any FirebaseIDTokenProviding
    private let dataLoader: any HTTPDataLoading
    private let requestTimeout: TimeInterval
    private let encoder: JSONEncoder
    private let decoder: JSONDecoder

    func post<Request: Encodable, Response: Decodable>(
        function: FirebaseFunctionEndpoint,
        body: Request,
        response: Response.Type
    ) async throws -> Response {
        let token: String
        do {
            try Task.checkCancellation()
            token = try await tokenProvider.validIDToken(forcingRefresh: true)
                .trimmingCharacters(in: .whitespacesAndNewlines)
        } catch {
            throw mapTransportError(error)
        }
        guard !token.isEmpty else { throw FirebaseFunctionClientError.missingIDToken }

        let endpointURL = storedBaseURL.appendingPathComponent(function.rawValue, isDirectory: false)
        guard endpointURL.scheme == "https", endpointURL.host != nil else {
            throw FirebaseFunctionClientError.invalidEndpoint
        }
        var request = URLRequest(url: endpointURL, timeoutInterval: requestTimeout)
        request.httpMethod = "POST"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.httpBody = try encoder.encode(body)

        let data: Data
        let urlResponse: URLResponse
        do {
            (data, urlResponse) = try await dataLoader.data(for: request)
        } catch {
            throw mapTransportError(error)
        }
        if Task.isCancelled {
            throw FirebaseFunctionClientError.cancelled
        }
        guard let httpResponse = urlResponse as? HTTPURLResponse else {
            throw FirebaseFunctionClientError.invalidHTTPResponse
        }
        guard (200...299).contains(httpResponse.statusCode) else {
            throw mapHTTPError(statusCode: httpResponse.statusCode, data: data)
        }
        do {
            return try decoder.decode(response, from: data)
        } catch {
            throw FirebaseFunctionClientError.invalidResponse
        }
    }

    private func mapHTTPError(statusCode: Int, data: Data) -> FirebaseFunctionClientError {
        let payload = try? decoder.decode(FirebaseFunctionErrorResponse.self, from: data).error
        let code = payload?.code ?? "http_\(statusCode)"
        let message = payload?.message ?? HTTPURLResponse.localizedString(forStatusCode: statusCode)
        switch statusCode {
        case 401:
            return .unauthorized(code: code, message: message)
        case 403:
            return .forbidden(code: code, message: message)
        case 409:
            return .conflict(code: code, message: message)
        default:
            return .http(statusCode: statusCode, code: code, message: message)
        }
    }

    private func mapTransportError(_ error: Error) -> FirebaseFunctionClientError {
        if error is CancellationError {
            return .cancelled
        }
        if let tokenProviderError = error as? IDTokenProviderError {
            switch tokenProviderError {
            case .noAuthenticatedUser:
                return .missingIDToken
            case .unavailable:
                return .transport(message: String(describing: error))
            }
        }
        if let urlError = error as? URLError {
            switch urlError.code {
            case .cancelled:
                return .cancelled
            case .timedOut:
                return .timeout
            default:
                break
            }
        }
        return .transport(message: String(describing: error))
    }
}

extension URLSessionHTTPDataLoader {
    init(session: URLSession = .shared) {
        self.storedSession = session
    }
}

extension AuthenticatedFirebaseFunctionsClient {
    init(
        baseURL: URL,
        tokenProvider: any FirebaseIDTokenProviding,
        dataLoader: any HTTPDataLoading = URLSessionHTTPDataLoader(),
        requestTimeout: TimeInterval = 15,
        encoder: JSONEncoder = JSONEncoder(),
        decoder: JSONDecoder = JSONDecoder()
    ) {
        self.storedBaseURL = baseURL
        self.tokenProvider = tokenProvider
        self.dataLoader = dataLoader
        self.requestTimeout = requestTimeout
        self.encoder = encoder
        self.decoder = decoder
    }
}
