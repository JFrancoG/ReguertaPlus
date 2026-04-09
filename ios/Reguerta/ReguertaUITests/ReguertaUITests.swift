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
        XCUIApplication().terminate()
    }

    override func tearDownWithError() throws {
        // Put teardown code here. This method is called after the invocation of each test method in the class.
    }

    @MainActor
    func testUnauthorizedUserShowsRestrictedMode() throws {
        let app = configuredApp()
        let emailField = launchAndOpenLogin(app)

        emailField.tap()
        emailField.typeText("unknown@reguerta.app")

        let passwordField = app.secureTextFields["Password"]
        XCTAssertTrue(passwordField.waitForExistence(timeout: 5), "Password field not found")
        passwordField.tap()
        passwordField.typeText("test1234")

        app.buttons["Sign in"].tap()

        XCTAssertTrue(app.staticTexts["Unauthorized user email"].waitForExistence(timeout: 5))
        let signOutButton = app.buttons.matching(identifier: "Sign out").firstMatch
        XCTAssertTrue(signOutButton.waitForExistence(timeout: 5))
        signOutButton.tap()
        XCTAssertTrue(app.buttons["Enter the app"].waitForExistence(timeout: 5))
    }

    @MainActor
    func testPreAuthorizedAdminEntersHomeWithModulesEnabled() throws {
        let app = configuredApp()
        let emailField = launchAndOpenLogin(app)
        emailField.tap()
        emailField.typeText("ana.admin@reguerta.app")

        let passwordField = app.secureTextFields["Password"]
        XCTAssertTrue(passwordField.waitForExistence(timeout: 5), "Password field not found")
        passwordField.tap()
        passwordField.typeText("test1234")

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

        let enabledPredicate = NSPredicate(format: "isEnabled == true")
        expectation(for: enabledPredicate, evaluatedWith: myOrderButton)
        expectation(for: enabledPredicate, evaluatedWith: shiftsButton)
        waitForExpectations(timeout: 5)

        XCTAssertTrue(myOrderButton.isEnabled, "My order should be enabled")
        XCTAssertTrue(shiftsButton.isEnabled, "Shifts should be enabled")
    }

    @MainActor
    func testInvalidCredentialsShowsInlineErrorWithoutCrash() throws {
        let app = configuredApp()
        let emailField = launchAndOpenLogin(app)

        emailField.tap()
        emailField.typeText("ana.admin@reguerta.app")

        let passwordField = app.secureTextFields["Password"]
        XCTAssertTrue(passwordField.waitForExistence(timeout: 5), "Password field not found")
        passwordField.tap()
        passwordField.typeText("wrong123")

        app.buttons["Sign in"].tap()

        XCTAssertTrue(
            app.staticTexts["Incorrect email or password"].waitForExistence(timeout: 5),
            "Invalid credentials inline error should be shown"
        )
        XCTAssertTrue(app.buttons["Sign in"].exists, "App should remain alive on invalid credentials")
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
        app.launchArguments += ["-AppleLanguages", "(en)", "-AppleLocale", "en_US", "-skipSplash", "-useMockAuth"]
        return app
    }

    @MainActor
    private func launchAndOpenLogin(_ app: XCUIApplication) -> XCUIElement {
        app.launch()

        let enterButton = app.buttons["Enter the app"]
        if enterButton.waitForExistence(timeout: 8) {
            enterButton.tap()
        }

        let emailField = app.textFields["Email"]
        XCTAssertTrue(emailField.waitForExistence(timeout: 12), "Email field not found")
        return emailField
    }
}
