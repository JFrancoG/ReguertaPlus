import SwiftUI

private struct ShiftSwapResponseOption {
    let request: ShiftSwapRequest
    let candidate: ShiftSwapCandidate
}

struct ShiftsRouteView: View {
    let tokens: ReguertaDesignTokens
    let viewModel: ShiftsFeatureViewModel
    let onRefreshFromNextShifts: () -> Void
    let onStartSwapRequestForShift: (String) -> Void

    private var shiftSwapCopy: ShiftSwapCopy {
        .localized
    }

    private func localizedKey(_ key: String) -> LocalizedStringKey {
        LocalizedStringKey(key)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: tokens.spacing.lg) {
            reguertaCard {
                VStack(alignment: .leading, spacing: tokens.spacing.sm) {
                    Text(localizedKey(AccessL10nKey.shiftsListSubtitle))
                        .font(tokens.typography.bodySecondary)
                        .foregroundStyle(tokens.colors.textSecondary)
                    reguertaButton(localizedKey(AccessL10nKey.shiftsRefreshAction), variant: .text) {
                        Task { await viewModel.refreshShifts() }
                    }
                }
            }

            NextShiftsCardView(
                tokens: tokens,
                isLoading: viewModel.isLoadingShifts,
                nextDeliverySummary: viewModel.nextDeliveryShift.map(viewModel.shiftSummary) ?? l10n(AccessL10nKey.shiftsNextPending),
                nextMarketSummary: viewModel.nextMarketShift.map(viewModel.shiftSummary) ?? l10n(AccessL10nKey.shiftsNextPending),
                onViewAll: onRefreshFromNextShifts
            )

            ShiftSwapRequestsCardView(
                tokens: tokens,
                viewModel: viewModel,
                shiftSwapCopy: shiftSwapCopy
            )

            if viewModel.isLoadingShifts {
                reguertaCard {
                    Text(localizedKey(AccessL10nKey.shiftsLoading))
                        .font(tokens.typography.bodySecondary)
                }
            } else if viewModel.shiftsFeed.isEmpty {
                reguertaCard {
                    Text(localizedKey(AccessL10nKey.shiftsEmptyState))
                        .font(tokens.typography.bodySecondary)
                        .foregroundStyle(tokens.colors.textSecondary)
                }
            } else {
                Picker("", selection: selectedShiftSegmentBinding) {
                    ForEach(ShiftBoardSegment.allCases, id: \.self) { segment in
                        Text(localizedKey(segment.titleKey)).tag(segment)
                    }
                }
                .pickerStyle(.segmented)

                if viewModel.visibleShifts.isEmpty {
                    reguertaCard {
                        Text(localizedKey(AccessL10nKey.shiftsEmptyState))
                            .font(tokens.typography.bodySecondary)
                            .foregroundStyle(tokens.colors.textSecondary)
                    }
                } else {
                    ForEach(viewModel.visibleShifts) { shift in
                        ShiftBoardCardView(
                            tokens: tokens,
                            viewModel: viewModel,
                            shift: shift,
                            shiftSwapCopy: shiftSwapCopy,
                            onStartSwapRequestForShift: onStartSwapRequestForShift
                        )
                    }
                }
            }
        }
    }

    private var selectedShiftSegmentBinding: Binding<ShiftBoardSegment> {
        Binding(
            get: { viewModel.selectedShiftSegment },
            set: { viewModel.selectedShiftSegment = $0 }
        )
    }
}

private struct ShiftSwapRequestsCardView: View {
    let tokens: ReguertaDesignTokens
    let viewModel: ShiftsFeatureViewModel
    let shiftSwapCopy: ShiftSwapCopy

    private var segmentType: ShiftType {
        viewModel.selectedShiftSegment == .delivery ? .delivery : .market
    }

    private var relevantRequests: [ShiftSwapRequest] {
        viewModel.shiftSwapRequests.filter { request in
            guard let shift = viewModel.shiftsFeed.first(where: { $0.id == request.requestedShiftId }) else { return false }
            return shift.type == segmentType
        }
    }

    private var incoming: [(ShiftSwapRequest, ShiftSwapCandidate)] {
        relevantRequests.flatMap { request in
            request.candidates
                .filter { $0.userId == viewModel.currentMember?.id }
                .filter { candidate in
                    request.status == .open &&
                        !request.responses.contains(where: { $0.userId == candidate.userId && $0.shiftId == candidate.shiftId })
                }
                .map { (request, $0) }
        }
    }

