import SwiftUI

struct ReguertaCardView<Content: View>: View {
    @Environment(\.reguertaTokens) private var tokens

    let configuration: ReguertaCardConfiguration
    let content: () -> Content

    var body: some View {
        content()
            .padding(tokens.spacing.lg)
            .frame(maxWidth: configuration.maxWidth, alignment: configuration.alignment)
            .background(tokens.colors.surfacePrimary)
            .overlay(
                RoundedRectangle(cornerRadius: tokens.radius.md)
                    .stroke(tokens.colors.borderSubtle, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: tokens.radius.md))
    }
}

#Preview(
    "ReguertaCard",
    traits: .modifier(ReguertaDesignSystemPreviewModifier(fixture: .cardPrimary)),
    .fixedLayout(width: 320, height: 640)
) {
    reguertaCard {
        VStack(alignment: .leading, spacing: 8) {
            Text("common.status.active")
                .font(.headline)
            Text("feedback.unable_load_data")
                .font(.subheadline)
        }
    }
    .padding()
}

#Preview(
    "ReguertaCard XXX",
    traits: .modifier(ReguertaDesignSystemPreviewModifier(fixture: .cardXXX)),
    .fixedLayout(width: 600, height: 820)
) {
    reguertaCard {
        VStack(alignment: .leading, spacing: 8) {
            Text("common.status.active")
                .font(.headline)
            Text("feedback.unable_load_data")
                .font(.body)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
    .padding()
}

#Preview(
    "ReguertaCard AX5 · external Increased Contrast override",
    traits: .modifier(ReguertaDesignSystemPreviewModifier(fixture: .cardAccessibility)),
    .fixedLayout(width: 320, height: 720)
) {
    reguertaCard {
        VStack(alignment: .leading, spacing: 8) {
            Text("common.status.active")
                .font(.headline)
            Text("feedback.unable_save_changes")
                .font(.body)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
    .padding()
}
