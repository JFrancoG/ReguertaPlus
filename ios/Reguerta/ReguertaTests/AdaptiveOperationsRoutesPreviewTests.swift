import Foundation
import SwiftUI
import Testing

@testable import Reguerta

@Suite("Adaptive operations route previews")
struct AdaptiveOperationsRoutesPreviewTests {
    @Test func operationsPreviewHostsTheCompleteRouteMatrix() throws {
        let source = try combinedPreviewSource()

        for routeType in expectedRouteTypes {
            #expect(source.contains(routeType), "Missing real route host: \(routeType)")
        }
        for scenario in expectedScenarios {
            #expect(source.contains("case \(scenario)"), "Missing preview scenario: \(scenario)")
        }
        #expect(occurrenceCount(of: "#Preview(", in: source) == expectedScenarios.count)
    }

    @Test func operationsPreviewCoversTheDeclaredAdaptiveCombinations() throws {
        let source = try combinedPreviewSource()

        for requiredFragment in adaptiveMatrixFragments {
            #expect(source.contains(requiredFragment), "Missing adaptive matrix fragment: \(requiredFragment)")
        }

        for scenario in ["myOrderCart", "shiftsPlanning", "deliveryCalendarSheet"] {
            let section = scenarioSection(scenario, in: source)
            #expect(section.contains("width: 320"), "\(scenario) must remain a 320-point stress case")
            #expect(section.contains("dynamicTypeSize: .accessibility5"), "\(scenario) must cover AX5")
            #expect(section.contains("reducesMotion: true"), "\(scenario) must cover Reduce Motion")
        }

        let requiredOverrideCount = AdaptiveOperationsPreviewScenario.allCases
            .map(\.matrix)
            .filter(\.requiresIncreasedContrastOverride)
            .count
        #expect(occurrenceCount(of: "external Increased Contrast override", in: source) == requiredOverrideCount)
    }

