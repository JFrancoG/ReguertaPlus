import Foundation
import Observation

/// Owns only isolated rehearsal credentials. The normal feature shares the route presentation without
/// acquiring a second login or retaining the application's Firebase token in UI state.
@MainActor
@Observable
final class CoverageRehearsalViewModel {
    let route: CoverageRouteViewModel
    var coverage: ShiftCoverageViewModel { route.coverage }
    var email = ""
    var password = ""
    private(set) var isSigningIn = false
    private(set) var loginFailed = false
    @ObservationIgnored private let access: any CoverageRehearsalAccess
    @ObservationIgnored private var revision: UInt64 = 0

    init(access: any CoverageRehearsalAccess) {
        self.access = access
        route = CoverageRouteViewModel(repository: access.repository)
    }

    var canSignIn: Bool { !isSigningIn && !email.trimmingCharacters(in: .whitespaces).isEmpty && !password.isEmpty }

    func signIn() async {
        guard canSignIn else { return }
        revision &+= 1
        let owner = revision
        let secret = password
        password = ""
        route.bind(nil)
        isSigningIn = true
        loginFailed = false
        do {
            let session = try await access.signIn(email: email.trimmingCharacters(in: .whitespaces), password: secret)
            guard revision == owner else { return }
            route.bind(session)
            await coverage.refresh()
        } catch {
            guard revision == owner else { return }
            loginFailed = true
        }
        guard revision == owner else { return }
        isSigningIn = false
    }

    func signOut() {
        revision &+= 1
        access.signOut()
        route.clear()
        password = ""
        isSigningIn = false
        loginFailed = false
    }
}
