import SwiftUI

struct CoverageAdministrationCommandSheet: View {
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @FocusState private var isReasonFocused: Bool
    let model: CoverageRouteViewModel
    @Bindable var draft: CoverageAdministrationDraft

    var body: some View {
        NavigationStack {
            TimelineView(.periodic(from: .now, by: 1)) { _ in
                Form {
                    if dynamicTypeSize.isAccessibilitySize {
                        Text(CoverageCopy.text(draft.titleKey))
                            .font(.title.bold())
                            .fixedSize(horizontal: false, vertical: true)
                            .accessibilityAddTraits(.isHeader)
                    }
                    Section {
                        Text(draft.memberName).font(.headline)
                        Text(CoverageCopy.text(draft.noteKey))
                    }
                    if let candidate = draft.spacingCandidate {
                        Section {
                            CoverageSpacingPairView(candidate: candidate)
                            Text(CoverageCopy.text("admin_spacing_confirmation"))
                        }
                    }
                    if draft.needsReason {
                        TextField(CoverageCopy.text("reason"), text: $draft.reason, axis: .vertical)
                            .focused($isReasonFocused)
                            .accessibilityIdentifier("coverage.admin.reason")
                    }
                    if draft.isPermanentDeparture {
                        Toggle(
                            CoverageCopy.text("admin_departure_acknowledgement"),
                            isOn: $draft.confirmsCreditCancellation
                        )
                            .accessibilityIdentifier("coverage.admin.acknowledge")
                    }
                    Button(CoverageCopy.text("confirm")) { Task { await model.confirmAdministration() } }
                        .disabled(!model.canConfirmAdministration)
                        .accessibilityIdentifier("coverage.admin.confirm")
                }
                .scrollDismissesKeyboard(.interactively)
            }
            .navigationTitle(dynamicTypeSize.isAccessibilitySize ? "" : CoverageCopy.text(draft.titleKey))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(CoverageCopy.text("dismiss")) {
                        isReasonFocused = false
                        model.administrationDraft = nil
                    }
                }
                // Avoid the infinite fixed width observed in this form's keyboard accessory on iOS 26.5.
                ToolbarItem(placement: .topBarTrailing) {
                    if isReasonFocused {
                        Button(CoverageCopy.text("hide_keyboard")) { isReasonFocused = false }
                            .accessibilityIdentifier("coverage.admin.hideKeyboard")
                    }
                }
            }
        }
    }
}

#if DEBUG
#Preview("Baja permanente", traits: .modifier(ReguertaDesignSystemPreviewModifier())) {
    @Previewable @State var model = CoveragePreviewAccess.model().route
    @Previewable @State var draft = CoverageAdministrationDraft(
        subject: .permanentDeparture(CoveragePreviewAccess.administration.members[0]),
        environment: .develop,
        expectedPolicyRevision: CoveragePreviewAccess.administration.policyRevision
    )
    CoverageAdministrationCommandSheet(model: model, draft: draft)
        .task {
            await CoverageAdministrationPreview.prepare(model)
            if let prepared = model.administrationDraft {
                draft = prepared
            }
        }
}

#Preview("Excepción de separación", traits: .modifier(ReguertaDesignSystemPreviewModifier())) {
    @Previewable @State var model = CoveragePreviewAccess.model().route
    @Previewable @State var draft = CoverageAdministrationDraft(
        subject: .spacing(CoveragePreviewAccess.administration.spacingCandidates[0]),
        environment: .develop,
        expectedPolicyRevision: CoveragePreviewAccess.administration.policyRevision
    )
    CoverageAdministrationCommandSheet(model: model, draft: draft)
        .task {
            await CoverageAdministrationPreview.prepare(model, spacing: true)
            if let prepared = model.administrationDraft {
                draft = prepared
            }
        }
}
#endif
