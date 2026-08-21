import Testing

@testable import Reguerta

@MainActor
struct AuthFormStateOwnershipTests {
    @Test(
        "Editar un input limpia solo el error que posee",
        arguments: [
            (
                AuthInputField.signInEmail,
                AuthFormErrorSnapshot(
                    signInEmail: nil,
                    signInPassword: "sign-in-password-error",
                    signUpEmail: "sign-up-email-error",
                    signUpPassword: "sign-up-password-error",
                    signUpRepeatedPassword: "sign-up-repeat-error",
                    recoveryEmail: "recovery-email-error"
                )
            ),
            (
                AuthInputField.signInPassword,
                AuthFormErrorSnapshot(
                    signInEmail: "sign-in-email-error",
                    signInPassword: nil,
                    signUpEmail: "sign-up-email-error",
                    signUpPassword: "sign-up-password-error",
                    signUpRepeatedPassword: "sign-up-repeat-error",
                    recoveryEmail: "recovery-email-error"
                )
            ),
            (
                AuthInputField.signUpEmail,
                AuthFormErrorSnapshot(
                    signInEmail: "sign-in-email-error",
                    signInPassword: "sign-in-password-error",
                    signUpEmail: nil,
                    signUpPassword: "sign-up-password-error",
                    signUpRepeatedPassword: "sign-up-repeat-error",
                    recoveryEmail: "recovery-email-error"
                )
            ),
            (
                AuthInputField.signUpPassword,
                AuthFormErrorSnapshot(
                    signInEmail: "sign-in-email-error",
                    signInPassword: "sign-in-password-error",
                    signUpEmail: "sign-up-email-error",
                    signUpPassword: nil,
                    signUpRepeatedPassword: "sign-up-repeat-error",
                    recoveryEmail: "recovery-email-error"
                )
            ),
            (
                AuthInputField.signUpRepeatedPassword,
                AuthFormErrorSnapshot(
                    signInEmail: "sign-in-email-error",
                    signInPassword: "sign-in-password-error",
                    signUpEmail: "sign-up-email-error",
                    signUpPassword: "sign-up-password-error",
                    signUpRepeatedPassword: nil,
                    recoveryEmail: "recovery-email-error"
                )
            ),
            (
                AuthInputField.recoveryEmail,
                AuthFormErrorSnapshot(
                    signInEmail: "sign-in-email-error",
                    signInPassword: "sign-in-password-error",
                    signUpEmail: "sign-up-email-error",
                    signUpPassword: "sign-up-password-error",
                    signUpRepeatedPassword: "sign-up-repeat-error",
                    recoveryEmail: nil
                )
            )
        ]
    )
    func editingInputClearsOnlyItsOwnedError(
        field: AuthInputField,
        expectedErrors: AuthFormErrorSnapshot
    ) {
        let viewModel = makeAuthFormStateViewModel()
        seedAllAuthFormDraftsAndErrors(viewModel)

        field.edit(viewModel)

        #expect(authFormErrors(viewModel) == expectedErrors)
    }

    @Test("Resetear login conserva los borradores de registro y recuperacion")
    func signInResetOwnsOnlySignInState() {
        let viewModel = makeAuthFormStateViewModel()
        seedAllAuthFormState(viewModel)

        viewModel.resetSignInDraft()

        #expect(signInState(viewModel) == .empty)
        #expect(signUpState(viewModel) == .seeded)
        #expect(recoveryState(viewModel) == .seeded)
    }

    @Test("Resetear registro conserva los borradores de login y recuperacion")
    func signUpResetOwnsOnlySignUpState() {
        let viewModel = makeAuthFormStateViewModel()
        seedAllAuthFormState(viewModel)

        viewModel.resetSignUpDraft()

        #expect(signInState(viewModel) == .seeded)
        #expect(signUpState(viewModel) == .empty)
        #expect(recoveryState(viewModel) == .seeded)
    }

    @Test("Resetear recuperacion conserva los borradores de login y registro")
    func recoveryResetOwnsOnlyRecoveryState() {
        let viewModel = makeAuthFormStateViewModel()
        seedAllAuthFormState(viewModel)

        viewModel.resetRecoverDraft()

        #expect(signInState(viewModel) == .seeded)
        #expect(signUpState(viewModel) == .seeded)
        #expect(recoveryState(viewModel) == .empty)
    }

    @Test("Datos validos habilitan los tres formularios")
    func validDraftsCanBeSubmitted() {
        let viewModel = makeAuthFormStateViewModel()
        seedValidAuthFormDrafts(viewModel)

        #expect(viewModel.canSubmitSignIn)
        #expect(viewModel.canSubmitSignUp)
        #expect(viewModel.canSubmitPasswordReset)
    }

