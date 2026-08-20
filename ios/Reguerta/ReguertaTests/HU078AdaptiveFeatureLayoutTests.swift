import Foundation
import Testing

@Suite("HU-078 adaptive feature layout")
struct HU078AdaptiveFeatureLayoutTests {
    @Test func selectedFeatureRoutesDoNotUseLegacyResizeCalls() throws {
        let sourceRoot = productionSourceURL().appending(path: "Presentation")
        let featureNames = ["Products", "Users", "SharedProfile", "News"]

        for featureName in featureNames {
            let combinedSource = try swiftSourceURLs(in: sourceRoot.appending(path: featureName))
                .map(source(at:))
                .joined(separator: "\n")

            #expect(
                combinedSource.range(
                    of: #"\.resize(?:BottomSize|StatusBarSize)?\b"#,
                    options: .regularExpression
                ) == nil,
                "\(featureName) still reads the legacy window scale"
            )
        }
    }

    @Test func productAndUsersActionsUseLocalizedAccessibilityResources() throws {
        let productSource = try source(
            at: productionSourceURL().appending(path: "Presentation/Products/ContentView+ProductsRoute.swift")
        )
        let usersSource = try source(
            at: productionSourceURL().appending(path: "Presentation/Users/ContentView+UsersRoute.swift")
        )
        let localizationKeys = try source(
            at: productionSourceURL()
                .appending(path: "Presentation/Localization/AccessLocalization+ProductsAndSettings.swift")
        )
        let catalog = try source(at: productionSourceURL().appending(path: "Resources/Localizable.xcstrings"))
        let expectedKeys = [
            "products.card.action.edit",
            "products.card.action.archive",
            "users.card.action.edit",
            "users.card.action.deactivate"
        ]

        #expect(productSource.contains("Editar producto") == false)
        #expect(productSource.contains("Archivar producto") == false)
        #expect(usersSource.contains("Editar Regüertense") == false)
        #expect(usersSource.contains("Desactivar Regüertense") == false)
        #expect(productSource.contains("AccessL10nKey.productsCardActionEdit"))
        #expect(productSource.contains("AccessL10nKey.productsCardActionArchive"))
        #expect(usersSource.contains("AccessL10nKey.usersCardActionEdit"))
        #expect(usersSource.contains("AccessL10nKey.usersCardActionDeactivate"))

        for key in expectedKeys {
            #expect(localizationKeys.contains("\"\(key)\""))
            #expect(catalog.contains("\"\(key)\""))
        }
    }

    @Test func compactFeatureControlsUseMinimumTouchTargetContract() throws {
        let productEditorSource = try source(
            at: productionSourceURL().appending(path: "Presentation/Products/ProductEditorView.swift")
        )
        let sharedProfileSource = try source(
            at: productionSourceURL().appending(path: "Presentation/SharedProfile/ContentView+SharedProfileRoute.swift")
        )
        let newsSource = try source(
            at: productionSourceURL().appending(path: "Presentation/News/ContentView+NewsNotificationsRoutes.swift")
        )

        #expect(productEditorSource.contains("minWidth: tokens.layout.minimumTouchTarget"))
        #expect(productEditorSource.contains("minHeight: tokens.layout.minimumTouchTarget"))
        #expect(sharedProfileSource.contains("controlSize: tokens.layout.minimumTouchTarget"))
        #expect(sharedProfileSource.contains(".frame(minHeight: tokens.layout.minimumTouchTarget)"))
        #expect(occurrenceCount(of: ".frame(minHeight: tokens.layout.minimumTouchTarget)", in: newsSource) >= 2)
    }

    @Test func featureFloatingActionsOwnTheirBottomSafeArea() throws {
        let presentationURL = productionSourceURL().appending(path: "Presentation")
        let expectedInsetCounts = [
            "Products/ContentView+ProductsRoute.swift": 1,
            "Users/ContentView+UsersRoute.swift": 1,
            "SharedProfile/ContentView+SharedProfileRoute.swift": 2,
            "News/ContentView+NewsNotificationsRoutes.swift": 3
        ]

        for (relativePath, expectedInsetCount) in expectedInsetCounts {
            let featureSource = try source(at: presentationURL.appending(path: relativePath))

            let safeAreaInsetCount = occurrenceCount(
                of: ".safeAreaInset(edge: .bottom, spacing: 0)",
                in: featureSource
            )
            #expect(safeAreaInsetCount == expectedInsetCount)
            #expect(featureSource.contains("ReguertaFloatingActionButtonLayout.scrollContentBottomPadding") == false)
        }
    }

    @Test func sharedProfileCarouselDerivesItsWidthFromTheCurrentContainer() throws {
        let sharedProfileSource = try source(
            at: productionSourceURL().appending(path: "Presentation/SharedProfile/ContentView+SharedProfileRoute.swift")
        )

        #expect(sharedProfileSource.contains(".containerRelativeFrame(.horizontal)"))
        #expect(sharedProfileSource.contains(".frame(width: 300") == false)
        #expect(sharedProfileSource.contains("height: 430") == false)
    }

    @Test func featureMaterialMotionConsumesTheRootPolicyAtTheViewBoundary() throws {
        let presentationURL = productionSourceURL().appending(path: "Presentation")
        let featurePaths = [
            "Products/ContentView+ProductsRoute.swift",
            "Users/ContentView+UsersRoute.swift",
            "News/ContentView+NewsNotificationsRoutes.swift",
            "SharedProfile/ContentView+SharedProfileRoute.swift"
        ]

        for relativePath in featurePaths {
            let featureSource = try source(at: presentationURL.appending(path: relativePath))

            #expect(featureSource.contains("@Environment(\\.reguertaMotionPolicy)"), "\(relativePath)")
            #expect(featureSource.contains("motionPolicy.materialAnimation("), "\(relativePath)")
            #expect(featureSource.contains("withAnimation(.") == false, "\(relativePath)")
            #expect(featureSource.contains(".animation(.") == false, "\(relativePath)")
        }

        let sharedProfileSource = try source(
            at: presentationURL.appending(path: "SharedProfile/ContentView+SharedProfileRoute.swift")
        )
        #expect(sharedProfileSource.contains("motionPolicy.reducesMotion ? .identity"))
    }

    private func source(at url: URL) throws -> String {
        try String(contentsOf: url, encoding: .utf8)
    }

    private func occurrenceCount(of needle: String, in source: String) -> Int {
        source.components(separatedBy: needle).count - 1
    }

    private func swiftSourceURLs(in directoryURL: URL) throws -> [URL] {
        let resourceKeys: Set<URLResourceKey> = [.isRegularFileKey]
        guard let enumerator = FileManager.default.enumerator(
            at: directoryURL,
            includingPropertiesForKeys: Array(resourceKeys)
        ) else {
            throw HU078AdaptiveFeatureTestError.unavailable(directoryURL)
        }
        let sourceURLs: [URL] = try enumerator.compactMap { element in
            guard let url = element as? URL,
                  url.pathExtension == "swift",
                  try url.resourceValues(forKeys: resourceKeys).isRegularFile == true else {
                return nil
            }
            return url
        }.sorted { $0.path < $1.path }
        guard !sourceURLs.isEmpty else { throw HU078AdaptiveFeatureTestError.empty(directoryURL) }
        return sourceURLs
    }

    private func productionSourceURL() -> URL {
        URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .appending(path: "Reguerta")
    }
}

private enum HU078AdaptiveFeatureTestError: Error {
    case unavailable(URL)
    case empty(URL)
}