    @MainActor @Test func homeFreshnessScenariosMaterializeTheirRuntimeState() {
        let expectations: [(scenario: AdaptiveOperationsPreviewScenario, state: MyOrderFreshnessState)] = [
            (.homeDashboard, .ready),
            (.homeFreshnessIdle, .idle),
            (.homeFreshnessChecking, .checking),
            (.homeFreshnessTimedOut, .timedOut),
            (.homeFreshnessUnavailable, .unavailable)
        ]

        for expectation in expectations {
            let fixture = AdaptiveOperationsPreviewFixture(scenario: expectation.scenario)
            guard case .authorized(let presentation) = fixture.homeDashboardPresentation.content else {
                Issue.record("\(expectation.scenario.rawValue) must materialize authorized Home content")
                continue
            }
            #expect(
                presentation.actionRow.myOrderFreshnessState == expectation.state,
                "\(expectation.scenario.rawValue) must materialize \(expectation.state)"
            )
        }
    }

    @MainActor @Test func receivedOrdersFailureUsesTheRealInlineRetryState() async throws {
        let source = try combinedPreviewSource()
        let routeSource = try receivedOrdersRouteSource()
        let failureScenario = try #require(
            AdaptiveOperationsPreviewScenario.allCases.first {
                $0.rawValue == "receivedOrdersFailure"
            }
        )

        #expect(source.contains("case .receivedOrders, .receivedOrdersWide, .receivedOrdersFailure:"))
        #expect(source.contains("AdaptiveOperationsRoutesPreview(scenario: .receivedOrdersFailure)"))
        #expect(source.contains("receivedOrdersViewModel.loadState = .error"))
        #expect(source.contains("failsReceivedOrdersReads: scenario == .receivedOrdersFailure"))
        #expect(source.contains("throw AdaptiveOperationsPreviewOrdersRepositoryError.unavailable"))
        #expect(source.contains("private var receivedOrdersReadCountValue = 0"))
        #expect(source.contains("receivedOrdersReadCountValue += 1"))
        #expect(source.contains("func receivedOrdersReadCount() -> Int"))
        #expect(routeSource.contains("case .error:"))
        #expect(routeSource.contains("await viewModel.retry()"))

        let fixture = AdaptiveOperationsPreviewFixture(scenario: failureScenario)
        #expect(fixture.receivedOrdersViewModel.loadState == .error)
        let readCountBeforeRetry = await fixture.ordersRepository.receivedOrdersReadCount()
        await fixture.receivedOrdersViewModel.retry()
        let readCountAfterRetry = await fixture.ordersRepository.receivedOrdersReadCount()
        #expect(readCountAfterRetry == readCountBeforeRetry + 1)
        #expect(fixture.receivedOrdersViewModel.loadState == .error)
    }

    @Test func receivedOrdersIncludesPhoneAxAndWideXxxLargeScenarios() throws {
        let source = try combinedPreviewSource()
        let receivedScenarios = AdaptiveOperationsPreviewScenario.allCases.filter {
            $0.rawValue.hasPrefix("receivedOrders") && $0 != .receivedOrdersHistory
        }
        let phoneScenario = receivedScenarios.first { $0.rawValue == "receivedOrders" }
        let wideScenario = receivedScenarios.first { $0.rawValue == "receivedOrdersWide" }
        let failureScenario = receivedScenarios.first { $0.rawValue == "receivedOrdersFailure" }

        #expect(Set(receivedScenarios.map(\.rawValue)) == [
            "receivedOrders",
            "receivedOrdersFailure",
            "receivedOrdersWide"
        ])
        #expect(phoneScenario?.rawValue == "receivedOrders")
        #expect(phoneScenario?.matrix.width == 320)
        #expect(phoneScenario?.matrix.dynamicTypeSize == .large)
        #expect(wideScenario?.rawValue == "receivedOrdersWide")
        #expect(wideScenario?.matrix.width == 600)
        #expect(wideScenario?.matrix.dynamicTypeSize == .xxxLarge)
        #expect(failureScenario?.rawValue == "receivedOrdersFailure")
        #expect(failureScenario?.matrix.width == 320)
        #expect(failureScenario?.matrix.dynamicTypeSize == .accessibility5)
        #expect(source.contains("AdaptiveOperationsRoutesPreview(scenario: .receivedOrdersWide)"))
    }

    @Test func everyPreviewCombinesTheDesignSystemModifierWithItsFixedMatrix() throws {
        let source = try combinedPreviewSource()
        let declarations = previewDeclarations(in: source)

        #expect(declarations.count == AdaptiveOperationsPreviewScenario.allCases.count)
        for scenario in AdaptiveOperationsPreviewScenario.allCases {
            let declaration = declarations.first { $0.contains("scenario: .\(scenario.rawValue)") }
            let matrix = scenario.matrix
            let expectedSize = CGSize(width: matrix.width, height: matrix.height)

            #expect(declaration != nil, "Missing preview declaration for \(scenario.rawValue)")
            #expect(
                declaration?.contains(".modifier(ReguertaDesignSystemPreviewModifier())") == true,
                "\(scenario.rawValue) must apply the design-system preview modifier"
            )
            #expect(
                try declaration.flatMap { try fixedLayoutSize(in: $0) } == expectedSize,
                "\(scenario.rawValue) must pin \(expectedSize.width)x\(expectedSize.height) with fixedLayout"
            )
        }
    }

    @Test func operationsPreviewUsesOnlyDeterministicLocalDependencies() throws {
        let source = try combinedPreviewSource()

        #expect(source.contains("ReguertaAppEnvironment.preview("))
        #expect(source.contains("developmentTimeMachine: .transient("))
        #expect(source.contains("AdaptiveOperationsPreviewOrdersRepository"))
        #expect(source.contains("AdaptiveOperationsPreviewCartStore"))
        #expect(source.contains("productImageUrl: nil"))
        #expect(source.contains("AdaptivePreviewImageDataError.unavailable"))
        #expect(source.contains("TimeZone(identifier: \"Europe/Madrid\")"))
        #expect(source.contains("Firestore") == false)
        #expect(source.contains("URLSession") == false)
        #expect(source.contains("UserDefaults") == false)
        #expect(source.contains("UUID") == false)
        #expect(source.contains("?? .current") == false)
        #expect(source.contains("TimeZone.current") == false)
        #expect(source.contains(".task") == false)
        #expect(source.contains("ProgressView") == false)
    }

    @Test func operationsPreviewDeclaresOnlyOneViewType() throws {
        let source = try combinedPreviewSource()
        let viewConformancePattern = #"\b(?:struct|class|enum)\s+\w+(?:<[^>]+>)?\s*:\s*[^\{\n]*\bView\b"#
        let matches = source.matches(of: try Regex(viewConformancePattern))

        #expect(matches.count == 1)
        #expect(source.contains("struct AdaptiveOperationsRoutesPreview: View"))
    }

    @Test func operationsPreviewSourcesStayDebugOnlyAndLintSized() throws {
        let sources = try previewSources()

        #expect(sources.count == previewSourceFileNames.count)
        for (fileName, source) in zip(previewSourceFileNames, sources) {
            let trimmedSource = source.trimmingCharacters(in: .whitespacesAndNewlines)
            let lineCount = source.components(separatedBy: .newlines).count

            #expect(trimmedSource.hasPrefix("#if DEBUG"), "\(fileName) must be Debug-only")
            #expect(trimmedSource.hasSuffix("#endif"), "\(fileName) must close its Debug guard")
            #expect(lineCount < 500, "\(fileName) must stay below SwiftLint's file-length limit")
            #expect(source.contains("swiftlint:disable") == false)
        }
    }

    private func combinedPreviewSource() throws -> String {
        try previewSources().joined(separator: "\n")
    }

    private func previewSources() throws -> [String] {
        try previewSourceURLs().map { try String(contentsOf: $0, encoding: .utf8) }
    }

    private func previewSourceURLs() -> [URL] {
        let previewDirectory = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .appending(path: "Reguerta/Presentation/Preview")
        return previewSourceFileNames.map { previewDirectory.appending(path: $0) }
    }

    private func receivedOrdersRouteSource() throws -> String {
        let presentationDirectory = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .appending(path: "Reguerta/Presentation")
        let routeURL = presentationDirectory.appending(path: "Orders/ContentView+ReceivedOrdersRoute.swift")
        return try String(contentsOf: routeURL, encoding: .utf8)
    }

    private func occurrenceCount(of needle: String, in source: String) -> Int {
        source.components(separatedBy: needle).count - 1
    }

    private func previewDeclarations(in source: String) -> [String] {
        var declarations = source.components(separatedBy: "#Preview(")
        declarations.removeFirst()
        return declarations
    }

    private func fixedLayoutSize(in declaration: String) throws -> CGSize? {
        let pattern = try Regex(
            #"\.fixedLayout\s*\(\s*width:\s*([0-9_]+)\s*,\s*height:\s*([0-9_]+)\s*\)"#
        )
        guard let match = declaration.firstMatch(of: pattern),
              let widthText = match.output[1].substring,
              let heightText = match.output[2].substring,
              let width = Double(widthText.replacingOccurrences(of: "_", with: "")),
              let height = Double(heightText.replacingOccurrences(of: "_", with: "")) else { return nil }
        return CGSize(width: width, height: height)
    }

    private func scenarioSection(_ scenario: String, in source: String) -> String {
        guard let scenarioTypeRange = source.range(of: "enum AdaptiveOperationsPreviewScenario"),
              let matrixRange = source[scenarioTypeRange.lowerBound...]
                .range(of: "var matrix: AdaptiveOperationsPreviewMatrix"),
              let range = source[matrixRange.lowerBound...].range(of: "case .\(scenario):") else { return "" }
        return String(source[range.lowerBound...].prefix(600))
    }

    private var previewSourceFileNames: [String] {
        [
            "AdaptiveOperationsRoutesPreview.swift",
            "AdaptiveOperationsRoutesPreviewSupport.swift",
            "AdaptiveOperationsRoutesPreviewSupportData.swift"
        ]
    }

    private var expectedRouteTypes: [String] {
        [
            "HomeDashboardRouteView(",
            "HomeDrawerContentView(",
            "MyOrderRouteView(",
            "MyOrdersHistoryRouteView(",
            "ReceivedOrdersRouteView(",
            "ReceivedOrdersHistoryRouteView(",
            "ShiftsRouteView(",
            "SettingsRouteView(",
            "DeliveryCalendarWeekPickerSheet("
        ]
    }

    private var expectedScenarios: [String] {
        [
            "homeDashboard",
            "homeFreshnessIdle",
            "homeFreshnessChecking",
            "homeFreshnessTimedOut",
            "homeFreshnessUnavailable",
            "homeDrawer",
            "myOrderList",
            "myOrderCart",
            "myOrdersHistory",
            "receivedOrders",
            "receivedOrdersFailure",
            "receivedOrdersWide",
            "receivedOrdersHistory",
            "shiftsPlanning",
            "settings",
            "deliveryCalendarSheet"
        ]
    }

    private var adaptiveMatrixFragments: [String] {
        [
            "width: 320",
            "width: 600",
            "width: 1_024",
            "dynamicTypeSize: .large",
            "dynamicTypeSize: .xxxLarge",
            "dynamicTypeSize: .accessibility5",
            "Locale(identifier: \"es_ES\")",
            "Locale(identifier: \"en_US\")",
            "colorScheme: .light",
            "colorScheme: .dark",
            "requiresIncreasedContrastOverride: true",
            "reducesMotion: true",
            ".reguertaPreviewTheme(tokens: matrix.tokens, motionPolicy: matrix.motionPolicy)"
        ]
    }
}
