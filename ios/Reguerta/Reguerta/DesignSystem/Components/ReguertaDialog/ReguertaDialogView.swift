import SwiftUI

struct ReguertaDialogView: View {
    @Environment(\.reguertaTokens) private var tokens
    @AccessibilityFocusState private var isTitleFocused: Bool
    @State private var cardFrame = CGRect.infinite

    let configuration: ReguertaDialogConfiguration

    var body: some View {
        ZStack {
            Color("dialogBack")
                .ignoresSafeArea()
                .accessibilityHidden(true)

            ScrollView {
                VStack(spacing: tokens.spacing.md) {
                    ReguertaDialogIconView(configuration: configuration)
                        .accessibilityHidden(true)

                    Text(configuration.title)
                        .font(tokens.typography.titleDialog)
                        .foregroundStyle(tokens.colors.textPrimary)
                        .multilineTextAlignment(.center)
                        .fixedSize(horizontal: false, vertical: true)
                        .accessibilityAddTraits(.isHeader)
                        .accessibilityFocused($isTitleFocused)

                    Text(configuration.message)
                        .font(tokens.typography.bodyDialog)
                        .foregroundStyle(tokens.colors.textSecondary)
                        .multilineTextAlignment(.center)
                        .fixedSize(horizontal: false, vertical: true)

                    ReguertaDialogActionsView(configuration: configuration)
                        .padding(.top, tokens.spacing.sm)
                }
                .padding(tokens.spacing.lg)
                .frame(maxWidth: 360)
                .background(tokens.colors.surfacePrimary)
                .overlay(
                    RoundedRectangle(cornerRadius: tokens.radius.lg)
                        .stroke(tokens.colors.borderSubtle, lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: tokens.radius.lg))
                .background {
                    GeometryReader { proxy in
                        Color.clear.preference(
                            key: ReguertaDialogCardFramePreferenceKey.self,
                            value: proxy.frame(in: .named(ReguertaDialogCoordinateSpace.name))
                        )
                    }
                }
                .padding(tokens.spacing.lg)
            }
            .scrollBounceBehavior(.basedOnSize)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .coordinateSpace(name: ReguertaDialogCoordinateSpace.name)
        .onPreferenceChange(ReguertaDialogCardFramePreferenceKey.self) {
            cardFrame = $0
        }
        .simultaneousGesture(
            SpatialTapGesture(coordinateSpace: .named(ReguertaDialogCoordinateSpace.name))
                .onEnded { event in
                    guard !cardFrame.contains(event.location) else { return }
                    dismissIfAllowed()
                }
        )
        .accessibilityElement(children: .contain)
        .accessibilityAddTraits(.isModal)
        .onAppear {
            isTitleFocused = true
        }
        .onChange(of: configuration.title) {
            isTitleFocused = true
        }
    }

    private func dismissIfAllowed() {
        guard configuration.dismissible else { return }
        configuration.onDismiss?()
    }
}

private enum ReguertaDialogCoordinateSpace {
    static let name = "reguerta-dialog-overlay"
}

private struct ReguertaDialogCardFramePreferenceKey: PreferenceKey {
    static let defaultValue = CGRect.infinite

    static func reduce(
        value: inout CGRect,
        nextValue: () -> CGRect
    ) {
        value = nextValue()
    }
}

private struct ReguertaDialogIconView: View {
    @Environment(\.reguertaTokens) private var tokens

    let configuration: ReguertaDialogConfiguration

    var body: some View {
        ZStack {
            Circle()
                .fill(configuration.accentColor(tokens: tokens).opacity(0.22))
                .frame(
                    width: tokens.layout.minimumTouchTarget * 2,
                    height: tokens.layout.minimumTouchTarget * 2
                )

            Circle()
                .fill(configuration.accentColor(tokens: tokens))
                .frame(
                    width: tokens.layout.minimumTouchTarget,
                    height: tokens.layout.minimumTouchTarget
                )

            Image(systemName: configuration.symbolName)
                .font(.system(size: tokens.icons.standard, weight: .bold))
                .symbolRenderingMode(.monochrome)
                .foregroundStyle(configuration.contentColor(tokens: tokens))
        }
    }
}

private struct ReguertaDialogActionsView: View {
    @Environment(\.reguertaTokens) private var tokens
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    let configuration: ReguertaDialogConfiguration

    var body: some View {
        if let secondaryAction = configuration.secondaryAction {
            if dynamicTypeSize.isAccessibilitySize {
                VStack(spacing: tokens.spacing.sm) {
                    dialogActionButton(configuration.primaryAction, variant: configuration.primaryButtonVariant)
                    dialogActionButton(secondaryAction, variant: .secondary)
                }
            } else {
                HStack(spacing: tokens.spacing.sm) {
                    reguertaButton(
                        LocalizedStringKey(secondaryAction.title),
                        variant: .secondary,
                        fullWidth: false,
                        fixedWidth: tokens.button.dialogTwoButtonsWidth
                    ) {
                        secondaryAction.action()
                    }

                    reguertaButton(
                        LocalizedStringKey(configuration.primaryAction.title),
                        variant: configuration.primaryButtonVariant,
                        fullWidth: false,
                        fixedWidth: tokens.button.dialogTwoButtonsWidth
                    ) {
                        configuration.primaryAction.action()
                    }
                }
            }
        } else {
            reguertaButton(
                LocalizedStringKey(configuration.primaryAction.title),
                variant: configuration.primaryButtonVariant,
                fullWidth: true,
                fixedWidth: nil
            ) {
                configuration.primaryAction.action()
            }
        }
    }

    private func dialogActionButton(_ action: ReguertaDialogAction, variant: ReguertaButtonVariant) -> some View {
        reguertaButton(
            LocalizedStringKey(action.title),
            variant: variant,
            fullWidth: true,
            fixedWidth: nil
        ) {
            action.action()
        }
    }
}

#Preview(
    "ReguertaDialog",
    traits: .modifier(ReguertaDesignSystemPreviewModifier(fixture: .dialogInfo)),
    .fixedLayout(width: 320, height: 640)
) {
    reguertaDialog(
        type: .info,
        title: "Dialog title",
        message: "Dialog message",
        primaryAction: ReguertaDialogAction(title: "OK") {}
    )
}

#Preview(
    "Two actions XXX",
    traits: .modifier(ReguertaDesignSystemPreviewModifier(fixture: .dialogXXX)),
    .fixedLayout(width: 600, height: 820)
) {
    reguertaDialog(
        type: .info,
        title: "Confirm this change",
        message: "The updated value will be available to every member of the community.",
        primaryAction: ReguertaDialogAction(title: "Confirm") {},
        secondaryAction: ReguertaDialogAction(title: "Cancel") {}
    )
}

#Preview(
    "Two actions AX5 · external Increased Contrast override",
    traits: .modifier(ReguertaDesignSystemPreviewModifier(fixture: .dialogAccessibility)),
    .fixedLayout(width: 320, height: 720)
) {
    reguertaDialog(
        type: .error,
        title: "Unable to complete this action",
        message: "Review the information and try again. Your existing changes remain available.",
        primaryAction: ReguertaDialogAction(title: "Try again") {},
        secondaryAction: ReguertaDialogAction(title: "Go back") {}
    )
}
