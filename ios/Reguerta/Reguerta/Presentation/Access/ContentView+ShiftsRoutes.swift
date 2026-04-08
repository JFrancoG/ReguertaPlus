import SwiftUI

private struct ShiftSwapResponseOption {
    let request: ShiftSwapRequest
    let candidate: ShiftSwapCandidate
}

struct ShiftsRouteView: View {
    let tokens: ReguertaDesignTokens
    @Binding var selectedShiftSegment: ShiftBoardSegment
    let isLoadingShifts: Bool
    let shiftsFeed: [ShiftAssignment]
    let shiftSwapRequests: [ShiftSwapRequest]
    let dismissedShiftSwapRequestIds: Set<String>
    let currentMemberId: String?
    let currentSession: AuthorizedSession?
    let shiftSwapCopy: ShiftSwapCopy
    let nextShiftsIsLoading: Bool
    let nextDeliverySummary: String
    let nextMarketSummary: String
    let onRefreshShifts: () -> Void
    let onRefreshFromNextShifts: () -> Void
    let onStartSwapRequestForShift: (String) -> Void
    let onAcceptIncomingCandidate: (String, String) -> Void
    let onRejectIncomingCandidate: (String, String) -> Void
    let onConfirmResponse: (String, String) -> Void
    let onCancelOwnRequest: (String) -> Void
    let onDismissAppliedRequest: (String) -> Void
    let shiftBoardLines: (ShiftAssignment) -> [ShiftBoardLine]
    let shiftSwapDisplayLabel: (ShiftAssignment, String?) -> String
    let displayNameForSwap: (String) -> String
    let shiftSwapStatusLabel: (ShiftSwapRequestStatus) -> String
    let canRequestSwapForShift: (ShiftAssignment, String) -> Bool

    private var deliveryShifts: [ShiftAssignment] {
        shiftsFeed
            .filter { $0.type == .delivery }
            .sorted { $0.dateMillis < $1.dateMillis }
    }

    private var marketShifts: [ShiftAssignment] {
        shiftsFeed
            .filter { $0.type == .market }
            .sorted { $0.dateMillis < $1.dateMillis }
    }

    private var visibleShifts: [ShiftAssignment] {
        selectedShiftSegment == .delivery ? deliveryShifts : marketShifts
    }

    private func localizedKey(_ key: String) -> LocalizedStringKey {
        LocalizedStringKey(key)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: tokens.spacing.lg) {
            ReguertaCard {
                VStack(alignment: .leading, spacing: tokens.spacing.sm) {
                    Text(localizedKey(AccessL10nKey.shifts))
                        .font(tokens.typography.titleCard)
                    Text(localizedKey(AccessL10nKey.shiftsListSubtitle))
                        .font(tokens.typography.bodySecondary)
                        .foregroundStyle(tokens.colors.textSecondary)
                    ReguertaButton(localizedKey(AccessL10nKey.shiftsRefreshAction), variant: .text, action: onRefreshShifts)
                }
            }

            NextShiftsCardView(
                tokens: tokens,
                isLoading: nextShiftsIsLoading,
                nextDeliverySummary: nextDeliverySummary,
                nextMarketSummary: nextMarketSummary,
                onViewAll: onRefreshFromNextShifts
            )

            ShiftSwapRequestsCardView(
                tokens: tokens,
                shiftSwapCopy: shiftSwapCopy,
                selectedShiftSegment: selectedShiftSegment,
                shiftsFeed: shiftsFeed,
                shiftSwapRequests: shiftSwapRequests,
                dismissedShiftSwapRequestIds: dismissedShiftSwapRequestIds,
                currentMemberId: currentMemberId,
                shiftSwapDisplayLabel: shiftSwapDisplayLabel,
                displayNameForSwap: displayNameForSwap,
                shiftSwapStatusLabel: shiftSwapStatusLabel,
                onAcceptIncomingCandidate: onAcceptIncomingCandidate,
                onRejectIncomingCandidate: onRejectIncomingCandidate,
                onConfirmResponse: onConfirmResponse,
                onCancelOwnRequest: onCancelOwnRequest,
                onDismissAppliedRequest: onDismissAppliedRequest
            )

            if isLoadingShifts {
                ReguertaCard {
                    Text(localizedKey(AccessL10nKey.shiftsLoading))
                        .font(tokens.typography.bodySecondary)
                }
            } else if shiftsFeed.isEmpty {
                ReguertaCard {
                    Text(localizedKey(AccessL10nKey.shiftsEmptyState))
                        .font(tokens.typography.bodySecondary)
                        .foregroundStyle(tokens.colors.textSecondary)
                }
            } else {
                Picker("", selection: $selectedShiftSegment) {
                    ForEach(ShiftBoardSegment.allCases, id: \.self) { segment in
                        Text(localizedKey(segment.titleKey)).tag(segment)
                    }
                }
                .pickerStyle(.segmented)

                if visibleShifts.isEmpty {
                    ReguertaCard {
                        Text(localizedKey(AccessL10nKey.shiftsEmptyState))
                            .font(tokens.typography.bodySecondary)
                            .foregroundStyle(tokens.colors.textSecondary)
                    }
                } else {
                    ForEach(visibleShifts) { shift in
                        ShiftBoardCardView(
                            tokens: tokens,
                            shift: shift,
                            currentMemberId: currentMemberId,
                            currentSession: currentSession,
                            shiftSwapCopy: shiftSwapCopy,
                            shiftBoardLines: shiftBoardLines,
                            canRequestSwapForShift: canRequestSwapForShift,
                            onStartSwapRequestForShift: onStartSwapRequestForShift
                        )
                    }
                }
            }
        }
    }
}

