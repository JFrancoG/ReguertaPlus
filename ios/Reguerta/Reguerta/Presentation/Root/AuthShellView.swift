import SwiftUI

struct AuthShellView: View {
    let rootViewModel: AccessRootViewModel
    let sessionViewModel: SessionViewModel
    let tokens: ReguertaDesignTokens
    let openURL: OpenURLAction

    var body: some View {
        if rootViewModel.shellState.currentRoute == .splash {
            splashRoute
        } else {
            ScrollView(.vertical, showsIndicators: false) {
                currentAuthRoute
                    .frame(maxWidth: .infinity, alignment: .topLeading)
                    .containerRelativeFrame(.vertical, alignment: .top)
                    .padding(.bottom, tokens.spacing.md)
            }
            .scrollDismissesKeyboard(.interactively)
            .scrollClipDisabled()
        }
    }
}

#Preview("Authentication shell", traits: .modifier(ReguertaDesignSystemPreviewModifier())) {
    let environment = routePreviewEnvironment(.welcome)
    AuthShellView(
        rootViewModel: environment.accessRootViewModel,
        sessionViewModel: environment.sessionViewModel,
        tokens: .light,
        openURL: EnvironmentValues().openURL
    )
}
