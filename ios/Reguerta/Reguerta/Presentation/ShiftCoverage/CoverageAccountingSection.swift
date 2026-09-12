import SwiftUI

struct CoverageAccountingSection: View {
    let snapshot: ShiftCoverageSnapshot

    var body: some View {
        Section(CoverageCopy.text("accounting")) {
            if snapshot.credits.isEmpty { Text(CoverageCopy.text("no_credits")) }
            ForEach(snapshot.credits, id: \.creditId) { credit in
                VStack(alignment: .leading) {
                    Text(CoverageCopy.text(credit.type.rawValue)).font(.headline)
                    Text(CoverageCopy.text("credit_\(credit.state.rawValue)"))
                }
                .accessibilityElement(children: .combine)
            }
            ForEach(snapshot.reserves, id: \.type) { reserve in
                VStack(alignment: .leading) {
                    Text(CoverageCopy.text(reserve.type.rawValue)).font(.headline)
                    Text(CoverageCopy.text(reserve.active ? "reserve_active" : "reserve_inactive"))
                }
                .accessibilityElement(children: .combine)
            }
        }
    }
}

#if DEBUG
#Preview("Ensayo local", traits: .modifier(ReguertaDesignSystemPreviewModifier())) {
    @Previewable @State var model = CoveragePreviewAccess.model()
    List { CoverageAccountingSection(snapshot: CoveragePreviewAccess().snapshot) }
}
#endif
