import Foundation
import Testing

@testable import Reguerta

@Suite("Settings and shifts adaptive layout")
struct SettingsShiftsAdaptiveLayoutTests {
    @Test func deliveryCalendarControlsRetainTheAccessibleMinimumTarget() {
        #expect(DeliveryCalendarAdaptiveLayoutContract.dayControlSize(minimumTouchTarget: 44) == 46)
        #expect(DeliveryCalendarAdaptiveLayoutContract.dayControlSize(minimumTouchTarget: 52) == 52)
    }

    @Test func deliveryCalendarNavigationStacksForAccessibilitySizes() {
        #expect(DeliveryCalendarAdaptiveLayoutContract.usesStackedDayNavigation(isAccessibilitySize: false) == false)
        #expect(DeliveryCalendarAdaptiveLayoutContract.usesStackedDayNavigation(isAccessibilitySize: true))
        #expect(DeliveryCalendarAdaptiveLayoutContract.prefersExpandedSheet(isAccessibilitySize: false) == false)
        #expect(DeliveryCalendarAdaptiveLayoutContract.prefersExpandedSheet(isAccessibilitySize: true))
    }

    @Test func deliveryCalendarEditorUsesTheAllowedExceptionPolicy() {
        #expect(
            DeliveryCalendarAdaptiveLayoutContract.selectableWeekdays(
                defaultWeekday: .wednesday,
                selectedWeekday: .wednesday
            ) == [.tuesday, .wednesday, .thursday, .friday]
        )
        #expect(
            DeliveryCalendarAdaptiveLayoutContract.selectableWeekdays(
                defaultWeekday: .sunday,
                selectedWeekday: .sunday
            ) == [.tuesday, .thursday, .friday, .sunday]
        )
        #expect(
            DeliveryCalendarAdaptiveLayoutContract.selectableWeekdays(
                defaultWeekday: .wednesday,
                selectedWeekday: .saturday
            ) == [.tuesday, .wednesday, .thursday, .friday, .saturday]
        )
        #expect(
            DeliveryCalendarAdaptiveLayoutContract.selectableWeekdays(
                defaultWeekday: .wednesday,
                selectedWeekday: .wednesday
            ).contains(.saturday) == false
        )
    }

    @Test func shiftBoardColumnReleasesItsFixedWidthForAccessibilitySizes() {
        #expect(
            ShiftsAdaptiveLayoutContract.leadingColumnWidth(for: .market, isAccessibilitySize: false) == 80
        )
        #expect(
            ShiftsAdaptiveLayoutContract.leadingColumnWidth(for: .delivery, isAccessibilitySize: false) == 88
        )
        #expect(
            ShiftsAdaptiveLayoutContract.leadingColumnWidth(for: .market, isAccessibilitySize: true) == nil
        )
        #expect(
            ShiftsAdaptiveLayoutContract.leadingColumnWidth(for: .delivery, isAccessibilitySize: true) == nil
        )
        #expect(ShiftsAdaptiveLayoutContract.nextShiftTitleWidth(isAccessibilitySize: false) == 104)
        #expect(ShiftsAdaptiveLayoutContract.nextShiftTitleWidth(isAccessibilitySize: true) == nil)
        #expect(ShiftsAdaptiveLayoutContract.usesStackedNextShiftSummary(isAccessibilitySize: false) == false)
        #expect(ShiftsAdaptiveLayoutContract.usesStackedNextShiftSummary(isAccessibilitySize: true))
    }

    @Test func shiftEditorHeightUsesTheSemanticTouchTarget() {
        #expect(ShiftsAdaptiveLayoutContract.editorMinimumHeight(minimumTouchTarget: 44) == 176)
        #expect(ShiftsAdaptiveLayoutContract.editorMinimumHeight(minimumTouchTarget: 52) == 208)
    }

    @Test func featureActionsReleaseTheirMaximumWidthForAccessibilitySizes() {
        #expect(DeliveryCalendarAdaptiveLayoutContract.actionMaximumWidth(isAccessibilitySize: false) == 216)
        #expect(DeliveryCalendarAdaptiveLayoutContract.actionMaximumWidth(isAccessibilitySize: true) == nil)
        #expect(ShiftsAdaptiveLayoutContract.actionMaximumWidth(isAccessibilitySize: false) == 196)
        #expect(ShiftsAdaptiveLayoutContract.actionMaximumWidth(isAccessibilitySize: true) == nil)
    }

    @Test func settingsAndShiftsSourcesDoNotUseLegacyResizeAPIs() throws {
        for relativePath in [
            "Presentation/Settings/ContentView+DeliveryCalendarSheets.swift",
            "Presentation/Shifts/ContentView+ShiftsRouteComponents.swift"
        ] {
            let sourceURL = productionSourceURL().appending(path: relativePath)
            let source = try String(contentsOf: sourceURL, encoding: .utf8)

            #expect(
                source.range(
                    of: #"\.resize(?:BottomSize|StatusBarSize)?\b"#,
                    options: .regularExpression
                ) == nil,
                "Legacy scaling remains in \(sourceURL.lastPathComponent)"
            )
        }
    }

    @Test func accessibilityCalendarKeepsItsContentScrollableAndSaveActionInset() throws {
        let sourceURL = productionSourceURL()
            .appending(path: "Presentation/Settings/ContentView+DeliveryCalendarSheets.swift")
        let source = try String(contentsOf: sourceURL, encoding: .utf8)

        #expect(source.contains("ScrollView(.vertical, showsIndicators: true)"))
        #expect(source.contains(".safeAreaInset(edge: .bottom, spacing: 0)"))
        #expect(source.contains(".frame(height: 180)"))
    }

    @Test func shiftsRouteKeepsAccessibilityContentScrollable() throws {
        let sourceURL = productionSourceURL().appending(path: "Presentation/Shifts/ContentView+ShiftsRoutes.swift")
        let source = try String(contentsOf: sourceURL, encoding: .utf8)

        #expect(source.contains("ScrollView(.vertical, showsIndicators: true)"))
        #expect(source.contains(".fixedSize(horizontal: false, vertical: true)"))
    }

    private func productionSourceURL() -> URL {
        URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .appending(path: "Reguerta")
    }
}
