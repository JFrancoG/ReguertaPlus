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
        #expect(source.contains("ReguertaDesignSystemPreviewModifier") == false)
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

    @Test func everyPreviewPinsItsScenarioMatrixWithAnExplicitFixedLayout() throws {
        let source = try combinedPreviewSource()
        let declarations = previewDeclarations(in: source)

        #expect(declarations.count == AdaptiveOperationsPreviewScenario.allCases.count)
        for scenario in AdaptiveOperationsPreviewScenario.allCases {
            let declaration = declarations.first { $0.contains("scenario: .\(scenario.rawValue)") }
            let matrix = scenario.matrix
            let expectedSize = CGSize(width: matrix.width, height: matrix.height)

            #expect(declaration != nil, "Missing preview declaration for \(scenario.rawValue)")
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
            #"traits:\s*\.fixedLayout\s*\(\s*width:\s*([0-9_]+)\s*,\s*height:\s*([0-9_]+)\s*\)"#
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
            "homeDrawer",
            "myOrderList",
            "myOrderCart",
            "myOrdersHistory",
            "receivedOrders",
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
