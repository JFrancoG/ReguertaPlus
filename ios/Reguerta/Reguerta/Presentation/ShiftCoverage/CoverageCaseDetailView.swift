import SwiftUI

struct CoverageCaseDetailView: View {
    let model: CoverageRehearsalViewModel
    let caseId: String

    var body: some View {
        TimelineView(.periodic(from: .now, by: 1)) { _ in
            List {
                CoverageFeedbackSection(model: model.coverage)
                if let item = model.coverage.caseItem(caseId) {
                    Section {
                        Text(CoverageCopy.text(item.type.rawValue)).font(.headline)
                        Text(CoverageCopy.shiftDate(item.scheduledAtMillis))
                        Text(CoverageCopy.text("status_\(item.status.rawValue)"))
                            .accessibilityIdentifier("coverage.status")
                        LabeledContent(CoverageCopy.text("absent"), value: model.coverage.memberName(item.absentUserId))
                        if let accepted = item.acceptedUserId {
                            LabeledContent(CoverageCopy.text("replacement"), value: model.coverage.memberName(accepted))
                        }
                        if let phase = item.selectionPhase {
                            Text(CoverageCopy.text("phase_\(phase.rawValue)"))
                        }
                        if !item.writable { Text(CoverageCopy.text("read_only")) }
                        if item.status == .offered, let offer = item.offer {
                            LabeledContent(CoverageCopy.text("member"), value: model.coverage.memberName(offer.userId))
                            LabeledContent(
                                CoverageCopy.text("offer_deadline"),
                                value: CoverageCopy.date(offer.expiresAtMillis)
                            )
                        }
                        if let closes = item.volunteerClosesAtMillis {
                            LabeledContent(CoverageCopy.text("volunteer_deadline"), value: CoverageCopy.date(closes))
                        }
                        if let administration = item.administration {
                            LabeledContent(CoverageCopy.text("reason"), value: administration.reason)
                        }
                        if item.selectionPhase == .drawRequired, model.coverage.snapshot?.policy.drawAvailable != true {
                            Text(CoverageCopy.text("draw_unavailable"))
                        }
                    }
                    Section {
                        ForEach(model.coverage.actions(for: item), id: \.rawValue) { action in
                            Button(CoverageCopy.text("action_\(action.rawValue)")) { model.present(action, item: item) }
                                .accessibilityIdentifier("coverage.action.\(action.rawValue)")
                        }
                    }
                }
                Button(CoverageCopy.text("refresh")) { Task { await model.coverage.refresh() } }
                    .disabled(model.coverage.isBusy)
            }
        }
        .navigationTitle(CoverageCopy.text("title"))
    }
}

#if DEBUG
#Preview("Ensayo local", traits: .modifier(ReguertaDesignSystemPreviewModifier())) {
    @Previewable @State var model = CoveragePreviewAccess.model()
    NavigationStack { CoverageCaseDetailView(model: model, caseId: "preview-case") }
        .task { await model.coverage.refresh() }
}
#endif
