import Foundation

struct PixelSize: Equatable, Sendable {
    let width: Int
    let height: Int
}

struct CropSquare: Equatable, Sendable {
    let left: Int
    let top: Int
    let size: Int
}

enum ImagePipelineSizingContract {
    static func scaledDimensions(
        sourceWidth: Int,
        sourceHeight: Int,
        targetShortSidePx: Int
    ) -> PixelSize? {
        guard sourceWidth > 0, sourceHeight > 0, targetShortSidePx > 0 else {
            return nil
        }
        let shortSide = Double(min(sourceWidth, sourceHeight))
        let scale = Double(targetShortSidePx) / shortSide
        let scaledWidth = max(targetShortSidePx, Int((Double(sourceWidth) * scale).rounded()))
        let scaledHeight = max(targetShortSidePx, Int((Double(sourceHeight) * scale).rounded()))
        return PixelSize(width: scaledWidth, height: scaledHeight)
    }

    static func centerCropSquare(
        sourceWidth: Int,
        sourceHeight: Int,
        targetSidePx: Int
    ) -> CropSquare? {
        guard sourceWidth >= targetSidePx,
              sourceHeight >= targetSidePx,
              targetSidePx > 0 else {
            return nil
        }
        let left = max(0, (sourceWidth - targetSidePx) / 2)
        let top = max(0, (sourceHeight - targetSidePx) / 2)
        return CropSquare(left: left, top: top, size: targetSidePx)
    }
}
