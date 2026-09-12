import SwiftUI

struct CoverageLoginSection: View {
    @Bindable var model: CoverageRehearsalViewModel

    var body: some View {
        Section {
            TextField(CoverageCopy.text("email"), text: $model.email)
                .textContentType(.username)
                .keyboardType(.emailAddress)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .accessibilityIdentifier("coverage.email")
            SecureField(CoverageCopy.text("password"), text: $model.password)
                .textContentType(.password)
                .accessibilityIdentifier("coverage.password")
            Button(CoverageCopy.text("sign_in")) { Task { await model.signIn() } }
                .disabled(!model.canSignIn)
                .accessibilityIdentifier("coverage.signIn")
            if model.isSigningIn { ProgressView(CoverageCopy.text("loading")) }
            if model.loginFailed { Text(CoverageCopy.text("login_failed")) }
            if let failure = model.coverage.failure { Text(CoverageCopy.failure(failure)) }
        }
    }
}

#if DEBUG
#Preview("Ensayo local", traits: .modifier(ReguertaDesignSystemPreviewModifier())) {
    @Previewable @State var model = CoveragePreviewAccess.model()
    List { CoverageLoginSection(model: model) }
}
#endif
