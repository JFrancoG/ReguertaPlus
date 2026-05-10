import FirebaseAuth
import Foundation
import Testing

@testable import Reguerta

@MainActor
struct ReguertaStartupAndOrderTests {
    @Test
    func startupGateBlocksOutdatedVersionWhenForceUpdateIsActive() {
        let useCase = ResolveStartupVersionGateUseCase(
            repository: FixedStartupVersionPolicyRepository(
                policy: StartupVersionPolicy(
                    currentVersion: "0.3.1",
                    minimumVersion: "0.3.0",
                    forceUpdate: true,
                    storeURL: "https://apps.apple.com"
                )
            )
        )

        let decision = useCase.evaluate(
            installedVersion: "0.2.9",
            policy: StartupVersionPolicy(
                currentVersion: "0.3.1",
                minimumVersion: "0.3.0",
                forceUpdate: true,
                storeURL: "https://apps.apple.com"
            )
        )

        #expect(decision == .forcedUpdate(storeURL: "https://apps.apple.com"))
    }

    @Test
    func startupGateWarnsWhenVersionIsBelowCurrent() {
        let useCase = ResolveStartupVersionGateUseCase(
            repository: FixedStartupVersionPolicyRepository(
                policy: StartupVersionPolicy(
                    currentVersion: "0.3.1",
                    minimumVersion: "0.3.0",
                    forceUpdate: false,
                    storeURL: "https://apps.apple.com"
                )
            )
        )

        let decision = useCase.evaluate(
            installedVersion: "0.3.0",
            policy: StartupVersionPolicy(
                currentVersion: "0.3.1",
                minimumVersion: "0.3.0",
                forceUpdate: false,
                storeURL: "https://apps.apple.com"
            )
        )

        #expect(decision == .optionalUpdate(storeURL: "https://apps.apple.com"))
    }

    @Test
    func startupGateFallsBackToAllowWhenPolicyIsMalformed() {
        let useCase = ResolveStartupVersionGateUseCase(
            repository: FixedStartupVersionPolicyRepository(
                policy: StartupVersionPolicy(
                    currentVersion: "invalid",
                    minimumVersion: "0.3.0",
                    forceUpdate: true,
                    storeURL: "https://apps.apple.com"
                )
            )
        )

        let decision = useCase.evaluate(
            installedVersion: "0.2.9",
            policy: StartupVersionPolicy(
                currentVersion: "invalid",
                minimumVersion: "0.3.0",
                forceUpdate: true,
                storeURL: "https://apps.apple.com"
            )
        )

        #expect(decision == .allow)
    }

    @Test
    func criticalDataFreshnessRejectsMissingTimestampKeys() {
        let useCase = ResolveCriticalDataFreshnessUseCase(
            remoteRepository: FixedCriticalDataFreshnessRemoteRepository(config: nil),
            localRepository: InMemoryCriticalDataFreshnessLocalRepository()
        )

        let evaluation = useCase.evaluate(
            config: CriticalDataFreshnessConfig(
                cacheExpirationMinutes: 15,
                remoteTimestampsMillis: [
                    .users: 1_000,
                    .products: 1_000,
                    .orders: 1_000,
                    .containers: 1_000,
                    .measures: 1_000
                ]
            ),
            metadata: nil,
            nowMillis: 10_000
        )

        #expect(evaluation == .invalidConfig)
    }

