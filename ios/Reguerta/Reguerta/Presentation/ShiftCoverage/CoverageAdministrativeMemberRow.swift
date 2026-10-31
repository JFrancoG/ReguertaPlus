import SwiftUI

struct CoverageAdministrativeMemberRow: View {
    @ScaledMetric(relativeTo: .body) private var contentSpacing: CGFloat = 12
    @ScaledMetric(relativeTo: .body) private var minimumActionHeight: CGFloat = 44
    let member: ShiftCoverageAdministrationSnapshot.Member
    let writable: Bool
    let model: CoverageRouteViewModel
    let focus: AccessibilityFocusState<CoverageAdministrationView.ActionFocus?>.Binding
    let present: (CoverageAdministrationDraft.Subject) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: contentSpacing) {
            Text(member.displayName).font(.headline)
            Text(CoverageCopy.membershipStatus(member))
            if member.pendingQueueTransition {
                Text(CoverageCopy.text("admin_queue_pending"))
            }
            ForEach(member.reserves, id: \.type) { reserve in
                VStack(alignment: .leading) {
                    Text(CoverageCopy.text(reserve.type.rawValue)).font(.subheadline.bold())
                    Text(CoverageCopy.text(reserve.active ? "reserve_active" : "reserve_inactive"))
                }
                .accessibilityElement(children: .combine)
            }
            ForEach(member.credits, id: \.type) { credits in
                VStack(alignment: .leading) {
                    Text(CoverageCopy.text(credits.type.rawValue)).font(.subheadline.bold())
                    LabeledContent(CoverageCopy.text("admin_pending_credits"), value: credits.pendingCount.formatted())
                    LabeledContent(CoverageCopy.text("admin_used_credits"), value: credits.consumedCount.formatted())
                    LabeledContent(
                        CoverageCopy.text("admin_cancelled_credits"), value: credits.cancelledCount.formatted()
                    )
                }
            }
            Button {
                present(.reconcile(member))
            } label: {
                Text(CoverageCopy.text("admin_reconcile"))
                    .frame(maxWidth: .infinity, minHeight: minimumActionHeight, alignment: .leading)
                    .contentShape(.rect)
            }
            .buttonStyle(.borderless)
            .disabled(!writable || !model.canAdminister)
            .accessibilityIdentifier("coverage.admin.reconcile.\(member.userId)")
            .accessibilityFocused(focus, equals: .reconcile(member.userId))
            if member.allowsPermanentDeparture {
                Button(role: .destructive) {
                    present(.permanentDeparture(member))
                } label: {
                    Text(CoverageCopy.text("admin_departure"))
                        .frame(maxWidth: .infinity, minHeight: minimumActionHeight, alignment: .leading)
                        .contentShape(.rect)
                }
                .buttonStyle(.borderless)
                .disabled(!writable || !model.canAdminister)
                .accessibilityIdentifier("coverage.admin.departure.\(member.userId)")
                .accessibilityFocused(focus, equals: .departure(member.userId))
            }
        }
    }
}

#if DEBUG
#Preview("Socio inactivo", traits: .modifier(ReguertaDesignSystemPreviewModifier())) {
    @Previewable @State var model = CoveragePreviewAccess.model().route
    @Previewable @AccessibilityFocusState var focusedAction: CoverageAdministrationView.ActionFocus?
    List {
        CoverageAdministrativeMemberRow(
            member: CoveragePreviewAccess.administration.members[0],
            writable: true,
            model: model,
            focus: $focusedAction
        ) { model.presentAdministration($0) }
    }
}
#endif
