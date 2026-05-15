//
//  ReguertaUITests.swift
//  ReguertaUITests
//
//  Created by Jesús Franco on 05.02.2026.
//

import XCTest

final class ReguertaUITests: XCTestCase {
    private let enterButtonId = "auth.welcome.enterButton"
    private let emailFieldId = "auth.login.emailField"
    private let passwordFieldId = "auth.login.passwordField"
    private let signInButtonId = "auth.login.signInButton"
    private let menuButtonId = "home.topBar.menuButton"
    private let topBarTitleId = "reguerta.screenHeader.title"
    private let newsDrawerItemId = "home.drawer.item.news"
    private let myOrderButtonId = "home.module.myOrder"
    private let receivedOrdersButtonId = "home.module.receivedOrders"
    private let latestNewsTitleIdPrefix = "home.latestNews.article."
    private let latestNewsScrollId = "home.latestNews.scroll"

    override func setUpWithError() throws {
        // Put setup code here. This method is called before the invocation of each test method in the class.

        // In UI tests it is usually best to stop immediately when a failure occurs.
        continueAfterFailure = false

        // In UI tests set initial state before each run.
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

        let passwordField = app.secureTextFields[passwordFieldId]
        XCTAssertTrue(passwordField.waitForExistence(timeout: 5), "Password field not found")
        passwordField.tap()
        passwordField.typeText("test1234")

        app.buttons[signInButtonId].tap()

        XCTAssertTrue(app.staticTexts["Unauthorized user email"].waitForExistence(timeout: 5))
        dismissPasswordSavePromptIfNeeded(in: app)
        let signOutButton = app.buttons.matching(identifier: "Sign out").firstMatch
        XCTAssertTrue(signOutButton.waitForExistence(timeout: 5))
        signOutButton.tap()
        XCTAssertTrue(app.buttons["Enter the app"].waitForExistence(timeout: 5))
    }

    @MainActor
    func testPreAuthorizedProducerEntersHomeWithActionRowEnabled() throws {
        let app = configuredApp()
        let emailField = launchAndOpenLogin(app)
        emailField.tap()
        emailField.typeText("pablo.producer@reguerta.app")

        let passwordField = app.secureTextFields[passwordFieldId]
        XCTAssertTrue(passwordField.waitForExistence(timeout: 5), "Password field not found")
        passwordField.tap()
        passwordField.typeText("test1234")

        app.buttons[signInButtonId].tap()
        dismissPasswordSavePromptIfNeeded(in: app)

        let myOrderButton = app.buttons[myOrderButtonId]
        let receivedOrdersButton = app.buttons[receivedOrdersButtonId]

        XCTAssertTrue(myOrderButton.waitForExistence(timeout: 8), "My order button not found")
        XCTAssertTrue(receivedOrdersButton.waitForExistence(timeout: 3), "Received orders button not found")

        let enabledPredicate = NSPredicate(format: "isEnabled == true")
        expectation(for: enabledPredicate, evaluatedWith: myOrderButton)
        expectation(for: enabledPredicate, evaluatedWith: receivedOrdersButton)
        waitForExpectations(timeout: 5)

        XCTAssertTrue(myOrderButton.isEnabled, "My order should be enabled")
        XCTAssertTrue(receivedOrdersButton.isEnabled, "Received orders should be enabled")
    }

    @MainActor
    func testHomeShowsLatestNewsWithoutBottomObstruction() throws {
        let app = configuredApp()
        signInAsProducer(in: app)

        let latestNewsTitles = app.staticTexts.matching(
            NSPredicate(format: "identifier BEGINSWITH %@", latestNewsTitleIdPrefix)
        )
        XCTAssertTrue(
            waitForElementCount(latestNewsTitles, minimumCount: 1, timeout: 8),
            "Latest news title not found"
        )

        let latestNewsTitle = latestNewsTitles.element(boundBy: latestNewsTitles.count - 1)
        let latestNewsScroll = app.scrollViews[latestNewsScrollId]
        for _ in 0 ..< 4 where !latestNewsTitle.isHittable {
            latestNewsScroll.swipeUp()
        }

        XCTAssertTrue(latestNewsTitle.isHittable, "Latest news title should be visible and hittable")
        XCTAssertLessThanOrEqual(
            latestNewsTitle.frame.maxY,
            app.frame.maxY - 8,
            "Latest news title should not be covered by the bottom edge"
        )
    }

