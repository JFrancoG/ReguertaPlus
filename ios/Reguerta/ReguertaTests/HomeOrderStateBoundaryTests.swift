import Foundation
import Testing

@testable import Reguerta

@Suite("Home order-state boundary")
struct HomeOrderStateBoundaryTests {
    @Test func presentationHomeUsesTheInjectedOrdersStateBoundary() throws {
        let homeDirectory = sourceRoot.appendingPathComponent("Reguerta/Presentation/Home", isDirectory: true)
        let fileURLs = try FileManager.default.contentsOfDirectory(
            at: homeDirectory,
            includingPropertiesForKeys: nil
        ).filter { $0.pathExtension == "swift" }
        let combinedSource = try fileURLs
            .map { try String(contentsOf: $0, encoding: .utf8) }
            .joined(separator: "\n")

        #expect(!combinedSource.contains("UserDefaults"))
        #expect(!combinedSource.contains("reguerta_my_order_cart"))
        #expect(!combinedSource.contains("myOrderLocalStateStorageKey"))
        #expect(combinedSource.contains("currentHomeOrderStateScope"))
        #expect(combinedSource.contains("refreshHomeOrderState"))
    }

    private var sourceRoot: URL {
        URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
    }
}
