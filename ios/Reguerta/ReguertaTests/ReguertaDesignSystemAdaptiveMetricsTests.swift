import Foundation
import Testing

@testable import Reguerta

@Suite("DesignSystem adaptive component contracts")
struct ReguertaDesignSystemAdaptiveMetricsTests {
    @MainActor @Test func interactiveComponentMetricsPreserveAtLeastTheAccessibleMinimum() {
        let tokens = ReguertaDesignTokens.light
        let minimumTouchTarget = tokens.layout.minimumTouchTarget

        #expect(tokens.button.fullHeight >= minimumTouchTarget)
        #expect(ReguertaFloatingActionButtonLayout.minimumHeight >= minimumTouchTarget)
        #expect(
            ReguertaInputFieldLayout.actionSize(
                iconSize: tokens.icons.prominent,
                minimumTouchTarget: minimumTouchTarget
            ) == minimumTouchTarget
        )
        #expect(
            ReguertaListItemCardLayout.actionTargetSize(
                requestedSize: 32,
                minimumTouchTarget: minimumTouchTarget
            ) == minimumTouchTarget
        )
        #expect(
            ReguertaListItemCardLayout.actionTargetSize(
                requestedSize: 52,
                minimumTouchTarget: minimumTouchTarget
            ) == 52
        )
        #expect(ReguertaScreenHeaderLayout.actionSize >= minimumTouchTarget)
        #expect(
            ReguertaScreenScaffoldLayout.maximumContentWidth(
                requestedWidth: 320,
                readableMaximumWidth: tokens.layout.readableContentMaximumWidth
            ) == 320
        )
        #expect(
            ReguertaScreenScaffoldLayout.maximumContentWidth(
                requestedWidth: 1_024,
                readableMaximumWidth: tokens.layout.readableContentMaximumWidth
            ) == tokens.layout.readableContentMaximumWidth
        )
    }

    @Test func sharedComponentsRespectTouchDialogAlignmentAndSafeAreaOwnership() throws {
        let inputSource = try source(
            at: designSystemSourceURL()
                .appending(path: "Components/ReguertaInputField/ReguertaInputFieldView.swift")
        )
        let dialogSource = try source(
            at: designSystemSourceURL()
                .appending(path: "Components/ReguertaDialog/ReguertaDialogView.swift")
        )
        let scaffoldSource = try source(
            at: designSystemSourceURL()
                .appending(path: "Components/ReguertaScreenScaffold/ReguertaScreenScaffold.swift")
        )

        #expect(
            inputSource.range(
                of: #"\.frame\((?s:.*?)minHeight:\s*tokens\.layout\.minimumTouchTarget"#,
                options: .regularExpression
            ) != nil
        )
        #expect(dialogSource.contains(".defaultScrollAnchor(.center, for: .alignment)"))
        #expect(scaffoldSource.contains(".ignoresSafeArea(.container, edges: .bottom)") == false)
        #expect(scaffoldSource.contains("tokens.colors.surfacePrimary.ignoresSafeArea()"))
        #expect(
            scaffoldSource.components(
                separatedBy: ".padding(.horizontal, tokens.layout.compactHorizontalPadding)"
            ).count == 4
        )
    }

    @Test func designSystemComponentsDoNotReadLegacyGlobalScaling() throws {
        let sourceURLs = try swiftSourceURLs(in: designSystemSourceURL())
        let legacyReferences = try sourceURLs.flatMap { sourceURL in
            try source(at: sourceURL)
                .split(separator: "\n")
                .enumerated()
                .filter { _, line in
                    line.range(
                        of: #"\.resize(?:BottomSize|StatusBarSize)?\b"#,
                        options: .regularExpression
                    ) != nil || line.contains("DeviceScale")
                }
                .map { offset, _ in
                    "\(sourceURL.lastPathComponent):\(offset + 1)"
                }
        }

        #expect(legacyReferences.isEmpty, "Legacy layout references remain at \(legacyReferences)")
    }

    @Test func everyDesignSystemPreviewUsesTheSharedDeterministicModifier() throws {
        let sourceURLs = try swiftSourceURLs(in: designSystemSourceURL())
        let unscopedPreviews = try sourceURLs.flatMap { sourceURL in
            try previewDeclarations(in: source(at: sourceURL))
                .filter { !$0.contains("ReguertaDesignSystemPreviewModifier") }
                .map { _ in sourceURL.lastPathComponent }
        }

        #expect(unscopedPreviews.isEmpty, "Unscoped DesignSystem previews remain at \(unscopedPreviews)")
    }

    private func source(at url: URL) throws -> String {
        try String(contentsOf: url, encoding: .utf8)
    }

    private func previewDeclarations(in source: String) throws -> [String] {
        let pattern = try Regex(#"#Preview\((?s:.*?)\)\s*\{"#)
        return source.matches(of: pattern).compactMap { $0.output[0].substring.map(String.init) }
    }

    private func swiftSourceURLs(in directoryURL: URL) throws -> [URL] {
        let resourceKeys: Set<URLResourceKey> = [.isRegularFileKey]
        guard let enumerator = FileManager.default.enumerator(
            at: directoryURL,
            includingPropertiesForKeys: Array(resourceKeys)
        ) else {
            throw ReguertaDesignSystemAdaptiveMetricsTestError.unavailable(directoryURL)
        }

        let sources: [URL] = try enumerator.compactMap { element in
            guard let sourceURL = element as? URL,
                  sourceURL.pathExtension == "swift",
                  try sourceURL.resourceValues(forKeys: resourceKeys).isRegularFile == true else {
                return nil
            }
            return sourceURL
        }.sorted { $0.path < $1.path }

        guard !sources.isEmpty else {
            throw ReguertaDesignSystemAdaptiveMetricsTestError.empty(directoryURL)
        }
        return sources
    }

    private func designSystemSourceURL() -> URL {
        URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .appending(path: "Reguerta/DesignSystem")
    }
}

private enum ReguertaDesignSystemAdaptiveMetricsTestError: Error {
    case unavailable(URL)
    case empty(URL)
}
