import SwiftUI

struct RootOverlayView: View {
    let rootViewModel: AccessRootViewModel
    let sessionViewModel: SessionViewModel

    var body: some View {
        overlayDialogs
    }
}

#Preview("Root overlay", traits: .modifier(ReguertaDesignSystemPreviewModifier())) {
    let environment = rootOverlayPreviewEnvironment()
    RootOverlayView(
        rootViewModel: environment.accessRootViewModel,
        sessionViewModel: environment.sessionViewModel
    )
}
