import SwiftUI

struct ShiftBoardCardView: View {
    let tokens: ReguertaDesignTokens
    let viewModel: ShiftsFeatureViewModel
    let shift: ShiftAssignment
    let shiftSwapCopy: ShiftSwapCopy
    let isHighlighted: Bool
    let onStartSwapRequestForShift: (String) -> Void

    private var leftColumnWidth: CGFloat {
        shift.type == .market ? 80.resize : 88.resize
    }

    private var leftAlignment: HorizontalAlignment {
        shift.type == .market ? .center : .leading
    }

    private var highlightedIndex: Int? {
        guard let currentMemberId = viewModel.currentMember?.id else { return nil }
        return viewModel.highlightedBoardNameIndex(for: shift, currentMemberId: currentMemberId)
    }

    private var canRequestSwap: Bool {
        guard let currentMemberId = viewModel.currentMember?.id else { return false }
        return viewModel.canRequestSwapForShift(shift, currentMemberId: currentMemberId)
    }

    private var leftLines: [ShiftBoardDisplayLine] {
        viewModel.shiftLeftBoardLines(shift, tokens: tokens).enumerated().map { index, line in
            ShiftBoardDisplayLine(id: "\(shift.id)-left-\(index)", line: line)
        }
    }

    private var boardNames: [ShiftBoardDisplayName] {
        viewModel.boardNames(for: shift).enumerated().map { index, name in
            ShiftBoardDisplayName(id: "\(shift.id)-name-\(index)", index: index, name: name)
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: tokens.spacing.sm) {
            HStack(alignment: .center, spacing: tokens.spacing.md) {
                VStack(alignment: leftAlignment, spacing: tokens.spacing.xs) {
                    ForEach(leftLines) { item in
                        Text(item.line.text)
                            .font(item.line.font)
                            .fontWeight(item.line.weight)
                            .foregroundStyle(item.line.color)
                            .multilineTextAlignment(shift.type == .market ? .center : .leading)
                    }
                }
                .frame(width: leftColumnWidth, alignment: shift.type == .market ? .center : .leading)

                VStack(alignment: .leading, spacing: tokens.spacing.xs) {
                    ForEach(boardNames) { item in
                        Text(item.name)
                            .font(boardNameFont(index: item.index))
                            .fontWeight(boardNameWeight(index: item.index))
                            .foregroundStyle(
                                highlightedIndex == item.index
                                ? tokens.colors.actionPrimary
                                : tokens.colors.textPrimary
                            )
                            .lineLimit(1)
                            .minimumScaleFactor(0.78)
                            .allowsTightening(true)
                    }
                    if shift.status != .planned {
                        Text(LocalizedStringKey(shift.status.titleKey))
                            .font(tokens.typography.label)
                            .foregroundStyle(tokens.colors.textSecondary)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            if highlightedIndex != nil && canRequestSwap {
                reguertaButton(
                    LocalizedStringKey(shiftSwapCopy.ask),
                    variant: .secondary,
                    fullWidth: false,
                    fixedWidth: 196.resize
                ) {
                    onStartSwapRequestForShift(shift.id)
                }
                .frame(maxWidth: .infinity, alignment: .center)
            }
        }
        .padding(tokens.spacing.lg)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(cardBackgroundColor)
        .overlay(
            RoundedRectangle(cornerRadius: tokens.radius.md)
                .stroke(tokens.colors.borderSubtle.opacity(0.55), lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: tokens.radius.md))
        .accessibilityElement(children: .combine)
    }

    private func boardNameFont(index: Int) -> Font {
        if shift.type == .market {
            return tokens.typography.bodySecondary
        }
        return index == 0 ? tokens.typography.body : tokens.typography.bodySecondary
    }

    private func boardNameWeight(index: Int) -> Font.Weight {
        if shift.type == .market {
            return .regular
        }
        return index == 0 ? .semibold : .regular
    }

    private var cardBackgroundColor: Color {
        if isHighlighted {
            return tokens.colors.feedbackWarning.opacity(0.15)
        }
        return tokens.colors.actionPrimary.opacity(0.15)
    }
}

private struct ShiftBoardDisplayLine: Identifiable {
    let id: String
    let line: ShiftBoardLine
}

private struct ShiftBoardDisplayName: Identifiable {
    let id: String
    let index: Int
    let name: String
}

struct ShiftSwapRequestRouteView: View {
    let tokens: ReguertaDesignTokens
    let viewModel: ShiftsFeatureViewModel
    let shift: ShiftAssignment?
    let shiftDisplayLabel: String
    let onSave: () -> Void

    private var shiftSwapCopy: ShiftSwapCopy {
        .localized
    }

    var body: some View {
        ScrollView(.vertical, showsIndicators: false) {
            reguertaCard {
                VStack(alignment: .leading, spacing: tokens.spacing.md) {
                    Text(shiftSwapCopy.subtitle)
                        .font(tokens.typography.bodySecondary)
                        .foregroundStyle(tokens.colors.textSecondary)
                    Text(shiftSwapCopy.shift(shiftDisplayLabel))
                        .font(tokens.typography.bodySecondary)
                    Text(
                        shiftSwapCopy.broadcastScope(
                            shift?.type == .market ? shiftSwapCopy.marketLabel : shiftSwapCopy.deliveryLabel
                        )
                    )
                    .font(tokens.typography.bodySecondary)
                    .foregroundStyle(tokens.colors.textSecondary)
                    Text(shiftSwapCopy.reasonLabel)
                        .font(tokens.typography.label)
                        .foregroundStyle(tokens.colors.textSecondary)
                    TextEditor(text: shiftSwapReasonBinding)
                        .frame(minHeight: 160.resize)
                        .padding(tokens.spacing.sm)
                        .background(tokens.colors.surfaceSecondary)
                        .clipShape(RoundedRectangle(cornerRadius: tokens.radius.sm))

                    reguertaButton(
                        LocalizedStringKey(viewModel.isSavingShiftSwapRequest ? shiftSwapCopy.sending : shiftSwapCopy.send),
                        isEnabled: !viewModel.isSavingShiftSwapRequest && !viewModel.shiftSwapDraft.shiftId.isEmpty,
                        isLoading: viewModel.isSavingShiftSwapRequest,
                        action: onSave
                    )
                }
            }
            .padding(.bottom, tokens.spacing.sm)
        }
        .scrollDismissesKeyboard(.interactively)
    }

    private var shiftSwapReasonBinding: Binding<String> {
        Binding(
            get: { viewModel.shiftSwapDraft.reason },
            set: { newValue in
                viewModel.updateShiftSwapDraft { $0.reason = newValue }
            }
        )
    }
}