    @Test(
        "Cada error bloquea solo el formulario que lo posee",
        arguments: [
            (AuthBlockingError.signInEmail, false, true, true),
            (AuthBlockingError.signInPassword, false, true, true),
            (AuthBlockingError.signUpEmail, true, false, true),
            (AuthBlockingError.signUpPassword, true, false, true),
            (AuthBlockingError.signUpRepeatedPassword, true, false, true),
            (AuthBlockingError.recoveryEmail, true, true, false)
        ]
    )
    func ownedErrorsBlockOnlyTheirForm(
        error: AuthBlockingError,
        expectedSignIn: Bool,
        expectedSignUp: Bool,
        expectedRecovery: Bool
    ) {
        let viewModel = makeAuthFormStateViewModel()
        seedValidAuthFormDrafts(viewModel)

        error.apply(to: viewModel)

        #expect(viewModel.canSubmitSignIn == expectedSignIn)
        #expect(viewModel.canSubmitSignUp == expectedSignUp)
        #expect(viewModel.canSubmitPasswordReset == expectedRecovery)
    }

    @Test(
        "Cada loading bloquea solo el formulario que lo posee",
        arguments: [
            (AuthLoadingState.signIn, false, true, true),
            (AuthLoadingState.signUp, true, false, true),
            (AuthLoadingState.recovery, true, true, false)
        ]
    )
    func ownedLoadingBlocksOnlyItsForm(
        loading: AuthLoadingState,
        expectedSignIn: Bool,
        expectedSignUp: Bool,
        expectedRecovery: Bool
    ) {
        let viewModel = makeAuthFormStateViewModel()
        seedValidAuthFormDrafts(viewModel)

        loading.apply(to: viewModel)

        #expect(viewModel.canSubmitSignIn == expectedSignIn)
        #expect(viewModel.canSubmitSignUp == expectedSignUp)
        #expect(viewModel.canSubmitPasswordReset == expectedRecovery)
    }

    @Test("La lane de sesion bloquea login y registro pero no recuperacion")
    func activeSessionLaneKeepsPasswordRecoveryIndependent() {
        let viewModel = makeAuthFormStateViewModel()
        seedValidAuthFormDrafts(viewModel)

        viewModel.sessionOperationState = .active(generation: 7)

        #expect(viewModel.canSubmitSignIn == false)
        #expect(viewModel.canSubmitSignUp == false)
        #expect(viewModel.canSubmitPasswordReset)
    }

    @Test("El reset global limpia todas las credenciales y errores")
    func accessResetClearsEveryCredentialAndError() {
        let viewModel = makeAuthFormStateViewModel()
        seedAllAuthFormDraftsAndErrors(viewModel)
        viewModel.isRecoveringPassword = true

        viewModel.resetAccessCredentialsAndErrors()

        #expect(signInState(viewModel) == .empty)
        #expect(signUpState(viewModel) == .empty)
        #expect(recoveryState(viewModel) == .empty)
        #expect(authFormErrors(viewModel) == .empty)
    }
}

enum AuthInputField {
    case signInEmail
    case signInPassword
    case signUpEmail
    case signUpPassword
    case signUpRepeatedPassword
    case recoveryEmail

    @MainActor
    func edit(_ viewModel: SessionViewModel) {
        switch self {
        case .signInEmail:
            viewModel.emailInput = "edited-sign-in@example.com"
        case .signInPassword:
            viewModel.passwordInput = "edited12"
        case .signUpEmail:
            viewModel.registerEmailInput = "edited-sign-up@example.com"
        case .signUpPassword:
            viewModel.registerPasswordInput = "edited12"
        case .signUpRepeatedPassword:
            viewModel.registerRepeatPasswordInput = "edited12"
        case .recoveryEmail:
            viewModel.recoverEmailInput = "edited-recovery@example.com"
        }
    }
}

enum AuthBlockingError {
    case signInEmail
    case signInPassword
    case signUpEmail
    case signUpPassword
    case signUpRepeatedPassword
    case recoveryEmail

    @MainActor
    func apply(to viewModel: SessionViewModel) {
        switch self {
        case .signInEmail:
            viewModel.emailErrorKey = "sign-in-email-error"
        case .signInPassword:
            viewModel.passwordErrorKey = "sign-in-password-error"
        case .signUpEmail:
            viewModel.registerEmailErrorKey = "sign-up-email-error"
        case .signUpPassword:
            viewModel.registerPasswordErrorKey = "sign-up-password-error"
        case .signUpRepeatedPassword:
            viewModel.registerRepeatPasswordErrorKey = "sign-up-repeat-error"
        case .recoveryEmail:
            viewModel.recoverEmailErrorKey = "recovery-email-error"
        }
    }
}

enum AuthLoadingState {
    case signIn
    case signUp
    case recovery

    @MainActor
    func apply(to viewModel: SessionViewModel) {
        switch self {
        case .signIn:
            viewModel.isAuthenticating = true
        case .signUp:
            viewModel.isRegistering = true
        case .recovery:
            viewModel.isRecoveringPassword = true
        }
    }
}

struct AuthFormErrorSnapshot: Equatable {
    let signInEmail: String?
    let signInPassword: String?
    let signUpEmail: String?
    let signUpPassword: String?
    let signUpRepeatedPassword: String?
    let recoveryEmail: String?

