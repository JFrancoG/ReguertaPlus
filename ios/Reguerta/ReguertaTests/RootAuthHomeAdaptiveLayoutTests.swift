import Foundation
import Testing

@testable import Reguerta

@Suite("Root, Auth, and Home adaptive layout")
struct RootAuthHomeAdaptiveLayoutTests {
    @Test func homeDrawerWidthUsesItsContainerWithoutCoveringTheOppositeEdge() {
        #expect(HomeShellLayoutContract.drawerWidth(containerWidth: 320, minimumEdgeReveal: 44) == 276)
        #expect(HomeShellLayoutContract.drawerWidth(containerWidth: 375, minimumEdgeReveal: 44) == 304)
        #expect(HomeShellLayoutContract.drawerWidth(containerWidth: 600, minimumEdgeReveal: 44) == 304)
    }

    @Test func homeDrawerInteractionThresholdsDoNotDependOnWindowScale() {
        #expect(HomeShellLayoutContract.shouldOpenDrawer(translationWidth: 48) == false)
        #expect(HomeShellLayoutContract.shouldOpenDrawer(translationWidth: 49))
        #expect(HomeShellLayoutContract.shouldCloseDrawer(translationWidth: -56) == false)
        #expect(HomeShellLayoutContract.shouldCloseDrawer(translationWidth: -57))
        #expect(HomeShellLayoutContract.clampedOpenTranslation(500, drawerWidth: 304) == 304)
        #expect(HomeShellLayoutContract.clampedOpenTranslation(-20, drawerWidth: 304) == 0)
    }

    @Test func homeDrawerOpeningGestureRecognizesOnlyTheLeadingEdge() {
        #expect(HomeShellLayoutContract.shouldRecognizeDrawerOpeningGesture(startLocationX: 0, edgeWidth: 44))
        #expect(HomeShellLayoutContract.shouldRecognizeDrawerOpeningGesture(startLocationX: 44, edgeWidth: 44))
        #expect(HomeShellLayoutContract.shouldRecognizeDrawerOpeningGesture(startLocationX: -1, edgeWidth: 44) == false)
        #expect(HomeShellLayoutContract.shouldRecognizeDrawerOpeningGesture(startLocationX: 45, edgeWidth: 44) == false)
    }

    @Test func imagePickerIconControlsRetainTheAccessibleMinimumTarget() {
        #expect(ReguertaImagePickerLayoutContract.controlSize(requested: 38, minimumTouchTarget: 44) == 44)
        #expect(ReguertaImagePickerLayoutContract.controlSize(requested: 56, minimumTouchTarget: 44) == 56)
    }

    @Test func rootAuthAndHomeDoNotUseLegacyResizeAPIs() throws {
        for directory in ["Root", "Auth", "Home"] {
            let sourceURLs = try swiftSourceURLs(
                in: productionSourceURL().appending(path: "Presentation/\(directory)")
            )

            for sourceURL in sourceURLs {
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
    }

    @Test func latestNewsScrollStaysInsideTheBottomSafeArea() throws {
        let source = try source(
            at: productionSourceURL().appending(path: "Presentation/Home/ContentView+HomeDashboardCards.swift")
        )

        #expect(source.contains(".ignoresSafeArea(.container, edges: .bottom)") == false)
        #expect(source.contains("Color.clear") == false)
        #expect(source.contains(".padding(.bottom, tokens.spacing.lg)"))
    }

    @Test func rootMotionIsResolvedByViewsAndNotPresentationModels() throws {
        let rootSource = productionSourceURL().appending(path: "Presentation/Root")
        let homeSource = productionSourceURL().appending(path: "Presentation/Home")
        let accessRootViewModel = try source(at: rootSource.appending(path: "AccessRootViewModel.swift"))
        let homeShellViewModel = try source(at: homeSource.appending(path: "ContentView+HomeShellViewModel.swift"))
        let authShellView = try source(at: rootSource.appending(path: "AuthShellView.swift"))
        let homeShellView = try source(at: rootSource.appending(path: "HomeShellView.swift"))
        let mainView = try source(at: rootSource.appending(path: "ContentView.swift"))
        let feedbackBanner = try source(at: rootSource.appending(path: "GlobalFeedbackBanner.swift"))

        #expect(accessRootViewModel.contains("withAnimation") == false)
        #expect(homeShellViewModel.contains("withAnimation") == false)
        #expect(homeShellViewModel.contains("Animation") == false)
        #expect(authShellView.contains("@Environment(\\.reguertaMotionPolicy)"))
        #expect(authShellView.contains("motionPolicy.materialAnimation("))
        #expect(homeShellView.contains("@Environment(\\.reguertaMotionPolicy)"))
        #expect(homeShellView.contains("motionPolicy.materialAnimation("))
        #expect(mainView.contains("@Environment(\\.reguertaMotionPolicy)"))
        #expect(mainView.contains("motionPolicy.materialAnimation("))
        #expect(feedbackBanner.contains("motionPolicy.allowsMaterialAnimation"))
    }

    @Test func reducedMotionKeepsTheEssentialSplashStateVisible() throws {
        let splashSource = try source(
            at: productionSourceURL()
                .appending(path: "Presentation/Auth/ContentView+AuthOverlaysAndHandlers.swift")
        )

        #expect(splashSource.contains("motionPolicy.materialScale(rootViewModel.splashScale)"))
        #expect(splashSource.contains("motionPolicy.allowsMaterialAnimation ? rootViewModel.splashRotation : 0"))
        #expect(splashSource.contains("motionPolicy.allowsMaterialAnimation ? rootViewModel.splashOpacity : 1"))
        #expect(splashSource.contains("withAnimation(splashMaterialAnimation)"))
    }

    @Test func nativeReduceMotionIsReadOnlyByTheThemeBoundary() throws {
        let productionURL = productionSourceURL()
        let productionPathPrefix = productionURL.path + "/"
        let filesReadingNativeReduceMotion: Set<String> = try Set(
            swiftSourceURLs(in: productionURL).compactMap { sourceURL in
                guard try source(at: sourceURL).contains("accessibilityReduceMotion") else { return nil }
                return sourceURL.path.replacingOccurrences(of: productionPathPrefix, with: "")
            }
        )

        #expect(filesReadingNativeReduceMotion == ["DesignSystem/ReguertaTheme.swift"])
    }

    private func source(at url: URL) throws -> String {
        try String(contentsOf: url, encoding: .utf8)
    }

    private func swiftSourceURLs(in directoryURL: URL) throws -> [URL] {
        guard let enumerator = FileManager.default.enumerator(
            at: directoryURL,
            includingPropertiesForKeys: [.isRegularFileKey]
        ) else {
            throw RootAuthHomeAdaptiveLayoutTestError.unavailable(directoryURL)
        }

        return try enumerator.compactMap { element in
            guard let sourceURL = element as? URL,
                  sourceURL.pathExtension == "swift",
                  try sourceURL.resourceValues(forKeys: [.isRegularFileKey]).isRegularFile == true else {
                return nil
            }
            return sourceURL
        }
    }

    private func productionSourceURL() -> URL {
        URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .appending(path: "Reguerta")
    }
}

private enum RootAuthHomeAdaptiveLayoutTestError: Error {
    case unavailable(URL)
}
