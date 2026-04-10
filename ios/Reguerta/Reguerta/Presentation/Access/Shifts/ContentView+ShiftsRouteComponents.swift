import SwiftUI

struct ShiftBoardCardView: View {
    let tokens: ReguertaDesignTokens
    let shift: ShiftAssignment
    let currentMemberId: String?
    let currentSession: AuthorizedSession?
    let shiftSwapCopy: ShiftSwapCopy
    let shiftBoardLines: (ShiftAssignment) -> [ShiftBoardLine]
    let canRequestSwapForShift: (ShiftAssignment, String) -> Bool
    let onStartSwapRequestForShift: (String) -> Void

    private var leftColumnWidth: CGFloat {
        shift.type == .market ? 88.resize : 104.resize
    }

    private var leftAlignment: HorizontalAlignment {
        shift.type == .market ? .center : .leading
    }

    private var highlightedIndex: Int? {
        currentMemberId.flatMap { shift.highlightedBoardNameIndex(for: $0) }
    }

    private var canRequestSwap: Bool {
        guard let currentMemberId else { return false }
        return canRequestSwapForShift(shift, currentMemberId)
    }

    var body: some View {
        ReguertaCard {
            VStack(alignment: .leading, spacing: tokens.spacing.sm) {
                HStack(alignment: .top, spacing: tokens.spacing.md) {
                    VStack(alignment: leftAlignment, spacing: tokens.spacing.xs) {
                        ForEach(Array(shiftBoardLines(shift).enumerated()), id: \.offset) { _, line in
                            Text(line.text)
                                .font(line.font)
                                .fontWeight(line.weight)
                                .foregroundStyle(line.color)
                                .multilineTextAlignment(shift.type == .market ? .center : .leading)
                        }
                    }
                    .frame(width: leftColumnWidth, alignment: shift.type == .market ? .center : .leading)

                    VStack(alignment: .leading, spacing: tokens.spacing.xs) {
                        ForEach(Array(shift.boardNames(session: currentSession).enumerated()), id: \.offset) { index, name in
                            Text(name)
                                .font(boardNameFont(index: index))
                                .fontWeight(boardNameWeight(index: index))
                                .foregroundStyle(
                                    highlightedIndex == index
                                    ? tokens.colors.actionPrimary
                                    : tokens.colors.textPrimary
                                )
                        }
                        if shift.status != .planned {
                            Text(LocalizedStringKey(shift.status.titleKey))
                                .font(tokens.typography.label)
                                .foregroundStyle(tokens.colors.textSecondary)
                        }
                    }
                }
                if highlightedIndex != nil && canRequestSwap {
                    ReguertaButton(LocalizedStringKey(shiftSwapCopy.ask), variant: .text, fullWidth: false) {
                        onStartSwapRequestForShift(shift.id)
                    }
                }
            }
        }
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
}

struct ShiftSwapRequestRouteView: View {
    let tokens: ReguertaDesignTokens
    let shift: ShiftAssignment?
    let shiftSwapDraftShiftId: String
    @Binding var shiftSwapReason: String
    let isSavingShiftSwapRequest: Bool
    let shiftSwapCopy: ShiftSwapCopy
    let shiftDisplayLabel: String
    let onSave: () -> Void
    let onBack: () -> Void

    var body: some View {
        ReguertaCard {
            VStack(alignment: .leading, spacing: tokens.spacing.md) {
                Text(shiftSwapCopy.title)
                    .font(tokens.typography.titleCard)
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
                TextEditor(text: $shiftSwapReason)
                    .frame(minHeight: 160.resize)
                    .padding(tokens.spacing.sm)
                    .background(tokens.colors.surfaceSecondary)
                    .clipShape(RoundedRectangle(cornerRadius: tokens.radius.sm))

                ReguertaButton(
                    LocalizedStringKey(isSavingShiftSwapRequest ? shiftSwapCopy.sending : shiftSwapCopy.send),
                    isEnabled: !isSavingShiftSwapRequest && !shiftSwapDraftShiftId.isEmpty,
                    isLoading: isSavingShiftSwapRequest,
                    action: onSave
                )
                ReguertaButton(LocalizedStringKey(shiftSwapCopy.back), variant: .text, action: onBack)
            }
        }
    }
}
