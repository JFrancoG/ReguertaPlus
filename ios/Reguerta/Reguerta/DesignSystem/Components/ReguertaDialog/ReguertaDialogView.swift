import SwiftUI

struct ReguertaDialogView: View {
    @Environment(\.reguertaTokens) private var tokens

    let viewModel: ReguertaDialogViewModel

    var body: some View {
        ZStack {
            Color("dialogBack")
                .ignoresSafeArea()
                .onTapGesture(perform: dismissIfAllowed)

            VStack(spacing: tokens.spacing.md) {
                ReguertaDialogIconView(viewModel: viewModel)

                Text(viewModel.title)
                    .font(tokens.typography.titleDialog)
                    .foregroundStyle(tokens.colors.textPrimary)
                    .multilineTextAlignment(.center)

                Text(viewModel.message)
                    .font(tokens.typography.bodyDialog)
                    .foregroundStyle(tokens.colors.textSecondary)
                    .multilineTextAlignment(.center)

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
            .padding(tokens.spacing.lg)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func dismissIfAllowed() {
        guard viewModel.dismissible else { return }
        viewModel.onDismiss?()
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
                .foregroundStyle(tokens.colors.actionOnPrimary)
        }
    }
}

private struct ReguertaDialogActionsView: View {
    @Environment(\.reguertaTokens) private var tokens

    let viewModel: ReguertaDialogViewModel

    var body: some View {
        if let secondaryAction = viewModel.secondaryAction {
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
}

#Preview("ReguertaDialog") {
    reguertaDialog(
        type: .info,
        title: "Dialog title",
        message: "Dialog message",
        primaryAction: ReguertaDialogAction(title: "OK") {}
    )
}
