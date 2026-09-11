import FirebaseCore
import FirebaseFirestore
import Foundation
import Testing

@testable import Reguerta

/// Opt-in acceptance against the local HU-083 controller, never the configured Firebase project.
@MainActor
struct ShiftSheetsEmulatorAcceptanceTests {
    @Test(.enabled(if: Bundle(for: ShiftSheetsAcceptanceBundle.self)
        .url(forResource: "hu083-emulator-enabled", withExtension: "json") != nil))
    func replacementSynchronizationAndRecoveryRefreshTheSameViewModel() async throws {
        try #require(ProcessInfo.processInfo.arguments.contains("-useMockAuth"))
        let appName = "hu083-\(UUID().uuidString)"
        let options = FirebaseOptions(googleAppID: "1:1234567890:ios:0123456789abcdef", gcmSenderID: "1234567890")
        options.projectID = "demo-hu083-develop-rehearsal"
        options.apiKey = "A00000000000000000000000000000000000000"
        FirebaseApp.configure(name: appName, options: options)
        let app = try #require(FirebaseApp.app(name: appName))
        let database = Firestore.firestore(app: app)
        let settings = FirestoreSettings()
        settings.host = "127.0.0.1:8797"
        settings.isSSLEnabled = false
        settings.cacheSettings = MemoryCacheSettings()
        database.settings = settings
        let repository = FirestoreShiftRepository(firebaseAppName: appName)
        do {
            try await verifyScenario(repository: repository, database: database)
            try await database.terminate()
        } catch {
            try? await database.terminate()
            await app.delete()
            throw error
        }
        await app.delete()
    }

    private func verifyScenario(repository: FirestoreShiftRepository, database: Firestore) async throws {
        let initial = try await advance("forward", database: database)
        let member = shiftMember(id: initial.memberId, displayName: "Acceptance member")
        let viewModel = makeShiftsViewModel(
            currentMember: member,
            members: [member],
            shiftRepository: repository,
            nowMillisProvider: { initial.nowMillis }
        )

        for phase in ["forward", "synchronize", "restore"] {
            let oracle = phase == "forward" ? initial : try await advance(phase, database: database)
            let fetched = try await repository.allShifts(environment: .develop)
            #expect(fetched.map(\.dateMillis) == fetched.map(\.dateMillis).sorted())
            #expect(fetched.map(ShiftSheetsAcceptanceRow.init).sorted { $0.id < $1.id } == oracle.rows)
            await viewModel.refreshShifts()
            #expect(viewModel.shiftsFeed.map(ShiftSheetsAcceptanceRow.init).sorted { $0.id < $1.id } == oracle.rows)
            #expect(viewModel.nextDeliveryLeadShift?.id == oracle.nextLeadId)
            #expect(viewModel.nextDeliveryHelperShift?.id == oracle.nextHelperId)
            #expect(viewModel.nextMarketAssignedShift?.id == oracle.nextMarketId)
            #expect(viewModel.shiftBoardWindow(for: .delivery).highlightedShiftId == oracle.boardDeliveryId)
        }
    }

    private func advance(_ action: String, database: Firestore) async throws -> ShiftSheetsAcceptanceOracle {
        let command = database.collection("hu083AcceptanceCommands").document(UUID().uuidString)
        try await command.setData(["action": action])
        let deadline = ContinuousClock.now + .seconds(45)
        while ContinuousClock.now < deadline {
            let snapshot = try await command.getDocument(source: .server)
            let values = snapshot.data() ?? [:]
            if let error = values["error"] as? String {
                Issue.record("Local acceptance controller: \(error)")
                throw URLError(.cannotParseResponse)
            }
            if let json = values["oracle"] as? String {
                return try JSONDecoder().decode(ShiftSheetsAcceptanceOracle.self, from: Data(json.utf8))
            }
            try await Task.sleep(for: .milliseconds(100))
        }
        throw URLError(.timedOut)
    }
}

private final class ShiftSheetsAcceptanceBundle: NSObject {}

private struct ShiftSheetsAcceptanceOracle: Decodable {
    let memberId: String
    let nowMillis: Int64
    let rows: [ShiftSheetsAcceptanceRow]
    let nextLeadId: String?
    let nextHelperId: String?
    let nextMarketId: String?
    let boardDeliveryId: String?
}

private struct ShiftSheetsAcceptanceRow: Decodable, Equatable {
    let id: String
    let type: String
    let dateMillis: Int64
    let assignedUserIds: [String]
    let helperUserId: String?
    let status: String
    let source: String
}

private extension ShiftSheetsAcceptanceRow {
    init(_ shift: ShiftAssignment) {
        id = shift.id
        type = shift.type.rawValue
        dateMillis = shift.dateMillis
        assignedUserIds = shift.assignedUserIds
        helperUserId = shift.helperUserId
        status = shift.status.rawValue
        source = shift.source
    }
}
