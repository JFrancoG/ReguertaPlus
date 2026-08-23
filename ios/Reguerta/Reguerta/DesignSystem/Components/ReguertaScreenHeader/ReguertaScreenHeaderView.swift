import SwiftUI

enum ReguertaScreenHeaderLayout {
    static let rowMinimumHeight: CGFloat = 52
    static let actionSize: CGFloat = 52
    static let glassEffectPadding: CGFloat = 6
    static let badgeDotSize: CGFloat = 8
    static let badgeMinimumSize: CGFloat = 17
    static let badgeOffset: CGFloat = 10
    static let badgeDotStrokeWidth: CGFloat = 1
    static let badgeStrokeWidth: CGFloat = 1.5
}

struct ReguertaScreenHeaderView: View {
    @Environment(\.reguertaTokens) private var tokens

    let configuration: ReguertaScreenHeaderConfiguration

    var body: some View {
        VStack(alignment: .leading, spacing: tokens.spacing.sm) {
            ReguertaScreenHeaderTopRowView(configuration: configuration)

            if let title = configuration.title {
                ReguertaScreenHeaderTitleView(title: title)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct ReguertaScreenHeaderTopRowView: View {
    @Environment(\.reguertaTokens) private var tokens

    let configuration: ReguertaScreenHeaderConfiguration

    var body: some View {
        HStack(alignment: .center, spacing: tokens.spacing.md) {
            if let leadingAction = configuration.leadingAction {
                ReguertaGlassIconButton(iconAction: leadingAction)
            }

            ReguertaScreenHeaderLeadingTextView(text: configuration.leadingText)

            if let trailingAction = configuration.trailingAction {
                ReguertaGlassIconButton(iconAction: trailingAction)
            }
        }
        .frame(
            maxWidth: .infinity,
            minHeight: max(ReguertaScreenHeaderLayout.rowMinimumHeight, tokens.layout.minimumTouchTarget)
        )
    }
}

private struct ReguertaScreenHeaderLeadingTextView: View {
    @Environment(\.reguertaTokens) private var tokens

    let text: ReguertaHeaderText?

    var body: some View {
        Group {
            if let text {
                text.viewText
                    .font(tokens.typography.titleCard)
                    .foregroundStyle(tokens.colors.textPrimary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.78)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .accessibilityAddTraits(.isHeader)
                    .accessibilityIdentifier("reguerta.screenHeader.leadingText")
            } else {
                Spacer(minLength: 0)
            }
        }
    }
}

private struct ReguertaScreenHeaderTitleView: View {
    @Environment(\.reguertaTokens) private var tokens

    let title: ReguertaHeaderText

    var body: some View {
        title.viewText
            .font(tokens.typography.titleSection)
            .foregroundStyle(tokens.colors.textPrimary)
            .lineLimit(2)
            .minimumScaleFactor(0.78)
            .frame(maxWidth: .infinity, alignment: .leading)
            .accessibilityAddTraits(.isHeader)
            .accessibilityIdentifier("reguerta.screenHeader.title")
    }
}

struct ReguertaGlassIconButton: View {
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.reguertaTokens) private var tokens

    let iconAction: ReguertaHeaderAction
    private var buttonSize: CGFloat {
        max(ReguertaScreenHeaderLayout.actionSize, tokens.layout.minimumTouchTarget)
    }
    private let effectPadding = ReguertaScreenHeaderLayout.glassEffectPadding

    var body: some View {
        ZStack(alignment: .topTrailing) {
            Button(action: iconAction.action) {
                Image(systemName: iconAction.systemImageName)
                    .font(.system(size: tokens.icons.standard, weight: .semibold))
                    .foregroundStyle(iconAction.iconColor(tokens: tokens))
                    .frame(width: buttonSize, height: buttonSize)
                    .contentShape(Circle())
            }
            .buttonStyle(.plain)
            .disabled(!iconAction.isEnabled)
            .opacity(iconAction.opacity)
            .reguertaHeaderGlassButton(
                isEnabled: iconAction.isEnabled,
                colorScheme: colorScheme
            )
            .padding(effectPadding)
            .accessibilityLabel(iconAction.accessibilityLabel.viewText)
            .reguertaHeaderAccessibilityIdentifier(iconAction.accessibilityIdentifier)

            ReguertaHeaderBadgeView(badge: iconAction.badge)
                .padding(effectPadding)
                .allowsHitTesting(false)
        }
        .frame(width: buttonSize + effectPadding * 2, height: buttonSize + effectPadding * 2)
    }
}

private struct ReguertaHeaderBadgeView: View {
    let badge: ReguertaHeaderBadge?

    var body: some View {
        Group {
            if badge?.showsDot == true {
                ReguertaHeaderDotBadgeView()
            } else if let countText = badge?.countText {
                ReguertaHeaderCountBadgeView(text: countText)
            } else {
                EmptyView()
            }
        }
        .accessibilityHidden(true)
    }
}

private struct ReguertaHeaderDotBadgeView: View {
    @Environment(\.reguertaTokens) private var tokens

    var body: some View {
        Circle()
            .fill(tokens.colors.feedbackError)
            .frame(
                width: ReguertaScreenHeaderLayout.badgeDotSize,
                height: ReguertaScreenHeaderLayout.badgeDotSize
            )
            .overlay(
                Circle().stroke(
                    tokens.colors.surfacePrimary,
                    lineWidth: ReguertaScreenHeaderLayout.badgeDotStrokeWidth
                )
            )
            .padding(.top, ReguertaScreenHeaderLayout.badgeOffset)
            .padding(.trailing, ReguertaScreenHeaderLayout.badgeOffset)
    }
}

private struct ReguertaHeaderCountBadgeView: View {
    @Environment(\.reguertaTokens) private var tokens

    let text: String

    var body: some View {
        Text(text)
            .font(tokens.typography.labelRegular)
            .foregroundStyle(tokens.colors.feedbackOnError)
            .frame(
                minWidth: ReguertaScreenHeaderLayout.badgeMinimumSize,
                minHeight: ReguertaScreenHeaderLayout.badgeMinimumSize
            )
            .padding(.horizontal, tokens.spacing.xs)
            .background(tokens.colors.feedbackError, in: Capsule())
            .overlay(
                Capsule().stroke(
                    tokens.colors.surfacePrimary,
                    lineWidth: ReguertaScreenHeaderLayout.badgeStrokeWidth
                )
            )
            .padding(.top, tokens.spacing.xs)
            .padding(.trailing, tokens.spacing.xs)
    }
}

private struct ReguertaScreenHeaderPreviewSurface: View {
    @Environment(\.reguertaTokens) private var tokens

    let configuration: ReguertaScreenHeaderConfiguration

    var body: some View {
        ReguertaScreenHeaderView(configuration: configuration)
            .padding(tokens.spacing.xl)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .background(tokens.colors.surfacePrimary)
    }
}

#Preview(
    "Back + Title",
    traits: .modifier(ReguertaDesignSystemPreviewModifier(fixture: .headerBackTitle)),
    .fixedLayout(width: 320, height: 640)
) {
    ReguertaScreenHeaderPreviewSurface(
        configuration: ReguertaScreenHeaderConfiguration(
            title: .verbatim("Pedidos a preparar"),
            leadingAction: ReguertaHeaderAction(
                systemImageName: "chevron.left",
                accessibilityLabel: .localized(AccessL10nKey.commonBack),
                accessibilityIdentifier: "preview.header.backButton",
                action: {}
            )
        )
    )
}

#Preview(
    "Long title · external Increased Contrast override",
    traits: .modifier(ReguertaDesignSystemPreviewModifier(fixture: .headerLongTitle)),
    .fixedLayout(width: 320, height: 720)
) {
    ReguertaScreenHeaderPreviewSurface(
        configuration: ReguertaScreenHeaderConfiguration(
            title: .verbatim("Crear tu pedido semanal"),
            leadingAction: ReguertaHeaderAction(
                systemImageName: "chevron.left",
                accessibilityLabel: .localized(AccessL10nKey.commonBack),
                action: {}
            ),
            leadingText: .verbatim("Semana 21")
        )
    )
}

#Preview(
    "Menu + alerts",
    traits: .modifier(ReguertaDesignSystemPreviewModifier(fixture: .headerNotifications)),
    .fixedLayout(width: 320, height: 640)
) {
    ReguertaScreenHeaderPreviewSurface(
        configuration: ReguertaScreenHeaderConfiguration(
            leadingAction: ReguertaHeaderAction(
                systemImageName: "line.3.horizontal",
                accessibilityLabel: .localized(AccessL10nKey.homeShellMenu),
                accessibilityIdentifier: "preview.header.menuButton",
                action: {}
            ),
            leadingText: .verbatim("miercoles 13 mayo"),
            trailingAction: ReguertaHeaderAction(
                systemImageName: "bell",
                accessibilityLabel: .localized(AccessL10nKey.homeShellNotifications),
                accessibilityIdentifier: "preview.header.notificationsButton",
                badge: .dot,
                action: {}
            )
        )
    )
}

