import Foundation
import SwiftUI

enum ReguertaDesignSystemPreviewWidth: String, CaseIterable, Hashable {
    case compact320
    case split600
    case regular1024

    var points: CGFloat {
        switch self {
        case .compact320:
            320
        case .split600:
            600
        case .regular1024:
            1_024
        }
    }
}

enum ReguertaDesignSystemPreviewContentSize: String, CaseIterable, Hashable {
    case large
    case xxxLarge
    case accessibility5

    var dynamicTypeSize: DynamicTypeSize {
        switch self {
        case .large:
            .large
        case .xxxLarge:
            .xxxLarge
        case .accessibility5:
            .accessibility5
        }
    }
}

enum ReguertaDesignSystemPreviewLocale: String, CaseIterable, Hashable {
    case spanish
    case english

    var value: Locale {
        switch self {
        case .spanish:
            Locale(identifier: "es_ES")
        case .english:
            Locale(identifier: "en_US")
        }
    }
}

enum ReguertaDesignSystemPreviewColorScheme: String, CaseIterable, Hashable {
    case light
    case dark

    var value: ColorScheme {
        switch self {
        case .light:
            .light
        case .dark:
            .dark
        }
    }
}

enum ReguertaDesignSystemPreviewMotion: String, CaseIterable, Hashable {
    case standard
    case reduced

    var reducesMotion: Bool { self == .reduced }
}

struct ReguertaDesignSystemPreviewScenario: Hashable {
    let identifier: String
    let width: ReguertaDesignSystemPreviewWidth
    let height: CGFloat
    let contentSize: ReguertaDesignSystemPreviewContentSize
    let locale: ReguertaDesignSystemPreviewLocale
    let colorScheme: ReguertaDesignSystemPreviewColorScheme
    /// Requires the preview renderer's Increased Contrast variant; the environment value is read-only in SwiftUI.
    let requiresIncreasedContrastOverride: Bool
    let motion: ReguertaDesignSystemPreviewMotion
}

extension ReguertaDesignSystemPreviewScenario {
    static let compactSpanishLightLarge = ReguertaDesignSystemPreviewScenario(
        identifier: "compact-320-es-light-large",
        width: .compact320,
        height: 640,
        contentSize: .large,
        locale: .spanish,
        colorScheme: .light,
        requiresIncreasedContrastOverride: false,
        motion: .standard
    )

    static let compactEnglishDarkAX5HighContrastReducedMotion = ReguertaDesignSystemPreviewScenario(
        identifier: "compact-320-en-dark-ax5-high-contrast-reduced-motion",
        width: .compact320,
        height: 720,
        contentSize: .accessibility5,
        locale: .english,
        colorScheme: .dark,
        requiresIncreasedContrastOverride: true,
        motion: .reduced
    )

    static let splitSpanishLightXXXLarge = ReguertaDesignSystemPreviewScenario(
        identifier: "split-600-es-light-xxxl",
        width: .split600,
        height: 820,
        contentSize: .xxxLarge,
        locale: .spanish,
        colorScheme: .light,
        requiresIncreasedContrastOverride: false,
        motion: .standard
    )

    static let regularEnglishDarkLarge = ReguertaDesignSystemPreviewScenario(
        identifier: "regular-1024-en-dark-large",
        width: .regular1024,
        height: 768,
        contentSize: .large,
        locale: .english,
        colorScheme: .dark,
        requiresIncreasedContrastOverride: false,
        motion: .standard
    )

    static let canonicalMatrix = [
        compactSpanishLightLarge,
        compactEnglishDarkAX5HighContrastReducedMotion,
        splitSpanishLightXXXLarge,
        regularEnglishDarkLarge
    ]
}

enum ReguertaDesignSystemPreviewComponent: String, CaseIterable, Hashable {
    case button
    case card
    case input
    case dialog
    case inlineFeedback
    case list
    case floatingActionButton
    case header
    case scaffold
}

enum ReguertaDesignSystemPreviewFixture: String, CaseIterable {
    case buttonPrimary
    case buttonStates
    case buttonAccessibility
    case cardPrimary
    case cardXXX
    case cardAccessibility
    case inputCompact
    case inputStates
    case inputAccessibility
    case dialogInfo
    case dialogXXX
    case dialogAccessibility
    case inlinePrimary
    case inlineXXX
    case inlineAccessibility
    case listCompact
    case listActions
    case listAccessibility
    case fabStates
    case fabXXX
    case fabAccessibility
    case headerBackTitle
    case headerLongTitle
    case headerNotifications
    case headerCartCount
    case headerDisabledAction
    case scaffoldCompact
    case scaffoldXXX
    case scaffoldAccessibility
    case scaffoldReadableWidth

