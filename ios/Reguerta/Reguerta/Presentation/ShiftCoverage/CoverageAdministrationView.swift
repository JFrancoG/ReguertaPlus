import SwiftUI

struct CoverageAdministrationView: View {
    @Environment(\.accessibilityVoiceOverEnabled) private var isVoiceOverEnabled
    @AccessibilityFocusState(for: .voiceOver) private var focusedAction: ActionFocus?
    @State private var returnFocus: (target: ActionFocus, session: ShiftCoverageSession)?
    @ScaledMetric(relativeTo: .body) private var contentSpacing: CGFloat = 12
    @ScaledMetric(relativeTo: .body) private var minimumActionHeight: CGFloat = 44
    @Bindable var model: CoverageRehearsalViewModel

    enum ActionFocus: Hashable {
        case reconcile(String)
        case departure(String)
        case spacing(String)
    }

    var body: some View {
        List {
            Section {
                Text(CoverageCopy.text("admin_note"))
                Button(CoverageCopy.text("refresh")) { Task { await model.coverage.refreshAdministration() } }
                    .disabled(model.coverage.isBusy)
                    .accessibilityIdentifier("coverage.admin.refresh")
            }
            CoverageFeedbackSection(model: model.coverage)
            if let snapshot = model.coverage.administration, model.coverage.snapshot?.isAdmin == true {
                Section(CoverageCopy.text("admin_members")) {
                    if !snapshot.membershipWritable {
                        Text(CoverageCopy.text("admin_read_only"))
                    }
                    if snapshot.members.isEmpty {
                        Text(CoverageCopy.text("admin_no_members"))
                    }
                    ForEach(snapshot.members) { member in
                        CoverageAdministrativeMemberRow(
                            member: member,
                            writable: snapshot.membershipWritable,
                            model: model,
                            focus: $focusedAction
                        ) { presentAdministration($0) }
                    }
                }
                Section(CoverageCopy.text("admin_spacing")) {
                    Text(CoverageCopy.text("admin_spacing_note"))
                    if snapshot.spacingCandidates.isEmpty {
                        Text(CoverageCopy.text(
                            snapshot.spacingUnavailableReason == nil ? "admin_no_spacing" : "admin_spacing_unavailable"
                        ))
                    }
                    ForEach(snapshot.spacingCandidates) { candidate in
                        VStack(alignment: .leading, spacing: contentSpacing) {
                            Text(candidate.displayName).font(.headline)
                            CoverageSpacingPairView(candidate: candidate)
                            Button {
                                presentAdministration(.spacing(candidate))
                            } label: {
                                Text(CoverageCopy.text("admin_spacing"))
                                    .frame(maxWidth: .infinity, minHeight: minimumActionHeight, alignment: .leading)
                                    .contentShape(.rect)
                            }
                            .buttonStyle(.borderless)
                            .disabled(!model.canAdminister)
                            .accessibilityIdentifier("coverage.admin.spacing.\(candidate.id)")
                            .accessibilityFocused($focusedAction, equals: .spacing(candidate.id))
                        }
                    }
                }
            }
        }
        .navigationTitle(CoverageCopy.text("admin_title"))
        .navigationBarTitleDisplayMode(.inline)
        .task { await model.coverage.refreshAdministration() }
        .sheet(item: $model.administrationDraft, onDismiss: restoreActionFocus) { draft in
            CoverageAdministrationCommandSheet(model: model, draft: draft)
        }
        .onChange(of: model.coverage.session) {
            returnFocus = nil
            focusedAction = nil
        }
    }

    private func presentAdministration(_ subject: CoverageAdministrationDraft.Subject) {
        model.presentAdministration(subject)
        guard let draft = model.administrationDraft, let session = model.coverage.session else { return }
        let target: ActionFocus
        switch draft.subject {
        case .reconcile(let member): target = .reconcile(member.userId)
        case .permanentDeparture(let member): target = .departure(member.userId)
        case .spacing(let candidate): target = .spacing(candidate.id)
        }
        returnFocus = (target, session)
        focusedAction = nil
    }

    private func restoreActionFocus() {
        let origin = returnFocus
        returnFocus = nil
        guard isVoiceOverEnabled, let origin, origin.session == model.coverage.session,
              model.canAdminister, let snapshot = model.coverage.administration else { return }
        let isAvailable: Bool
        switch origin.target {
        case .reconcile(let userId):
            isAvailable = snapshot.membershipWritable && snapshot.members.contains { $0.userId == userId }
        case .departure(let userId):
            isAvailable = snapshot.membershipWritable && snapshot.members.contains {
                $0.userId == userId && $0.allowsPermanentDeparture
            }
        case .spacing(let id):
            isAvailable = snapshot.spacingCandidates.contains { $0.id == id }
        }
        guard isAvailable else { return }
        focusedAction = origin.target
    }
}

#if DEBUG
#Preview("Administración", traits: .modifier(ReguertaDesignSystemPreviewModifier())) {
    @Previewable @State var model = CoveragePreviewAccess.model()
    NavigationStack { CoverageAdministrationView(model: model) }
        .task {
            await model.coverage.refresh()
            await model.coverage.refreshAdministration()
        }
}
#endif
