import Foundation
import Observation

struct AuthorizedSession: Equatable {
    var principal: AuthPrincipal
    var authenticatedMember: Member
    var member: Member
    var members: [Member]
    var environment: SessionEnvironment
}

struct SessionOperationContext {
    let generation: UInt64
    let predecessor: Task<Void, Never>?
    let principalEmail: String
}

enum SessionOperationState: Equatable, Sendable {
    case idle
    case active(generation: UInt64)
    case draining(generation: UInt64)
}

enum SessionMode: Equatable, Sendable {
    case signedOut
    case unauthorized(email: String, reason: UnauthorizedReason)
    case authorized(AuthorizedSession)
}

@MainActor
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
    var mode: SessionMode = .signedOut {
        didSet {
            if oldValue != mode {
                sessionStateRevision &+= 1
            }
        }
    }
    @ObservationIgnored private(set) var sessionStateRevision: UInt64 = 0

    let feedbackCenter: GlobalFeedbackCenter
    let repository: any MemberRepository
    let authSessionProvider: any AuthSessionProvider
    let resolveAuthorizedSession: ResolveAuthorizedSessionUseCase
    let authorizedDeviceRegistrar: any AuthorizedDeviceRegistrar
    let criticalDataFreshnessLocalRepository: any CriticalDataFreshnessLocalRepository
    let environmentRouter: any SessionEnvironmentRouting
    let sessionRefreshPolicy: SessionRefreshPolicy
    let nowMillisProvider: @MainActor @Sendable () -> Int64
    let sessionOperationTimeout: Duration
    let sessionOperationSleeper: @Sendable (Duration) async throws -> Void
    let developImpersonationEnabled: Bool
    var lastSessionRefreshAtMillis: Int64?
    var isSessionRefreshInFlight = false
    var sessionOperationState: SessionOperationState = .idle
    @ObservationIgnored var sessionOperationTask: Task<Void, Never>?
    @ObservationIgnored var sessionOperationTimeoutTask: Task<Void, Never>?
    @ObservationIgnored var sessionTerminationCleanupTask: Task<Bool, Never>?
    @ObservationIgnored var sessionTerminationCleanupGeneration: UInt64 = 0
    @ObservationIgnored var sessionOperationGeneration: UInt64 = 0
    @ObservationIgnored var sessionOperationPrincipalEmail = ""
    @ObservationIgnored var authorizedDeviceSessionLease: AuthorizedDeviceSessionLease?

    var isDevelopImpersonationEnabled: Bool {
        developImpersonationEnabled
    }

    var isSessionOperationDraining: Bool {
        if case .draining = sessionOperationState {
            return true
        }
        return false
    }

    var canSubmitSignIn: Bool {
        let normalizedEmail = normalizeAccessEmail(emailInput)
        return sessionOperationState == .idle &&
            !isAuthenticating &&
            !normalizedEmail.isEmpty &&
            isValidAccessEmail(normalizedEmail) &&
            isValidAccessPassword(passwordInput) &&
            emailErrorKey == nil &&
            passwordErrorKey == nil
    }

    var canSubmitSignUp: Bool {
        let normalizedEmail = normalizeAccessEmail(registerEmailInput)
        return sessionOperationState == .idle &&
            !isRegistering &&
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
        self.criticalDataFreshnessLocalRepository = dependencies.criticalDataFreshnessLocalRepository
        self.environmentRouter = dependencies.environmentRouter
        self.sessionRefreshPolicy = dependencies.sessionRefreshPolicy
        self.nowMillisProvider = dependencies.nowMillisProvider
        self.sessionOperationTimeout = dependencies.sessionOperationTimeout
        self.sessionOperationSleeper = dependencies.sessionOperationSleeper
        self.developImpersonationEnabled = dependencies.developImpersonationEnabled
    }

    convenience init(
        repository: (any MemberRepository)? = nil,
        feedbackCenter: GlobalFeedbackCenter = GlobalFeedbackCenter(),
        authSessionProvider: (any AuthSessionProvider)? = nil,
        resolveAuthorizedSession: ResolveAuthorizedSessionUseCase? = nil,
        authorizedMemberResolver: (any AuthorizedMemberResolving)? = nil,
        authorizedDeviceRegistrar: (any AuthorizedDeviceRegistrar)? = nil,
        criticalDataFreshnessLocalRepository: any CriticalDataFreshnessLocalRepository =
            NoOpCriticalDataFreshnessLocalRepository(),
        environmentRouter: (any SessionEnvironmentRouting)? = nil,
        developImpersonationEnabled: Bool = false,
        sessionRefreshPolicy: SessionRefreshPolicy = SessionRefreshPolicy(),
        nowMillisProvider: @escaping @MainActor @Sendable () -> Int64 = { Int64(Date().timeIntervalSince1970 * 1_000) },
        sessionOperationTimeout: Duration = SessionOperationConfiguration.defaultTimeout,
        sessionOperationSleeper: @escaping @Sendable (Duration) async throws -> Void = {
            try await ContinuousClock().sleep(for: $0)
        }
    ) {
        self.init(
            dependencies: .live(
                repository: repository,
                feedbackCenter: feedbackCenter,
                authSessionProvider: authSessionProvider,
                resolveAuthorizedSession: resolveAuthorizedSession,
                authorizedMemberResolver: authorizedMemberResolver,
                authorizedDeviceRegistrar: authorizedDeviceRegistrar,
                criticalDataFreshnessLocalRepository: criticalDataFreshnessLocalRepository,
                environmentRouter: environmentRouter,
                developImpersonationEnabled: developImpersonationEnabled,
                sessionRefreshPolicy: sessionRefreshPolicy,
                nowMillisProvider: nowMillisProvider,
                sessionOperationTimeout: sessionOperationTimeout,
                sessionOperationSleeper: sessionOperationSleeper
            )
        )
    }
}
