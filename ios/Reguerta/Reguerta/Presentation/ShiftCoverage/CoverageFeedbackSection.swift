import SwiftUI

struct CoverageFeedbackSection: View {
    let model: ShiftCoverageViewModel

    var body: some View {
        Section {
            if model.isBusy { ProgressView(CoverageCopy.text("loading")) }
            if let failure = model.failure {
                Text(CoverageCopy.failure(failure)).accessibilityIdentifier("coverage.failure")
            }
            if model.pendingCommand != nil {
                Text(CoverageCopy.text("uncertain"))
                Button(CoverageCopy.text("retry")) { Task { await model.retryPending() } }
                    .disabled(model.isBusy)
                    .accessibilityIdentifier("coverage.retry")
            }
        }
    }
}

#if DEBUG
#Preview("Ensayo local", traits: .modifier(ReguertaDesignSystemPreviewModifier())) {
    @Previewable @State var model = CoveragePreviewAccess.model()
    List { CoverageFeedbackSection(model: model.coverage) }.task { await model.coverage.refresh() }
}
#endif
