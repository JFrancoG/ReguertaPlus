import SwiftUI

struct AuthShellView: View {
    @Environment(\.reguertaMotionPolicy) var motionPolicy

    @Bindable var rootViewModel: AccessRootViewModel
    @Bindable var sessionViewModel: SessionViewModel
    let tokens: ReguertaDesignTokens
    let openURL: OpenURLAction

    var splashMaterialAnimation: Animation? {
        motionPolicy.materialAnimation(.easeInOut(duration: SplashAnimationContract.durationSeconds))
    }

    var body: some View {
        if rootViewModel.shellState.currentRoute == .splash {
            splashRoute
        } else {
            ScrollView(.vertical, showsIndicators: false) {
                ZStack(alignment: .topLeading) {
                    Color.clear
                        .containerRelativeFrame(.vertical, alignment: .top)

                    currentAuthRoute
                        .frame(maxWidth: .infinity, alignment: .topLeading)
                }
                .padding(.bottom, tokens.spacing.md)
            }
            .scrollDismissesKeyboard(.interactively)
            .scrollClipDisabled()
        }
    }
}

#Preview("Authentication AX5", traits: .modifier(ReguertaDesignSystemPreviewModifier())) {
    let environment = routePreviewEnvironment(.register)
    AuthShellView(
        rootViewModel: environment.accessRootViewModel,
        sessionViewModel: environment.sessionViewModel,
        tokens: .light,
        openURL: EnvironmentValues().openURL
    )
    .reguertaAuthRoutePreviewSurface(tokens: .light, scrollsContent: false)
    .environment(\.dynamicTypeSize, .accessibility5)
}

#Preview("Authentication shell", traits: .modifier(ReguertaDesignSystemPreviewModifier())) {
    let environment = routePreviewEnvironment(.welcome)
    AuthShellView(
        rootViewModel: environment.accessRootViewModel,
        sessionViewModel: environment.sessionViewModel,
        tokens: .light,
        openURL: EnvironmentValues().openURL
    )
    .reguertaAuthRoutePreviewSurface(tokens: .light, scrollsContent: false)
}
