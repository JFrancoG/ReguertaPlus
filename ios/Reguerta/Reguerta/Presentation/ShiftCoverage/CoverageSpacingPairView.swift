import SwiftUI

struct CoverageSpacingPairView: View {
    @ScaledMetric(relativeTo: .body) private var contentSpacing: CGFloat = 8
    let candidate: ShiftCoverageAdministrationSnapshot.SpacingCandidate

    var body: some View {
        VStack(alignment: .leading, spacing: contentSpacing) {
            VStack(alignment: .leading) {
                Text(CoverageCopy.text("admin_plan")).font(.subheadline.bold())
                Text(candidate.planningRequestId)
                    .fixedSize(horizontal: false, vertical: true)
                    .textSelection(.enabled)
            }
            .accessibilityElement(children: .combine)
            VStack(alignment: .leading) {
                Text(CoverageCopy.text("admin_previous_turn")).font(.subheadline.bold())
                Text(CoverageCopy.ordinaryDateLabel(candidate.previousDate))
                LabeledContent(CoverageCopy.text("admin_round"), value: candidate.previousRoundNumber.formatted())
            }
            .accessibilityElement(children: .combine)
            VStack(alignment: .leading) {
                Text(CoverageCopy.text("admin_proposed_turn")).font(.subheadline.bold())
                Text(CoverageCopy.ordinaryDateLabel(candidate.date))
                LabeledContent(CoverageCopy.text("admin_round"), value: candidate.roundNumber.formatted())
            }
            .accessibilityElement(children: .combine)
        }
    }
}

#if DEBUG
#Preview("Pareja de turnos", traits: .modifier(ReguertaDesignSystemPreviewModifier())) {
    List { CoverageSpacingPairView(candidate: CoveragePreviewAccess.administration.spacingCandidates[0]) }
}
#endif
