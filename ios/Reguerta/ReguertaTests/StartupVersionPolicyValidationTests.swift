import Testing

@testable import Reguerta

@MainActor
struct StartupVersionPolicyValidationTests {
    @Test func startupGateRejectsMalformedPolicy() {
        let policy = StartupVersionPolicy(
            currentVersion: "invalid",
            minimumVersion: "0.3.0",
            forceUpdate: true,
            storeURL: "https://apps.apple.com"
        )
        let useCase = ResolveStartupVersionGateUseCase(
            repository: FixedStartupVersionPolicyRepository(policy: policy),
            environment: .develop
        )

        #expect(throws: RepositoryError.invalidData(resource: "startup.versionPolicy")) {
            try useCase.evaluate(installedVersion: "0.2.9", policy: policy)
        }
    }

    @Test func semanticVersionComparatorRejectsOverflowingComponents() {
        let overflowingComponent = String(repeating: "9", count: 100)

        #expect(SemanticVersionComparator.compare("1.\(overflowingComponent).0", "1.0.0") == nil)
    }

    @Test(arguments: [
        StartupVersionPolicy(
            currentVersion: "1.0.0",
            minimumVersion: "2.0.0",
            forceUpdate: true,
            storeURL: "https://apps.apple.com/app/reguerta"
        ),
        StartupVersionPolicy(
            currentVersion: "1.0.0",
            minimumVersion: "1.0.0",
            forceUpdate: true,
            storeURL: "not-a-url"
        )
    ])
    func startupGateRejectsSemanticallyInvalidPolicies(_ policy: StartupVersionPolicy) {
        let useCase = ResolveStartupVersionGateUseCase(
            repository: FixedStartupVersionPolicyRepository(policy: policy),
            environment: .develop
        )

        #expect(throws: RepositoryError.invalidData(resource: "startup.versionPolicy")) {
            try useCase.evaluate(installedVersion: "1.0.0", policy: policy)
        }
    }
}
