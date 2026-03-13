//
//  ReguertaUITestsLaunchTests.swift
//  ReguertaUITests
//
//  Created by Jesús Franco on 05.02.2026.
//

import XCTest

final class ReguertaUITestsLaunchTests: XCTestCase {

    override class var runsForEachTargetApplicationUIConfiguration: Bool {
        true
    }

    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    @MainActor
    func testLaunch() throws {
        throw XCTSkip("Flaky screenshot launch test in parallel simulator clones; launch behavior is covered by dedicated UI tests.")
    }
}
