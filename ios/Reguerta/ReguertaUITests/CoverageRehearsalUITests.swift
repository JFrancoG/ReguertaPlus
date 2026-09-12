import XCTest

final class CoverageRehearsalUITests: XCTestCase {
    @MainActor func testLocalMemberAcceptsCoverage() throws {
        try XCTSkipUnless(
            ProcessInfo.processInfo.environment["COVERAGE_REHEARSAL"] == "1", "Opt-in Auth/Firestore rehearsal"
        )
        continueAfterFailure = false
        let app = XCUIApplication()
        app.launchArguments = [
            "-coverageRehearsal", "-AppleLanguages", "(en)", "-AppleLocale", "en_US",
            "-UIPreferredContentSizeCategoryName", "UICTContentSizeCategoryL"
        ]
        app.launch()
        let email = app.textFields["coverage.email"]
        XCTAssertTrue(email.waitForExistence(timeout: 10))
        email.tap()
        email.typeText("d@example.test")
        let password = app.secureTextFields["coverage.password"]
        password.tap()
        password.typeText("local-fixture-password")
        app.buttons["coverage.signIn"].tap()
        let row = app.buttons["coverage.case.native-market"]
        XCTAssertTrue(row.waitForExistence(timeout: 15), app.debugDescription)
        row.tap()
        let accept = app.buttons["coverage.action.accept"]
        for _ in 0..<6 where !accept.isHittable { app.swipeUp() }
        XCTAssertTrue(accept.waitForExistence(timeout: 5), app.debugDescription)
        accept.tap()
        app.buttons["coverage.confirm"].tap()
        let accepted = app.staticTexts["coverage.status"]
        let predicate = NSPredicate(format: "label == %@", "Coverage accepted")
        expectation(for: predicate, evaluatedWith: accepted)
        waitForExpectations(timeout: 10)
        XCTAssertFalse(app.buttons["coverage.action.accept"].exists)
        XCTAssertFalse(app.staticTexts["coverage.failure"].exists)
    }

    @MainActor func testLocalEarnedCreditAtAccessibilitySize() throws {
        try XCTSkipUnless(
            ProcessInfo.processInfo.environment["COVERAGE_CREDIT_REHEARSAL"] == "1", "Opt-in completed delivery fixture"
        )
        continueAfterFailure = false
        let app = XCUIApplication()
        app.launchArguments = [
            "-coverageRehearsal", "-AppleLanguages", "(en)", "-AppleLocale", "en_US",
            "-UIPreferredContentSizeCategoryName", "UICTContentSizeCategoryAccessibilityXXXL"
        ]
        app.launch()
        let email = app.textFields["coverage.email"]
        XCTAssertTrue(email.waitForExistence(timeout: 10))
        email.tap()
        email.typeText("e@example.test")
        let password = app.secureTextFields["coverage.password"]
        password.tap()
        password.typeText("local-fixture-password")
        let signIn = app.buttons["coverage.signIn"]
        for _ in 0..<5 where !signIn.isHittable { app.swipeUp() }
        signIn.tap()
        XCTAssertTrue(app.buttons["coverage.signOut"].waitForExistence(timeout: 15))
        let credit = app.staticTexts["Pending credit"]
        for _ in 0..<8 where !credit.isHittable { app.swipeUp() }
        XCTAssertTrue(credit.isHittable, app.debugDescription)
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = "HU084 local earned credit AX5"
        attachment.lifetime = .keepAlways
        add(attachment)
    }

}
