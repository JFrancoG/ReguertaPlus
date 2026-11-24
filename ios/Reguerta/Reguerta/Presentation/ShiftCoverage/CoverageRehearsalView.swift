import SwiftUI

struct CoverageRehearsalView: View {
    @Bindable var model: CoverageRehearsalViewModel
    var rehearsalNote = CoverageCopy.text("local_note")

    var body: some View {
        ShiftCoverageRouteView(model: model.route, rehearsal: model, rehearsalNote: rehearsalNote)
    }
}

#if DEBUG
#Preview("Ensayo local", traits: .modifier(ReguertaDesignSystemPreviewModifier())) {
    @Previewable @State var model = CoveragePreviewAccess.model()
    CoverageRehearsalView(model: model).task { await model.coverage.refresh() }
}

#Preview("AX5", traits: .modifier(ReguertaDesignSystemPreviewModifier())) {
    @Previewable @State var model = CoveragePreviewAccess.model()
    CoverageRehearsalView(model: model).dynamicTypeSize(.accessibility5)
        .task { await model.coverage.refresh() }
}
#endif