    @Test
    func criticalDataFreshnessPersistsWhenRemoteTimestampsChange() {
        let useCase = ResolveCriticalDataFreshnessUseCase(
            remoteRepository: FixedCriticalDataFreshnessRemoteRepository(config: nil),
            localRepository: InMemoryCriticalDataFreshnessLocalRepository()
        )
        let remoteTimestamps = Dictionary(
            uniqueKeysWithValues: CriticalCollection.allCases.map { ($0, Int64(2_000)) }
        )

        let evaluation = useCase.evaluate(
            config: CriticalDataFreshnessConfig(
                cacheExpirationMinutes: 15,
                remoteTimestampsMillis: remoteTimestamps
            ),
            metadata: CriticalDataFreshnessMetadata(
                validatedAtMillis: 5_000,
                acknowledgedTimestampsMillis: Dictionary(
                    uniqueKeysWithValues: CriticalCollection.allCases.map { ($0, Int64(1_000)) }
                )
            ),
            nowMillis: 6_000
        )

        #expect(
            evaluation == .accepted(
                metadataToPersist: CriticalDataFreshnessMetadata(
                    validatedAtMillis: 6_000,
                    acknowledgedTimestampsMillis: remoteTimestamps
                )
            )
        )
    }

    @Test
    func criticalDataFreshnessKeepsMetadataWhenTtlIsStillValid() {
        let useCase = ResolveCriticalDataFreshnessUseCase(
            remoteRepository: FixedCriticalDataFreshnessRemoteRepository(config: nil),
            localRepository: InMemoryCriticalDataFreshnessLocalRepository()
        )
        let remoteTimestamps = Dictionary(
            uniqueKeysWithValues: CriticalCollection.allCases.map { ($0, Int64(2_000)) }
        )

        let evaluation = useCase.evaluate(
            config: CriticalDataFreshnessConfig(
                cacheExpirationMinutes: 15,
                remoteTimestampsMillis: remoteTimestamps
            ),
            metadata: CriticalDataFreshnessMetadata(
                validatedAtMillis: 10_000,
                acknowledgedTimestampsMillis: remoteTimestamps
            ),
            nowMillis: 20_000
        )

        #expect(evaluation == .accepted(metadataToPersist: nil))
    }

    @Test
    func sessionRefreshPolicyDebouncesForegroundTransitions() {
        let policy = SessionRefreshPolicy(minimumForegroundIntervalMillis: 15_000)

        #expect(policy.shouldRefresh(
            trigger: .startup,
            lastRefreshAtMillis: nil,
            nowMillis: 1_000,
            isRefreshInFlight: false
        ))
        #expect(!policy.shouldRefresh(
            trigger: .startup,
            lastRefreshAtMillis: 1_000,
            nowMillis: 2_000,
            isRefreshInFlight: false
        ))
        #expect(!policy.shouldRefresh(
            trigger: .foreground,
            lastRefreshAtMillis: 10_000,
            nowMillis: 20_000,
            isRefreshInFlight: false
        ))
        #expect(policy.shouldRefresh(
            trigger: .foreground,
            lastRefreshAtMillis: 10_000,
            nowMillis: 25_000,
            isRefreshInFlight: false
        ))
    }

    @Test
    func startupRefreshRestoresAuthorizedSession() async {
        let provider = TestAuthSessionProvider(
            refreshResult: .active(AuthPrincipal(uid: "uid_admin_restore", email: "ana.admin@reguerta.app"))
        )
        let viewModel = SessionViewModel(
            repository: InMemoryMemberRepository(),
            authSessionProvider: provider,
            sessionRefreshPolicy: SessionRefreshPolicy(minimumForegroundIntervalMillis: 15_000),
            nowMillisProvider: { 1_000 }
        )

        viewModel.refreshSession(trigger: .startup)
        await waitForCondition { viewModel.mode.isAuthenticatedSession }

        guard case .authorized(let session) = viewModel.mode else {
            Issue.record("Expected restored authorized session")
            return
        }

        #expect(session.principal.uid == "uid_admin_restore")
        #expect(viewModel.showSessionExpiredDialog == false)
    }

    @Test
    func expiredRefreshSignsOutAndShowsRecoveryDialog() async {
        let provider = TestAuthSessionProvider(
            signInResult: .success(AuthPrincipal(uid: "uid_admin_expired", email: "ana.admin@reguerta.app")),
            refreshResult: .expired
        )
        let viewModel = SessionViewModel(
            repository: InMemoryMemberRepository(),
            authSessionProvider: provider,
            sessionRefreshPolicy: SessionRefreshPolicy(minimumForegroundIntervalMillis: 15_000),
            nowMillisProvider: { 1_000 }
        )

        viewModel.emailInput = "ana.admin@reguerta.app"
        viewModel.passwordInput = "test1234"
        viewModel.signIn()
        await waitForCondition { viewModel.mode.isAuthenticatedSession }

        #expect(viewModel.mode.isAuthenticatedSession)

        viewModel.refreshSession(trigger: .foreground)
        await waitForCondition { viewModel.mode == .signedOut && viewModel.showSessionExpiredDialog }

        #expect(viewModel.mode == .signedOut)
        #expect(viewModel.showSessionExpiredDialog)
    }

    @Test
    func myOrderValidationBlocksMissingWeeklyCommitment() {
        let currentMember = member(id: "member_1", ecoCommitmentMode: .weekly)
        let producerEven = producer(id: "producer_even", parity: .even)
        let ecoBasket = ecoBasketProduct(id: "eco_even", vendorId: producerEven.id)

        let result = validateMyOrderCheckout(
            currentMember: currentMember,
            members: [currentMember, producerEven],
            products: [ecoBasket],
            selectedQuantities: [:],
            selectedEcoBasketOptions: [:]
        )

        #expect(result.isValid == false)
        #expect(result.missingCommitmentProductNames == ["Ecocesta"])
        #expect(result.hasEcoBasketPriceMismatch == false)
    }

    @Test
    func myOrderValidationAcceptsNoPickupAsPaidCommitment() {
        let currentMember = member(id: "member_1", ecoCommitmentMode: .weekly)
        let producerEven = producer(id: "producer_even", parity: .even)
        let ecoBasket = ecoBasketProduct(id: "eco_even", vendorId: producerEven.id)

        let result = validateMyOrderCheckout(
            currentMember: currentMember,
            members: [currentMember, producerEven],
            products: [ecoBasket],
            selectedQuantities: [ecoBasket.id: 1],
            selectedEcoBasketOptions: [ecoBasket.id: ecoBasketOptionNoPickup]
        )

        #expect(result.isValid == true)
        #expect(result.missingCommitmentProductNames.isEmpty)
    }

    @Test
    func myOrderValidationRequiresParityProducerInBiweeklyMode() {
        let currentMember = member(
            id: "member_1",
            ecoCommitmentMode: .biweekly,
            ecoCommitmentParity: .even
        )
        let producerEven = producer(id: "producer_even", parity: .even)
        let producerOdd = producer(id: "producer_odd", parity: .odd)
        let ecoEven = ecoBasketProduct(id: "eco_even", vendorId: producerEven.id, name: "Ecocesta par")
        let ecoOdd = ecoBasketProduct(id: "eco_odd", vendorId: producerOdd.id, name: "Ecocesta impar")

        let result = validateMyOrderCheckout(
            currentMember: currentMember,
            members: [currentMember, producerEven, producerOdd],
            products: [ecoEven, ecoOdd],
            selectedQuantities: [ecoOdd.id: 1],
            selectedEcoBasketOptions: [ecoOdd.id: ecoBasketOptionPickup],
            currentWeekParity: .even
        )

        #expect(result.isValid == false)
        #expect(result.missingCommitmentProductNames == ["Ecocesta par"])
    }

}
