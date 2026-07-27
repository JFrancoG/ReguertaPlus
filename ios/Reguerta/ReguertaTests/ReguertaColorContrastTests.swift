import SwiftUI
import Testing
import UIKit
@testable import Reguerta

@MainActor
struct ReguertaColorContrastTests {
    @Test(arguments: ContrastAppearance.allCases, TextContrastCase.allCases)
    func semanticTextPairsMeetWCAGAA(
        appearance: ContrastAppearance,
        contrastCase: TextContrastCase
    ) throws {
        let sample = try contrastCase.sample(for: appearance)
        let ratio = sample.foreground.contrastRatio(with: sample.background)

        #expect(
            ratio >= 4.5,
            "\(contrastCase) in \(appearance) resolved to \(ratio):1"
        )
    }

    @Test(arguments: ContrastAppearance.allCases, NonTextContrastCase.allCases)
    func semanticControlPairsMeetWCAGAA(
        appearance: ContrastAppearance,
        contrastCase: NonTextContrastCase
    ) throws {
        let sample = try contrastCase.sample(for: appearance)
        let ratio = sample.foreground.contrastRatio(with: sample.background)

        #expect(
            ratio >= 3,
            "\(contrastCase) in \(appearance) resolved to \(ratio):1"
        )
    }

    @Test(arguments: ContrastAppearance.allCases)
    func actionAndAccentAssetsStayEquivalent(appearance: ContrastAppearance) throws {
        let action = try ResolvedColor.asset(.actionPrimary, appearance: appearance)
        let accent = try ResolvedColor.asset(.accentColor, appearance: appearance)

        #expect(action == accent)
    }

    @Test(arguments: InterfaceLuminosity.allCases, DynamicContrastAsset.allCases)
    func increasedContrastUsesDedicatedAssetValues(
        luminosity: InterfaceLuminosity,
        asset: DynamicContrastAsset
    ) throws {
        let standard = try ResolvedColor.asset(
            asset.colorAsset,
            appearance: luminosity.standardAppearance
        )
        let increased = try ResolvedColor.asset(
            asset.colorAsset,
            appearance: luminosity.increasedAppearance
        )

        #expect(standard != increased)
    }

    @Test(arguments: ContrastAppearance.allCases)
    func productionTokensResolveCanonicalAssets(appearance: ContrastAppearance) throws {
        let colors = appearance.designTokens.colors
        let mappings: [ColorMapping] = [
            ColorMapping(name: "actionPrimary", color: colors.actionPrimary, asset: .actionPrimary),
            ColorMapping(name: "actionOnPrimary", color: colors.actionOnPrimary, asset: .mainBack),
            ColorMapping(name: "controlAccent", color: colors.controlAccent, asset: .controlAccent),
            ColorMapping(name: "surfacePrimary", color: colors.surfacePrimary, asset: .mainBack),
            ColorMapping(name: "surfaceSecondary", color: colors.surfaceSecondary, asset: .secBack),
            ColorMapping(name: "textPrimary", color: colors.textPrimary, asset: .textColor),
            ColorMapping(name: "feedbackError", color: colors.feedbackError, asset: .error),
            ColorMapping(name: "feedbackOnError", color: colors.feedbackOnError, asset: .mainBack),
            ColorMapping(name: "feedbackWarning", color: colors.feedbackWarning, asset: .warning)
        ]

        for mapping in mappings {
            let production = try ResolvedColor.swiftUIColor(
                mapping.color,
                appearance: appearance
            )
            let canonical = try ResolvedColor.asset(
                mapping.asset,
                appearance: appearance
            )

            #expect(
                production.isApproximatelyEqual(to: canonical),
                "\(mapping.name) in \(appearance) diverged from \(mapping.asset.rawValue)"
            )
        }
    }

    @Test
    func productionButtonPressedStatePreservesOpacity() {
        let normal = ReguertaContrastContract.buttonVisualState(isPressed: false)
        let pressed = ReguertaContrastContract.buttonVisualState(isPressed: true)

        #expect(normal.opacity == 1)
        #expect(pressed.opacity == 1)
        #expect(pressed.scale < normal.scale)
    }
}

private struct ColorMapping {
    let name: String
    let color: Color
    let asset: ColorAsset
}

enum ContrastAppearance: CaseIterable {
    case light
    case increasedLight
    case dark
    case increasedDark

    @MainActor
    var traitCollection: UITraitCollection {
        UITraitCollection { traits in
            traits.userInterfaceStyle = luminosity.userInterfaceStyle
            traits.accessibilityContrast = accessibilityContrast
        }
    }

    @MainActor
    var designTokens: ReguertaDesignTokens {
        switch self {
        case .light, .increasedLight:
            .light
        case .dark, .increasedDark:
            .dark
        }
    }

