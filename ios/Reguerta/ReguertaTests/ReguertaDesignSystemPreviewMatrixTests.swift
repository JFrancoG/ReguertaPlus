import Foundation
import Testing

@testable import Reguerta

@Suite("DesignSystem preview matrix")
struct ReguertaDesignSystemPreviewMatrixTests {
    @Test func canonicalScenariosCoverEveryRequiredAxisWithoutACartesianProduct() {
        let scenarios = ReguertaDesignSystemPreviewScenario.canonicalMatrix

        #expect(scenarios.count == 4)
        #expect(Set(scenarios.map(\.identifier)).count == scenarios.count)
        #expect(Set(scenarios.map(\.width)) == Set(ReguertaDesignSystemPreviewWidth.allCases))
        #expect(Set(scenarios.map(\.contentSize)) == Set(ReguertaDesignSystemPreviewContentSize.allCases))
        #expect(Set(scenarios.map(\.requiresIncreasedContrastOverride)) == [false, true])
        #expect(Set(scenarios.map(\.motion)) == Set(ReguertaDesignSystemPreviewMotion.allCases))
        #expect(scenarios.contains { $0.locale == .spanish && $0.colorScheme == .light })
        #expect(scenarios.contains { $0.locale == .english && $0.colorScheme == .dark })
    }

    @Test func fixtureCatalogCoversEveryComponentAndRequiredState() {
        let fixtures = ReguertaDesignSystemPreviewFixture.allCases
        let actualStates = Dictionary(grouping: fixtures, by: \.component)
            .mapValues { Set($0.flatMap(\.stateIdentifiers)) }

        #expect(Set(actualStates.keys) == Set(ReguertaDesignSystemPreviewComponent.allCases))
        for (component, requiredStates) in expectedStatesByComponent {
            #expect(actualStates[component, default: []].isSuperset(of: requiredStates))
        }

        let scenariosByComponent = Dictionary(grouping: fixtures, by: \.component)
            .mapValues { $0.map(\.scenario) }
        for component in ReguertaDesignSystemPreviewComponent.allCases {
            let scenarios = scenariosByComponent[component, default: []]
            #expect(Set(scenarios.map(\.contentSize)) == Set(ReguertaDesignSystemPreviewContentSize.allCases))
            #expect(scenarios.contains { $0.locale == .spanish && $0.colorScheme == .light })
            #expect(scenarios.contains { $0.locale == .english && $0.colorScheme == .dark })
        }
        #expect(Set(fixtures.map(\.scenario)) == Set(ReguertaDesignSystemPreviewScenario.canonicalMatrix))
    }

    @Test func everyRequiredComponentPreviewSelectsAnExplicitFixture() throws {
        var increasedContrastPreviewCount = 0
        for (fileName, fixtures) in expectedFixturesByFile {
            let source = try source(at: designSystemSourceURL().appending(path: fileName, directoryHint: .notDirectory))
            for fixture in fixtures {
                #expect(source.contains("ReguertaDesignSystemPreviewModifier(fixture: .\(fixture.rawValue))"))
            }

            let previews = try previewDeclarations(in: source)
            #expect(previews.count == fixtures.count)
            #expect(previews.allSatisfy { $0.contains("fixture:") })
            increasedContrastPreviewCount += previews.filter {
                $0.contains("external Increased Contrast override")
            }.count
        }

        let requiredOverrideCount = ReguertaDesignSystemPreviewFixture.allCases
            .map(\.scenario)
            .filter(\.requiresIncreasedContrastOverride)
            .count
        #expect(increasedContrastPreviewCount == requiredOverrideCount)
    }

