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
func testDeliveryShift(id: String, year: Int, month: Int, day: Int) -> ShiftAssignment {
    ShiftAssignment(
        id: id,
        type: .delivery,
        dateMillis: testMillis(year: year, month: month, day: day),
        assignedUserIds: ["member_1"],
        helperUserId: "member_2",
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

struct FixedStartupVersionPolicyRepository: StartupVersionPolicyRepository {
    let policy: StartupVersionPolicy?

    func policy(for platform: StartupPlatform) async -> StartupVersionPolicy? {
        policy
    }
}

struct FixedCriticalDataFreshnessRemoteRepository: CriticalDataFreshnessRemoteRepository {
    let config: CriticalDataFreshnessConfig?

    func getConfig() async -> CriticalDataFreshnessConfig? {
        config
    }
}

actor InMemoryCriticalDataFreshnessLocalRepository: CriticalDataFreshnessLocalRepository {
    private var metadata: CriticalDataFreshnessMetadata?

    func getMetadata() async -> CriticalDataFreshnessMetadata? {
        metadata
    }

    func saveMetadata(_ metadata: CriticalDataFreshnessMetadata) async {
        self.metadata = metadata
    }

    func clear() async {
        metadata = nil
    }
}

@MainActor
final class TestAuthSessionProvider: AuthSessionProvider {
    private let signInResult: AuthSignInResult
    private let refreshResult: AuthSessionRefreshResult

    init(
        signInResult: AuthSignInResult = .failure(.invalidCredentials),
        refreshResult: AuthSessionRefreshResult = .noSession
    ) {
        self.signInResult = signInResult
        self.refreshResult = refreshResult
    }

    func signIn(email: String, password: String) async -> AuthSignInResult {
        signInResult
    }

    func signUp(email: String, password: String) async -> AuthSignInResult {
        signInResult
    }

    func sendPasswordReset(email: String) async -> AuthPasswordResetResult {
        .success
    }

    func refreshCurrentSession() async -> AuthSessionRefreshResult {
        refreshResult
    }

    func signOut() {
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
