import SwiftUI

struct CoverageCommandSheet: View {
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    let model: CoverageRehearsalViewModel
    @Bindable var draft: CoverageCommandDraft

    var body: some View {
        NavigationStack {
            TimelineView(.periodic(from: .now, by: 1)) { _ in
                Form {
                    if dynamicTypeSize.isAccessibilitySize {
                        Text(CoverageCopy.text("action_\(draft.action.rawValue)"))
                            .font(.title.bold())
                            .fixedSize(horizontal: false, vertical: true)
                            .accessibilityAddTraits(.isHeader)
                    }
                    Text(CoverageCopy.text(draft.action == .complete ? "complete_note" : "confirm_note"))
                    if draft.action == .open {
                        if dynamicTypeSize.isAccessibilitySize {
                            Picker(CoverageCopy.text("shift"), selection: $draft.shiftId) {
                                ForEach(draft.shifts) { shift in
                                    Text(CoverageCopy.shiftLabel(shift))
                                        .fixedSize(horizontal: false, vertical: true)
                                        .tag(shift.shiftId)
                                }
                            }
                            .pickerStyle(.inline)
                        } else {
                            Picker(CoverageCopy.text("shift"), selection: $draft.shiftId) {
                                ForEach(draft.shifts) { shift in
                                    Text(CoverageCopy.shiftLabel(shift)).tag(shift.shiftId)
                                }
                            }
                        }
                    }
                    if draft.needsMember {
                        Picker(CoverageCopy.text("member"), selection: $draft.memberId) {
                            Text(CoverageCopy.text("choose")).tag("")
                            ForEach(draft.members) { member in Text(member.displayName).tag(member.memberId) }
                        }
                        .accessibilityIdentifier("coverage.member")
                    }
                    if draft.needsReason {
                        TextField(CoverageCopy.text("reason"), text: $draft.reason, axis: .vertical)
                            .accessibilityIdentifier("coverage.reason")
                    }
                    if draft.needsDeadline {
                        DatePicker(CoverageCopy.text("deadline"), selection: $draft.deadline)
                    }
                    Button(CoverageCopy.text("confirm")) { Task { await model.confirmDraft() } }
                        .disabled(!model.canConfirmDraft)
                        .accessibilityIdentifier("coverage.confirm")
                }
            }
            .navigationTitle(
                dynamicTypeSize.isAccessibilitySize ? "" : CoverageCopy.text("action_\(draft.action.rawValue)")
            )
            .navigationBarTitleDisplayMode(dynamicTypeSize.isAccessibilitySize ? .inline : .automatic)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(CoverageCopy.text("dismiss")) { model.draft = nil }
                }
            }
        }
    }
}

#if DEBUG
#Preview("Ensayo local", traits: .modifier(ReguertaDesignSystemPreviewModifier())) {
    @Previewable @State var model = CoveragePreviewAccess.model()
    if let draft = model.draft {
        CoverageCommandSheet(model: model, draft: draft)
    } else {
        ProgressView().task {
            await model.coverage.refresh()
            model.present(.open)
        }
    }
}
#endif
