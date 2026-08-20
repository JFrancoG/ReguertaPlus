import SwiftUI

struct AuthShellView: View {
    @Environment(\.dynamicTypeSize) var dynamicTypeSize
    @Environment(\.reguertaMotionPolicy) var motionPolicy

    let rootViewModel: AccessRootViewModel
    let sessionViewModel: SessionViewModel
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

#Preview("Authentication AX5", traits: .modifier(ReguertaDesignSystemPreviewModifier())) {
    let environment = routePreviewEnvironment(.register)
    AuthShellView(
        rootViewModel: environment.accessRootViewModel,
        sessionViewModel: environment.sessionViewModel,
        tokens: .light,
        openURL: EnvironmentValues().openURL
    )
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
}
