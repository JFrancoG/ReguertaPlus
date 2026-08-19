import Foundation

struct ResolveStartupVersionGateUseCase {
    private let storedRepository: any StartupVersionPolicyRepository
    private let environment: SessionEnvironment

    /// Loads the platform's version policy and resolves the startup gate.
    ///
    /// - Parameters:
    ///   - platform: The client platform whose remote policy should be loaded.
    ///   - installedVersion: The numeric, dot-separated application version.
    /// - Returns: The update or allow decision for the installed application.
    /// - Throws: A repository error or `RepositoryError.invalidData` when the policy cannot be
    ///   evaluated safely.
    func execute(platform: StartupPlatform, installedVersion: String) async throws -> StartupVersionGateDecision {
        let policy = try await storedRepository.policy(for: platform, environment: environment)
        return try evaluate(installedVersion: installedVersion, policy: policy)
    }

    /// Evaluates an installed application version against a validated startup policy.
    ///
    /// The policy is invalid when a version is malformed, the minimum exceeds the current
    /// version, or the store URL lacks an HTTP(S) scheme and host. Versions below the minimum
    /// are forced only when `forceUpdate` is enabled; all other older versions receive an
    /// optional update.
    ///
    /// - Parameters:
    ///   - installedVersion: The numeric, dot-separated application version.
    ///   - policy: The minimum, current, force-update, and store-link contract to apply.
    /// - Returns: `.forcedUpdate`, `.optionalUpdate`, or `.allow`.
    /// - Throws: `RepositoryError.invalidData` when the policy or installed version is invalid.
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

extension ResolveStartupVersionGateUseCase {
    init(repository: any StartupVersionPolicyRepository, environment: SessionEnvironment) {
        self.storedRepository = repository
        self.environment = environment
    }
}
