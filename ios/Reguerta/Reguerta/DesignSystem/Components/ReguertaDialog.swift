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
    let dismissible: Bool
    let onDismiss: (() -> Void)?

    init(
        type: ReguertaDialogType,
        title: String,
        message: String,
        primaryAction: ReguertaDialogAction,
        secondaryAction: ReguertaDialogAction? = nil,
        dismissible: Bool? = nil,
        onDismiss: (() -> Void)? = nil
    ) {
        self.type = type
        self.title = title
        self.message = message
        self.primaryAction = primaryAction
        self.secondaryAction = secondaryAction
        self.dismissible = dismissible ?? (onDismiss != nil)
        self.onDismiss = onDismiss
    }

    var body: some View {
        ZStack {
            dialogBackdropColor
                .ignoresSafeArea()
                .onTapGesture {
                    guard dismissible else { return }
                    onDismiss?()
                }

            VStack(spacing: tokens.spacing.md) {
                dialogIcon

                Text(title)
                    .font(tokens.typography.titleDialog)
                    .foregroundStyle(tokens.colors.textPrimary)
                    .multilineTextAlignment(.center)

                Text(message)
                    .font(tokens.typography.bodyDialog)
                    .foregroundStyle(tokens.colors.textSecondary)
                    .multilineTextAlignment(.center)

                if let secondaryAction {
                    HStack(spacing: tokens.spacing.sm) {
                        ReguertaButton(
                            LocalizedStringKey(secondaryAction.title),
                            variant: .secondary,
                            fullWidth: false,
                            fixedWidth: tokens.button.dialogTwoButtonsWidth
                        ) {
                            secondaryAction.action()
                        }

                        ReguertaButton(
                            LocalizedStringKey(primaryAction.title),
                            variant: type == .error ? .destructive : .primary,
                            fullWidth: false,
                            fixedWidth: tokens.button.dialogTwoButtonsWidth
                        ) {
                            primaryAction.action()
                        }
                    }
                    .padding(.top, tokens.spacing.sm)
                } else {
                    ReguertaButton(
                        LocalizedStringKey(primaryAction.title),
                        variant: type == .error ? .destructive : .primary,
                        fullWidth: true,
                        fixedWidth: nil
                    ) {
                        primaryAction.action()
                    }
                    .padding(.top, tokens.spacing.sm)
                }
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

            Circle()
                .fill(accentColor)
                .frame(width: 38, height: 38)

            Image(systemName: dialogSymbolName)
                .font(.system(size: 18, weight: .bold))
                .symbolRenderingMode(.monochrome)
                .foregroundStyle(tokens.colors.actionOnPrimary)
        }
    }

    private var dialogSymbolName: String {
        switch type {
        case .info:
            "info"
        case .error:
            "exclamationmark"
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
