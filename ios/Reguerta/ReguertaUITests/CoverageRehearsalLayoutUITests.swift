import XCTest

final class CoverageRehearsalLayoutUITests: XCTestCase {
    @MainActor func testSpanishRoleActionsRemainReachableAtAccessibilitySize() throws {
        try XCTSkipUnless(
            ProcessInfo.processInfo.environment["COVERAGE_LAYOUT_REHEARSAL"] == "1",
            "Opt-in read-only Auth/Firestore layout rehearsal"
        )
        continueAfterFailure = false
        let orientation = XCUIDevice.shared.orientation
        defer {
            XCUIDevice.shared.orientation = orientation
        }
        if ProcessInfo.processInfo.environment["COVERAGE_LANDSCAPE"] == "1" {
            XCUIDevice.shared.orientation = .landscapeLeft
        }
        let app = XCUIApplication()
        app.launchArguments = [
            "-coverageRehearsal", "-AppleLanguages", "(es)", "-AppleLocale", "es_ES",
            "-UIPreferredContentSizeCategoryName", "UICTContentSizeCategoryAccessibilityXXXL"
        ]
        app.launch()
        checkAdmin(app)
        checkReplacement(app)
        checkOfferee(app)
    }

    @MainActor private func checkAdmin(_ app: XCUIApplication) {
        signIn("admin", app: app)
        openCase("native-delivery", app: app)
        let complete = app.buttons["coverage.action.complete"]
        reveal(complete, app: app)
        XCTAssertEqual(complete.label, "Confirmar cobertura realizada")
        complete.tap()
        let confirm = app.buttons["coverage.confirm"]
        reveal(confirm, app: app)
        XCTAssertTrue(confirm.isEnabled)
        record("Admin confirmation ES AX5")
        app.navigationBars.buttons["Volver"].tap()
        XCTAssertFalse(confirm.exists)
        let status = app.staticTexts["coverage.status"]
        for _ in 0..<12 where !(status.exists && status.isHittable) {
            app.collectionViews.firstMatch.swipeDown()
        }
        XCTAssertTrue(status.isHittable, app.debugDescription)
        XCTAssertEqual(status.label, "Cobertura aceptada")
        app.navigationBars.buttons.element(boundBy: 0).tap()
        signOut(app)
    }

    @MainActor private func checkReplacement(_ app: XCUIApplication) {
        signIn("e", app: app)
        openCase("native-delivery", app: app)
        let status = app.staticTexts["coverage.status"]
        reveal(status, app: app)
        XCTAssertEqual(status.label, "Cobertura aceptada")
        XCTAssertFalse(app.buttons["coverage.action.complete"].exists)
        XCTAssertFalse(app.buttons["coverage.action.fail"].exists)
        XCTAssertFalse(app.staticTexts["Ensayo de reparto"].exists)
        record("Member detail ES AX5")
        app.navigationBars.buttons.element(boundBy: 0).tap()
        signOut(app)
    }

    @MainActor private func checkOfferee(_ app: XCUIApplication) {
        signIn("d", app: app)
        openCase("native-market", app: app)
        let accept = app.buttons["coverage.action.accept"]
        reveal(accept, app: app)
        XCTAssertEqual(accept.label, "Aceptar cobertura")
        accept.tap()
        let confirm = app.buttons["coverage.confirm"]
        reveal(confirm, app: app)
        XCTAssertTrue(confirm.isEnabled)
        record("Member offer ES AX5")
        app.navigationBars.buttons["Volver"].tap()
        XCTAssertFalse(confirm.exists)
        reveal(accept, app: app)
        XCTAssertTrue(accept.isEnabled)
        app.navigationBars.buttons.element(boundBy: 0).tap()
        let remaining = app.buttons["coverage.case.native-next-delivery"]
        reveal(remaining, app: app)
        signOut(app)
        signIn("d", app: app)
        openCase("native-market", app: app)
        reveal(accept, app: app)
        XCTAssertTrue(accept.isEnabled)
        app.navigationBars.buttons.element(boundBy: 0).tap()
        signOut(app)
    }

    @MainActor private func signIn(_ member: String, app: XCUIApplication) {
        let email = app.textFields["coverage.email"]
        reveal(email, app: app)
        email.tap()
        email.typeText("\(member)@example.test")
        let password = app.secureTextFields["coverage.password"]
        reveal(password, app: app)
        password.tap()
        password.typeText("local-fixture-password")
        let signIn = app.buttons["coverage.signIn"]
        reveal(signIn, app: app)
        signIn.tap()
        XCTAssertTrue(app.buttons["coverage.signOut"].waitForExistence(timeout: 15), app.debugDescription)
    }

    @MainActor private func signOut(_ app: XCUIApplication) {
        let signOut = app.buttons["coverage.signOut"]
        for _ in 0..<12 where !(signOut.exists && signOut.isHittable) {
            app.collectionViews.firstMatch.swipeDown()
        }
        reveal(signOut, app: app)
        signOut.tap()
        // A fresh launch makes each role independent while the server retains the unchanged cases.
        app.terminate()
        app.launch()
    }

    @MainActor private func openCase(_ id: String, app: XCUIApplication) {
        let row = app.buttons["coverage.case.\(id)"]
        reveal(row, app: app)
        row.tap()
    }

    @MainActor private func reveal(_ element: XCUIElement, app: XCUIApplication) {
        for _ in 0..<14 where !(element.exists && element.isHittable) {
            scrollUp(app)
        }
        XCTAssertTrue(element.waitForExistence(timeout: 10), app.debugDescription)
        XCTAssertTrue(element.isHittable, app.debugDescription)
    }

    @MainActor private func scrollUp(_ app: XCUIApplication) {
        guard app.keyboards.firstMatch.exists else {
            app.collectionViews.firstMatch.swipeUp()
            return
        }
        let top = app.navigationBars.firstMatch.frame.maxY + 20
        let bottom = app.keyboards.firstMatch.frame.minY - 20
        let origin = app.coordinate(withNormalizedOffset: .zero)
        let start = origin.withOffset(CGVector(dx: app.frame.minX + 8, dy: (top + bottom) / 2))
        let end = origin.withOffset(CGVector(dx: app.frame.minX + 8, dy: top))
        start.press(forDuration: 0.1, thenDragTo: end)
    }

    @MainActor private func record(_ name: String) {
        let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
