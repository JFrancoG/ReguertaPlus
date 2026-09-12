#if DEBUG
import Foundation

/// Memory-only emulator credentials. Login never touches the application's Firebase Auth instance.
@MainActor
final class LocalCoverageRehearsalAccess: CoverageRehearsalAccess {
    let repository: any ShiftCoverageRepository
    private let localRepository: LocalShiftCoverageRepository
    private let credentials: CoverageRehearsalCredentials
    private let loader: any HTTPDataLoading
    private let endpoint: URL

    init(port: Int = 8799, loader: any HTTPDataLoading = CoverageLoopbackDataLoader()) throws {
        let credentials = CoverageRehearsalCredentials()
        self.credentials = credentials
        self.loader = loader
        guard let endpoint = URL(string:
            "http://127.0.0.1:9098/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key"
        ) else { throw ShiftCoverageFailure.localOnly }
        self.endpoint = endpoint
        localRepository = try LocalShiftCoverageRepository(
            port: port,
            currentSession: { credentials.session },
            tokenProvider: {
                guard let token = credentials.token else { throw ShiftCoverageFailure.sessionChanged }
                return token
            },
            loader: loader
        )
        repository = localRepository
    }

    func signOut() {
        credentials.revision &+= 1
        credentials.token = nil
        credentials.session = nil
    }

    func signIn(email: String, password: String) async throws -> ShiftCoverageSession {
        signOut()
        let owner = credentials.revision
        do {
            var request = URLRequest(url: endpoint, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 15)
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONEncoder().encode(Login(email: email, password: password))
            let (data, response) = try await loader.data(for: request)
            try Task.checkCancellation()
            guard owner == credentials.revision else { throw ShiftCoverageFailure.sessionChanged }
            guard let response = response as? HTTPURLResponse, response.url == endpoint, response.statusCode == 200,
                  let login = try? JSONDecoder().decode(LoginResult.self, from: data) else {
                throw ShiftCoverageFailure.rejected(status: 401, code: "coverage_sign_in_failed")
            }
            let provisional = ShiftCoverageSession(
                uid: login.localId,
                memberId: "resolving",
                authorizationRevision: owner
            )
            credentials.token = login.idToken
            credentials.session = provisional
            let snapshot = try await localRepository.resolveMember(session: provisional)
            guard owner == credentials.revision else { throw ShiftCoverageFailure.sessionChanged }
            let session = ShiftCoverageSession(
                uid: login.localId,
                memberId: snapshot.memberId,
                authorizationRevision: owner
            )
            credentials.session = session
            return session
        } catch {
            if owner == credentials.revision {
                signOut()
            }
            throw error
        }
    }

    private struct Login: Encodable {
        let email: String
        let password: String
        let returnSecureToken = true
    }

    private struct LoginResult: Decodable {
        let localId: String
        let idToken: String
    }
}

@MainActor
private final class CoverageRehearsalCredentials {
    var revision: UInt64 = 0
    var token: String?
    var session: ShiftCoverageSession?
}
#endif
