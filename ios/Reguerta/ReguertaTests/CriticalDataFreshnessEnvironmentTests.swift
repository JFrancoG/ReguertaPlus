import Foundation
import Testing

@testable import Reguerta

@Suite(.timeLimit(.minutes(1)))
@MainActor
struct CriticalDataFreshnessEnvironmentTests {
    @Test
    func userDefaultsMetadataRoundTripsItsEnvironment() {
        let (suiteName, userDefaults) = isolatedUserDefaults(suffix: "roundtrip")
        defer { userDefaults.removePersistentDomain(forName: suiteName) }
        let repository = UserDefaultsCriticalDataFreshnessLocalRepository(userDefaults: userDefaults)
        let metadata = freshnessMetadata(environment: .production)

        repository.saveMetadata(metadata)

        #expect(repository.getMetadata() == metadata)
    }

    @Test
    func userDefaultsRejectsLegacyAndInvalidEnvironmentMetadata() {
        let (suiteName, userDefaults) = isolatedUserDefaults(suffix: "invalid-environment")
        defer { userDefaults.removePersistentDomain(forName: suiteName) }
        seedFreshnessValues(in: userDefaults)
        let repository = UserDefaultsCriticalDataFreshnessLocalRepository(userDefaults: userDefaults)

        #expect(repository.getMetadata() == nil)

        userDefaults.set("staging", forKey: freshnessEnvironmentKey)

        #expect(repository.getMetadata() == nil)
    }

    @Test
    func userDefaultsClearRemovesAllFreshnessMetadata() {
        let (suiteName, userDefaults) = isolatedUserDefaults(suffix: "clear")
        defer { userDefaults.removePersistentDomain(forName: suiteName) }
        let repository = UserDefaultsCriticalDataFreshnessLocalRepository(userDefaults: userDefaults)
        repository.saveMetadata(freshnessMetadata(environment: .develop))

        repository.clear()

        #expect(repository.getMetadata() == nil)
        #expect(userDefaults.object(forKey: freshnessValidatedAtKey) == nil)
        #expect(userDefaults.object(forKey: freshnessEnvironmentKey) == nil)
        for collection in CriticalCollection.allCases {
            #expect(userDefaults.object(forKey: freshnessTimestampKey(for: collection)) == nil)
        }
    }

    @Test
    func useCaseForwardsEnvironmentAndReturnsScopedMetadata() async throws {
        let remoteRepository = RecordingFreshnessRemoteRepository(
            config: freshnessConfig(timestamp: 2_000)
        )
        let useCase = ResolveCriticalDataFreshnessUseCase(
            remoteRepository: remoteRepository,
            localRepository: InMemoryCriticalDataFreshnessLocalRepository(),
            nowProvider: { 3_000 }
        )

        let resolution = try await useCase.execute(environment: .production)

        #expect(await remoteRepository.requestedEnvironments() == [.production])
        guard case .fresh(let metadata) = resolution else {
            Issue.record("Expected a fresh resolution")
            return
        }
        #expect(metadata?.environment == .production)
    }

    @Test("El mismo UID en otro entorno invalida el refresh anterior")
    func sameUIDEnvironmentChangeStartsNewRefresh() async throws {
        let remoteRepository = ControlledEnvironmentFreshnessRemoteRepository()
        let localRepository = InMemoryCriticalDataFreshnessLocalRepository()
        let viewModel = MyOrderFreshnessViewModel(
            resolveCriticalDataFreshness: ResolveCriticalDataFreshnessUseCase(
                remoteRepository: remoteRepository,
                localRepository: localRepository,
                nowProvider: { 3_000 }
            ),
            criticalDataFreshnessLocalRepository: localRepository,
            timeout: .seconds(60)
        )
        let developMode = freshnessAuthorizedMode(environment: .develop)
        let productionMode = freshnessAuthorizedMode(environment: .production)

        viewModel.retry(currentMode: developMode)
        let firstTasks = try #require(ownedFreshnessTasks(in: viewModel))
        await remoteRepository.waitForRequestCount(1)

        viewModel.handleSessionModeChange(from: developMode, to: productionMode)
        let secondTasks = try #require(ownedFreshnessTasks(in: viewModel))
        await remoteRepository.waitForRequestCount(2)

        await remoteRepository.completeRequest(at: 1, with: freshnessConfig(timestamp: 2_000))
        await secondTasks.operation.value
        await secondTasks.timeout.value

        await remoteRepository.completeRequest(at: 0, with: freshnessConfig(timestamp: 1_000))
        await firstTasks.operation.value
        await firstTasks.timeout.value

        #expect(viewModel.state == .ready)
        #expect(await remoteRepository.requestedEnvironments() == [.develop, .production])
        #expect(localRepository.getMetadata()?.environment == .production)
        #expect(localRepository.getMetadata()?.acknowledgedTimestampsMillis.values.allSatisfy { $0 == 2_000 } == true)
    }

