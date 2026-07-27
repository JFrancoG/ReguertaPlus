import Foundation
import Testing

struct FCMTokenLoggingSecurityTests {
    @Test
    func appDelegateDoesNotInterpolateFCMRegistrationTokens() throws {
        let source = try String(contentsOf: appDelegateURL(), encoding: .utf8)

        #expect(source.contains(#"\(token"#) == false)
        #expect(source.contains(#"\(fcmToken"#) == false)
    }

    private func appDelegateURL() -> URL {
        URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .appendingPathComponent("Reguerta/App/AppDelegate.swift")
    }
}
