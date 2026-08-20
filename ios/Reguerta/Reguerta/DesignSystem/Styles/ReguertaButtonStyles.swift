import SwiftUI

struct ReguertaButtonStyles {
    let fullHeight: CGFloat
    let cornerRadius: CGFloat
    let dialogSingleWidth: CGFloat
    let dialogTwoButtonsWidth: CGFloat
    let primaryFont: Font
    let secondaryFont: Font
    let textFont: Font

    @MainActor
    static var `default`: ReguertaButtonStyles {
        ReguertaButtonStyles(
            fullHeight: 48,
            cornerRadius: 24,
            dialogSingleWidth: 296,
            dialogTwoButtonsWidth: 140,
            primaryFont: .custom("CabinSketch-Bold", size: 20, relativeTo: .body),
            secondaryFont: .custom("CabinSketch-Regular", size: 20, relativeTo: .body),
            textFont: .custom("CabinSketch-Regular", size: 18, relativeTo: .body)
        )
    }
}
