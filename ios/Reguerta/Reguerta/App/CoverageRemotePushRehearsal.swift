#if DEBUG
import FirebaseCore
import Foundation

/// Explicit Debug-only transport rehearsal. Business dependencies remain in memory.
@MainActor
enum CoverageRemotePushRehearsal {
    static let eventID = "coverage-" + String(repeating: "84", count: 32)
    private static let preference = "coverageRemotePushRehearsal"

    static func isEnabled(arguments: [String], defaults: UserDefaults = .standard) -> Bool {
        let localOnly = [
            "-useMockAuth", "-coverageRehearsal", "-coveragePushRehearsal", "-coverageAccessibilityRehearsal"
        ]
        if arguments.contains("-disableCoverageRemotePushRehearsal") ||
            localOnly.contains(where: arguments.contains) {
            defaults.removeObject(forKey: preference)
        } else if arguments.contains("-coverageRemotePushRehearsal") {
            defaults.set(true, forKey: preference)
        }
        return defaults.bool(forKey: preference)
    }

    /// Refuse a synthetic or Release configuration before registering an installation.
    static func prepareFirebase() {
        guard Bundle.main.bundleIdentifier == "com.plusprojects.Reguerta.debug",
              let path = Bundle.main.path(forResource: "GoogleService-Info", ofType: "plist"),
              let options = FirebaseOptions(contentsOfFile: path),
              options.projectID == "reguerta-9f27f",
              options.googleAppID == "1:195744802339:ios:3fa2544ff8ed478aadb396" else {
            preconditionFailure("Real coverage push requires the registered Reguerta iOS Debug configuration")
        }
        do {
            try saveDestination(nil, apnsRegistered: false)
        } catch {
            preconditionFailure("Cannot clear the previous push rehearsal destination")
        }
        if FirebaseApp.app() == nil {
            FirebaseApp.configure(options: options)
        }
    }

    /// Export only after APNs and FCM registration in this launch; otherwise discard stale readiness evidence.
    /// Never forward the destination to the live device registrar.
    static func saveDestination(
        _ token: String?,
        apnsRegistered: Bool,
        url: URL = URL.documentsDirectory.appending(path: "coverage-push-destination.json")
    ) throws {
        guard apnsRegistered, let token, !token.isEmpty else {
            if FileManager.default.fileExists(atPath: url.path) {
                try FileManager.default.removeItem(at: url)
            }
            return
        }
        let destination: [String: String] = [
            "projectId": "reguerta-9f27f",
            "appId": "1:195744802339:ios:3fa2544ff8ed478aadb396",
            "bundleId": "com.plusprojects.Reguerta.debug",
            "platform": "ios",
            "fcmToken": token
        ]
        let data = try JSONSerialization.data(withJSONObject: destination, options: [.sortedKeys])
        try data.write(to: url, options: [.atomic, .completeFileProtection])
    }
}
#endif
