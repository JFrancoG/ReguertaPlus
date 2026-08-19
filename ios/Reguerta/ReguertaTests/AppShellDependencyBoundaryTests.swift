import Foundation
import SwiftUI
import Testing

@testable import Reguerta

struct AppShellDependencyBoundaryTests {
    @MainActor @Test func shellRoutesKeepTheInjectedRootAndSessionOwners() {
        let environment = ReguertaAppEnvironment.preview()
        let tokens = ReguertaDesignTokens.light
        let openURL = EnvironmentValues().openURL
        let rootRoute = RootRouteView(
            rootViewModel: environment.accessRootViewModel,
            sessionViewModel: environment.sessionViewModel,
            tokens: tokens,
            openURL: openURL,
            loadNewsImageData: environment.loadNewsImageData
        )
        let authShell = AuthShellView(
            rootViewModel: environment.accessRootViewModel,
            sessionViewModel: environment.sessionViewModel,
            tokens: tokens,
            openURL: openURL
        )
        let homeShell = HomeShellView(
            rootViewModel: environment.accessRootViewModel,
            sessionViewModel: environment.sessionViewModel,
            tokens: tokens,
            loadNewsImageData: environment.loadNewsImageData
        )
        let rootOverlay = RootOverlayView(
            rootViewModel: environment.accessRootViewModel,
            sessionViewModel: environment.sessionViewModel
        )
        #expect(rootRoute.rootViewModel === environment.accessRootViewModel)
        #expect(rootRoute.sessionViewModel === environment.sessionViewModel)
        #expect(authShell.rootViewModel === environment.accessRootViewModel)
        #expect(authShell.sessionViewModel === environment.sessionViewModel)
        #expect(homeShell.rootViewModel === environment.accessRootViewModel)
        #expect(homeShell.sessionViewModel === environment.sessionViewModel)
        #expect(rootOverlay.rootViewModel === environment.accessRootViewModel)
        #expect(rootOverlay.sessionViewModel === environment.sessionViewModel)
    }

    @Test func obsoleteShellAliasesAndBroadRoutingProtocolAreAbsent() throws {
        let contentViewSource = try source(at: rootSourceDirectoryURL().appending(path: "ContentView.swift"))

        #expect(contentViewSource.contains("struct ContentView: View") == false)
        #expect(contentViewSource.contains("struct AccessRootView: View") == false)

        for sourceURL in try presentationSourceURLs() {
            let routeSource = try source(at: sourceURL)
            #expect(
                routeSource.contains("AccessRootRoutingView") == false,
                "\(sourceURL.lastPathComponent) must target a concrete shell view"
            )
        }
    }

    @Test func onlyMainViewReadsTheAppEnvironmentAtTheShellBoundary() throws {
        let sourceURLs = try presentationSourceURLs()
        let expectedReferences = [
            "Root/ContentView.swift": [
                "@Environment(\\.reguertaAppEnvironment) private var appEnvironment",
                ".reguertaAppEnvironment(startupGatePreviewEnvironment(.unavailable))"
            ],
            "Auth/ContentView+AuthOverlaysAndHandlers.swift": [
                ".reguertaAppEnvironment(startupGatePreviewEnvironment(.unavailable))",
                ".reguertaAppEnvironment(startupGatePreviewEnvironment(.timedOut))"
            ]
        ]
        let presentationPathPrefix = presentationSourceDirectoryURL().path + "/"

        for sourceURL in sourceURLs {
            let routeSource = try source(at: sourceURL)
            let relativePath = sourceURL.path.replacingOccurrences(of: presentationPathPrefix, with: "")
            let allowedReferences = expectedReferences[relativePath] ?? []
            let referenceCount = routeSource.components(separatedBy: "reguertaAppEnvironment").count - 1

            #expect(
                referenceCount == allowedReferences.count,
                "\(relativePath) contains an unapproved App environment reference"
            )
            for reference in allowedReferences {
                #expect(routeSource.components(separatedBy: reference).count - 1 == 1)
            }
        }
    }

    @Test func everyShellViewHasOneDedicatedSourceAndPreview() throws {
        for entry in shellViewSources() {
            let viewSource = try source(at: entry.url)
            let declarations = viewSource.components(separatedBy: .newlines).filter { line in
                let declaration = line.trimmingCharacters(in: .whitespaces)
                return declaration.hasPrefix("struct ") && declaration.contains(": View {")
            }

            #expect(
                declarations.count == 1,
                "\(entry.url.lastPathComponent) must declare exactly one View"
            )
            #expect(declarations.first?.contains("struct \(entry.type): View") == true)
            #expect(viewSource.contains("#Preview("), "\(entry.type) must own a preview")
            #expect(viewSource.contains("\n    init(") == false, "\(entry.type) must keep its synthesized initializer")
        }
    }

    @MainActor @Test func startupGatePreviewFixturesRemainStableDuringEvaluation() {
        for expectedState in [StartupGateUIState.unavailable, .timedOut] {
            let environment = startupGatePreviewEnvironment(expectedState)
            let rootViewModel = environment.accessRootViewModel

            #expect(rootViewModel.didEvaluateStartupGate)
            #expect(rootViewModel.startupGateState == expectedState)

            rootViewModel.evaluateStartupGateIfNeeded()

            #expect(rootViewModel.startupGateState == expectedState)
            #expect(rootViewModel.startupGateOperationTask == nil)
            #expect(rootViewModel.startupGateTimeoutTask == nil)
        }
    }

    private func source(at url: URL) throws -> String {
        try String(contentsOf: url, encoding: .utf8)
    }

    private func presentationSourceURLs() throws -> [URL] {
        let directoryURL = presentationSourceDirectoryURL()
        let resourceKeys: Set<URLResourceKey> = [.isRegularFileKey]
        guard let enumerator = FileManager.default.enumerator(
            at: directoryURL,
            includingPropertiesForKeys: Array(resourceKeys)
        ) else {
            throw AppShellSourceEnumerationError.unavailable(directoryURL)
        }
        let sources: [URL] = try enumerator.compactMap { element in
            guard let sourceURL = element as? URL,
                  sourceURL.pathExtension == "swift",
                  try sourceURL.resourceValues(forKeys: resourceKeys).isRegularFile == true else {
                return nil
            }
            return sourceURL
        }.sorted { $0.path < $1.path }
        guard !sources.isEmpty else { throw AppShellSourceEnumerationError.empty(directoryURL) }
        return sources
    }

    private func shellViewSources() -> [(type: String, url: URL)] {
        let rootURL = rootSourceDirectoryURL()
        return [
            ("MainView", rootURL.appending(path: "ContentView.swift")),
            ("RootRouteView", rootURL.appending(path: "RootRouteView.swift")),
            ("AuthShellView", rootURL.appending(path: "AuthShellView.swift")),
            ("HomeShellView", rootURL.appending(path: "HomeShellView.swift")),
            ("RootOverlayView", rootURL.appending(path: "RootOverlayView.swift")),
            ("GlobalFeedbackBanner", rootURL.appending(path: "GlobalFeedbackBanner.swift")),
            ("GlobalFeedbackRouteView", rootURL.appending(path: "GlobalFeedbackRouteView.swift"))
        ]
    }

    private func rootSourceDirectoryURL() -> URL {
        presentationSourceDirectoryURL().appending(path: "Root")
    }

    private func presentationSourceDirectoryURL() -> URL {
        URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .appending(path: "Reguerta/Presentation")
    }
}

private enum AppShellSourceEnumerationError: Error {
    case unavailable(URL)
    case empty(URL)
}
