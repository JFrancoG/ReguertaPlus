import Foundation

struct ResolveStartupVersionGateUseCase: Sendable {
    private let repository: any StartupVersionPolicyRepository

    init(repository: any StartupVersionPolicyRepository) {
        self.repository = repository
    }

    func execute(platform: StartupPlatform, installedVersion: String) async throws -> StartupVersionGateDecision {
        let policy = try await repository.policy(for: platform)
        return try evaluate(installedVersion: installedVersion, policy: policy)
    }

    func evaluate(installedVersion: String, policy: StartupVersionPolicy) throws -> StartupVersionGateDecision {
        guard let comparisonToMinimum = SemanticVersionComparator.compare(installedVersion, policy.minimumVersion),
              let comparisonToCurrent = SemanticVersionComparator.compare(installedVersion, policy.currentVersion),
              let minimumToCurrent = SemanticVersionComparator.compare(policy.minimumVersion, policy.currentVersion),
              minimumToCurrent <= 0,
              let storeURL = validatedStoreURL(policy.storeURL)
        else {
            throw RepositoryError.invalidData(resource: "startup.versionPolicy")
        }

        if comparisonToMinimum < 0 && policy.forceUpdate {
            return .forcedUpdate(storeURL: storeURL)
        }

        if comparisonToMinimum < 0 || comparisonToCurrent < 0 {
            return .optionalUpdate(storeURL: storeURL)
        }

        return .allow
    }

    private func validatedStoreURL(_ rawValue: String) -> String? {
        let normalized = rawValue.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let components = URLComponents(string: normalized),
              let scheme = components.scheme?.lowercased(),
              scheme == "https" || scheme == "http",
              components.host?.isEmpty == false
        else {
            return nil
        }
        return normalized
    }
}