private struct ShiftSwapRequestsCardView: View {
    let tokens: ReguertaDesignTokens
    let shiftSwapCopy: ShiftSwapCopy
    let selectedShiftSegment: ShiftBoardSegment
    let shiftsFeed: [ShiftAssignment]
    let shiftSwapRequests: [ShiftSwapRequest]
    let dismissedShiftSwapRequestIds: Set<String>
    let currentMemberId: String?
    let shiftSwapDisplayLabel: (ShiftAssignment, String?) -> String
    let displayNameForSwap: (String) -> String
    let shiftSwapStatusLabel: (ShiftSwapRequestStatus) -> String
    let onAcceptIncomingCandidate: (String, String) -> Void
    let onRejectIncomingCandidate: (String, String) -> Void
    let onConfirmResponse: (String, String) -> Void
    let onCancelOwnRequest: (String) -> Void
    let onDismissAppliedRequest: (String) -> Void

    private var segmentType: ShiftType {
        selectedShiftSegment == .delivery ? .delivery : .market
    }

    private var relevantRequests: [ShiftSwapRequest] {
        shiftSwapRequests.filter { request in
            guard let shift = shiftsFeed.first(where: { $0.id == request.requestedShiftId }) else { return false }
            return shift.type == segmentType
        }
    }

    private var incoming: [(ShiftSwapRequest, ShiftSwapCandidate)] {
        relevantRequests.flatMap { request in
            request.candidates
                .filter { $0.userId == currentMemberId }
                .filter { candidate in
                    request.status == .open &&
                        !request.responses.contains(where: { $0.userId == candidate.userId && $0.shiftId == candidate.shiftId })
                }
                .map { (request, $0) }
        }
    }

