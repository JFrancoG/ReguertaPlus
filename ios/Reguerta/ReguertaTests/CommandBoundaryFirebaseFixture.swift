import FirebaseCore
import FirebaseFirestore

/// Supplies the SDK handle required by HTTP-only repository tests without starting a live app graph.
@MainActor
enum CommandBoundaryFirebaseFixture {
    // One named app is retained for this test process; both command suites share its immutable configuration.
    static let appName: String = {
        let name = "command-boundary-tests"
        let options = FirebaseOptions(googleAppID: "1:1234567890:ios:0123456789abcdef", gcmSenderID: "1234567890")
        options.projectID = "demo-reguerta-command-boundary"
        options.apiKey = "A00000000000000000000000000000000000000"
        FirebaseApp.configure(name: name, options: options)
        guard let app = FirebaseApp.app(name: name) else { preconditionFailure("Missing named test Firebase app") }
        let database = Firestore.firestore(app: app)
        let settings = FirestoreSettings()
        // No Firestore I/O belongs to these tests. An accidental request must never reach a configured backend.
        settings.host = "127.0.0.1:1"
        settings.isSSLEnabled = false
        settings.cacheSettings = MemoryCacheSettings()
        database.settings = settings
        return name
    }()
}
