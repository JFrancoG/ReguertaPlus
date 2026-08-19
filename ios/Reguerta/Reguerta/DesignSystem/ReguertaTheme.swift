import SwiftUI

enum AppAppearance: String, CaseIterable, Identifiable, Sendable {
    case system
    case light
    case dark

    static let storageKey = "app_appearance"

    var id: String { rawValue }

    var preferredColorScheme: ColorScheme? {
        switch self {
        case .system:
            nil
        case .light:
            .light
        case .dark:
            .dark
        }
    }
}
import UIKit

struct ReguertaButtonInteractionVisualState: Equatable {
    let scale: CGFloat
    let opacity: Double
}

enum ReguertaContrastContract {
    static let maximumActionTintOpacity = 0.16
    static let maximumModeledPressedStateLayerOpacity = 0.12

    static func buttonVisualState(isPressed: Bool) -> ReguertaButtonInteractionVisualState {
        ReguertaButtonInteractionVisualState(
            scale: isPressed ? 0.98 : 1,
            opacity: 1
        )
    }
}

struct ReguertaDesignTokens {
    struct Colors {
        let actionPrimary: Color
        let actionOnPrimary: Color
        let controlAccent: Color
        let surfacePrimary: Color
        let surfaceSecondary: Color
        let borderSubtle: Color
        let textPrimary: Color
        let textSecondary: Color
        let feedbackError: Color
        let feedbackOnError: Color
        let feedbackWarning: Color
    }

    struct Spacing {
        @MainActor var xs: CGFloat { 4.resize }
        @MainActor var sm: CGFloat { 8.resize }
        @MainActor var md: CGFloat { 12.resize }
        @MainActor var lg: CGFloat { 16.resize }
        @MainActor var xl: CGFloat { 20.resize }
        @MainActor var xxl: CGFloat { 24.resize }
    }

    struct Radius {
        @MainActor var sm: CGFloat { 10.resize }
        @MainActor var md: CGFloat { 14.resize }
        @MainActor var lg: CGFloat { 18.resize }
    }

    struct Typography {
        @MainActor var titleHero: Font { .custom("CabinSketch-Bold", size: 36.resize, relativeTo: .title) }
        @MainActor var titleSection: Font { .custom("CabinSketch-Bold", size: 24.resize, relativeTo: .title3) }
        @MainActor var titleDialog: Font { .custom("CabinSketch-Bold", size: 22.resize, relativeTo: .headline) }
        @MainActor var titleCard: Font { .custom("CabinSketch-Regular", size: 20.resize, relativeTo: .headline) }
        @MainActor var body: Font { .custom("CabinSketch-Regular", size: 18.resize, relativeTo: .body) }
        @MainActor var bodyDialog: Font { .custom("CabinSketch-Regular", size: 16.resize, relativeTo: .body) }
        @MainActor var bodySecondary: Font { .custom("CabinSketch-Regular", size: 16.resize, relativeTo: .subheadline) }
        @MainActor var label: Font { .custom("CabinSketch-Bold", size: 14.resize, relativeTo: .footnote) }
        @MainActor var labelRegular: Font { .custom("CabinSketch-Regular", size: 14.resize, relativeTo: .footnote) }
    }

    let colors: Colors
    let spacing: Spacing
    let radius: Radius
    let typography: Typography
    let button: ReguertaButtonStyles

    @MainActor
    static var light: ReguertaDesignTokens {
        ReguertaDesignTokens(
            colors: Colors(
                actionPrimary: Color.reguertaAsset("actionPrimary", fallback: Color(hex: 0x3D681E)),
                actionOnPrimary: Color.reguertaAsset("mainBack", fallback: Color(hex: 0xF2F8E1)),
                controlAccent: Color.reguertaAsset("controlAccent", fallback: Color(hex: 0x3D681E)),
                surfacePrimary: Color.reguertaAsset("mainBack", fallback: Color(hex: 0xF2F8E1)),
                surfaceSecondary: Color.reguertaAsset("secBack", fallback: Color(hex: 0xDDE5C0)),
                borderSubtle: Color(hex: 0xB9C8A2),
                textPrimary: Color.reguertaAsset("textColor", fallback: Color(hex: 0x2A3B2A)),
                textSecondary: Color(hex: 0x4E5D4D),
                feedbackError: Color.reguertaAsset("error", fallback: Color(hex: 0x8D3434)),
                feedbackOnError: Color.reguertaAsset("mainBack", fallback: Color(hex: 0xF2F8E1)),
                feedbackWarning: Color.reguertaAsset("warning", fallback: Color(hex: 0x843800))
            ),
            spacing: Spacing(),
            radius: Radius(),
            typography: Typography(),
            button: .default
        )
    }

    @MainActor
    static var dark: ReguertaDesignTokens {
        ReguertaDesignTokens(
            colors: Colors(
                actionPrimary: Color.reguertaAsset("actionPrimary", fallback: Color(hex: 0x6DA239)),
                actionOnPrimary: Color.reguertaAsset("mainBack", fallback: Color(hex: 0x0F1D0D)),
                controlAccent: Color.reguertaAsset("controlAccent", fallback: Color(hex: 0x6DA239)),
                surfacePrimary: Color.reguertaAsset("mainBack", fallback: Color(hex: 0x0F1D0D)),
                surfaceSecondary: Color.reguertaAsset("secBack", fallback: Color(hex: 0x1A2B1B)),
                borderSubtle: Color(hex: 0x37513B),
                textPrimary: Color.reguertaAsset("textColor", fallback: Color(hex: 0xD1E1D1)),
                textSecondary: Color(hex: 0xB5C5B3),
                feedbackError: Color.reguertaAsset("error", fallback: Color(hex: 0xF48787)),
                feedbackOnError: Color.reguertaAsset("mainBack", fallback: Color(hex: 0x0F1D0D)),
                feedbackWarning: Color.reguertaAsset("warning", fallback: Color(hex: 0xFFAA70))
            ),
            spacing: Spacing(),
            radius: Radius(),
            typography: Typography(),
            button: .default
        )
    }
}

private struct ReguertaDesignTokensKey: EnvironmentKey {
    static let defaultValue: ReguertaDesignTokens? = nil
}

extension EnvironmentValues {
    fileprivate var injectedReguertaTokens: ReguertaDesignTokens? {
        get { self[ReguertaDesignTokensKey.self] }
        set { self[ReguertaDesignTokensKey.self] = newValue }
    }

    @MainActor
    var reguertaTokens: ReguertaDesignTokens {
        get {
            guard let tokens = injectedReguertaTokens else {
                preconditionFailure("ReguertaDesignTokens must be injected by ReguertaTheme")
            }
            return tokens
        }
        set {
            injectedReguertaTokens = newValue
        }
    }
}

struct ReguertaTheme<Content: View>: View {
    @Environment(\.colorScheme) private var colorScheme
    private let storedContent: () -> Content

    var body: some View {
        let tokens = colorScheme == .dark ? ReguertaDesignTokens.dark : ReguertaDesignTokens.light
        storedContent()
            .environment(\.injectedReguertaTokens, tokens)
            .tint(tokens.colors.actionPrimary)
    }
}

extension ReguertaTheme {
    init(@ViewBuilder content: @escaping () -> Content) {
        self.storedContent = content
    }
}

private extension Color {
    static func reguertaAsset(_ name: String, fallback: Color) -> Color {
        guard let uiColor = UIColor(named: name) else { return fallback }
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
