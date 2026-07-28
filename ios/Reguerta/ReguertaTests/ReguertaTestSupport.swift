import FirebaseAuth
import Foundation
import Testing

@testable import Reguerta

@MainActor
func member(
    id: String,
    ecoCommitmentMode: EcoCommitmentMode,
    ecoCommitmentParity: ProducerParity? = nil
) -> Member {
    Member(
        id: id,
        displayName: "Member",
        normalizedEmail: "\(id)@reguerta.app",
        authUid: "auth_\(id)",
        roles: [.member],
        isActive: true,
        producerCatalogEnabled: true,
        ecoCommitmentMode: ecoCommitmentMode,
        ecoCommitmentParity: ecoCommitmentParity
    )
}

@MainActor
func producer(id: String, parity: ProducerParity) -> Member {
    Member(
        id: id,
        displayName: id,
        normalizedEmail: "\(id)@reguerta.app",
        authUid: nil,
        roles: [.producer],
        isActive: true,
        producerCatalogEnabled: true,
        producerParity: parity
    )
}

@MainActor
func ecoBasketProduct(
    id: String,
    vendorId: String,
    name: String = "Ecocesta",
    price: Double = 2.0
) -> Product {
    Product(
        id: id,
        vendorId: vendorId,
        companyName: vendorId,
        name: name,
        description: "",
        productImageUrl: nil,
        price: price,
        pricingMode: .fixed,
        unitName: "unit",
        unitAbbreviation: "ud",
        unitPlural: "units",
        unitQty: 1.0,
        packContainerName: nil,
        packContainerAbbreviation: nil,
        packContainerPlural: nil,
        packContainerQty: nil,
        isAvailable: true,
        stockMode: .infinite,
        stockQty: nil,
        isEcoBasket: true,
        isCommonPurchase: false,
        commonPurchaseType: nil,
        archived: false,
        createdAtMillis: 1,
        updatedAtMillis: 1
    )
}

@MainActor
func regularProduct(
    id: String,
    vendorId: String,
    name: String
) -> Product {
    Product(
        id: id,
        vendorId: vendorId,
        companyName: vendorId,
        name: name,
        description: "",
        productImageUrl: nil,
        price: 2.0,
        pricingMode: .fixed,
        unitName: "unit",
        unitAbbreviation: "ud",
        unitPlural: "units",
        unitQty: 1.0,
        packContainerName: nil,
        packContainerAbbreviation: nil,
        packContainerPlural: nil,
        packContainerQty: nil,
        isAvailable: true,
        stockMode: .infinite,
        stockQty: nil,
        isEcoBasket: false,
        isCommonPurchase: false,
        commonPurchaseType: nil,
        archived: false,
        createdAtMillis: 1,
        updatedAtMillis: 1
    )
}

@MainActor
func seasonalCommitment(
    productId: String,
    seasonKey: String = "2026",
    productNameHint: String? = nil,
    fixedQtyPerOfferedWeek: Double
) -> SeasonalCommitment {
    SeasonalCommitment(
        id: "commitment_\(productId)",
        userId: "member_1",
        productId: productId,
        productNameHint: productNameHint,
        seasonKey: seasonKey,
        fixedQtyPerOfferedWeek: fixedQtyPerOfferedWeek,
        active: true,
        createdAtMillis: 1,
        updatedAtMillis: 1
    )
}

@MainActor
func testMillis(year: Int, month: Int, day: Int) -> Int64 {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = TimeZone(identifier: "Europe/Madrid")!
    let date = calendar.date(from: DateComponents(year: year, month: month, day: day))!
    return Int64(date.timeIntervalSince1970 * 1_000)
}

@MainActor
func testDeliveryShift(
    id: String,
    year: Int,
    month: Int,
    day: Int,
    assignedUserIds: [String] = ["member_1"],
    helperUserId: String? = "member_2"
) -> ShiftAssignment {
    ShiftAssignment(
        id: id,
        type: .delivery,
        dateMillis: testMillis(year: year, month: month, day: day),
        assignedUserIds: assignedUserIds,
        helperUserId: helperUserId,
        status: .confirmed,
        source: "test",
        createdAtMillis: 0,
        updatedAtMillis: 0
    )
}

@MainActor
func testMarketShift(
    id: String,
    year: Int,
    month: Int,
    day: Int,
    assignedUserIds: [String] = ["member_1", "member_2", "member_3"]
) -> ShiftAssignment {
    ShiftAssignment(
        id: id,
        type: .market,
        dateMillis: testMillis(year: year, month: month, day: day),
        assignedUserIds: assignedUserIds,
        helperUserId: nil,
        status: .confirmed,
        source: "test",
        createdAtMillis: 0,
        updatedAtMillis: 0
    )
}

let homeSummaryMembers = [
    Member(
        id: "member_1",
        displayName: "Carmen",
        normalizedEmail: "carmen@reguerta.test",
        authUid: nil,
        roles: [.member],
        isActive: true,
        producerCatalogEnabled: true
    ),
    Member(
        id: "member_2",
        displayName: "Javier",
        normalizedEmail: "javier@reguerta.test",
        authUid: nil,
        roles: [.member],
        isActive: true,
        producerCatalogEnabled: true
    ),
    Member(
        id: "member_3",
        displayName: "Luz",
        normalizedEmail: "luz@reguerta.test",
        authUid: nil,
        roles: [.member],
        isActive: true,
        producerCatalogEnabled: true
    ),
    Member(
        id: "producer_1",
        displayName: "Huerta Norte",
        companyName: "Huerta Norte",
        normalizedEmail: "huerta@reguerta.test",
        authUid: nil,
        roles: [.producer],
        isActive: true,
        producerCatalogEnabled: true,
        producerParity: .odd
    ),
    Member(
        id: "producer_2",
        displayName: "Huerta Sur",
        companyName: "Huerta Sur",
        normalizedEmail: "sur@reguerta.test",
        authUid: nil,
        roles: [.producer],
        isActive: true,
        producerCatalogEnabled: true,
        producerParity: .even
    )
]

