import SwiftUI

struct RootOverlayView: View {
    let rootViewModel: AccessRootViewModel
    let sessionViewModel: SessionViewModel

    var body: some View {
        overlayDialogs
    }
}

#Preview(
    "Password recovery success",
    traits: .modifier(ReguertaDesignSystemPreviewModifier()),
    .fixedLayout(width: 393, height: 852)
) {
    let environment = rootOverlayPreviewEnvironment()
    RootOverlayView(
        rootViewModel: environment.accessRootViewModel,
        sessionViewModel: environment.sessionViewModel
    )
}

#Preview(
    "Session expired · external Increased Contrast override",
    traits: .modifier(ReguertaDesignSystemPreviewModifier()),
    .fixedLayout(width: 320, height: 720)
) {
    let environment = sessionExpiredOverlayPreviewEnvironment()
    RootOverlayView(
        rootViewModel: environment.accessRootViewModel,
        sessionViewModel: environment.sessionViewModel
    )
    .environment(\.dynamicTypeSize, .accessibility5)
}

#Preview(
    "Unauthorized member",
    traits: .modifier(ReguertaDesignSystemPreviewModifier()),
    .fixedLayout(width: 393, height: 852)
) {
    let environment = unauthorizedOverlayPreviewEnvironment()
    RootOverlayView(
        rootViewModel: environment.accessRootViewModel,
        sessionViewModel: environment.sessionViewModel
    )
    .environment(\.dynamicTypeSize, .xxxLarge)
}