    @Test("Autorizar el mismo email despues de un rechazo inicia freshness")
    func unauthorizedToAuthorizedSameEmailStartsRefresh() async throws {
        let remoteRepository = ControlledEnvironmentFreshnessRemoteRepository()
        let localRepository = InMemoryCriticalDataFreshnessLocalRepository()
        let viewModel = MyOrderFreshnessViewModel(
            resolveCriticalDataFreshness: ResolveCriticalDataFreshnessUseCase(
                remoteRepository: remoteRepository,
                localRepository: localRepository,
                nowProvider: { 3_000 }
            ),
            criticalDataFreshnessLocalRepository: localRepository,
            timeout: .seconds(60)
        )
        let email = "member@reguerta.test"
        let authorizedMode = freshnessAuthorizedMode(email: email, environment: .develop)

        viewModel.handleSessionModeChange(
            from: .unauthorized(email: email, reason: .userNotFoundInAuthorizedUsers),
            to: authorizedMode
        )
        let tasks = try #require(ownedFreshnessTasks(in: viewModel))
        await remoteRepository.waitForRequestCount(1)
        await remoteRepository.completeRequest(at: 0, with: freshnessConfig(timestamp: 2_000))
        await tasks.operation.value
        await tasks.timeout.value

        #expect(viewModel.state == .ready)
        #expect(await remoteRepository.requestedEnvironments() == [.develop])
    }
}

private let freshnessValidatedAtKey = "critical_data_freshness.validated_at"
private let freshnessEnvironmentKey = "critical_data_freshness.environment"

private func freshnessTimestampKey(for collection: CriticalCollection) -> String {
    "critical_data_freshness.timestamp.\(collection.rawValue)"
}

private func isolatedUserDefaults(suffix: String) -> (suiteName: String, userDefaults: UserDefaults) {
    let suiteName = "com.reguerta.tests.freshness.\(suffix)"
    let userDefaults = UserDefaults(suiteName: suiteName)!
    userDefaults.removePersistentDomain(forName: suiteName)
    return (suiteName, userDefaults)
}

private func seedFreshnessValues(in userDefaults: UserDefaults) {
    userDefaults.set(3_000, forKey: freshnessValidatedAtKey)
    for collection in CriticalCollection.allCases {
        userDefaults.set(2_000, forKey: freshnessTimestampKey(for: collection))
    }
}

private func freshnessMetadata(
    environment: SessionEnvironment,
    timestamp: Int64 = 2_000
) -> CriticalDataFreshnessMetadata {
    CriticalDataFreshnessMetadata(
        validatedAtMillis: 3_000,
        acknowledgedTimestampsMillis: freshnessTimestamps(timestamp: timestamp),
        environment: environment
    )
}

private func freshnessConfig(timestamp: Int64) -> CriticalDataFreshnessConfig {
    CriticalDataFreshnessConfig(
        cacheExpirationMinutes: 15,
        remoteTimestampsMillis: freshnessTimestamps(timestamp: timestamp)
    )
}

private func freshnessTimestamps(timestamp: Int64) -> [CriticalCollection: Int64] {
    Dictionary(uniqueKeysWithValues: CriticalCollection.allCases.map { ($0, timestamp) })
}

@MainActor
private func freshnessAuthorizedMode(
    email: String = "member@reguerta.test",
    environment: SessionEnvironment
) -> SessionMode {
    let currentMember = member(id: "uid_same", ecoCommitmentMode: .weekly)
    return .authorized(
        AuthorizedSession(
            principal: AuthPrincipal(uid: "uid_same", email: email),
            authenticatedMember: currentMember,
            member: currentMember,
            members: [currentMember],
            environment: environment
        )
    )
}

private typealias EnvironmentFreshnessTasks = (
    operation: Task<Void, Never>,
    timeout: Task<Void, Never>
)

@MainActor
private func ownedFreshnessTasks(
    in viewModel: MyOrderFreshnessViewModel
) -> EnvironmentFreshnessTasks? {
    guard let operation = viewModel.freshnessOperationTask,
          let timeout = viewModel.freshnessTimeoutTask else {
        Issue.record("Expected owned freshness tasks")
        return nil
    }
    return (operation, timeout)
}

private actor RecordingFreshnessRemoteRepository: CriticalDataFreshnessRemoteRepository {
    let config: CriticalDataFreshnessConfig
    private var environments: [SessionEnvironment] = []

    init(config: CriticalDataFreshnessConfig) {
        self.config = config
    }

    func getConfig(environment: SessionEnvironment) async throws -> CriticalDataFreshnessConfig {
        environments.append(environment)
        return config
    }

    func requestedEnvironments() -> [SessionEnvironment] {
        environments
    }
}

private actor ControlledEnvironmentFreshnessRemoteRepository: CriticalDataFreshnessRemoteRepository {
    private var environments: [SessionEnvironment] = []
    private var continuations: [Int: CheckedContinuation<CriticalDataFreshnessConfig, Never>] = [:]
    private var requestCountWaiters: [
        (count: Int, continuation: CheckedContinuation<Void, Never>)
    ] = []

    func getConfig(environment: SessionEnvironment) async throws -> CriticalDataFreshnessConfig {
        let requestIndex = environments.count
        environments.append(environment)
        resumeSatisfiedRequestCountWaiters()
        return await withCheckedContinuation { continuation in
            continuations[requestIndex] = continuation
        }
    }

    func waitForRequestCount(_ expectedCount: Int) async {
        guard environments.count < expectedCount else { return }
        await withCheckedContinuation { continuation in
            requestCountWaiters.append((expectedCount, continuation))
        }
    }

    func completeRequest(at index: Int, with config: CriticalDataFreshnessConfig) {
        continuations.removeValue(forKey: index)?.resume(returning: config)
    }

    func requestedEnvironments() -> [SessionEnvironment] {
        environments
    }

    private func resumeSatisfiedRequestCountWaiters() {
        let satisfiedWaiterIndexes = requestCountWaiters.indices.filter {
            requestCountWaiters[$0].count <= environments.count
        }
        for index in satisfiedWaiterIndexes.reversed() {
            requestCountWaiters.remove(at: index).continuation.resume()
        }
    }
}
