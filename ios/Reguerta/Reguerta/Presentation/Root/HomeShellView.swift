import SwiftUI

struct HomeShellView: View {
    let rootViewModel: AccessRootViewModel
    let sessionViewModel: SessionViewModel
    let tokens: ReguertaDesignTokens
    let loadNewsImageData: @Sendable (URL) async throws -> Data

    var body: some View {
        homeRoute
    }
}

#Preview("Home shell", traits: .modifier(ReguertaDesignSystemPreviewModifier())) {
    let environment = routePreviewEnvironment(.home)
    HomeShellView(
        rootViewModel: environment.accessRootViewModel,
        sessionViewModel: environment.sessionViewModel,
        tokens: .light,
        loadNewsImageData: environment.loadNewsImageData
    )
}