    @MainActor
    func testDrawerNavigationOpensSelectedRoute() throws {
        let app = configuredApp()
        let emailField = launchAndOpenLogin(app)
        emailField.tap()
        emailField.typeText("pablo.producer@reguerta.app")

        let passwordField = app.secureTextFields[passwordFieldId]
        XCTAssertTrue(passwordField.waitForExistence(timeout: 5), "Password field not found")
        passwordField.tap()
        passwordField.typeText("test1234")

        app.buttons[signInButtonId].tap()
        dismissPasswordSavePromptIfNeeded(in: app)

        let menuButton = app.buttons[menuButtonId]
        XCTAssertTrue(menuButton.waitForExistence(timeout: 8), "Menu button not found")
        dismissPasswordSavePromptIfNeeded(in: app, timeout: 1)
        XCTAssertTrue(waitForHittable(menuButton, timeout: 5), "Menu button not hittable")
        menuButton.tap()

        let newsDrawerItem = app.buttons[newsDrawerItemId]
        XCTAssertTrue(newsDrawerItem.waitForExistence(timeout: 5), "News drawer item not found")
        XCTAssertTrue(waitForHittable(newsDrawerItem, timeout: 5), "News drawer item not hittable")
        newsDrawerItem.tap()

        let title = app.staticTexts[topBarTitleId]
        XCTAssertTrue(title.waitForExistence(timeout: 3), "Top bar title not found")
        XCTAssertEqual(title.label, "Latest news")
    }

    @MainActor
    func testInvalidCredentialsShowsInlineErrorWithoutCrash() throws {
        let app = configuredApp()
        let emailField = launchAndOpenLogin(app)

        emailField.tap()
        emailField.typeText("ana.admin@reguerta.app")

        let passwordField = app.secureTextFields[passwordFieldId]
        XCTAssertTrue(passwordField.waitForExistence(timeout: 5), "Password field not found")
        passwordField.tap()
        passwordField.typeText("wrong123")

        app.buttons[signInButtonId].tap()

        XCTAssertTrue(
            app.staticTexts["Incorrect email or password"].waitForExistence(timeout: 5),
            "Invalid credentials inline error should be shown"
        )
        XCTAssertTrue(app.buttons[signInButtonId].exists, "App should remain alive on invalid credentials")
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
    private func waitForElementCount(
        _ query: XCUIElementQuery,
        minimumCount: Int,
        timeout: TimeInterval
    ) -> Bool {
        let deadline = Date().addingTimeInterval(timeout)
        while Date() < deadline {
            if query.count >= minimumCount {
                return true
            }
            RunLoop.current.run(until: Date().addingTimeInterval(0.25))
        }
        return query.count >= minimumCount
    }

    @MainActor
    private func signInAsProducer(in app: XCUIApplication) {
        let emailField = launchAndOpenLogin(app)
        emailField.tap()
        emailField.typeText("pablo.producer@reguerta.app")

        let passwordField = app.secureTextFields[passwordFieldId]
        XCTAssertTrue(passwordField.waitForExistence(timeout: 5), "Password field not found")
        passwordField.tap()
        passwordField.typeText("test1234")

        app.buttons[signInButtonId].tap()
        dismissPasswordSavePromptIfNeeded(in: app)

        XCTAssertTrue(app.buttons[myOrderButtonId].waitForExistence(timeout: 8), "Home did not load")
    }

    @MainActor
    private func waitForHittable(_ element: XCUIElement, timeout: TimeInterval) -> Bool {
        let predicate = NSPredicate(format: "isHittable == true")
        let expectation = XCTNSPredicateExpectation(predicate: predicate, object: element)
        return XCTWaiter.wait(for: [expectation], timeout: timeout) == .completed
    }

    @MainActor
    private func dismissPasswordSavePromptIfNeeded(in app: XCUIApplication, timeout: TimeInterval = 2) {
        for title in ["Not Now", "Ahora no"] {
            let button = app.buttons[title]
            if button.waitForExistence(timeout: timeout) {
                button.tap()
                return
            }
        }

        let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
        for title in ["Not Now", "Ahora no"] {
            let button = springboard.buttons[title]
            if button.waitForExistence(timeout: timeout) {
                button.tap()
                return
            }
        }
    }

    @MainActor
    private func launchAndOpenLogin(_ app: XCUIApplication) -> XCUIElement {
        app.launch()

        let enterButton = app.buttons[enterButtonId]
        if enterButton.waitForExistence(timeout: 8) {
            enterButton.tap()
        }

        let emailField = app.textFields[emailFieldId]
        XCTAssertTrue(emailField.waitForExistence(timeout: 12), "Email field not found")
        return emailField
    }
}