#Preview(
    "Cart count",
    traits: .modifier(ReguertaDesignSystemPreviewModifier(fixture: .headerCartCount)),
    .fixedLayout(width: 1_024, height: 768)
) {
    ReguertaScreenHeaderPreviewSurface(
        configuration: ReguertaScreenHeaderConfiguration(
            title: .verbatim("Lista de productos"),
            leadingAction: ReguertaHeaderAction(
                systemImageName: "chevron.left",
                accessibilityLabel: .localized(AccessL10nKey.commonBack),
                action: {}
            ),
            trailingAction: ReguertaHeaderAction(
                systemImageName: "cart",
                accessibilityLabel: .verbatim("Ver carrito"),
                accessibilityIdentifier: "preview.header.cartButton",
                badge: .count(12),
                action: {}
            )
        )
    )
}

#Preview(
    "Disabled action",
    traits: .modifier(ReguertaDesignSystemPreviewModifier(fixture: .headerDisabledAction)),
    .fixedLayout(width: 600, height: 820)
) {
    ReguertaScreenHeaderPreviewSurface(
        configuration: ReguertaScreenHeaderConfiguration(
            title: .verbatim("Notificaciones"),
            leadingAction: ReguertaHeaderAction(
                systemImageName: "chevron.left",
                accessibilityLabel: .localized(AccessL10nKey.commonBack),
                action: {}
            ),
            trailingAction: ReguertaHeaderAction(
                systemImageName: "paperplane",
                accessibilityLabel: .verbatim("Enviar"),
                isEnabled: false,
                action: {}
            )
        )
    )
}
