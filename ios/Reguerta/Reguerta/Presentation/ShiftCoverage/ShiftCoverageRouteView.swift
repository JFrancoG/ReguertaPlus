import SwiftUI

struct ShiftCoverageRouteView: View {
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @Bindable var model: CoverageRouteViewModel
    var rehearsal: CoverageRehearsalViewModel?
    var rehearsalNote: String?

    var body: some View {
        NavigationStack(path: $model.casePath) {
            List {
                if dynamicTypeSize.isAccessibilitySize {
                    Text(CoverageCopy.text("title"))
                        .font(.title.bold())
                        .fixedSize(horizontal: false, vertical: true)
                        .accessibilityAddTraits(.isHeader)
                }
                if let rehearsalNote {
                    Section {
                        Text(rehearsalNote)
                    } header: {
                        Text(CoverageCopy.text("rehearsal"))
                    }
                }
                if !model.hasCurrentSession {
                    if let rehearsal {
                        CoverageLoginSection(model: rehearsal)
                    } else {
                        Text(CoverageCopy.text("access_disabled"))
                    }
                } else {
                    Section {
                        Button(CoverageCopy.text("action_open")) { model.present(.open) }
                            .disabled(!model.canOpen)
                            .accessibilityIdentifier("coverage.open")
                        Button(CoverageCopy.text("refresh")) { Task { await model.coverage.refresh() } }
                            .disabled(model.coverage.isBusy)
                        if let rehearsal {
                            Button(CoverageCopy.text("sign_out")) { rehearsal.signOut() }
                                .accessibilityIdentifier("coverage.signOut")
                        }
                    }
                    if model.coverage.snapshot?.isAdmin == true {
                        Section {
                            Button(CoverageCopy.text("admin_title")) { model.openAdministration() }
                                .disabled(!model.canAdminister)
                                .accessibilityIdentifier("coverage.administration")
                        }
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
                                .disabled(model.coverage.isBusy || model.coverage.hasPendingCommand)
                                .accessibilityIdentifier("coverage.notification.\(notification.eventId)")
                            }
                        }
                        Section(CoverageCopy.text("cases")) {
                            if snapshot.cases.isEmpty {
                                Text(CoverageCopy.text("empty"))
                            }
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
            .navigationDestination(isPresented: $model.showsAdministration) {
                CoverageAdministrationView(model: model)
            }
            .onChange(of: model.readyPushEventID, initial: true) { Task { await model.openPendingPush() } }
            .onChange(of: model.casePath) { Task { await model.reloadOverviewAfterNavigation() } }
            .onChange(of: model.coverage.session) {
                model.casePath = []
                model.clearAdministrationPresentation()
            }
            .navigationTitle(dynamicTypeSize.isAccessibilitySize || rehearsal == nil ? "" : CoverageCopy.text("title"))
            .toolbar(.visible, for: .navigationBar)
            .task {
                if rehearsal == nil {
                    await model.prepareRoute()
                }
            }
            .navigationBarTitleDisplayMode(
                dynamicTypeSize.isAccessibilitySize || rehearsal == nil ? .inline : .automatic
            )
            .sheet(item: $model.draft) { draft in
                CoverageCommandSheet(model: model, draft: draft)
            }
        }
    }
}

#if DEBUG
#Preview("Coberturas admitidas", traits: .modifier(ReguertaDesignSystemPreviewModifier())) {
    @Previewable @State var model = CoveragePreviewAccess.model().route
    ShiftCoverageRouteView(model: model)
}

#Preview("Acceso cerrado", traits: .modifier(ReguertaDesignSystemPreviewModifier())) {
    @Previewable @State var model = CoveragePreviewAccess.closedRoute()
    ShiftCoverageRouteView(model: model)
}
#endif