    static let empty = AuthFormErrorSnapshot(
        signInEmail: nil,
        signInPassword: nil,
        signUpEmail: nil,
        signUpPassword: nil,
        signUpRepeatedPassword: nil,
        recoveryEmail: nil
    )
}

private struct SignInFormState: Equatable {
    let email: String
    let password: String
    let emailError: String?
    let passwordError: String?
    let isLoading: Bool

    static let empty = SignInFormState(
        email: "",
        password: "",
        emailError: nil,
        passwordError: nil,
        isLoading: false
    )

    static let seeded = SignInFormState(
        email: "sign-in@example.com",
        password: "signin12",
        emailError: "sign-in-email-error",
        passwordError: "sign-in-password-error",
        isLoading: true
    )
}

private struct SignUpFormState: Equatable {
    let email: String
    let password: String
    let repeatedPassword: String
    let emailError: String?
    let passwordError: String?
    let repeatedPasswordError: String?
    let isLoading: Bool

    static let empty = SignUpFormState(
        email: "",
        password: "",
        repeatedPassword: "",
        emailError: nil,
        passwordError: nil,
        repeatedPasswordError: nil,
        isLoading: false
    )

    static let seeded = SignUpFormState(
        email: "sign-up@example.com",
        password: "signup12",
        repeatedPassword: "signup12",
        emailError: "sign-up-email-error",
        passwordError: "sign-up-password-error",
        repeatedPasswordError: "sign-up-repeat-error",
        isLoading: true
    )
}

private struct RecoveryFormState: Equatable {
    let email: String
    let emailError: String?
    let isLoading: Bool

    static let empty = RecoveryFormState(email: "", emailError: nil, isLoading: false)
    static let seeded = RecoveryFormState(
        email: "recovery@example.com",
        emailError: "recovery-email-error",
        isLoading: true
    )
}

@MainActor
private func makeAuthFormStateViewModel() -> SessionViewModel {
    SessionViewModel(
        nowMillisProvider: { 0 },
        sessionOperationSleeper: { _ in }
    )
}

@MainActor
private func seedValidAuthFormDrafts(_ viewModel: SessionViewModel) {
    viewModel.emailInput = "sign-in@example.com"
    viewModel.passwordInput = "signin12"
    viewModel.registerEmailInput = "sign-up@example.com"
    viewModel.registerPasswordInput = "signup12"
    viewModel.registerRepeatPasswordInput = "signup12"
    viewModel.recoverEmailInput = "recovery@example.com"
}

@MainActor
private func seedAllAuthFormDraftsAndErrors(_ viewModel: SessionViewModel) {
    seedValidAuthFormDrafts(viewModel)
    viewModel.emailErrorKey = "sign-in-email-error"
    viewModel.passwordErrorKey = "sign-in-password-error"
    viewModel.registerEmailErrorKey = "sign-up-email-error"
    viewModel.registerPasswordErrorKey = "sign-up-password-error"
    viewModel.registerRepeatPasswordErrorKey = "sign-up-repeat-error"
    viewModel.recoverEmailErrorKey = "recovery-email-error"
}

@MainActor
private func seedAllAuthFormState(_ viewModel: SessionViewModel) {
    seedAllAuthFormDraftsAndErrors(viewModel)
    viewModel.isAuthenticating = true
    viewModel.isRegistering = true
    viewModel.isRecoveringPassword = true
}

@MainActor
private func authFormErrors(_ viewModel: SessionViewModel) -> AuthFormErrorSnapshot {
    AuthFormErrorSnapshot(
        signInEmail: viewModel.emailErrorKey,
        signInPassword: viewModel.passwordErrorKey,
        signUpEmail: viewModel.registerEmailErrorKey,
        signUpPassword: viewModel.registerPasswordErrorKey,
        signUpRepeatedPassword: viewModel.registerRepeatPasswordErrorKey,
        recoveryEmail: viewModel.recoverEmailErrorKey
    )
}

@MainActor
private func signInState(_ viewModel: SessionViewModel) -> SignInFormState {
    SignInFormState(
        email: viewModel.emailInput,
        password: viewModel.passwordInput,
        emailError: viewModel.emailErrorKey,
        passwordError: viewModel.passwordErrorKey,
        isLoading: viewModel.isAuthenticating
    )
}

@MainActor
private func signUpState(_ viewModel: SessionViewModel) -> SignUpFormState {
    SignUpFormState(
        email: viewModel.registerEmailInput,
        password: viewModel.registerPasswordInput,
        repeatedPassword: viewModel.registerRepeatPasswordInput,
        emailError: viewModel.registerEmailErrorKey,
        passwordError: viewModel.registerPasswordErrorKey,
        repeatedPasswordError: viewModel.registerRepeatPasswordErrorKey,
        isLoading: viewModel.isRegistering
    )
}

@MainActor
private func recoveryState(_ viewModel: SessionViewModel) -> RecoveryFormState {
    RecoveryFormState(
        email: viewModel.recoverEmailInput,
        emailError: viewModel.recoverEmailErrorKey,
        isLoading: viewModel.isRecoveringPassword
    )
}
