import SwiftUI

struct CoverageRehearsalView: View {
    @Bindable var model: CoverageRehearsalViewModel

    var body: some View {
        NavigationStack(path: $model.casePath) {
            List {
                Section {
                    Text(CoverageCopy.text("local_note"))
                } header: {
                    Text(CoverageCopy.text("rehearsal"))
                }
                if model.coverage.session == nil {
                    CoverageLoginSection(model: model)
                } else {
                    Section {
                        Button(CoverageCopy.text("action_open")) { model.present(.open) }
                            .disabled(!model.canOpen)
                            .accessibilityIdentifier("coverage.open")
                        Button(CoverageCopy.text("refresh")) { Task { await model.coverage.refresh() } }
                            .disabled(model.coverage.isBusy)
                        Button(CoverageCopy.text("sign_out")) { model.signOut() }
                            .accessibilityIdentifier("coverage.signOut")
                    }
                    CoverageFeedbackSection(model: model.coverage)
                    if let snapshot = model.coverage.snapshot {
                        Section(CoverageCopy.text("notifications")) {
                            if snapshot.notifications?.isEmpty != false {
                                Text(CoverageCopy.text("no_notifications"))
                            }
                            ForEach(snapshot.notifications ?? []) { notification in
                                Button {
                                    Task { await model.openNotification(notification.eventId) }
                                } label: {
                                    VStack(alignment: .leading) {
                                        Text(CoverageCopy.text("notification_title"))
                                        Text(CoverageCopy.date(notification.sentAtMillis))
                                    }
                                }
                                .disabled(model.coverage.isBusy || model.coverage.pendingCommand != nil)
                                .accessibilityIdentifier("coverage.notification.\(notification.eventId)")
                            }
                        }
                        Section(CoverageCopy.text("cases")) {
                            if snapshot.cases.isEmpty { Text(CoverageCopy.text("empty")) }
                            ForEach(snapshot.cases) { item in
                                NavigationLink(value: item.caseId) {
                                    VStack(alignment: .leading) {
                                        Text(CoverageCopy.text(item.type.rawValue)).font(.headline)
                                        Text(CoverageCopy.shiftDate(item.scheduledAtMillis))
                                        Text(model.coverage.memberName(item.absentUserId))
                                        Text(CoverageCopy.text("status_\(item.status.rawValue)"))
                                    }
                                }
                                .accessibilityIdentifier("coverage.case.\(item.caseId)")
                            }
                        }
                        CoverageAccountingSection(snapshot: snapshot)
                    }
                }
            }
            .navigationDestination(for: String.self) { caseId in
                CoverageCaseDetailView(model: model, caseId: caseId)
            }
            .onChange(of: model.readyPushEventID, initial: true) { Task { await model.openPendingPush() } }
            .onChange(of: model.casePath) { Task { await model.reloadOverviewAfterNavigation() } }
            .onChange(of: model.coverage.session) { model.casePath = [] }
            .navigationTitle(CoverageCopy.text("title"))
            .sheet(item: $model.draft) { draft in
                CoverageCommandSheet(model: model, draft: draft)
            }
        }
    }
}

#if DEBUG
#Preview("Ensayo local", traits: .modifier(ReguertaDesignSystemPreviewModifier())) {
    @Previewable @State var model = CoveragePreviewAccess.model()
    CoverageRehearsalView(model: model).task { await model.coverage.refresh() }
}
#endif

#if DEBUG
#Preview("AX5", traits: .modifier(ReguertaDesignSystemPreviewModifier())) {
    @Previewable @State var model = CoveragePreviewAccess.model()
    CoverageRehearsalView(model: model).dynamicTypeSize(.accessibility5)
        .task { await model.coverage.refresh() }
}
#endif
