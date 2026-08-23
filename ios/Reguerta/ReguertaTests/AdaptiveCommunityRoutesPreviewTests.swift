import Foundation
import SwiftUI
import Testing

@testable import Reguerta

@Suite("HU-078 adaptive community route previews")
struct AdaptiveCommunityRoutesPreviewTests {
    @Test func galleryHostsEveryRealCommunityRouteWithOnePreviewViewType() throws {
        let source = try previewSource()
        let supportSource = try previewSupportSource()
        let routeTypes = [
            "ProductsRouteView(",
            "UsersRouteView(",
            "SharedProfileHubRoute(",
            "NewsListRouteView(",
            "NewsEditorRouteView(",
            "NotificationsListRouteView(",
            "NotificationEditorRouteView("
        ]

        #expect(occurrenceCount(of: ": View", in: source) == 1)
        #expect(source.contains("struct AdaptiveCommunityRoutesPreview: View"))
        #expect(supportSource.contains(": View") == false)
        #expect(supportSource.contains("struct AdaptiveCommunityPreviewFixture"))
        for routeType in routeTypes {
            #expect(source.contains(routeType), "Missing real route host: \(routeType)")
        }
    }

    @Test func galleryCoversRepresentativeDeterministicRouteStates() throws {
        let source = try previewSource()
        let expectedStates = [
            "productsLoading",
            "productsEmpty",
            "productsContent",
            "productsFailure",
            "productEditor",
            "usersContent",
            "userEditor",
            "userAction",
            "sharedProfileLoading",
            "sharedProfileContent",
            "newsLoading",
            "newsContent",
            "newsEditor",
            "notificationsEmpty",
            "notificationsContent",
            "notificationEditor",
            "routeError"
        ]

        #expect(occurrenceCount(of: "#Preview(", in: source) == expectedStates.count)
        for state in expectedStates {
            #expect(source.contains("case .\(state)"), "Missing configured state: \(state)")
            #expect(source.contains("scenario: .\(state)"), "Missing rendered preview: \(state)")
        }
        #expect(source.contains("GlobalFeedbackRouteView("))
        #expect(source.contains("isVoiceOverEnabled: true"))
    }

    @MainActor @Test func productsFailureUsesItsRealRouteAndDeterministicGlobalFeedback() throws {
        let source = try previewSource()
        let failureScenario = try #require(
            AdaptiveCommunityPreviewScenario.allCases.first {
                String(describing: $0) == "productsFailure"
            }
        )

        #expect(source.contains("AdaptiveCommunityRoutesPreview(scenario: .productsFailure)"))
        #expect(source.contains("messageKey: fixture.environment.feedbackCenter.messageKey"))
        #expect(source.contains("fixture.environment.feedbackCenter.clear()"))
        #expect(source.contains("environment.feedbackCenter.show(AccessL10nKey.feedbackUnableLoadData)"))
        guard case .products = failureScenario.route else {
            Issue.record("Products failure must render ProductsRouteView")
            return
        }

