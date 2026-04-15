import Foundation

enum AuthErrorFlow: Sendable {
    case signIn
    case signUp
    case passwordReset
}

struct AuthErrorPresentation: Sendable {
    let emailErrorKey: String?
    let passwordErrorKey: String?
    let globalMessageKey: String?

    init(
        emailErrorKey: String? = nil,
        passwordErrorKey: String? = nil,
        globalMessageKey: String? = nil
    ) {
        self.emailErrorKey = emailErrorKey
        self.passwordErrorKey = passwordErrorKey
        self.globalMessageKey = globalMessageKey
    }
}

func mapAuthFailure(_ reason: AuthSignInFailureReason, flow: AuthErrorFlow) -> AuthErrorPresentation {
    switch flow {
    case .signIn, .signUp:
        return mapDefaultAuthFailure(reason)
    case .passwordReset:
        return mapPasswordResetAuthFailure(reason)
    }
}

private func mapDefaultAuthFailure(_ reason: AuthSignInFailureReason) -> AuthErrorPresentation {
    switch reason {
    case .invalidEmail:
        return AuthErrorPresentation(emailErrorKey: AccessL10nKey.feedbackEmailInvalid)
    case .invalidCredentials:
        return AuthErrorPresentation(passwordErrorKey: AccessL10nKey.authErrorInvalidCredentials)
    case .emailAlreadyInUse:
        return AuthErrorPresentation(emailErrorKey: AccessL10nKey.authErrorEmailAlreadyInUse)
    case .weakPassword:
        return AuthErrorPresentation(passwordErrorKey: AccessL10nKey.authErrorWeakPassword)
    case .userNotFound:
        return AuthErrorPresentation(emailErrorKey: AccessL10nKey.authErrorUserNotFound)
    case .userDisabled:
        return AuthErrorPresentation(emailErrorKey: AccessL10nKey.authErrorUserDisabled)
    case .tooManyRequests:
        return AuthErrorPresentation(globalMessageKey: AccessL10nKey.authErrorTooManyRequests)
    case .network:
        return AuthErrorPresentation(globalMessageKey: AccessL10nKey.authErrorNetwork)
    case .unknown:
        return AuthErrorPresentation(globalMessageKey: AccessL10nKey.authErrorUnknown)
    }
}

private func mapPasswordResetAuthFailure(_ reason: AuthSignInFailureReason) -> AuthErrorPresentation {
    switch reason {
    case .invalidEmail:
        return AuthErrorPresentation(emailErrorKey: AccessL10nKey.feedbackEmailInvalid)
    case .userNotFound:
        return AuthErrorPresentation(emailErrorKey: AccessL10nKey.authErrorUserNotFound)
    case .userDisabled:
        return AuthErrorPresentation(emailErrorKey: AccessL10nKey.authErrorUserDisabled)
    case .tooManyRequests:
        return AuthErrorPresentation(globalMessageKey: AccessL10nKey.authErrorTooManyRequests)
    case .network:
        return AuthErrorPresentation(globalMessageKey: AccessL10nKey.authErrorNetwork)
    case .unknown, .invalidCredentials, .emailAlreadyInUse, .weakPassword:
        return AuthErrorPresentation(globalMessageKey: AccessL10nKey.authErrorUnknown)
    }
}
