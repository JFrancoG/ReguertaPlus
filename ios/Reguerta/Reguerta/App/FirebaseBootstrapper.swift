import FirebaseCore

enum FirebaseBootstrapper {
    static func configureIfNeeded() {
        guard FirebaseApp.app() == nil else { return }
        FirebaseApp.configure()
    }
}
