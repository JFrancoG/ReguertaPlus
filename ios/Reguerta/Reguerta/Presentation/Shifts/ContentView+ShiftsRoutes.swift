import SwiftUI

private struct IncomingShiftSwapOption: Identifiable {
    let request: ShiftSwapRequest
    let candidate: ShiftSwapCandidate

    var id: String {
        "\(request.id):\(candidate.userId):\(candidate.shiftId)"
    }
}

struct ShiftsRouteView: View {
    let tokens: ReguertaDesignTokens
    let viewModel: ShiftsFeatureViewModel
    let onStartSwapRequestForShift: (String) -> Void

    private var shiftSwapCopy: ShiftSwapCopy {
        .localized
    }

    var body: some View {
        VStack(alignment: .leading, spacing: tokens.spacing.lg) {
            if viewModel.hasVisibleShiftSwapActivity {
                ShiftSwapRequestsCardView(
                    tokens: tokens,
                    viewModel: viewModel,
                    shiftSwapCopy: shiftSwapCopy
                )
            }

            MyNextShiftsSectionView(
                tokens: tokens,
                viewModel: viewModel
            )

            ShiftBoardSectionView(
                tokens: tokens,
                viewModel: viewModel,
                shiftSwapCopy: shiftSwapCopy,
                onStartSwapRequestForShift: onStartSwapRequestForShift
            )
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}

private struct MyNextShiftsSectionView: View {
    let tokens: ReguertaDesignTokens
    let viewModel: ShiftsFeatureViewModel

    private func localizedKey(_ key: String) -> LocalizedStringKey {
        LocalizedStringKey(key)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: tokens.spacing.sm) {
            Text(localizedKey(AccessL10nKey.shiftsNextTitle))
                .font(tokens.typography.titleCard)
                .accessibilityAddTraits(.isHeader)

            if viewModel.isLoadingShifts {
                Text(localizedKey(AccessL10nKey.shiftsLoading))
                    .font(tokens.typography.bodySecondary)
                    .foregroundStyle(tokens.colors.textSecondary)
            } else {
                reguertaCard {
                    VStack(alignment: .leading, spacing: tokens.spacing.sm) {
                        nextShiftRow(titleKey: AccessL10nKey.shiftsTypeDelivery) {
                            VStack(alignment: .leading, spacing: tokens.spacing.sm) {
                                nextDateLine(
                                    titleKey: AccessL10nKey.shiftsNextDeliveryHelper,
                                    value: dateLabel(viewModel.nextDeliveryHelperShift),
                                    prominent: false
                                )
                                nextDateLine(
                                    titleKey: AccessL10nKey.shiftsNextDeliveryLead,
                                    value: dateLabel(viewModel.nextDeliveryLeadShift),
                                    prominent: true
                                )
                            }
                        }
                        Divider()
                            .overlay(tokens.colors.borderSubtle.opacity(0.65))
                        nextShiftRow(titleKey: AccessL10nKey.shiftsTypeMarket) {
                            Text(dateLabel(viewModel.nextMarketAssignedShift))
                                .font(tokens.typography.titleCard)
                                .fontWeight(.semibold)
                                .foregroundStyle(tokens.colors.textPrimary)
                                .lineLimit(1)
                                .minimumScaleFactor(0.82)
                        }
                    }
                }
                .accessibilityElement(children: .combine)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func nextShiftRow<Content: View>(
        titleKey: String,
        @ViewBuilder content: () -> Content
    ) -> some View {
        HStack(alignment: .top, spacing: tokens.spacing.lg) {
            Text(localizedKey(titleKey))
                .font(tokens.typography.body.weight(.semibold))
                .foregroundStyle(tokens.colors.actionPrimary)
                .frame(width: 104, alignment: .leading)

            content()
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func nextDateLine(titleKey: String, value: String, prominent: Bool) -> some View {
        Text("\(value) \(l10n(titleKey))")
            .font(prominent ? tokens.typography.titleCard : tokens.typography.bodySecondary)
            .fontWeight(prominent ? .semibold : .regular)
            .foregroundStyle(tokens.colors.textPrimary)
            .lineLimit(1)
            .minimumScaleFactor(0.82)
    }

    private func dateLabel(_ shift: ShiftAssignment?) -> String {
        shift.map(viewModel.localizedEffectiveShortDateOnly) ?? l10n(AccessL10nKey.shiftsNextPending)
    }
}

private struct ShiftBoardSectionView: View {
    let tokens: ReguertaDesignTokens
    let viewModel: ShiftsFeatureViewModel
    let shiftSwapCopy: ShiftSwapCopy
    let onStartSwapRequestForShift: (String) -> Void

    private func localizedKey(_ key: String) -> LocalizedStringKey {
        LocalizedStringKey(key)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: tokens.spacing.md) {
            Picker("", selection: selectedShiftSegmentBinding) {
                ForEach(ShiftBoardSegment.allCases, id: \.self) { segment in
                    Text(localizedKey(segment.titleKey)).tag(segment)
                }
            }
            .pickerStyle(.segmented)
            .accessibilityLabel(localizedKey(AccessL10nKey.shifts))

            if viewModel.isLoadingShifts {
                reguertaCard {
                    Text(localizedKey(AccessL10nKey.shiftsLoading))
                        .font(tokens.typography.bodySecondary)
                }
            } else if viewModel.visibleShifts.isEmpty {
                reguertaCard {
                    Text(localizedKey(AccessL10nKey.shiftsEmptyState))
                        .font(tokens.typography.bodySecondary)
                        .foregroundStyle(tokens.colors.textSecondary)
                }
            } else {
                boardScroll
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    private var boardScroll: some View {
        ScrollViewReader { proxy in
            ScrollView(.vertical, showsIndicators: true) {
                LazyVStack(alignment: .leading, spacing: tokens.spacing.sm) {
                    ForEach(viewModel.visibleShifts) { shift in
                            ShiftBoardCardView(
                                tokens: tokens,
                                viewModel: viewModel,
                                shift: shift,
                                shiftSwapCopy: shiftSwapCopy,
                                isHighlighted: viewModel.selectedBoardWindow.highlights(shift),
                                onStartSwapRequestForShift: onStartSwapRequestForShift
                            )
                        .id(shift.id)
                    }
                }
                .padding(.bottom, tokens.spacing.sm)
            }
            .scrollDismissesKeyboard(.interactively)
            .onAppear {
                scrollToTarget(proxy)
            }
            .onChange(of: viewModel.selectedShiftSegment) {
                scrollToTarget(proxy)
            }
            .onChange(of: viewModel.selectedBoardWindow.targetShiftId) {
                scrollToTarget(proxy)
            }
            .onChange(of: viewModel.visibleShiftIdsSignature) {
                scrollToTarget(proxy)
            }
        }
    }

    private func scrollToTarget(_ proxy: ScrollViewProxy) {
        guard let targetShiftId = viewModel.selectedBoardWindow.targetShiftId else { return }
        proxy.scrollTo(targetShiftId, anchor: .top)
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

    private var activity: VisibleShiftSwapActivity {
        viewModel.visibleShiftSwapActivity
    }

    private var incomingOptions: [IncomingShiftSwapOption] {
        activity.incoming.map { request, candidate in
            IncomingShiftSwapOption(request: request, candidate: candidate)
        }
    }

    var body: some View {
        if activity.hasContent {
            reguertaCard {
                VStack(alignment: .leading, spacing: tokens.spacing.md) {
                    Text(shiftSwapCopy.requestsTitle)
                        .font(tokens.typography.titleCard)
                        .accessibilityAddTraits(.isHeader)
                    Text(shiftSwapCopy.requestsSubtitle)
                        .font(tokens.typography.bodySecondary)
                        .foregroundStyle(tokens.colors.textSecondary)

                    if !incomingOptions.isEmpty {
                        incomingSection
                    }
                    if !activity.availableResponses.isEmpty {
                        availableResponsesSection
                    }
                    if !activity.outgoing.isEmpty {
                        outgoingSection
                    }
                    if !activity.history.isEmpty {
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
            ForEach(incomingOptions) { option in
                incomingRow(option.request, candidate: option.candidate)
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
            ForEach(activity.availableResponses, id: \.id) { item in
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
            ForEach(activity.outgoing) { request in
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
            ForEach(activity.history) { request in
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
