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
    case .signIn:
        switch reason {
        case .invalidEmail:
            AuthErrorPresentation(emailErrorKey: AccessL10nKey.feedbackEmailInvalid)
        case .invalidCredentials:
            AuthErrorPresentation(passwordErrorKey: AccessL10nKey.authErrorInvalidCredentials)
        case .emailAlreadyInUse:
            AuthErrorPresentation(emailErrorKey: AccessL10nKey.authErrorEmailAlreadyInUse)
        case .weakPassword:
            AuthErrorPresentation(passwordErrorKey: AccessL10nKey.authErrorWeakPassword)
        case .userNotFound:
            AuthErrorPresentation(emailErrorKey: AccessL10nKey.authErrorUserNotFound)
        case .userDisabled:
            AuthErrorPresentation(emailErrorKey: AccessL10nKey.authErrorUserDisabled)
        case .tooManyRequests:
            AuthErrorPresentation(globalMessageKey: AccessL10nKey.authErrorTooManyRequests)
        case .network:
            AuthErrorPresentation(globalMessageKey: AccessL10nKey.authErrorNetwork)
        case .unknown:
            AuthErrorPresentation(globalMessageKey: AccessL10nKey.authErrorUnknown)
        }

    case .signUp:
        switch reason {
        case .invalidEmail:
            AuthErrorPresentation(emailErrorKey: AccessL10nKey.feedbackEmailInvalid)
        case .invalidCredentials:
            AuthErrorPresentation(passwordErrorKey: AccessL10nKey.authErrorInvalidCredentials)
        case .emailAlreadyInUse:
            AuthErrorPresentation(emailErrorKey: AccessL10nKey.authErrorEmailAlreadyInUse)
        case .weakPassword:
            AuthErrorPresentation(passwordErrorKey: AccessL10nKey.authErrorWeakPassword)
        case .userNotFound:
            AuthErrorPresentation(emailErrorKey: AccessL10nKey.authErrorUserNotFound)
        case .userDisabled:
            AuthErrorPresentation(emailErrorKey: AccessL10nKey.authErrorUserDisabled)
        case .tooManyRequests:
            AuthErrorPresentation(globalMessageKey: AccessL10nKey.authErrorTooManyRequests)
        case .network:
            AuthErrorPresentation(globalMessageKey: AccessL10nKey.authErrorNetwork)
        case .unknown:
            AuthErrorPresentation(globalMessageKey: AccessL10nKey.authErrorUnknown)
        }

    case .passwordReset:
        switch reason {
        case .invalidEmail:
            AuthErrorPresentation(emailErrorKey: AccessL10nKey.feedbackEmailInvalid)
        case .userNotFound:
            AuthErrorPresentation(emailErrorKey: AccessL10nKey.authErrorUserNotFound)
        case .userDisabled:
            AuthErrorPresentation(emailErrorKey: AccessL10nKey.authErrorUserDisabled)
        case .tooManyRequests:
            AuthErrorPresentation(globalMessageKey: AccessL10nKey.authErrorTooManyRequests)
        case .network:
            AuthErrorPresentation(globalMessageKey: AccessL10nKey.authErrorNetwork)
        case .unknown, .invalidCredentials, .emailAlreadyInUse, .weakPassword:
            AuthErrorPresentation(globalMessageKey: AccessL10nKey.authErrorUnknown)
        }
    }
}