let may2026HomeSummaryMembers = [
    Member(
        id: "felix",
        displayName: "Felix",
        normalizedEmail: "felix@reguerta.test",
        authUid: nil,
        roles: [.member],
        isActive: true,
        producerCatalogEnabled: true
    ),
    Member(
        id: "ana_belen",
        displayName: "Ana Belen",
        normalizedEmail: "ana.belen@reguerta.test",
        authUid: nil,
        roles: [.member],
        isActive: true,
        producerCatalogEnabled: true
    ),
    Member(
        id: "valle",
        displayName: "Valle",
        normalizedEmail: "valle@reguerta.test",
        authUid: nil,
        roles: [.member],
        isActive: true,
        producerCatalogEnabled: true
    ),
    Member(
        id: "angeles",
        displayName: "Angeles",
        normalizedEmail: "angeles@reguerta.test",
        authUid: nil,
        roles: [.member],
        isActive: true,
        producerCatalogEnabled: true
    ),
    Member(
        id: "sandra",
        displayName: "Sandra",
        normalizedEmail: "sandra@reguerta.test",
        authUid: nil,
        roles: [.member],
        isActive: true,
        producerCatalogEnabled: true
    ),
    Member(
        id: "producer_tito_fernando",
        displayName: "Tito Fernando",
        companyName: "Tito Fernando",
        normalizedEmail: "tito.fernando@reguerta.test",
        authUid: nil,
        roles: [.producer],
        isActive: true,
        producerCatalogEnabled: true,
        producerParity: .even
    ),
    Member(
        id: "producer_laurel",
        displayName: "El Laurel de Cantillo",
        companyName: "El Laurel de Cantillo",
        normalizedEmail: "laurel@reguerta.test",
        authUid: nil,
        roles: [.producer],
        isActive: true,
        producerCatalogEnabled: true,
        producerParity: .odd
    )
]

struct FixedStartupVersionPolicyRepository: StartupVersionPolicyRepository {
    let policy: StartupVersionPolicy?

    func policy(for platform: StartupPlatform) async throws -> StartupVersionPolicy {
        guard let policy else {
            throw RepositoryError.notFound(resource: "config.public")
        }
        return policy
    }
}

struct FixedCriticalDataFreshnessRemoteRepository: CriticalDataFreshnessRemoteRepository {
    let config: CriticalDataFreshnessConfig?

    func getConfig(environment: SessionEnvironment) async throws -> CriticalDataFreshnessConfig {
        guard let config else {
            throw RepositoryError.notFound(resource: "config.member")
        }
        return config
    }
}

@MainActor
final class InMemoryCriticalDataFreshnessLocalRepository: CriticalDataFreshnessLocalRepository {
    private var metadata: CriticalDataFreshnessMetadata?

    func getMetadata() -> CriticalDataFreshnessMetadata? {
        metadata
    }

    func saveMetadata(_ metadata: CriticalDataFreshnessMetadata) {
        self.metadata = metadata
    }

    func clear() {
        metadata = nil
    }
}

@MainActor
final class TestAuthSessionProvider: AuthSessionProvider {
    private let signInResult: AuthSignInResult
    private let signUpResult: AuthSignUpResult
    private let refreshResult: AuthSessionRefreshResult
    private let verificationSent: Bool
    private let idToken: String
    private let signOutSucceeds: Bool

    init(
        signInResult: AuthSignInResult = .failure(.invalidCredentials),
        signUpResult: AuthSignUpResult = .failure(.unknown),
        refreshResult: AuthSessionRefreshResult = .noSession,
        verificationSent: Bool = true,
        idToken: String = "test-firebase-id-token",
        signOutSucceeds: Bool = true
    ) {
        self.signInResult = signInResult
        self.signUpResult = signUpResult
        self.refreshResult = refreshResult
        self.verificationSent = verificationSent
        self.idToken = idToken
        self.signOutSucceeds = signOutSucceeds
    }

    func signIn(email: String, password: String) async -> AuthSignInResult {
        signInResult
    }

    func signUp(email: String, password: String) async -> AuthSignUpResult {
        signUpResult
    }

    func sendPasswordReset(email: String) async -> AuthPasswordResetResult {
        .success
    }

    func sendCurrentUserEmailVerification() async -> Bool {
        verificationSent
    }

    func validIDToken(forcingRefresh: Bool) async throws -> String {
        idToken
    }

    func refreshCurrentSession() async -> AuthSessionRefreshResult {
        refreshResult
    }

    @discardableResult
    func signOut() -> Bool {
        signOutSucceeds
    }
}

@MainActor
func waitForCondition(
    timeoutNanoseconds: UInt64 = 500_000_000,
    pollNanoseconds: UInt64 = 10_000_000,
    condition: @escaping @MainActor () -> Bool
) async {
    let start = ContinuousClock.now
    while !condition() {
        if ContinuousClock.now - start >= .nanoseconds(Int(timeoutNanoseconds)) {
            return
        }
        try? await Task.sleep(nanoseconds: pollNanoseconds)
    }
}
