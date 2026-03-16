import SwiftUI

enum ReguertaDialogType {
    case info
    case error
}

struct ReguertaDialogAction {
    let title: String
    let action: () -> Void
}

struct ReguertaDialog: View {
    @Environment(\.reguertaTokens) private var tokens

    let type: ReguertaDialogType
    let title: String
    let message: String
    let primaryAction: ReguertaDialogAction
    let secondaryAction: ReguertaDialogAction?
    let onDismiss: (() -> Void)?

    init(
        type: ReguertaDialogType,
        title: String,
        message: String,
        primaryAction: ReguertaDialogAction,
        secondaryAction: ReguertaDialogAction? = nil,
        onDismiss: (() -> Void)? = nil
    ) {
        self.type = type
        self.title = title
        self.message = message
        self.primaryAction = primaryAction
        self.secondaryAction = secondaryAction
        self.onDismiss = onDismiss
    }

    var body: some View {
        ZStack {
            dialogBackdropColor
                .ignoresSafeArea()
                .onTapGesture {
                    onDismiss?()
                }

            VStack(spacing: tokens.spacing.md) {
                dialogIcon

                Text(title)
                    .font(tokens.typography.titleSection)
                    .foregroundStyle(tokens.colors.textPrimary)
                    .multilineTextAlignment(.center)

                Text(message)
                    .font(tokens.typography.bodySecondary)
                    .foregroundStyle(tokens.colors.textSecondary)
                    .multilineTextAlignment(.center)

                HStack(spacing: tokens.spacing.sm) {
                    if let secondaryAction {
                        ReguertaButton(
                            LocalizedStringKey(secondaryAction.title),
                            variant: .secondary,
                            fullWidth: false,
                            fixedWidth: tokens.button.dialogTwoButtonsWidth
                        ) {
                            secondaryAction.action()
                        }
                    }

                    ReguertaButton(
                        LocalizedStringKey(primaryAction.title),
                        variant: type == .error ? .destructive : .primary,
                        fullWidth: false,
                        fixedWidth: secondaryAction == nil
                            ? tokens.button.dialogSingleWidth
                            : tokens.button.dialogTwoButtonsWidth
                    ) {
                        primaryAction.action()
                    }
                }
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
    }

    private var dialogIcon: some View {
        ZStack {
            Circle()
                .fill(accentColor.opacity(0.22))
                .frame(width: 88, height: 88)

            Image(systemName: type == .error ? "exclamationmark.triangle.fill" : "info.circle.fill")
                .font(.system(size: 34, weight: .semibold))
                .foregroundStyle(accentColor)
        }
    }

    private var accentColor: Color {
        switch type {
        case .info:
            tokens.colors.actionPrimary
        case .error:
            tokens.colors.feedbackError
        }
    }

    private var dialogBackdropColor: Color {
        Color("dialogBack")
    }
}
