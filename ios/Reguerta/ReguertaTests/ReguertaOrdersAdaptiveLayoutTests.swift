import Foundation
import Testing

@Suite("Orders adaptive layout")
struct ReguertaOrdersAdaptiveLayoutTests {
    @Test func orderRoutesDoNotDependOnLegacyWindowScaling() throws {
        let sources = try orderSources()

        for (name, source) in sources {
            #expect(
                source.range(
                    of: #"\.resize(?:BottomSize|StatusBarSize)?\b"#,
                    options: .regularExpression
                ) == nil,
                "Legacy resize helper remains in \(name)"
            )
            #expect(source.contains("DeviceScale") == false, "Global window scale remains in \(name)")
        }
    }

    @Test func denseOrderSummariesOfferACompactContainerFallback() throws {
        let receivedSummary = try orderSource(named: "ContentView+ReceivedOrdersSummaryContent.swift")
        let personalSummary = try orderSource(named: "PersonalOrderSummaryCard.swift")

        #expect(receivedSummary.contains("ViewThatFits(in: .horizontal)"))
        #expect(personalSummary.contains("ViewThatFits(in: .horizontal)"))
    }

    @Test func interactiveOrderControlsUseTheSharedMinimumTarget() throws {
        let sections = try orderSource(named: "ContentView+MyOrderRouteSections.swift")
        let history = try orderSource(named: "ContentView+OrderHistoryWeekComponents.swift")
        let received = try orderSource(named: "ContentView+ReceivedOrdersSummaryContent.swift")
        let overlays = try orderSource(named: "ContentView+MyOrderRouteOverlays.swift")

        #expect(sections.contains("tokens.layout.minimumTouchTarget"))
        #expect(history.contains("tokens.layout.minimumTouchTarget"))
        #expect(received.contains("tokens.layout.minimumTouchTarget"))
        #expect(overlays.contains("minWidth: tokens.layout.minimumTouchTarget"))
        #expect(overlays.contains("minHeight: tokens.layout.minimumTouchTarget"))
    }

    @Test func persistentBottomControlsUseSafeAreaInsetsInsteadOfManualReservations() throws {
        let route = try orderSource(named: "ContentView+MyOrderRoute.swift")
        let sections = try orderSource(named: "ContentView+MyOrderRouteSections.swift")
        let history = try orderSource(named: "ContentView+MyOrdersHistoryRoute.swift")
        let received = try orderSource(named: "ContentView+ReceivedOrdersSummaryContent.swift")

        #expect(route.contains(".safeAreaInset(edge: .bottom, spacing: 0)"))
        #expect(occurrenceCount(of: ".safeAreaInset(edge: .bottom, spacing: 0)", in: sections) == 2)
        #expect(history.contains(".safeAreaInset(edge: .bottom, spacing: 0)"))
        #expect(received.contains(".safeAreaInset(edge: .bottom, spacing: 0)"))
        for source in [sections, history, received] {
            #expect(source.contains(".ignoresSafeArea(.container, edges: .bottom)") == false)
        }
        #expect(sections.contains("orderTotalBarScrollBottomPadding") == false)
        #expect(received.contains("totalBarScrollBottomPadding") == false)
    }

    @Test func cartBackgroundUsesItsContainerInsteadOfTheProcessWindow() throws {
        let route = try orderSource(named: "ContentView+MyOrderRoute.swift")
        let overlays = try orderSource(named: "ContentView+MyOrderRouteOverlays.swift")

        #expect(overlays.contains("containerRelativeFrame(.horizontal)"))
        #expect(route.contains("shortestSide") == false)
        #expect(overlays.contains("shortestSide") == false)
    }

    private func orderSources() throws -> [(String, String)] {
        let resourceKeys: Set<URLResourceKey> = [.isRegularFileKey]
        guard let enumerator = FileManager.default.enumerator(
            at: ordersSourceURL(),
            includingPropertiesForKeys: Array(resourceKeys)
        ) else {
            throw OrdersAdaptiveLayoutSourceError.unavailable
        }
        let sourceURLs: [URL] = try enumerator.compactMap { element in
            guard let sourceURL = element as? URL,
                  sourceURL.pathExtension == "swift",
                  try sourceURL.resourceValues(forKeys: resourceKeys).isRegularFile == true else {
                return nil
            }
            return sourceURL
        }.sorted { $0.path < $1.path }
        guard !sourceURLs.isEmpty else { throw OrdersAdaptiveLayoutSourceError.empty }
        return try sourceURLs.map { ($0.lastPathComponent, try String(contentsOf: $0, encoding: .utf8)) }
    }

    private func orderSource(named fileName: String) throws -> String {
        try String(contentsOf: ordersSourceURL().appending(path: fileName), encoding: .utf8)
    }

    private func occurrenceCount(of needle: String, in source: String) -> Int {
        source.components(separatedBy: needle).count - 1
    }

    private func ordersSourceURL() -> URL {
        URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .appending(path: "Reguerta/Presentation/Orders")
    }
}

private enum OrdersAdaptiveLayoutSourceError: Error {
    case unavailable
    case empty
}
