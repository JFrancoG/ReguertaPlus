import XCTest
@testable import Reguerta

@MainActor
final class ImagePipelineSizingContractTests: XCTestCase {
    func testScaledDimensionsLandscapeHasShortSide300() {
        let scaled = ImagePipelineSizingContract.scaledDimensions(
            sourceWidth: 1200,
            sourceHeight: 800,
            targetShortSidePx: 300
        )

        XCTAssertEqual(scaled, PixelSize(width: 450, height: 300))
    }

    func testScaledDimensionsPortraitHasShortSide300() {
        let scaled = ImagePipelineSizingContract.scaledDimensions(
            sourceWidth: 800,
            sourceHeight: 1600,
            targetShortSidePx: 300
        )

        XCTAssertEqual(scaled, PixelSize(width: 300, height: 600))
    }

    func testCenterCropSquareIsCentered() {
        let cropLandscape = ImagePipelineSizingContract.centerCropSquare(
            sourceWidth: 450,
            sourceHeight: 300,
            targetSidePx: 300
        )
        XCTAssertEqual(cropLandscape, CropSquare(left: 75, top: 0, size: 300))

        let cropPortrait = ImagePipelineSizingContract.centerCropSquare(
            sourceWidth: 300,
            sourceHeight: 600,
            targetSidePx: 300
        )
        XCTAssertEqual(cropPortrait, CropSquare(left: 0, top: 150, size: 300))
    }
}
