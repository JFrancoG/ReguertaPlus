import XCTest

extension ReguertaUITests {
    @MainActor func testProducerEditsMockProductAndReturnsToUpdatedList() throws {
        let app = configuredApp()
        signInAsProducer(in: app)
        openDrawer(in: app)
        let drawerItem = app.buttons["home.drawer.item.products"]
        let drawerNavigationScroll = app.scrollViews["home.drawer.navigationScroll"]
        XCTAssertTrue(waitForHittable(drawerNavigationScroll, timeout: 5), "Drawer navigation scroll not hittable")
        var drawerScrollAttempts = 0
        while !drawerItem.isHittable && drawerScrollAttempts < 4 {
            drawerNavigationScroll.swipeUp()
            drawerScrollAttempts += 1
        }
        XCTAssertTrue(waitForHittable(drawerItem, timeout: 5), "Products drawer item not hittable")
        drawerItem.tap()
        XCTAssertTrue(app.staticTexts["Tomatoes"].waitForExistence(timeout: 8), "Mock product not found")
        let editButton = app.buttons["Edit product"].firstMatch
        XCTAssertTrue(waitForHittable(editButton, timeout: 5), "Edit product button not hittable")
        editButton.tap()
        let nameField = app.textFields["Product name"]
        XCTAssertTrue(nameField.waitForExistence(timeout: 5), "Product name field not found")
        XCTAssertEqual(nameField.value as? String, "Tomatoes", "Editor did not load the exact mock product")
        let clearButton = app.buttons["Clear"].firstMatch
        XCTAssertTrue(clearButton.waitForExistence(timeout: 3), "Product name clear button not found")
        clearButton.tap()
        nameField.tap()
        nameField.typeText("Tomatoes updated")
        XCTAssertEqual(nameField.value as? String, "Tomatoes updated")
        dismissKeyboardBeforeSubmitting(in: app)
        let saveButton = app.buttons["Save product"]
        let editorScroll = app.scrollViews["products.route.scroll"]
        XCTAssertTrue(waitForHittable(editorScroll, timeout: 5), "Products route scroll not hittable")
        var editorScrollAttempts = 0
        while !saveButton.isHittable && editorScrollAttempts < 8 {
            editorScroll.swipeUp()
            editorScrollAttempts += 1
        }
        XCTAssertTrue(waitForHittable(saveButton, timeout: 5), "Save product button not hittable")
        saveButton.tap()
        XCTAssertTrue(waitForNonExistence(nameField, timeout: 8), "Product editor did not close after save")
        let originalRows = app.staticTexts.matching(NSPredicate(format: "label == %@", "Tomatoes"))
        XCTAssertEqual(originalRows.count, 0, "Original product name remained in the list")
        let updatedRows = app.staticTexts.matching(NSPredicate(format: "label == %@", "Tomatoes updated"))
        XCTAssertTrue(updatedRows.firstMatch.waitForExistence(timeout: 8), "Updated product did not return to the list")
        XCTAssertEqual(updatedRows.count, 1, "Updated product should appear exactly once")
    }
}
