import SwiftUI

struct RootRouteView: View {
    let rootViewModel: AccessRootViewModel
    let sessionViewModel: SessionViewModel
    let tokens: ReguertaDesignTokens
    let openURL: OpenURLAction
    let loadNewsImageData: @Sendable (URL) async throws -> Data

    var body: some View {
        if rootViewModel.isHomeRoute {
            HomeShellView(
                rootViewModel: rootViewModel,
                sessionViewModel: sessionViewModel,
                tokens: tokens,
                loadNewsImageData: loadNewsImageData
            )
        } else {
            AuthShellView(
                rootViewModel: rootViewModel,
                sessionViewModel: sessionViewModel,
                tokens: tokens,
                openURL: openURL
            )
        }
    }
}

#Preview("Root route", traits: .modifier(ReguertaDesignSystemPreviewModifier())) {
    let environment = routePreviewEnvironment(.welcome)
    RootRouteView(
        rootViewModel: environment.accessRootViewModel,
        sessionViewModel: environment.sessionViewModel,
        tokens: .light,
        openURL: EnvironmentValues().openURL,
        loadNewsImageData: environment.loadNewsImageData
    )
}
