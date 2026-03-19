import Foundation
import FirebaseFirestore

final class FirestoreStartupVersionPolicyRepository: @unchecked Sendable, StartupVersionPolicyRepository {
    private let db: Firestore
    private let environment: ReguertaFirestoreEnvironment

    init(
        db: Firestore = Firestore.firestore(),
        environment: ReguertaFirestoreEnvironment = .develop
    ) {
        self.db = db
        self.environment = environment
    }

    func policy(for platform: StartupPlatform) async -> StartupVersionPolicy? {
        do {
            let snapshot = try await db
                .reguertaDocument(.global, in: .config, environment: environment)
                .getDocument()

            guard let data = snapshot.data(),
                  let versions = data["versions"] as? [String: Any],
                  let platformPolicy = versions[platform.rawValue] as? [String: Any],
                  let currentVersion = platformPolicy.requiredString(for: "current"),
                  let minimumVersion = platformPolicy.requiredString(for: "min"),
                  let storeURL = platformPolicy.requiredString(for: "storeUrl"),
                  let forceUpdate = platformPolicy["forceUpdate"] as? Bool
            else {
                return nil
            }

            return StartupVersionPolicy(
                currentVersion: currentVersion,
                minimumVersion: minimumVersion,
                forceUpdate: forceUpdate,
                storeURL: storeURL
            )
        } catch {
            return nil
        }
    }
}

private extension Dictionary where Key == String, Value == Any {
    func requiredString(for key: String) -> String? {
        guard let value = self[key] as? String else {
            return nil
        }
        let normalized = value.trimmingCharacters(in: .whitespacesAndNewlines)
        return normalized.isEmpty ? nil : normalized
    }
}
