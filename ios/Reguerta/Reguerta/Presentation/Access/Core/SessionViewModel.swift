import Foundation
import Observation

struct AuthorizedSession: Equatable, Sendable {
    var principal: AuthPrincipal
    var authenticatedMember: Member
    var member: Member
    var members: [Member]
}

protocol ReviewerEnvironmentRouter: Sendable {
    func applyRouting(for principal: AuthPrincipal) async
    func resetToBaseEnvironment()
}

struct NoOpReviewerEnvironmentRouter: ReviewerEnvironmentRouter {
    func applyRouting(for principal: AuthPrincipal) async {}
    func resetToBaseEnvironment() {}
}

enum SessionMode: Equatable, Sendable {
    case signedOut
    case unauthorized(email: String, reason: UnauthorizedReason)
    case authorized(AuthorizedSession)
}

enum MyOrderFreshnessState: Equatable, Sendable {
    case idle
    case checking
    case ready
    case timedOut
    case unavailable
}

@Observable
final class SessionViewModel {
    var emailInput = "" {
        didSet {
            if oldValue != emailInput {
                emailErrorKey = nil
            }
        }
    }
    var passwordInput = "" {
        didSet {
            if oldValue != passwordInput {
                passwordErrorKey = nil
            }
        }
    }
    var registerEmailInput = "" {
        didSet {
            if oldValue != registerEmailInput {
                registerEmailErrorKey = nil
            }
        }
    }
    var registerPasswordInput = "" {
        didSet {
            if oldValue != registerPasswordInput {
                registerPasswordErrorKey = nil
            }
        }
    }
    var registerRepeatPasswordInput = "" {
        didSet {
            if oldValue != registerRepeatPasswordInput {
                registerRepeatPasswordErrorKey = nil
            }
        }
    }
    var recoverEmailInput = "" {
        didSet {
            if oldValue != recoverEmailInput {
                recoverEmailErrorKey = nil
            }
        }
    }
    var emailErrorKey: String?
    var passwordErrorKey: String?
    var registerEmailErrorKey: String?
    var registerPasswordErrorKey: String?
    var registerRepeatPasswordErrorKey: String?
    var recoverEmailErrorKey: String?
    var isAuthenticating = false
    var isRegistering = false
    var isRecoveringPassword = false
    var showSessionExpiredDialog = false
    var showUnauthorizedDialog = false
    var mode: SessionMode = .signedOut
    var feedbackMessageKey: String?
    var myOrderFreshnessState: MyOrderFreshnessState = .idle
    var bylawsQueryInput = ""
    var bylawsAnswerResult: BylawsAnswerResult?
    var isAskingBylaws = false

    let repository: any MemberRepository
    let authSessionProvider: any AuthSessionProvider
    let resolveAuthorizedSession: ResolveAuthorizedSessionUseCase
    let authorizedDeviceRegistrar: any AuthorizedDeviceRegistrar
    let resolveCriticalDataFreshness: ResolveCriticalDataFreshnessUseCase
    let criticalDataFreshnessLocalRepository: any CriticalDataFreshnessLocalRepository
    let reviewerEnvironmentRouter: any ReviewerEnvironmentRouter
    let sessionRefreshPolicy: SessionRefreshPolicy
    let nowMillisProvider: @MainActor @Sendable () -> Int64
    let developImpersonationEnabled: Bool
    var lastSessionRefreshAtMillis: Int64?
    var isSessionRefreshInFlight = false

    var isDevelopImpersonationEnabled: Bool {
        developImpersonationEnabled
    }

    var canSubmitSignIn: Bool {
        let normalizedEmail = normalizeEmail(emailInput)
        return !isAuthenticating &&
            !normalizedEmail.isEmpty &&
            isValidEmail(normalizedEmail) &&
            isValidPassword(passwordInput) &&
            emailErrorKey == nil &&
            passwordErrorKey == nil
    }

    var canSubmitSignUp: Bool {
        let normalizedEmail = normalizeEmail(registerEmailInput)
        return !isRegistering &&
            !normalizedEmail.isEmpty &&
            isValidEmail(normalizedEmail) &&
            isValidPassword(registerPasswordInput) &&
            isValidPassword(registerRepeatPasswordInput) &&
            registerPasswordInput == registerRepeatPasswordInput &&
            registerEmailErrorKey == nil &&
            registerPasswordErrorKey == nil &&
            registerRepeatPasswordErrorKey == nil
    }

    var canSubmitPasswordReset: Bool {
        let normalizedEmail = normalizeEmail(recoverEmailInput)
        return !isRecoveringPassword &&
            !normalizedEmail.isEmpty &&
            isValidEmail(normalizedEmail) &&
            recoverEmailErrorKey == nil
    }

    init(dependencies: SessionViewModelDependencies) {
        self.repository = dependencies.repository
        self.authSessionProvider = dependencies.authSessionProvider
        self.resolveAuthorizedSession = dependencies.resolveAuthorizedSession
        self.authorizedDeviceRegistrar = dependencies.authorizedDeviceRegistrar
        self.resolveCriticalDataFreshness = dependencies.resolveCriticalDataFreshness
        self.criticalDataFreshnessLocalRepository = dependencies.criticalDataFreshnessLocalRepository
        self.reviewerEnvironmentRouter = dependencies.reviewerEnvironmentRouter
        self.sessionRefreshPolicy = dependencies.sessionRefreshPolicy
        self.nowMillisProvider = dependencies.nowMillisProvider
        self.developImpersonationEnabled = dependencies.developImpersonationEnabled
    }

    convenience init(
        repository: (any MemberRepository)? = nil,
        authSessionProvider: (any AuthSessionProvider)? = nil,
        resolveAuthorizedSession: ResolveAuthorizedSessionUseCase? = nil,
        authorizedDeviceRegistrar: (any AuthorizedDeviceRegistrar)? = nil,
        reviewerEnvironmentRouter: (any ReviewerEnvironmentRouter)? = nil,
        developImpersonationEnabled: Bool = false,
        sessionRefreshPolicy: SessionRefreshPolicy = SessionRefreshPolicy(),
        nowMillisProvider: @escaping @MainActor @Sendable () -> Int64 = { Int64(Date().timeIntervalSince1970 * 1_000) }
    ) {
        self.init(
            dependencies: .live(
                repository: repository,
                authSessionProvider: authSessionProvider,
                resolveAuthorizedSession: resolveAuthorizedSession,
                authorizedDeviceRegistrar: authorizedDeviceRegistrar,
                reviewerEnvironmentRouter: reviewerEnvironmentRouter,
                developImpersonationEnabled: developImpersonationEnabled,
                sessionRefreshPolicy: sessionRefreshPolicy,
                nowMillisProvider: nowMillisProvider
            )
        )
    }
}
