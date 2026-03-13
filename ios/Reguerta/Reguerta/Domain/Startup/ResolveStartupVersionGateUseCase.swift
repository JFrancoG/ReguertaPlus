import Foundation

struct ResolveStartupVersionGateUseCase: Sendable {
    private let repository: any StartupVersionPolicyRepository

    init(repository: any StartupVersionPolicyRepository) {
        self.repository = repository
    }

    func execute(platform: StartupPlatform, installedVersion: String) async -> StartupVersionGateDecision {
        guard let policy = await repository.policy(for: platform) else {
            return .allow
        }
        return evaluate(installedVersion: installedVersion, policy: policy)
    }

    func evaluate(installedVersion: String, policy: StartupVersionPolicy) -> StartupVersionGateDecision {
        guard !policy.storeURL.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            return .allow
        }

        guard let comparisonToMinimum = SemanticVersionComparator.compare(installedVersion, policy.minimumVersion),
              let comparisonToCurrent = SemanticVersionComparator.compare(installedVersion, policy.currentVersion)
        else {
            return .allow
        }

        if comparisonToMinimum < 0 && policy.forceUpdate {
            return .forcedUpdate(storeURL: policy.storeURL)
        }

        if comparisonToMinimum < 0 || comparisonToCurrent < 0 {
            return .optionalUpdate(storeURL: policy.storeURL)
        }

        return .allow
    }
}