    private var luminosity: InterfaceLuminosity {
        switch self {
        case .light, .increasedLight:
            .light
        case .dark, .increasedDark:
            .dark
        }
    }

    private var accessibilityContrast: UIAccessibilityContrast {
        switch self {
        case .light, .dark:
            .normal
        case .increasedLight, .increasedDark:
            .high
        }
    }
}

enum InterfaceLuminosity: CaseIterable {
    case light
    case dark

    var standardAppearance: ContrastAppearance {
        switch self {
        case .light:
            .light
        case .dark:
            .dark
        }
    }

    var increasedAppearance: ContrastAppearance {
        switch self {
        case .light:
            .increasedLight
        case .dark:
            .increasedDark
        }
    }

    var userInterfaceStyle: UIUserInterfaceStyle {
        switch self {
        case .light:
            .light
        case .dark:
            .dark
        }
    }
}

enum DynamicContrastAsset: CaseIterable {
    case actionPrimary
    case accentColor
    case controlAccent
    case warning
    case error

    var colorAsset: ColorAsset {
        switch self {
        case .actionPrimary:
            .actionPrimary
        case .accentColor:
            .accentColor
        case .controlAccent:
            .controlAccent
        case .warning:
            .warning
        case .error:
            .error
        }
    }
}

enum TextContrastCase: CaseIterable {
    case actionOnPrimarySurface
    case actionOnSecondarySurface
    case contentOnAction
    case pressedContentOnAction
    case actionOnTintedPrimarySurface
    case disabledContentOnSecondarySurface
    case warningOnPrimarySurface
    case warningOnSecondarySurface
    case errorOnPrimarySurface
    case errorOnSecondarySurface
    case contentOnError
    case pressedContentOnError

    @MainActor
    func sample(for appearance: ContrastAppearance) throws -> ContrastSample {
        switch self {
        case .actionOnPrimarySurface,
             .actionOnSecondarySurface,
             .contentOnAction,
             .pressedContentOnAction,
             .actionOnTintedPrimarySurface,
             .disabledContentOnSecondarySurface:
            try actionSample(for: appearance)
        case .warningOnPrimarySurface,
             .warningOnSecondarySurface,
             .errorOnPrimarySurface,
             .errorOnSecondarySurface,
             .contentOnError,
             .pressedContentOnError:
            try feedbackSample(for: appearance)
        }
    }

    @MainActor
    private func actionSample(for appearance: ContrastAppearance) throws -> ContrastSample {
        let action = try ResolvedColor.asset(.actionPrimary, appearance: appearance)
        let actionContent = try ResolvedColor.asset(.mainBack, appearance: appearance)
        let primarySurface = actionContent
        let secondarySurface = try ResolvedColor.asset(.secBack, appearance: appearance)
        let primaryText = try ResolvedColor.asset(.textColor, appearance: appearance)

        return switch self {
        case .actionOnPrimarySurface:
            ContrastSample(foreground: action, background: primarySurface)
        case .actionOnSecondarySurface:
            ContrastSample(foreground: action, background: secondarySurface)
        case .contentOnAction:
            ContrastSample(foreground: actionContent, background: action)
        case .pressedContentOnAction:
            ContrastSample(
                foreground: actionContent,
                background: actionContent.composited(
                    over: action,
                    alpha: ReguertaContrastContract.maximumModeledPressedStateLayerOpacity
                )
            )
        case .actionOnTintedPrimarySurface:
            ContrastSample(
                foreground: action,
                background: action.composited(
                    over: primarySurface,
                    alpha: ReguertaContrastContract.maximumActionTintOpacity
                )
            )
        case .disabledContentOnSecondarySurface:
            ContrastSample(
                foreground: primaryText.composited(over: secondarySurface, alpha: 0.86),
                background: secondarySurface
            )
        case .warningOnPrimarySurface,
             .warningOnSecondarySurface,
             .errorOnPrimarySurface,
             .errorOnSecondarySurface,
             .contentOnError,
             .pressedContentOnError:
            preconditionFailure("Feedback cases must use feedbackSample")
        }
    }

    @MainActor
    private func feedbackSample(for appearance: ContrastAppearance) throws -> ContrastSample {
        let primarySurface = try ResolvedColor.asset(.mainBack, appearance: appearance)
        let secondarySurface = try ResolvedColor.asset(.secBack, appearance: appearance)
        let warning = try ResolvedColor.asset(.warning, appearance: appearance)
        let error = try ResolvedColor.asset(.error, appearance: appearance)

        return switch self {
        case .warningOnPrimarySurface:
            ContrastSample(foreground: warning, background: primarySurface)
        case .warningOnSecondarySurface:
            ContrastSample(foreground: warning, background: secondarySurface)
        case .errorOnPrimarySurface:
            ContrastSample(foreground: error, background: primarySurface)
        case .errorOnSecondarySurface:
            ContrastSample(foreground: error, background: secondarySurface)
        case .contentOnError:
            ContrastSample(foreground: primarySurface, background: error)
        case .pressedContentOnError:
            ContrastSample(
                foreground: primarySurface,
                background: primarySurface.composited(
                    over: error,
                    alpha: ReguertaContrastContract.maximumModeledPressedStateLayerOpacity
                )
            )
        case .actionOnPrimarySurface,
             .actionOnSecondarySurface,
             .contentOnAction,
             .pressedContentOnAction,
             .actionOnTintedPrimarySurface,
             .disabledContentOnSecondarySurface:
            preconditionFailure("Action cases must use actionSample")
        }
    }
}

