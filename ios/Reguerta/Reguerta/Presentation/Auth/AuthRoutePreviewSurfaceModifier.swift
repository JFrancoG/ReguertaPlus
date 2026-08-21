import SwiftUI

struct AuthRoutePreviewSurfaceModifier: ViewModifier {
    let tokens: ReguertaDesignTokens
    let scrollsContent: Bool

    func body(content: Content) -> some View {
        Group {
            if scrollsContent {
                ScrollView(.vertical, showsIndicators: false) {
                    ZStack(alignment: .topLeading) {
                        Color.clear
                            .containerRelativeFrame(.vertical, alignment: .top)

                        previewContent(content)
                    }
                }
                .scrollDismissesKeyboard(.interactively)
                .scrollClipDisabled()
            } else {
                previewContent(content)
            }
        }
        .background(tokens.colors.surfacePrimary.ignoresSafeArea())
    }

    private func previewContent(_ content: Content) -> some View {
        content
            .padding(tokens.spacing.lg)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
    }
}

extension View {
    func reguertaAuthRoutePreviewSurface(
        tokens: ReguertaDesignTokens,
        scrollsContent: Bool = true
    ) -> some View {
        modifier(AuthRoutePreviewSurfaceModifier(tokens: tokens, scrollsContent: scrollsContent))
    }
}
