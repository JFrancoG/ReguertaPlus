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
        let xs: CGFloat = 4
        let sm: CGFloat = 8
        let md: CGFloat = 12
        let lg: CGFloat = 16
        let xl: CGFloat = 20
        let xxl: CGFloat = 24
    }

    struct Radius {
        let sm: CGFloat = 10
        let md: CGFloat = 14
        let lg: CGFloat = 18
    }

    struct Typography {
        let titleHero: Font = .system(.title, design: .rounded).weight(.bold)
        let titleSection: Font = .system(.title3, design: .rounded).weight(.semibold)
        let titleCard: Font = .system(.headline, design: .rounded).weight(.semibold)
        let body: Font = .system(.body, design: .default)
        let bodySecondary: Font = .system(.subheadline, design: .default)
        let label: Font = .system(.footnote, design: .default)
    }

    let colors: Colors
    let spacing: Spacing
    let radius: Radius
    let typography: Typography

    static let `default` = ReguertaDesignTokens(
        colors: Colors(
            actionPrimary: .adaptive(light: 0x6DA539, dark: 0x8BBF5A),
            actionOnPrimary: .white,
            surfacePrimary: .adaptive(light: 0xF2F8E1, dark: 0x0F1D0D),
            surfaceSecondary: .adaptive(light: 0xDDE5C0, dark: 0x1A2B1B),
            borderSubtle: .adaptive(light: 0xB9C8A2, dark: 0x37513B),
            textPrimary: .adaptive(light: 0x2A3B2A, dark: 0xD1E1D1),
            textSecondary: .adaptive(light: 0x4E5D4D, dark: 0xB5C5B3),
            feedbackError: Color(hex: 0xB04B4B),
            feedbackWarning: Color(hex: 0xEB6200)
        ),
        spacing: Spacing(),
        radius: Radius(),
        typography: Typography()
    )
}

private struct ReguertaDesignTokensKey: EnvironmentKey {
    static let defaultValue = ReguertaDesignTokens.default
}

extension EnvironmentValues {
    var reguertaTokens: ReguertaDesignTokens {
        get { self[ReguertaDesignTokensKey.self] }
        set { self[ReguertaDesignTokensKey.self] = newValue }
    }
}

struct ReguertaTheme<Content: View>: View {
    private let content: () -> Content

    init(@ViewBuilder content: @escaping () -> Content) {
        self.content = content
    }

    var body: some View {
        let tokens = ReguertaDesignTokens.default
        content()
            .environment(\.reguertaTokens, tokens)
            .tint(tokens.colors.actionPrimary)
    }
}

private extension Color {
    init(hex: UInt, alpha: Double = 1) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255,
            opacity: alpha
        )
    }

    static func adaptive(light: UInt, dark: UInt) -> Color {
        Color(
            UIColor { traits in
                traits.userInterfaceStyle == .dark ? UIColor(hex: dark) : UIColor(hex: light)
            }
        )
    }
}

private extension UIColor {
    convenience init(hex: UInt, alpha: CGFloat = 1) {
        self.init(
            red: CGFloat((hex >> 16) & 0xFF) / 255,
            green: CGFloat((hex >> 8) & 0xFF) / 255,
            blue: CGFloat(hex & 0xFF) / 255,
            alpha: alpha
        )
    }
}
