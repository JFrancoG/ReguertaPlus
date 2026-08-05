import Foundation
import FirebaseFirestore

final class FirestoreStartupVersionPolicyRepository: @unchecked Sendable, StartupVersionPolicyRepository {
    private let db: Firestore
    private let environment: ReguertaFirestoreEnvironment?

    init(db: Firestore = Firestore.firestore(), environment: ReguertaFirestoreEnvironment? = nil) {
        self.db = db
        self.environment = environment
    }

    func policy(for platform: StartupPlatform) async throws -> StartupVersionPolicy {
        do {
            let snapshot = try await db
                .reguertaDocument(.publicConfiguration, in: .config, environment: environment)
                .getDocument(source: .server)

            guard snapshot.exists else {
                throw RepositoryError.notFound(resource: "config.public")
            }
            guard let data = snapshot.data() else {
                throw RepositoryError.invalidData(resource: "config.public.versions.\(platform.rawValue)")
            }
            return try Self.policy(for: platform, data: data)
        } catch {
            throw FirestoreRepositoryErrorMapper.map(error, resource: "config.public")
        }
    }

    nonisolated static func policy(for platform: StartupPlatform, data: [String: Any]) throws -> StartupVersionPolicy {
        guard let versions = data["versions"] as? [String: Any],
              let platformPolicy = versions[platform.rawValue] as? [String: Any],
              let currentVersion = platformPolicy.requiredString(for: "current"),
              let minimumVersion = platformPolicy.requiredString(for: "min"),
              let storeURL = platformPolicy.requiredString(for: "storeUrl"),
              let forceUpdate = platformPolicy["forceUpdate"] as? Bool
        else {
            throw RepositoryError.invalidData(resource: "config.public.versions.\(platform.rawValue)")
        }

        return StartupVersionPolicy(
            currentVersion: currentVersion,
            minimumVersion: minimumVersion,
            forceUpdate: forceUpdate,
            storeURL: storeURL
        )
    }
}

nonisolated private extension Dictionary where Key == String, Value == Any {
    func requiredString(for key: String) -> String? {
        guard let value = self[key] as? String else {
            return nil
        }
        let normalized = value.trimmingCharacters(in: .whitespacesAndNewlines)
        return normalized.isEmpty ? nil : normalized
    }
}
