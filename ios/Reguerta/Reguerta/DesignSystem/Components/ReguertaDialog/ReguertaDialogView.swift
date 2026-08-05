import SwiftUI

struct ReguertaDialogView: View {
    @Environment(\.reguertaTokens) private var tokens
    @AccessibilityFocusState private var isTitleFocused: Bool
    @State private var cardFrame = CGRect.infinite

    let viewModel: ReguertaDialogViewModel

    var body: some View {
        ZStack {
            Color("dialogBack")
                .ignoresSafeArea()
                .accessibilityHidden(true)

            ScrollView {
                VStack(spacing: tokens.spacing.md) {
                    ReguertaDialogIconView(viewModel: viewModel)
                        .accessibilityHidden(true)

                    Text(viewModel.title)
                        .font(tokens.typography.titleDialog)
                        .foregroundStyle(tokens.colors.textPrimary)
                        .multilineTextAlignment(.center)
                        .fixedSize(horizontal: false, vertical: true)
                        .accessibilityAddTraits(.isHeader)
                        .accessibilityFocused($isTitleFocused)

                    Text(viewModel.message)
                        .font(tokens.typography.bodyDialog)
                        .foregroundStyle(tokens.colors.textSecondary)
                        .multilineTextAlignment(.center)
                        .fixedSize(horizontal: false, vertical: true)

                    ReguertaDialogActionsView(viewModel: viewModel)
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
        .onChange(of: viewModel.title) {
            isTitleFocused = true
        }
    }

    private func dismissIfAllowed() {
        guard viewModel.dismissible else { return }
        viewModel.onDismiss?()
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

    let viewModel: ReguertaDialogViewModel

    var body: some View {
        ZStack {
            Circle()
                .fill(viewModel.accentColor(tokens: tokens).opacity(0.22))
                .frame(width: 88, height: 88)

            Circle()
                .fill(viewModel.accentColor(tokens: tokens))
                .frame(width: 38, height: 38)

            Image(systemName: viewModel.symbolName)
                .font(.system(size: 18, weight: .bold))
                .symbolRenderingMode(.monochrome)
                .foregroundStyle(viewModel.contentColor(tokens: tokens))
        }
    }
}

private struct ReguertaDialogActionsView: View {
    @Environment(\.reguertaTokens) private var tokens
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    let viewModel: ReguertaDialogViewModel

    var body: some View {
        if let secondaryAction = viewModel.secondaryAction {
            if dynamicTypeSize.isAccessibilitySize {
                VStack(spacing: tokens.spacing.sm) {
                    dialogActionButton(viewModel.primaryAction, variant: viewModel.primaryButtonVariant)
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
                        LocalizedStringKey(viewModel.primaryAction.title),
                        variant: viewModel.primaryButtonVariant,
                        fullWidth: false,
                        fixedWidth: tokens.button.dialogTwoButtonsWidth
                    ) {
                        viewModel.primaryAction.action()
                    }
                }
            }
        } else {
            reguertaButton(
                LocalizedStringKey(viewModel.primaryAction.title),
                variant: viewModel.primaryButtonVariant,
                fullWidth: true,
                fixedWidth: nil
            ) {
                viewModel.primaryAction.action()
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

#Preview("ReguertaDialog", traits: .modifier(ReguertaDesignSystemPreviewModifier())) {
    reguertaDialog(
        type: .info,
        title: "Dialog title",
        message: "Dialog message",
        primaryAction: ReguertaDialogAction(title: "OK") {}
    )
}
