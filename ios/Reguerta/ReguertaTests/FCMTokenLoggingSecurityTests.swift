import Foundation
import Testing

struct FCMTokenLoggingSecurityTests {
    @Test func pushRegistrationDoesNotLogTokensOrPublicErrors() throws {
        let sources = try [appDelegateURL(), coordinatorURL()].map {
            try String(contentsOf: $0, encoding: .utf8)
        }
        let source = sources.joined(separator: "\n")

        #expect(source.contains(#"\(token"#) == false)
        #expect(source.contains(#"\(fcmToken"#) == false)
        #expect(source.contains("privacy: .public") == false)
        #expect(source.contains(#"\(context.memberId"#) == false)
        #expect(source.contains(#"\(device.deviceId"#) == false)
    }

    private func appDelegateURL() -> URL {
        URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .appendingPathComponent("Reguerta/App/AppDelegate.swift")
    }

    private func coordinatorURL() -> URL {
        URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .appendingPathComponent(
                "Reguerta/Data/Devices/FirebaseAuthorizedDeviceCoordinator.swift"
            )
    }
}