    private var requesterOpen: [ShiftSwapRequest] {
        relevantRequests.filter { $0.requesterUserId == viewModel.currentMember?.id && $0.status == .open }
    }

    private var availableResponses: [ShiftSwapResponseOption] {
        requesterOpen.flatMap { request in
            request.availableResponses.compactMap { response in
                request.candidates.first(where: { $0.userId == response.userId && $0.shiftId == response.shiftId }).map {
                    ShiftSwapResponseOption(
                        request: request,
                        candidate: $0
                    )
                }
            }
        }
    }

    private var outgoing: [ShiftSwapRequest] {
        requesterOpen.filter { $0.availableResponses.isEmpty }
    }

    private var history: [ShiftSwapRequest] {
        relevantRequests.filter {
            $0.status != .open && !viewModel.dismissedShiftSwapRequestIds.contains($0.id)
        }
    }

    var body: some View {
        reguertaCard {
            VStack(alignment: .leading, spacing: tokens.spacing.md) {
                Text(shiftSwapCopy.requestsTitle)
                    .font(tokens.typography.titleCard)
                Text(shiftSwapCopy.requestsSubtitle)
                    .font(tokens.typography.bodySecondary)
                    .foregroundStyle(tokens.colors.textSecondary)

                if relevantRequests.isEmpty {
                    Text(shiftSwapCopy.empty)
                        .font(tokens.typography.bodySecondary)
                        .foregroundStyle(tokens.colors.textSecondary)
                } else {
                    if !incoming.isEmpty {
                        incomingSection
                    }
                    if !availableResponses.isEmpty {
                        availableResponsesSection
                    }
                    if !outgoing.isEmpty {
                        outgoingSection
                    }
                    if !history.isEmpty {
                        historySection
                    }
                }
            }
        }
    }

    private var incomingSection: some View {
        VStack(alignment: .leading, spacing: tokens.spacing.sm) {
            Text(shiftSwapCopy.incoming)
                .font(tokens.typography.label.weight(.semibold))
                .foregroundStyle(tokens.colors.actionPrimary)
            ForEach(Array(incoming.enumerated()), id: \.offset) { _, item in
                incomingRow(item.0, candidate: item.1)
            }
        }
    }

    private func incomingRow(_ request: ShiftSwapRequest, candidate: ShiftSwapCandidate) -> some View {
        let requestedShift = viewModel.shiftsFeed.first(where: { $0.id == request.requestedShiftId })
        let candidateShift = viewModel.shiftsFeed.first(where: { $0.id == candidate.shiftId })

        return VStack(alignment: .leading, spacing: tokens.spacing.xs) {
            Text(shiftSwapCopy.requestedBy(viewModel.displayNameForSwap(request.requesterUserId)))
                .font(tokens.typography.body.weight(.semibold))
            Text(shiftSwapCopy.shift(requestedShift.map { viewModel.shiftSwapDisplayLabel($0, memberId: request.requesterUserId) } ?? request.requestedShiftId))
                .font(tokens.typography.label)
            Text(shiftSwapCopy.offerShift(candidateShift.map { viewModel.shiftSwapDisplayLabel($0, memberId: candidate.userId) } ?? candidate.shiftId))
                .font(tokens.typography.label)
            Text(shiftSwapCopy.reason(request.reason.isEmpty ? shiftSwapCopy.noReason : request.reason))
                .font(tokens.typography.label)
                .foregroundStyle(tokens.colors.textSecondary)
            HStack(spacing: tokens.spacing.sm) {
                reguertaButton(LocalizedStringKey(shiftSwapCopy.acceptShort), fullWidth: false) {
                    viewModel.acceptShiftSwapRequest(requestId: request.id, candidateShiftId: candidate.shiftId)
                }
                reguertaButton(LocalizedStringKey(shiftSwapCopy.rejectShort), variant: .text, fullWidth: false) {
                    viewModel.rejectShiftSwapRequest(requestId: request.id, candidateShiftId: candidate.shiftId)
                }
            }
        }
        .padding(tokens.spacing.sm)
        .background(tokens.colors.surfaceSecondary)
        .clipShape(RoundedRectangle(cornerRadius: tokens.radius.sm))
    }

