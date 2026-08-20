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

/// Centralizes how material effects respond to the system Reduce Motion preference.
struct ReguertaMotionPolicy: Equatable {
    let reducesMotion: Bool

    var allowsMaterialAnimation: Bool { !reducesMotion }

    func materialScale(_ proposedScale: CGFloat) -> CGFloat {
        reducesMotion ? 1 : proposedScale
    }

    func materialAnimation(_ animation: Animation) -> Animation? {
        reducesMotion ? nil : animation
    }
}

enum ReguertaContrastContract {
    static let maximumActionTintOpacity = 0.16
    static let maximumModeledPressedStateLayerOpacity = 0.12

    static func buttonVisualState(
        isPressed: Bool,
        motionPolicy: ReguertaMotionPolicy = ReguertaMotionPolicy(reducesMotion: false)
    ) -> ReguertaButtonInteractionVisualState {
        ReguertaButtonInteractionVisualState(
            scale: motionPolicy.materialScale(isPressed ? 0.98 : 1),
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

    struct Icons {
        let small: CGFloat = 16
        let standard: CGFloat = 20
        let prominent: CGFloat = 24
    }

    struct Layout {
        let minimumTouchTarget: CGFloat = 44
        let compactHorizontalPadding: CGFloat = 16
        let regularHorizontalPadding: CGFloat = 24
        let splitWindowMinimumWidth: CGFloat = 600
        let readableContentMaximumWidth: CGFloat = 720
    }

    struct Motion {
        let quickDuration: Double = 0.16
        let standardDuration: Double = 0.24
    }

    struct Typography {
        @MainActor var titleHero: Font { .custom("CabinSketch-Bold", size: 36, relativeTo: .title) }
        @MainActor var titleSection: Font { .custom("CabinSketch-Bold", size: 24, relativeTo: .title3) }
        @MainActor var titleDialog: Font { .custom("CabinSketch-Bold", size: 22, relativeTo: .headline) }
        @MainActor var titleCard: Font { .custom("CabinSketch-Regular", size: 20, relativeTo: .headline) }
        @MainActor var body: Font { .custom("CabinSketch-Regular", size: 18, relativeTo: .body) }
        @MainActor var bodyDialog: Font { .custom("CabinSketch-Regular", size: 16, relativeTo: .body) }
        @MainActor var bodySecondary: Font { .custom("CabinSketch-Regular", size: 16, relativeTo: .subheadline) }
        @MainActor var label: Font { .custom("CabinSketch-Bold", size: 14, relativeTo: .footnote) }
        @MainActor var labelRegular: Font { .custom("CabinSketch-Regular", size: 14, relativeTo: .footnote) }
    }

    let colors: Colors
    let spacing: Spacing
    let radius: Radius
    let typography: Typography
    let button: ReguertaButtonStyles
    let icons = Icons()
    let layout = Layout()
    let motion = Motion()

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

extension EnvironmentValues {
    @Entry fileprivate var injectedReguertaTokens: ReguertaDesignTokens?
    @Entry var reguertaMotionPolicy = ReguertaMotionPolicy(reducesMotion: false)

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
    @Environment(\.accessibilityReduceMotion) private var accessibilityReduceMotion
    @Environment(\.colorScheme) private var colorScheme
    private let storedContent: () -> Content

    var body: some View {
        let tokens = colorScheme == .dark ? ReguertaDesignTokens.dark : ReguertaDesignTokens.light
        storedContent()
            .environment(\.injectedReguertaTokens, tokens)
            .environment(
                \.reguertaMotionPolicy,
                ReguertaMotionPolicy(reducesMotion: accessibilityReduceMotion)
            )
            .tint(tokens.colors.actionPrimary)
    }
}

extension ReguertaTheme {
    init(@ViewBuilder content: @escaping () -> Content) {
        self.storedContent = content
    }
}

extension View {
    /// Injects a deterministic preview theme without weakening the production fail-fast token boundary.
    @MainActor
    func reguertaPreviewTheme(tokens: ReguertaDesignTokens, motionPolicy: ReguertaMotionPolicy) -> some View {
        environment(\.injectedReguertaTokens, tokens)
            .environment(\.reguertaMotionPolicy, motionPolicy)
            .tint(tokens.colors.actionPrimary)
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
