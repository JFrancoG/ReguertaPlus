import SwiftUI
import UIKit

struct ReguertaDesignTokens {
    struct Colors {
        let actionPrimary: Color
        let actionOnPrimary: Color
        let surfacePrimary: Color
        let surfaceSecondary: Color
        let borderSubtle: Color
        let textPrimary: Color
        let textSecondary: Color
        let feedbackError: Color
        let feedbackWarning: Color
    }

    struct Spacing {
        var xs: CGFloat { 4.resize }
        var sm: CGFloat { 8.resize }
        var md: CGFloat { 12.resize }
        var lg: CGFloat { 16.resize }
        var xl: CGFloat { 20.resize }
        var xxl: CGFloat { 24.resize }
    }

    struct Radius {
        var sm: CGFloat { 10.resize }
        var md: CGFloat { 14.resize }
        var lg: CGFloat { 18.resize }
    }

    struct Typography {
        var titleHero: Font { .custom("CabinSketch-Bold", size: 36.resize, relativeTo: .title) }
        var titleSection: Font { .custom("CabinSketch-Bold", size: 24.resize, relativeTo: .title3) }
        var titleDialog: Font { .custom("CabinSketch-Bold", size: 22.resize, relativeTo: .headline) }
        var titleCard: Font { .custom("CabinSketch-Regular", size: 20.resize, relativeTo: .headline) }
        var body: Font { .custom("CabinSketch-Regular", size: 18.resize, relativeTo: .body) }
        var bodyDialog: Font { .custom("CabinSketch-Regular", size: 16.resize, relativeTo: .body) }
        var bodySecondary: Font { .custom("CabinSketch-Regular", size: 16.resize, relativeTo: .subheadline) }
        var label: Font { .custom("CabinSketch-Bold", size: 14.resize, relativeTo: .footnote) }
    }

    let colors: Colors
    let spacing: Spacing
    let radius: Radius
    let typography: Typography
    let button: ReguertaButtonStyles

    static var light: ReguertaDesignTokens {
        ReguertaDesignTokens(
            colors: Colors(
                actionPrimary: Color.reguertaAsset("actionPrimary", fallback: Color(hex: 0x6DA539)),
                actionOnPrimary: Color.reguertaAsset("mainBack", fallback: .white),
                surfacePrimary: Color.reguertaAsset("mainBack", fallback: Color(hex: 0xF2F8E1)),
                surfaceSecondary: Color.reguertaAsset("secBack", fallback: Color(hex: 0xDDE5C0)),
                borderSubtle: Color(hex: 0xB9C8A2),
                textPrimary: Color.reguertaAsset("textColor", fallback: Color(hex: 0x2A3B2A)),
                textSecondary: Color(hex: 0x4E5D4D),
                feedbackError: Color.reguertaAsset("error", fallback: Color(hex: 0xB04B4B)),
                feedbackWarning: Color.reguertaAsset("warning", fallback: Color(hex: 0xEB6200))
            ),
            spacing: Spacing(),
            radius: Radius(),
            typography: Typography(),
            button: .default
        )
    }

    static var dark: ReguertaDesignTokens {
        ReguertaDesignTokens(
            colors: Colors(
                actionPrimary: Color.reguertaAsset("actionPrimary", fallback: Color(hex: 0x8BBF5A)),
                actionOnPrimary: Color.reguertaAsset("mainBack", fallback: .white),
                surfacePrimary: Color.reguertaAsset("mainBack", fallback: Color(hex: 0x0F1D0D)),
                surfaceSecondary: Color.reguertaAsset("secBack", fallback: Color(hex: 0x1A2B1B)),
                borderSubtle: Color(hex: 0x37513B),
                textPrimary: Color.reguertaAsset("textColor", fallback: Color(hex: 0xD1E1D1)),
                textSecondary: Color(hex: 0xB5C5B3),
                feedbackError: Color.reguertaAsset("error", fallback: Color(hex: 0xD86B6B)),
                feedbackWarning: Color.reguertaAsset("warning", fallback: Color(hex: 0xF08D43))
            ),
            spacing: Spacing(),
            radius: Radius(),
            typography: Typography(),
            button: .default
        )
    }
}

private struct ReguertaDesignTokensKey: EnvironmentKey {
    static let defaultValue = ReguertaDesignTokens.light
}

extension EnvironmentValues {
    var reguertaTokens: ReguertaDesignTokens {
        get { self[ReguertaDesignTokensKey.self] }
        set { self[ReguertaDesignTokensKey.self] = newValue }
    }
}

struct ReguertaTheme<Content: View>: View {
    @Environment(\.colorScheme) private var colorScheme
    private let content: () -> Content

    init(@ViewBuilder content: @escaping () -> Content) {
        self.content = content
    }

    var body: some View {
        let tokens = colorScheme == .dark ? ReguertaDesignTokens.dark : ReguertaDesignTokens.light
        content()
            .environment(\.reguertaTokens, tokens)
            .tint(tokens.colors.actionPrimary)
    }
}

private extension Color {
    static func reguertaAsset(_ name: String, fallback: Color) -> Color {
        guard let uiColor = UIColor(named: name) else {
            return fallback
        }
        return Color(uiColor: uiColor)
    }

    init(hex: UInt, alpha: Double = 1) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255,
            opacity: alpha
        )
    }
}