enum NonTextContrastCase: CaseIterable {
    case controlTrackAgainstPrimarySurface
    case controlTrackAgainstSecondarySurface
    case whiteThumbAgainstControlTrack

    @MainActor
    func sample(for appearance: ContrastAppearance) throws -> ContrastSample {
        let controlAccent = try ResolvedColor.asset(.controlAccent, appearance: appearance)

        return switch self {
        case .controlTrackAgainstPrimarySurface:
            ContrastSample(
                foreground: controlAccent,
                background: try ResolvedColor.asset(.mainBack, appearance: appearance)
            )
        case .controlTrackAgainstSecondarySurface:
            ContrastSample(
                foreground: controlAccent,
                background: try ResolvedColor.asset(.secBack, appearance: appearance)
            )
        case .whiteThumbAgainstControlTrack:
            ContrastSample(foreground: .white, background: controlAccent)
        }
    }
}

enum ColorAsset: String {
    case actionPrimary
    case accentColor = "AccentColor"
    case controlAccent
    case mainBack
    case secBack
    case textColor
    case warning
    case error
}

struct ContrastSample {
    let foreground: ResolvedColor
    let background: ResolvedColor
}

struct ResolvedColor: Equatable {
    let red: Double
    let green: Double
    let blue: Double

    static let white = ResolvedColor(red: 1, green: 1, blue: 1)

    @MainActor
    static func asset(
        _ asset: ColorAsset,
        appearance: ContrastAppearance
    ) throws -> ResolvedColor {
        let traits = appearance.traitCollection
        guard let color = UIColor(
            named: asset.rawValue,
            in: .main,
            compatibleWith: traits
        ) else {
            throw ContrastTestError.missingAsset(asset.rawValue)
        }

        let resolved = color.resolvedColor(with: traits)
        var red: CGFloat = 0
        var green: CGFloat = 0
        var blue: CGFloat = 0
        var alpha: CGFloat = 0
        guard resolved.getRed(&red, green: &green, blue: &blue, alpha: &alpha) else {
            throw ContrastTestError.unsupportedColorSpace(asset.rawValue)
        }

        return ResolvedColor(
            red: Double(red),
            green: Double(green),
            blue: Double(blue)
        )
    }

    @MainActor
    static func swiftUIColor(
        _ color: Color,
        appearance: ContrastAppearance
    ) throws -> ResolvedColor {
        let resolved = UIColor(color).resolvedColor(with: appearance.traitCollection)
        var red: CGFloat = 0
        var green: CGFloat = 0
        var blue: CGFloat = 0
        var alpha: CGFloat = 0
        guard resolved.getRed(&red, green: &green, blue: &blue, alpha: &alpha) else {
            throw ContrastTestError.unsupportedColorSpace("production token")
        }

        return ResolvedColor(
            red: Double(red),
            green: Double(green),
            blue: Double(blue)
        )
    }

    func composited(over background: ResolvedColor, alpha: Double) -> ResolvedColor {
        ResolvedColor(
            red: alpha * red + (1 - alpha) * background.red,
            green: alpha * green + (1 - alpha) * background.green,
            blue: alpha * blue + (1 - alpha) * background.blue
        )
    }

    func contrastRatio(with other: ResolvedColor) -> Double {
        let lighter = max(relativeLuminance, other.relativeLuminance)
        let darker = min(relativeLuminance, other.relativeLuminance)
        return (lighter + 0.05) / (darker + 0.05)
    }

    func isApproximatelyEqual(to other: ResolvedColor, tolerance: Double = 0.000_001) -> Bool {
        abs(red - other.red) <= tolerance
            && abs(green - other.green) <= tolerance
            && abs(blue - other.blue) <= tolerance
    }

    private var relativeLuminance: Double {
        0.2126 * red.linearized
            + 0.7152 * green.linearized
            + 0.0722 * blue.linearized
    }
}

extension Double {
    var linearized: Double {
        self <= 0.04045
            ? self / 12.92
            : pow((self + 0.055) / 1.055, 2.4)
    }
}

enum ContrastTestError: Error {
    case missingAsset(String)
    case unsupportedColorSpace(String)
}
