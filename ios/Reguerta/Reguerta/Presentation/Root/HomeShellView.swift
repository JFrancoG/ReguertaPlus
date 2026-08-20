import SwiftUI

struct HomeShellView: View {
    @Environment(\.reguertaMotionPolicy) var motionPolicy

    let rootViewModel: AccessRootViewModel
    let sessionViewModel: SessionViewModel
    let tokens: ReguertaDesignTokens
    let loadNewsImageData: @Sendable (URL) async throws -> Data

    var homeDrawerAnimation: Animation? {
        motionPolicy.materialAnimation(.easeInOut(duration: tokens.motion.standardDuration))
    }

    var homeDrawerDragAnimation: Animation? {
        motionPolicy.materialAnimation(
            .interactiveSpring(response: tokens.motion.standardDuration, dampingFraction: 0.84)
        )
    }

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