    private var availableResponsesSection: some View {
        VStack(alignment: .leading, spacing: tokens.spacing.sm) {
            Text(shiftSwapCopy.responses)
                .font(tokens.typography.label.weight(.semibold))
                .foregroundStyle(tokens.colors.actionPrimary)
            ForEach(Array(availableResponses.enumerated()), id: \.offset) { _, item in
                let request = item.request
                let candidate = item.candidate
                let requestedShift = viewModel.shiftsFeed.first(where: { $0.id == request.requestedShiftId })
                let candidateShift = viewModel.shiftsFeed.first(where: { $0.id == candidate.shiftId })

                VStack(alignment: .leading, spacing: tokens.spacing.xs) {
                    Text(viewModel.displayNameForSwap(candidate.userId))
                        .font(tokens.typography.body.weight(.semibold))
                    Text(shiftSwapCopy.confirmBeforeAfter(
                        requestedShift.map { viewModel.shiftSwapDisplayLabel($0, memberId: request.requesterUserId) } ?? request.requestedShiftId,
                        candidateShift.map { viewModel.shiftSwapDisplayLabel($0, memberId: candidate.userId) } ?? candidate.shiftId
                    ))
                    .font(tokens.typography.label)
                    reguertaButton(LocalizedStringKey(shiftSwapCopy.confirm), fullWidth: false) {
                        viewModel.confirmShiftSwapRequest(requestId: request.id, candidateShiftId: candidate.shiftId)
                    }
                }
                .padding(tokens.spacing.sm)
                .background(tokens.colors.surfaceSecondary)
                .clipShape(RoundedRectangle(cornerRadius: tokens.radius.sm))
            }
        }
    }

    private var outgoingSection: some View {
        VStack(alignment: .leading, spacing: tokens.spacing.sm) {
            Text(shiftSwapCopy.outgoing)
                .font(tokens.typography.label.weight(.semibold))
                .foregroundStyle(tokens.colors.actionPrimary)
            ForEach(outgoing) { request in
                let shift = viewModel.shiftsFeed.first(where: { $0.id == request.requestedShiftId })

                VStack(alignment: .leading, spacing: tokens.spacing.xs) {
                    Text(shift.map { viewModel.shiftSwapDisplayLabel($0, memberId: request.requesterUserId) } ?? request.requestedShiftId)
                        .font(tokens.typography.body.weight(.semibold))
                    Text(shiftSwapCopy.waitingMany(Set(request.candidates.map(\.userId)).count))
                        .font(tokens.typography.label)
                        .foregroundStyle(tokens.colors.textSecondary)
                    reguertaButton(LocalizedStringKey(shiftSwapCopy.cancel), variant: .text, fullWidth: false) {
                        viewModel.cancelShiftSwapRequest(requestId: request.id)
                    }
                }
                .padding(tokens.spacing.sm)
                .background(tokens.colors.surfaceSecondary)
                .clipShape(RoundedRectangle(cornerRadius: tokens.radius.sm))
            }
        }
    }

    private var historySection: some View {
        VStack(alignment: .leading, spacing: tokens.spacing.sm) {
            Text(shiftSwapCopy.history)
                .font(tokens.typography.label.weight(.semibold))
                .foregroundStyle(tokens.colors.actionPrimary)
            ForEach(history) { request in
                let shift = viewModel.shiftsFeed.first(where: { $0.id == request.requestedShiftId })

                VStack(alignment: .leading, spacing: tokens.spacing.xs) {
                    Text(shift.map { viewModel.shiftSwapDisplayLabel($0, memberId: request.requesterUserId) } ?? request.requestedShiftId)
                        .font(tokens.typography.body.weight(.semibold))
                    Text(shiftSwapCopy.requestedBy(viewModel.displayNameForSwap(request.requesterUserId)))
                        .font(tokens.typography.label)
                    Text(shiftSwapCopy.reason(request.reason.isEmpty ? shiftSwapCopy.noReason : request.reason))
                        .font(tokens.typography.label)
                        .foregroundStyle(tokens.colors.textSecondary)
                    Text(viewModel.shiftSwapStatusLabel(request.status))
                        .font(tokens.typography.label)
                        .foregroundStyle(tokens.colors.actionPrimary)
                    if let selectedUserId = request.selectedCandidateUserId {
                        Text(shiftSwapCopy.selected(viewModel.displayNameForSwap(selectedUserId)))
                            .font(tokens.typography.label)
                            .foregroundStyle(tokens.colors.textSecondary)
                    }
                    if request.status == .applied {
                        reguertaButton(LocalizedStringKey(shiftSwapCopy.acknowledge), variant: .text, fullWidth: false) {
                            viewModel.dismissShiftSwapActivity(requestId: request.id)
                        }
                    }
                }
                .padding(tokens.spacing.sm)
                .background(tokens.colors.surfaceSecondary)
                .clipShape(RoundedRectangle(cornerRadius: tokens.radius.sm))
            }
        }
    }
}
