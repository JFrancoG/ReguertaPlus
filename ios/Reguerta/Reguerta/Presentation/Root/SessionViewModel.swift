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

    let feedbackCenter: GlobalFeedbackCenter
    let repository: any MemberRepository
    let authSessionProvider: any AuthSessionProvider
    let resolveAuthorizedSession: ResolveAuthorizedSessionUseCase
    let authorizedDeviceRegistrar: any AuthorizedDeviceRegistrar
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
        let normalizedEmail = normalizeAccessEmail(emailInput)
        return !isAuthenticating &&
            !normalizedEmail.isEmpty &&
            isValidAccessEmail(normalizedEmail) &&
            isValidAccessPassword(passwordInput) &&
            emailErrorKey == nil &&
            passwordErrorKey == nil
    }

    var canSubmitSignUp: Bool {
        let normalizedEmail = normalizeAccessEmail(registerEmailInput)
        return !isRegistering &&
            !normalizedEmail.isEmpty &&
            isValidAccessEmail(normalizedEmail) &&
            isValidAccessPassword(registerPasswordInput) &&
            isValidAccessPassword(registerRepeatPasswordInput) &&
            registerPasswordInput == registerRepeatPasswordInput &&
            registerEmailErrorKey == nil &&
            registerPasswordErrorKey == nil &&
            registerRepeatPasswordErrorKey == nil
    }

    var canSubmitPasswordReset: Bool {
        let normalizedEmail = normalizeAccessEmail(recoverEmailInput)
        return !isRecoveringPassword &&
            !normalizedEmail.isEmpty &&
            isValidAccessEmail(normalizedEmail) &&
            recoverEmailErrorKey == nil
    }

    init(dependencies: SessionViewModelDependencies) {
        self.feedbackCenter = dependencies.feedbackCenter
        self.repository = dependencies.repository
        self.authSessionProvider = dependencies.authSessionProvider
        self.resolveAuthorizedSession = dependencies.resolveAuthorizedSession
        self.authorizedDeviceRegistrar = dependencies.authorizedDeviceRegistrar
        self.reviewerEnvironmentRouter = dependencies.reviewerEnvironmentRouter
        self.sessionRefreshPolicy = dependencies.sessionRefreshPolicy
        self.nowMillisProvider = dependencies.nowMillisProvider
        self.developImpersonationEnabled = dependencies.developImpersonationEnabled
    }

    convenience init(
        repository: (any MemberRepository)? = nil,
        feedbackCenter: GlobalFeedbackCenter = GlobalFeedbackCenter(),
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
                feedbackCenter: feedbackCenter,
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