    private var requesterOpen: [ShiftSwapRequest] {
        relevantRequests.filter { $0.requesterUserId == currentMemberId && $0.status == .open }
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
            $0.status != .open && !dismissedShiftSwapRequestIds.contains($0.id)
        }
    }

    var body: some View {
        ReguertaCard {
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
        let requestedShift = shiftsFeed.first(where: { $0.id == request.requestedShiftId })
        let candidateShift = shiftsFeed.first(where: { $0.id == candidate.shiftId })

        return VStack(alignment: .leading, spacing: tokens.spacing.xs) {
            Text(shiftSwapCopy.requestedBy(displayNameForSwap(request.requesterUserId)))
                .font(tokens.typography.body.weight(.semibold))
            Text(shiftSwapCopy.shift(requestedShift.map { shiftSwapDisplayLabel($0, request.requesterUserId) } ?? request.requestedShiftId))
                .font(tokens.typography.label)
            Text(shiftSwapCopy.offerShift(candidateShift.map { shiftSwapDisplayLabel($0, candidate.userId) } ?? candidate.shiftId))
                .font(tokens.typography.label)
            Text(shiftSwapCopy.reason(request.reason.isEmpty ? shiftSwapCopy.noReason : request.reason))
                .font(tokens.typography.label)
                .foregroundStyle(tokens.colors.textSecondary)
            HStack(spacing: tokens.spacing.sm) {
                ReguertaButton(LocalizedStringKey(shiftSwapCopy.acceptShort), fullWidth: false) {
                    onAcceptIncomingCandidate(request.id, candidate.shiftId)
                }
                ReguertaButton(LocalizedStringKey(shiftSwapCopy.rejectShort), variant: .text, fullWidth: false) {
                    onRejectIncomingCandidate(request.id, candidate.shiftId)
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
                let requestedShift = shiftsFeed.first(where: { $0.id == request.requestedShiftId })
                let candidateShift = shiftsFeed.first(where: { $0.id == candidate.shiftId })

                VStack(alignment: .leading, spacing: tokens.spacing.xs) {
                    Text(displayNameForSwap(candidate.userId))
                        .font(tokens.typography.body.weight(.semibold))
                    Text(shiftSwapCopy.confirmBeforeAfter(
                        requestedShift.map { shiftSwapDisplayLabel($0, request.requesterUserId) } ?? request.requestedShiftId,
                        candidateShift.map { shiftSwapDisplayLabel($0, candidate.userId) } ?? candidate.shiftId
                    ))
                    .font(tokens.typography.label)
                    ReguertaButton(LocalizedStringKey(shiftSwapCopy.confirm), fullWidth: false) {
                        onConfirmResponse(request.id, candidate.shiftId)
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
                let shift = shiftsFeed.first(where: { $0.id == request.requestedShiftId })

                VStack(alignment: .leading, spacing: tokens.spacing.xs) {
                    Text(shift.map { shiftSwapDisplayLabel($0, request.requesterUserId) } ?? request.requestedShiftId)
                        .font(tokens.typography.body.weight(.semibold))
                    Text(shiftSwapCopy.waitingMany(Set(request.candidates.map(\.userId)).count))
                        .font(tokens.typography.label)
                        .foregroundStyle(tokens.colors.textSecondary)
                    ReguertaButton(LocalizedStringKey(shiftSwapCopy.cancel), variant: .text, fullWidth: false) {
                        onCancelOwnRequest(request.id)
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
                let shift = shiftsFeed.first(where: { $0.id == request.requestedShiftId })

                VStack(alignment: .leading, spacing: tokens.spacing.xs) {
                    Text(shift.map { shiftSwapDisplayLabel($0, request.requesterUserId) } ?? request.requestedShiftId)
                        .font(tokens.typography.body.weight(.semibold))
                    Text(shiftSwapCopy.requestedBy(displayNameForSwap(request.requesterUserId)))
                        .font(tokens.typography.label)
                    Text(shiftSwapCopy.reason(request.reason.isEmpty ? shiftSwapCopy.noReason : request.reason))
                        .font(tokens.typography.label)
                        .foregroundStyle(tokens.colors.textSecondary)
                    Text(shiftSwapStatusLabel(request.status))
                        .font(tokens.typography.label)
                        .foregroundStyle(tokens.colors.actionPrimary)
                    if let selectedUserId = request.selectedCandidateUserId {
                        Text(shiftSwapCopy.selected(displayNameForSwap(selectedUserId)))
                            .font(tokens.typography.label)
                            .foregroundStyle(tokens.colors.textSecondary)
                    }
                    if request.status == .applied {
                        ReguertaButton(LocalizedStringKey(shiftSwapCopy.acknowledge), variant: .text, fullWidth: false) {
                            onDismissAppliedRequest(request.id)
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
