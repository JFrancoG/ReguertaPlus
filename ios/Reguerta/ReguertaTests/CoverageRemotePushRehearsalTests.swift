import Foundation
import Testing
@testable import Reguerta

@MainActor
struct CoverageRemotePushRehearsalTests {
    @Test func `cached token cannot export readiness before APNs and invalidation removes the destination`() throws {
        let url = URL.temporaryDirectory.appending(path: UUID().uuidString + ".json")
        defer { try? FileManager.default.removeItem(at: url) }
        try Data("stale destination".utf8).write(to: url)
        try CoverageRemotePushRehearsal.saveDestination("cached-token", apnsRegistered: false, url: url)
        #expect(!FileManager.default.fileExists(atPath: url.path))
        try CoverageRemotePushRehearsal.saveDestination("ready-token", apnsRegistered: true, url: url)
        let exported = try JSONDecoder().decode([String: String].self, from: Data(contentsOf: url))
        #expect(exported["fcmToken"] == "ready-token")
        #expect(exported["bundleId"] == "com.plusprojects.Reguerta.debug")
        try CoverageRemotePushRehearsal.saveDestination(nil, apnsRegistered: true, url: url)
        #expect(!FileManager.default.fileExists(atPath: url.path))
    }

    @Test func `cold launch retains explicit opt in and offline launch disables it`() throws {
        let name = "coverage-push-test-" + UUID().uuidString
        let defaults = try #require(UserDefaults(suiteName: name))
        defer { defaults.removePersistentDomain(forName: name) }
        #expect(!CoverageRemotePushRehearsal.isEnabled(arguments: [], defaults: defaults))
        #expect(CoverageRemotePushRehearsal.isEnabled(arguments: ["-coverageRemotePushRehearsal"], defaults: defaults))
        #expect(CoverageRemotePushRehearsal.isEnabled(arguments: [], defaults: defaults))
        let offline = ["-useMockAuth", "-coverageRemotePushRehearsal"]
        #expect(!CoverageRemotePushRehearsal.isEnabled(arguments: offline, defaults: defaults))
        #expect(!CoverageRemotePushRehearsal.isEnabled(arguments: [], defaults: defaults))
    }

    @Test func `sample notification routes to its case and unknown reference cannot open it`() async throws {
        let model = CoveragePreviewAccess.model()
        await model.coverage.refresh()
        let reference = try #require(ShiftNotificationPushReference.validated(
            eventID: "coverage-" + String(repeating: "84", count: 32),
            type: "shift_updated",
            target: "users"
        ))
        model.acceptPush(reference)
        await model.openPendingPush()
        #expect(model.casePath == ["preview-case"])
        #expect(model.pendingPushEventID == nil)
        model.casePath = []
        await model.openNotification("coverage-" + String(repeating: "aa", count: 32))
        #expect(model.casePath.isEmpty)
    }
}