    @Test func allThirtyComponentPreviewsUseTheirFixtureDimensionsAsFixedLayoutTraits() throws {
        var declaredFixtures: [ReguertaDesignSystemPreviewFixture] = []

        for (fileName, expectedFixtures) in expectedFixturesByFile {
            let source = try source(at: designSystemSourceURL().appending(path: fileName, directoryHint: .notDirectory))
            let previews = try previewDeclarations(in: source)

            #expect(previews.count == expectedFixtures.count)
            for preview in previews {
                let parsedFixture = try previewFixture(in: preview)
                let parsedFixedLayout = try previewFixedLayout(in: preview)
                let fixture = try #require(parsedFixture)
                let fixedLayout = try #require(parsedFixedLayout)

                #expect(fixedLayout.width == fixture.scenario.width.points)
                #expect(fixedLayout.height == fixture.scenario.height)
                declaredFixtures.append(fixture)
            }
        }

        #expect(declaredFixtures.count == 30)
        #expect(
            Set(declaredFixtures.map(\.rawValue))
                == Set(ReguertaDesignSystemPreviewFixture.allCases.map(\.rawValue))
        )
    }

    @Test func sharedModifierIsDeterministicAndSideEffectFree() throws {
        let source = try source(at: previewSupportSourceURL())
        let forbiddenEffects = [
            "SwiftData",
            "ModelContainer",
            "FetchDescriptor",
            "@Model",
            "fetchCount",
            "context.insert",
            "context.save",
            ".task",
            ".onAppear"
        ]

        #expect(forbiddenEffects.allSatisfy { !source.contains($0) })
        #expect(source.contains("environment(\\.locale"))
        #expect(source.contains("transformEnvironment(\\.dynamicTypeSize"))
        #expect(source.contains("reguertaPreviewTheme("))
        #expect(source.contains("environment(\\.colorSchemeContrast") == false)
        #expect(source.contains("environment(\\.accessibilityReduceMotion") == false)
        #expect(source.contains("environment(\\.reguertaTokens") == false)
        #expect(source.contains("preferredColorScheme"))
        #expect(source.contains("requiresIncreasedContrastOverride"))
    }

    @Test func floatingActionButtonHasNoDeadManualScrollReservation() throws {
        let source = try source(
            at: designSystemSourceURL()
                .appending(
                    path: "Components/ReguertaFloatingActionButton/ReguertaFloatingActionButtonView.swift",
                    directoryHint: .notDirectory
                )
        )

        #expect(!source.contains("scrollContentBottomPadding"))
        #expect(!source.contains("static let scrollContentBottomPadding: CGFloat = 96"))
    }

    @Test func dialogIconUsesSemanticDesignSystemMetrics() throws {
        let source = try source(
            at: designSystemSourceURL()
                .appending(path: "Components/ReguertaDialog/ReguertaDialogView.swift", directoryHint: .notDirectory)
        )

        #expect(source.contains("tokens.layout.minimumTouchTarget * 2"))
        #expect(source.contains("tokens.layout.minimumTouchTarget"))
        #expect(source.contains("tokens.icons.standard"))
        #expect(!source.contains("frame(width: 88, height: 88)"))
        #expect(!source.contains("frame(width: 38, height: 38)"))
        #expect(!source.contains("system(size: 18"))
    }

    private func source(at url: URL) throws -> String {
        try String(contentsOf: url, encoding: .utf8)
    }

    private func previewDeclarations(in source: String) throws -> [String] {
        let pattern = try Regex(#"#Preview\((?s:.*?)\)\s*\{"#)
        return source.matches(of: pattern).compactMap { $0.output[0].substring.map(String.init) }
    }

    private func previewFixture(in declaration: String) throws -> ReguertaDesignSystemPreviewFixture? {
        let pattern = try Regex(#"fixture:\s*\.([A-Za-z0-9_]+)"#)
        guard let match = declaration.firstMatch(of: pattern),
              let fixtureName = match.output[1].substring else { return nil }

        return ReguertaDesignSystemPreviewFixture(rawValue: String(fixtureName))
    }

    private func previewFixedLayout(in declaration: String) throws -> (width: CGFloat, height: CGFloat)? {
        let pattern = try Regex(#"\.fixedLayout\s*\(\s*width:\s*([0-9_]+),\s*height:\s*([0-9_]+)\s*\)"#)
        guard let match = declaration.firstMatch(of: pattern),
              let widthText = match.output[1].substring,
              let heightText = match.output[2].substring,
              let width = Double(widthText.replacingOccurrences(of: "_", with: "")),
              let height = Double(heightText.replacingOccurrences(of: "_", with: "")) else {
            return nil
        }

        return (CGFloat(width), CGFloat(height))
    }

    private func previewSupportSourceURL() -> URL {
        projectSourceURL()
            .appending(path: "Reguerta/App/ReguertaDesignSystemPreviewSupport.swift", directoryHint: .notDirectory)
    }

    private func designSystemSourceURL() -> URL {
        projectSourceURL().appending(path: "Reguerta/DesignSystem", directoryHint: .isDirectory)
    }

    private func projectSourceURL() -> URL {
        URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
    }

    private var expectedStatesByComponent: [ReguertaDesignSystemPreviewComponent: Set<String>] {
        [
            .button: ["primary", "secondary", "destructive", "text", "disabled", "loading"],
            .card: ["content", "compact", "longContent", "xxxLarge", "ax5"],
            .input: ["default", "secure", "error", "disabled", "multiline", "clear", "ax5"],
            .dialog: ["info", "error", "singleAction", "twoActions", "ax5"],
            .inlineFeedback: ["info", "warning", "error", "longContent", "xxxLarge", "ax5"],
            .list: ["highlighted", "enabledAction", "disabledAction", "longContent"],
            .floatingActionButton: ["enabled", "disabled"],
            .header: ["back", "menu", "notifications", "cartCount", "disabledAction", "longTitle"],
            .scaffold: ["bottomInset", "noBottomInset", "compact", "readableWidth"]
        ]
    }

    private var expectedFixturesByFile: [String: [ReguertaDesignSystemPreviewFixture]] {
        [
            "Components/ReguertaButton/ReguertaButtonView.swift": [.buttonPrimary, .buttonAccessibility],
            "Components/ReguertaButton/ReguertaButtonContrastPreview.swift": [.buttonStates],
            "Components/ReguertaCard/ReguertaCardView.swift": [.cardPrimary, .cardXXX, .cardAccessibility],
            "Components/ReguertaInputField/ReguertaInputFieldView.swift": [
                .inputCompact, .inputStates, .inputAccessibility
            ],
            "Components/ReguertaDialog/ReguertaDialogView.swift": [
                .dialogInfo, .dialogXXX, .dialogAccessibility
            ],
            "Components/ReguertaInlineFeedback/ReguertaInlineFeedbackView.swift": [
                .inlinePrimary, .inlineXXX, .inlineAccessibility
            ],
            "Components/ReguertaListItemCard/ReguertaListItemCardView.swift": [
                .listCompact, .listActions, .listAccessibility
            ],
            "Components/ReguertaFloatingActionButton/ReguertaFloatingActionButtonView.swift": [
                .fabStates, .fabXXX, .fabAccessibility
            ],
            "Components/ReguertaScreenHeader/ReguertaScreenHeaderView.swift": [
                .headerBackTitle, .headerLongTitle, .headerNotifications, .headerCartCount, .headerDisabledAction
            ],
            "Components/ReguertaScreenScaffold/ReguertaScreenScaffold.swift": [
                .scaffoldCompact, .scaffoldXXX, .scaffoldAccessibility, .scaffoldReadableWidth
            ]
        ]
    }
}
