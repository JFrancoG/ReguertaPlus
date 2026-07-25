import SwiftUI

struct BylawsPdfSheetView: View {
    @Environment(\.dismiss) private var dismiss

    let pdfURL: URL

    var body: some View {
        NavigationStack {
            BylawsPdfView(url: pdfURL)
                .navigationTitle(LocalizedStringKey(AccessL10nKey.bylawsTitle))
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button(LocalizedStringKey(AccessL10nKey.commonClose)) {
                            dismiss()
                        }
                    }
                }
        }
    }
}

#Preview("PDF", traits: .modifier(BylawsPreviewModifier())) {
    BylawsPdfSheetView(pdfURL: BylawsPreviewFixtures.pdfURL)
}
