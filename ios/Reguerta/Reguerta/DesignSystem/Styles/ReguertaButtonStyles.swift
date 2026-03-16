import SwiftUI

struct ReguertaButtonStyles {
    let fullHeight: CGFloat
    let cornerRadius: CGFloat
    let dialogSingleWidth: CGFloat
    let dialogTwoButtonsWidth: CGFloat
    let primaryFont: Font
    let secondaryFont: Font
    let textFont: Font

    static var `default`: ReguertaButtonStyles {
        ReguertaButtonStyles(
            fullHeight: 48.resize,
            cornerRadius: 24.resize,
            dialogSingleWidth: 296.resize,
            dialogTwoButtonsWidth: 140.resize,
            primaryFont: .custom("CabinSketch-Bold", size: 20.resize, relativeTo: .body),
            secondaryFont: .custom("CabinSketch-Regular", size: 20.resize, relativeTo: .body),
            textFont: .custom("CabinSketch-Regular", size: 18.resize, relativeTo: .body)
        )
    }
}
