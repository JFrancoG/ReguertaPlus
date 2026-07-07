import SwiftUI

struct ReguertaScreenHeaderView: View {
    @Environment(\.reguertaTokens) private var tokens

    let viewModel: ReguertaScreenHeaderViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: tokens.spacing.sm) {
            ReguertaScreenHeaderTopRowView(viewModel: viewModel)

            if let title = viewModel.title {
                ReguertaScreenHeaderTitleView(title: title)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct ReguertaScreenHeaderTopRowView: View {
    @Environment(\.reguertaTokens) private var tokens

    let viewModel: ReguertaScreenHeaderViewModel

    var body: some View {
        HStack(alignment: .center, spacing: tokens.spacing.md) {
            if let leadingAction = viewModel.leadingAction {
                ReguertaGlassIconButton(iconAction: leadingAction)
            }

            ReguertaScreenHeaderLeadingTextView(text: viewModel.leadingText)

            if let trailingAction = viewModel.trailingAction {
                ReguertaGlassIconButton(iconAction: trailingAction)
            }
        }
        .frame(maxWidth: .infinity, minHeight: 52.resize)
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
    private var buttonSize: CGFloat { 52.resize }
    private var effectPadding: CGFloat { 6.resize }

    var body: some View {
        ZStack(alignment: .topTrailing) {
            Button(action: iconAction.action) {
                Image(systemName: iconAction.systemImageName)
                    .font(.system(size: 20.resize, weight: .semibold))
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
            .frame(width: 8.resize, height: 8.resize)
            .overlay(Circle().stroke(tokens.colors.surfacePrimary, lineWidth: 1.resize))
            .padding(.top, 10.resize)
            .padding(.trailing, 10.resize)
    }
}

private struct ReguertaHeaderCountBadgeView: View {
    @Environment(\.reguertaTokens) private var tokens

    let text: String

    var body: some View {
        Text(text)
            .font(tokens.typography.labelRegular)
            .foregroundStyle(tokens.colors.actionOnPrimary)
            .frame(minWidth: 17.resize, minHeight: 17.resize)
            .padding(.horizontal, 4.resize)
            .background(tokens.colors.feedbackError, in: Capsule())
            .overlay(Capsule().stroke(tokens.colors.surfacePrimary, lineWidth: 1.5.resize))
            .padding(.top, 4.resize)
            .padding(.trailing, 4.resize)
    }
}

private struct ReguertaScreenHeaderPreviewSurface: View {
    @Environment(\.reguertaTokens) private var tokens

    let viewModel: ReguertaScreenHeaderViewModel

    var body: some View {
        ReguertaScreenHeaderView(viewModel: viewModel)
            .padding(20.resize)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .background(tokens.colors.surfacePrimary)
    }
}

#Preview("Back + Title") {
    ReguertaTheme {
        ReguertaScreenHeaderPreviewSurface(
            viewModel: ReguertaScreenHeaderViewModel(
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
}

#Preview("Back + Leading Text + Title") {
    ReguertaTheme {
        ReguertaScreenHeaderPreviewSurface(
            viewModel: ReguertaScreenHeaderViewModel(
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
}

#Preview("Menu + Date + Notifications") {
    ReguertaTheme {
        ReguertaScreenHeaderPreviewSurface(
            viewModel: ReguertaScreenHeaderViewModel(
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
}

#Preview("Back + Title + Cart Count") {
    ReguertaTheme {
        ReguertaScreenHeaderPreviewSurface(
            viewModel: ReguertaScreenHeaderViewModel(
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
}

#Preview("Disabled Trailing Action") {
    ReguertaTheme {
        ReguertaScreenHeaderPreviewSurface(
            viewModel: ReguertaScreenHeaderViewModel(
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
}
