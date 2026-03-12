//
//  ReguertaUITests.swift
//  ReguertaUITests
//
//  Created by Jesús Franco on 05.02.2026.
//

import XCTest

final class ReguertaUITests: XCTestCase {

    override func setUpWithError() throws {
        // Put setup code here. This method is called before the invocation of each test method in the class.

        // In UI tests it is usually best to stop immediately when a failure occurs.
        continueAfterFailure = false

        // In UI tests it’s important to set the initial state - such as interface orientation - required for your tests before they run. The setUp method is a good place to do this.
    }

    override func tearDownWithError() throws {
        // Put teardown code here. This method is called after the invocation of each test method in the class.
    }

    @MainActor
    func testUnauthorizedUserShowsRestrictedMode() throws {
        let app = configuredApp()
        app.launch()
        app.buttons["Enter the app"].tap()

        let emailField = app.textFields["Email"]
        XCTAssertTrue(emailField.waitForExistence(timeout: 5))
        emailField.tap()
        emailField.typeText("unknown@reguerta.app")

        let uidField = app.textFields["Auth UID"]
        uidField.tap()
        uidField.typeText("uid_unknown")

        app.buttons["Sign in"].tap()

        XCTAssertTrue(app.staticTexts["Unauthorized user"].waitForExistence(timeout: 5))
        XCTAssertFalse(app.buttons["My order"].isEnabled)
        XCTAssertFalse(app.buttons["Catalog"].isEnabled)
        XCTAssertFalse(app.buttons["Shifts"].isEnabled)
    }

    @MainActor
    func testPreAuthorizedAdminEntersHomeWithModulesEnabled() throws {
        let app = configuredApp()
        app.launch()
        app.buttons["Enter the app"].tap()

        let emailField = app.textFields["Email"]
        XCTAssertTrue(emailField.waitForExistence(timeout: 5), "Email field not found")
        emailField.tap()
        emailField.typeText("ana.admin@reguerta.app")

        let uidField = app.textFields["Auth UID"]
        uidField.tap()
        uidField.typeText("uid_admin_ui")

        app.buttons["Sign in"].tap()

        XCTAssertTrue(
            app.staticTexts["Home"].waitForExistence(timeout: 8),
            "Home should be visible for pre-authorized admin"
        )

        let myOrderButton = app.buttons["My order"]
        let catalogButton = app.buttons["Catalog"]
        let shiftsButton = app.buttons["Shifts"]

        XCTAssertTrue(myOrderButton.waitForExistence(timeout: 3), "My order button not found")
        XCTAssertTrue(catalogButton.waitForExistence(timeout: 3), "Catalog button not found")
        XCTAssertTrue(shiftsButton.waitForExistence(timeout: 3), "Shifts button not found")

        XCTAssertTrue(myOrderButton.isEnabled, "My order should be enabled")
        XCTAssertTrue(catalogButton.isEnabled, "Catalog should be enabled")
        XCTAssertTrue(shiftsButton.isEnabled, "Shifts should be enabled")
    }

    @MainActor
    func testLaunchPerformance() throws {
        // This measures how long it takes to launch your application.
        measure(metrics: [XCTApplicationLaunchMetric()]) {
            configuredApp().launch()
        }
    }

    private func configuredApp() -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments += ["-AppleLanguages", "(en)", "-AppleLocale", "en_US", "-skipSplash"]
        return app
    }
}