    var component: ReguertaDesignSystemPreviewComponent {
        switch self {
        case .buttonPrimary, .buttonStates, .buttonAccessibility:
            .button
        case .cardPrimary, .cardXXX, .cardAccessibility:
            .card
        case .inputCompact, .inputStates, .inputAccessibility:
            .input
        case .dialogInfo, .dialogXXX, .dialogAccessibility:
            .dialog
        case .inlinePrimary, .inlineXXX, .inlineAccessibility:
            .inlineFeedback
        case .listCompact, .listActions, .listAccessibility:
            .list
        case .fabStates, .fabXXX, .fabAccessibility:
            .floatingActionButton
        case .headerBackTitle, .headerLongTitle, .headerNotifications, .headerCartCount, .headerDisabledAction:
            .header
        case .scaffoldCompact, .scaffoldXXX, .scaffoldAccessibility, .scaffoldReadableWidth:
            .scaffold
        }
    }

    var stateIdentifiers: [String] {
        switch self {
        case .buttonPrimary:
            ["primary"]
        case .buttonStates:
            ["primary", "secondary", "destructive", "text", "disabled", "loading"]
        case .buttonAccessibility:
            ["primary", "ax5"]
        case .cardPrimary:
            ["content", "compact"]
        case .cardXXX:
            ["longContent", "xxxLarge"]
        case .cardAccessibility:
            ["longContent", "ax5"]
        case .inputCompact:
            ["default", "compact"]
        case .inputStates:
            ["default", "secure", "error", "disabled"]
        case .inputAccessibility:
            ["multiline", "clear", "ax5"]
        case .dialogInfo:
            ["info", "singleAction"]
        case .dialogXXX:
            ["info", "twoActions", "xxxLarge"]
        case .dialogAccessibility:
            ["error", "twoActions", "ax5"]
        case .inlinePrimary:
            ["info", "compact"]
        case .inlineXXX:
            ["warning", "error", "xxxLarge"]
        case .inlineAccessibility:
            ["longContent", "ax5"]
        case .listCompact:
            ["default", "compact"]
        case .listActions:
            ["highlighted", "enabledAction", "disabledAction", "longContent"]
        case .listAccessibility:
            ["highlighted", "ax5"]
        case .fabStates:
            ["enabled", "disabled"]
        case .fabXXX:
            ["enabled", "xxxLarge"]
        case .fabAccessibility:
            ["disabled", "ax5"]
        case .headerBackTitle:
            ["back"]
        case .headerLongTitle:
            ["longTitle"]
        case .headerNotifications:
            ["menu", "notifications"]
        case .headerCartCount:
            ["cartCount"]
        case .headerDisabledAction:
            ["disabledAction"]
        case .scaffoldCompact:
            ["bottomInset", "compact"]
        case .scaffoldXXX:
            ["bottomInset", "xxxLarge"]
        case .scaffoldAccessibility:
            ["noBottomInset", "ax5"]
        case .scaffoldReadableWidth:
            ["noBottomInset", "readableWidth"]
        }
    }

    var scenario: ReguertaDesignSystemPreviewScenario {
        switch self {
        case .buttonPrimary, .cardPrimary, .inputCompact, .dialogInfo, .inlinePrimary, .listCompact, .fabStates,
             .headerBackTitle, .headerNotifications, .scaffoldCompact:
            .compactSpanishLightLarge
        case .buttonStates, .cardXXX, .inputStates, .dialogXXX, .inlineXXX, .listActions, .fabXXX,
             .headerDisabledAction, .scaffoldXXX:
            .splitSpanishLightXXXLarge
        case .buttonAccessibility, .cardAccessibility, .inputAccessibility, .dialogAccessibility,
             .inlineAccessibility, .listAccessibility, .fabAccessibility, .headerLongTitle, .scaffoldAccessibility:
            .compactEnglishDarkAX5HighContrastReducedMotion
        case .headerCartCount, .scaffoldReadableWidth:
            .regularEnglishDarkLarge
        }
    }
}

struct ReguertaDesignSystemPreviewContext {}

struct ReguertaDesignSystemPreviewModifier: PreviewModifier {
    var fixture: ReguertaDesignSystemPreviewFixture?

    static func makeSharedContext() async throws -> ReguertaDesignSystemPreviewContext {
        ReguertaDesignSystemPreviewContext()
    }

    @ViewBuilder
    func body(content: Content, context _: ReguertaDesignSystemPreviewContext) -> some View {
        if let fixture {
            let scenario = fixture.scenario
            let tokens = scenario.colorScheme == .dark ? ReguertaDesignTokens.dark : ReguertaDesignTokens.light

            content
                .reguertaPreviewTheme(
                    tokens: tokens,
                    motionPolicy: ReguertaMotionPolicy(reducesMotion: scenario.motion.reducesMotion)
                )
                .environment(\.locale, scenario.locale.value)
                .transformEnvironment(\.dynamicTypeSize) { dynamicTypeSize in
                    // Preserve explicit XXX Large or AX5 variants requested by Xcode's preview renderer.
                    guard dynamicTypeSize == .large else { return }
                    dynamicTypeSize = scenario.contentSize.dynamicTypeSize
                }
                .preferredColorScheme(scenario.colorScheme.value)
                .frame(width: scenario.width.points, height: scenario.height)
        } else {
            ReguertaTheme {
                content
            }
        }
    }
}
