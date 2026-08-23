import FirebaseFirestore
import Foundation
import Testing

@testable import Reguerta

@Suite("Received-order status write error boundary")
struct ReceivedOrderStatusWriteErrorBoundaryTests {
    @Test func firestorePermissionDeniedMapsToTheDomainFeedbackResult() {
        let error = NSError(
            domain: FirestoreErrorDomain,
            code: FirestoreErrorCode.permissionDenied.rawValue
        )

        #expect(receivedOrderStatusWriteResult(from: error) == .permissionDenied)
    }

    @Test func aForeignErrorReusingCodeSevenIsNotTreatedAsFirestorePermissionDenied() {
        let error = NSError(
            domain: "NonFirestoreErrorDomain",
            code: FirestoreErrorCode.permissionDenied.rawValue
        )

        #expect(receivedOrderStatusWriteResult(from: error) == .failure)
    }

    @Test func cancellationNeverMasqueradesAsPermissionDenied() {
        let firestoreCancellation = NSError(
            domain: FirestoreErrorDomain,
            code: FirestoreErrorCode.cancelled.rawValue
        )

        #expect(receivedOrderStatusWriteResult(from: CancellationError()) == .failure)
        #expect(receivedOrderStatusWriteResult(from: firestoreCancellation) == .failure)
    }

    @Test func domainOwnsOnlyTheTypedResultWhileDataOwnsInfrastructureTranslation() throws {
        let productionRoot = sourceRoot.appendingPathComponent("Reguerta", isDirectory: true)
        let domainDirectory = productionRoot.appendingPathComponent("Domain/Orders", isDirectory: true)
        let dataDirectory = productionRoot.appendingPathComponent("Data/Orders", isDirectory: true)
        let domainSource = try combinedSwiftSource(in: domainDirectory)
        let resultSource = try source(
            at: domainDirectory.appendingPathComponent("ReceivedOrderStatusWriteResult.swift")
        )
        let dataSource = try combinedSwiftSource(in: dataDirectory)

        #expect(!resultSource.contains("import Foundation"))
        #expect(!domainSource.contains("NSError"))
        #expect(!domainSource.contains("FirestoreErrorDomain"))
        #expect(!domainSource.contains("FirestoreErrorCode"))
        #expect(!domainSource.contains("receivedOrderStatusWriteResult(from"))
        #expect(dataSource.contains("func receivedOrderStatusWriteResult(from"))
        #expect(dataSource.contains("FirestoreRepositoryErrorMapper.map"))
    }

    private var sourceRoot: URL {
        URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
    }

    private func source(at url: URL) throws -> String {
        try String(contentsOf: url, encoding: .utf8)
    }

    private func combinedSwiftSource(in directory: URL) throws -> String {
        let files = try FileManager.default.contentsOfDirectory(
            at: directory,
            includingPropertiesForKeys: nil
        )
        return try files
            .filter { $0.pathExtension == "swift" }
            .sorted { $0.lastPathComponent < $1.lastPathComponent }
            .map(source(at:))
            .joined(separator: "\n")
    }
}
