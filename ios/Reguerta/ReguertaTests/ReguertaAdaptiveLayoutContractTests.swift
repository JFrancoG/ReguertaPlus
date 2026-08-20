import Foundation
import Testing

@testable import Reguerta

@Suite("Adaptive layout contracts")
struct ReguertaAdaptiveLayoutContractTests {
    @MainActor @Test func semanticFoundationDefinesStableAdaptiveInvariants() {
        let tokens = ReguertaDesignTokens.light

        #expect(tokens.layout.minimumTouchTarget == 44)
        #expect(tokens.layout.compactHorizontalPadding < tokens.layout.regularHorizontalPadding)
        #expect(tokens.layout.splitWindowMinimumWidth < tokens.layout.readableContentMaximumWidth)
        #expect(tokens.icons.small < tokens.icons.standard)
        #expect(tokens.icons.standard < tokens.icons.prominent)
        #expect(tokens.motion.quickDuration < tokens.motion.standardDuration)

        let reducedMotion = ReguertaMotionPolicy(reducesMotion: true)
        #expect(reducedMotion.allowsMaterialAnimation == false)
        #expect(reducedMotion.materialScale(0.98) == 1)

        let standardMotion = ReguertaMotionPolicy(reducesMotion: false)
        #expect(standardMotion.allowsMaterialAnimation)
        #expect(standardMotion.materialScale(0.98) == 0.98)
    }

    @Test func semanticFoundationDoesNotReadLegacyWindowScale() throws {
        let themeSource = try source(at: productionSourceURL().appending(path: "DesignSystem/ReguertaTheme.swift"))

        #expect(
            themeSource.range(
                of: #"\.resize(?:BottomSize|StatusBarSize)?\b"#,
                options: .regularExpression
            ) == nil
        )
        #expect(themeSource.contains("DeviceScale") == false)
        #expect(themeSource.contains("EnvironmentKey") == false)
        #expect(themeSource.contains("@Entry fileprivate var injectedReguertaTokens"))
    }

    @Test func legacyLayoutSurfaceIsFullyRemoved() throws {
        let sourceURLs = try swiftSourceURLs(in: productionSourceURL())
        let productionPathPrefix = productionSourceURL().path + "/"
        let legacyPaths = try Set(sourceURLs.compactMap { url -> String? in
            let contents = try source(at: url)
            guard legacyLayoutPatterns.contains(where: { pattern in
                contents.range(of: pattern, options: .regularExpression) != nil
            }) else { return nil }
            return url.path.replacingOccurrences(of: productionPathPrefix, with: "")
        })

        #expect(legacyPaths.isEmpty)
        #expect(
            FileManager.default.fileExists(
                atPath: productionSourceURL().appending(path: "Core/Layout/DeviceScale.swift").path
            ) == false
        )
        #expect(
            FileManager.default.fileExists(
                atPath: productionSourceURL().appending(path: "Core/Layout/ResizeExtensions.swift").path
            ) == false
        )
    }

    @Test func passiveDesignSystemValuesUseExactConfigurationNames() throws {
        let sources = try swiftSourceURLs(in: productionSourceURL().appending(path: "DesignSystem"))
        let combinedSource = try sources.map(source(at:)).joined(separator: "\n")
        let retainedLegacyNames = Set(legacyPassiveViewModelNames.filter { name in
            combinedSource.contains("\(name)")
        })
        let retainedConfigurationNames = Set(expectedPassiveConfigurationNames.filter { name in
            combinedSource.contains("struct \(name)")
        })

        #expect(retainedLegacyNames.isEmpty)
        #expect(retainedConfigurationNames == expectedPassiveConfigurationNames)
    }

    private func source(at url: URL) throws -> String {
        try String(contentsOf: url, encoding: .utf8)
    }

    private func swiftSourceURLs(in directoryURL: URL) throws -> [URL] {
        let resourceKeys: Set<URLResourceKey> = [.isRegularFileKey]
        guard let enumerator = FileManager.default.enumerator(
            at: directoryURL,
            includingPropertiesForKeys: Array(resourceKeys)
        ) else {
            throw AdaptiveLayoutSourceError.unavailable(directoryURL)
        }
        let sources: [URL] = try enumerator.compactMap { element in
            guard let sourceURL = element as? URL,
                  sourceURL.pathExtension == "swift",
                  try sourceURL.resourceValues(forKeys: resourceKeys).isRegularFile == true else {
                return nil
            }
            return sourceURL
        }.sorted { $0.path < $1.path }
        guard !sources.isEmpty else { throw AdaptiveLayoutSourceError.empty(directoryURL) }
        return sources
    }

    private func productionSourceURL() -> URL {
        URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .appending(path: "Reguerta")
    }

    private var legacyPassiveViewModelNames: Set<String> {
        [
            "ReguertaButtonViewModel",
            "ReguertaCardViewModel",
            "ReguertaDialogViewModel",
            "ReguertaInlineFeedbackViewModel",
            "ReguertaInputFieldViewModel",
            "ReguertaScreenHeaderViewModel"
        ]
    }

    private var expectedPassiveConfigurationNames: Set<String> {
        [
            "ReguertaButtonConfiguration",
            "ReguertaCardConfiguration",
            "ReguertaDialogConfiguration",
            "ReguertaInlineFeedbackConfiguration",
            "ReguertaInputFieldConfiguration",
            "ReguertaScreenHeaderConfiguration"
        ]
    }

    private var legacyLayoutPatterns: Set<String> {
        [
            #"\.resize\b"#,
            #"\.resizeBottomSize\b"#,
            #"\.resizeStatusBarSize\b"#,
            #"\bDeviceScale\b"#,
            #"\bDeviceScaleCaptureView\b"#
        ]
    }
}

private enum AdaptiveLayoutSourceError: Error {
    case unavailable(URL)
    case empty(URL)
}
