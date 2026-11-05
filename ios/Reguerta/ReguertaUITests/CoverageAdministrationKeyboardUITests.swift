import XCTest

final class CoverageAdministrationKeyboardUITests: XCTestCase {
    @MainActor func testHideKeyboardPreservesReasonInDepartureAndSpacingForms() {
        continueAfterFailure = false
        for action in ["coverage.admin.departure.beatriz", "coverage.admin.spacing.preview-spacing"] {
            let app = openAdministrativeForm(action)
            defer { app.terminate() }
            let reason = reasonField(in: app)
            reason.tap()
            reason.typeText("Prueba")
            let keyboard = app.keyboards.firstMatch
            XCTAssertTrue(keyboard.waitForExistence(timeout: 5), "Enable the Simulator software keyboard for this test")
            let hideKeyboard = app.buttons["coverage.admin.hideKeyboard"]
            XCTAssertTrue(hideKeyboard.waitForExistence(timeout: 5), app.debugDescription)
            XCTAssertTrue(hideKeyboard.isHittable, app.debugDescription)
            hideKeyboard.tap()
            XCTAssertTrue(keyboard.waitForNonExistence(timeout: 5), "Hide keyboard must end editing")
            XCTAssertEqual(reason.value as? String, "Prueba", "Ending editing must preserve the reason")
            let back = app.navigationBars.buttons["Volver"]
            XCTAssertTrue(back.isHittable, "Cancellation must remain reachable after ending editing")
            back.tap()
            XCTAssertTrue(reason.waitForNonExistence(timeout: 5), "Back must close the administrative form")
            XCTAssertTrue(app.buttons[action].isEnabled, "Cancellation must not leave a submitted operation pending")
        }
    }

    @MainActor func testCancelWhileEditingClosesKeyboardWithoutSubmittingEitherAdministrativeForm() {
        continueAfterFailure = false
        for action in ["coverage.admin.departure.beatriz", "coverage.admin.spacing.preview-spacing"] {
            let app = openAdministrativeForm(action)
            defer { app.terminate() }
            let reason = reasonField(in: app)
            reason.tap()
            reason.typeText("Prueba")
            let keyboard = app.keyboards.firstMatch
            XCTAssertTrue(keyboard.waitForExistence(timeout: 5), "Enable the Simulator software keyboard for this test")
            let back = app.navigationBars.buttons["Volver"]
            XCTAssertTrue(back.isHittable, "Back must be reachable while the software keyboard is visible")
            back.tap()
            XCTAssertTrue(reason.waitForNonExistence(timeout: 5), "Back must close the administrative form")
            XCTAssertTrue(keyboard.waitForNonExistence(timeout: 5), "Cancelled forms must not retain the keyboard")
            XCTAssertTrue(app.buttons[action].isEnabled, "Cancellation must not leave a submitted operation pending")
        }
    }

    @MainActor private func openAdministrativeForm(_ action: String) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = [
            "-coverageAccessibilityRehearsal", "-useMockAuth", "-AppleLanguages", "(es)", "-AppleLocale", "es_ES",
            "-UIPreferredContentSizeCategoryName", "UICTContentSizeCategoryL"
        ]
        app.launch()
        let administration = app.buttons["coverage.administration"]
        reveal(administration, in: app)
        administration.tap()
        let button = app.buttons[action]
        reveal(button, in: app)
        button.tap()
        return app
    }

    @MainActor private func reasonField(in app: XCUIApplication) -> XCUIElement {
        let field = app.descendants(matching: .any).matching(identifier: "coverage.admin.reason").firstMatch
        reveal(field, in: app)
        return field
    }

    @MainActor private func reveal(_ element: XCUIElement, in app: XCUIApplication) {
        _ = element.waitForExistence(timeout: 5)
        for _ in 0..<10 where !element.isHittable {
            app.swipeUp()
        }
        XCTAssertTrue(element.exists, app.debugDescription)
        XCTAssertTrue(element.isHittable, app.debugDescription)
    }
}
