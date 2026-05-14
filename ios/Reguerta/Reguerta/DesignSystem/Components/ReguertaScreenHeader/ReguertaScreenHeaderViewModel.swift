import SwiftUI

typealias ReguertaScreenHeader = ReguertaScreenHeaderView

enum ReguertaHeaderText {
    case localized(String)
    case verbatim(String)

    var viewText: Text {
        switch self {
        case .localized(let key):
            Text(LocalizedStringKey(key))
        case .verbatim(let value):
            Text(verbatim: value)
        }
    }
}

enum ReguertaHeaderBadge {
    case dot
    case count(Int)

    var showsDot: Bool {
        switch self {
        case .dot:
            true
        case .count:
            false
        }
    }

    var countText: String? {
        switch self {
        case .count(let count) where count > 0:
            "\(min(count, 99))"
        case .count, .dot:
            nil
        }
    }
}

struct ReguertaHeaderAction {
    let systemImageName: String
    let accessibilityLabel: ReguertaHeaderText
    let accessibilityIdentifier: String?
    let isEnabled: Bool
    let badge: ReguertaHeaderBadge?
    let action: () -> Void

    init(
        systemImageName: String,
        accessibilityLabel: ReguertaHeaderText,
        accessibilityIdentifier: String? = nil,
        isEnabled: Bool = true,
        badge: ReguertaHeaderBadge? = nil,
        action: @escaping () -> Void
    ) {
        self.systemImageName = systemImageName
        self.accessibilityLabel = accessibilityLabel
        self.accessibilityIdentifier = accessibilityIdentifier
        self.isEnabled = isEnabled
        self.badge = badge
        self.action = action
    }

    var opacity: Double {
        isEnabled ? 1 : 0.66
    }

    func iconColor(tokens: ReguertaDesignTokens) -> Color {
        isEnabled ? tokens.colors.textPrimary : tokens.colors.textSecondary
    }
}

struct ReguertaScreenHeaderViewModel {
    let title: ReguertaHeaderText?
    let leadingAction: ReguertaHeaderAction?
    let leadingText: ReguertaHeaderText?
    let trailingAction: ReguertaHeaderAction?

    init(
        title: ReguertaHeaderText? = nil,
        leadingAction: ReguertaHeaderAction? = nil,
        leadingText: ReguertaHeaderText? = nil,
        trailingAction: ReguertaHeaderAction? = nil
    ) {
        self.title = title
        self.leadingAction = leadingAction
        self.leadingText = leadingText
        self.trailingAction = trailingAction
    }
}

extension View {
    @ViewBuilder
    func reguertaHeaderGlassButton(
        isEnabled: Bool,
        colorScheme: ColorScheme
    ) -> some View {
        let shape = Circle()
        let isDarkMode = colorScheme == .dark
        let tint = isDarkMode ? Color.black.opacity(0.36) : Color.white.opacity(0.42)

        if #available(iOS 26.0, *) {
            self
                .glassEffect(
                    .regular
                        .tint(tint)
                        .interactive(isEnabled),
                    in: shape
                )
        } else {
            self
                .background(.ultraThinMaterial, in: shape)
                .background(tint, in: shape)
        }
    }

    @ViewBuilder
    func reguertaHeaderAccessibilityIdentifier(_ identifier: String?) -> some View {
        if let identifier {
            accessibilityIdentifier(identifier)
        } else {
            self
        }
    }
}