        let fixture = AdaptiveCommunityPreviewFixture.make(for: failureScenario)
        #expect(fixture.rootViewModel.productsViewModel.isLoadingCatalog == false)
        #expect(fixture.environment.feedbackCenter.messageKey == AccessL10nKey.feedbackUnableLoadData)
    }

    @MainActor @Test func galleryDeclaresTheRequiredGeometryTypeLocaleAppearanceAndMotionMatrix() throws {
        let source = try previewSource()
        let variants = AdaptiveCommunityPreviewScenario.allCases.map(\.matrix)

        #expect(variants.count == 17)
        #expect(Set(variants.map(\.canvas)) == Set(AdaptiveCommunityPreviewCanvas.allCases))
        #expect(Set(variants.map(\.dynamicTypeSize)) == [.large, .xxxLarge, .accessibility5])
        #expect(Set(variants.map(\.localeIdentifier)) == ["es", "en"])
        #expect(Set(variants.map(\.colorScheme)) == [.light, .dark])
        #expect(Set(variants.map(\.requiresIncreasedContrastOverride)) == [false, true])
        #expect(Set(variants.map(\.reducesMotion)) == [false, true])
        #expect(variants.map(\.requiresIncreasedContrastOverride).filter { $0 }.count == 10)
        #expect(occurrenceCount(of: "external Increased Contrast override", in: source) == 10)
        #expect(source.contains(".environment(\\.locale,"))
        #expect(source.contains(".environment(\\.dynamicTypeSize,"))
        #expect(source.contains(".reguertaPreviewTheme("))
        #expect(source.contains(".preferredColorScheme("))
    }

    @MainActor @Test func everyPreviewCombinesTheDesignSystemModifierWithItsFixedCanvas() throws {
        let source = try previewSource()
        let declarations = previewDeclarations(in: source)

        #expect(declarations.count == AdaptiveCommunityPreviewScenario.allCases.count)
        for scenario in AdaptiveCommunityPreviewScenario.allCases {
            let scenarioName = String(describing: scenario)
            let declaration = declarations.first { $0.contains("scenario: .\(scenarioName)") }
            let expectedSize = scenario.matrix.canvas.size

            #expect(declaration != nil, "Missing preview declaration for \(scenarioName)")
            #expect(
                declaration?.contains(".modifier(ReguertaDesignSystemPreviewModifier())") == true,
                "\(scenarioName) must apply the design-system preview modifier"
            )
            #expect(
                try declaration.flatMap { try fixedLayoutSize(in: $0) } == expectedSize,
                "\(scenarioName) must pin \(expectedSize.width)x\(expectedSize.height) with fixedLayout"
            )
        }
    }

    @Test func previewOnlyHostAndSupportStayOutOfProductionBuilds() throws {
        for sourceURL in previewSourceURLs() {
            let source = try String(contentsOf: sourceURL, encoding: .utf8)
            #expect(source.hasPrefix("#if DEBUG\n"), "Missing DEBUG fence: \(sourceURL.lastPathComponent)")
            #expect(source.hasSuffix("#endif\n"), "Unclosed DEBUG fence: \(sourceURL.lastPathComponent)")
        }
    }

    @Test func fixtureUsesOnlyTheInMemoryPreviewGraphAndStableValues() throws {
        let source = try previewSource()
        let forbiddenLiveDependencies = [
            "ReguertaAppEnvironment.live",
            "URLSession",
            "Firestore",
            "Firebase",
            "UserDefaults",
            "Date()",
            "UUID()",
            "Task {",
            ".task(",
            "handleSessionModeChange("
        ]

        #expect(source.contains("ReguertaAppEnvironment.preview("))
        #expect(source.contains("previewNowMillis: Int64 = 1_735_689_600_000"))
        #expect(source.contains("environment.sessionViewModel.mode = .authorized(session)"))
        #expect(source.contains("loadNewsImageData: { _ in throw AdaptivePreviewImageDataError.unavailable }"))
        #expect(source.contains("environment(\\.colorSchemeContrast") == false)
        #expect(source.contains("environment(\\.accessibilityReduceMotion") == false)
        #expect(source.contains("environment(\\.reguertaTokens") == false)
        for dependency in forbiddenLiveDependencies {
            #expect(source.contains(dependency) == false, "Preview reads live or unstable dependency: \(dependency)")
        }
    }

    private func previewSource() throws -> String {
        try previewSourceURLs()
            .map { try String(contentsOf: $0, encoding: .utf8) }
            .joined(separator: "\n")
    }

    private func previewSupportSource() throws -> String {
        try previewSourceURLs()
            .filter { $0.lastPathComponent != "AdaptiveCommunityRoutesPreview.swift" }
            .map { try String(contentsOf: $0, encoding: .utf8) }
            .joined(separator: "\n")
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

    private func previewSourceURLs() -> [URL] {
        let previewDirectory = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .appending(path: "Reguerta/Presentation/Preview")
        return [
            previewDirectory.appending(path: "AdaptiveCommunityRoutesPreview.swift"),
            previewDirectory.appending(path: "AdaptiveCommunityRoutesPreviewSupport.swift"),
            previewDirectory.appending(path: "AdaptiveCommunityRoutesPreviewFixtures.swift")
        ]
    }
}
