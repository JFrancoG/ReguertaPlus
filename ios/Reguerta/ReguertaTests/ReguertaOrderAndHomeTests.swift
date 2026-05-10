import FirebaseAuth
import Foundation
import Testing

@testable import Reguerta

@MainActor
struct ReguertaOrderAndHomeTests {
    @Test
    func myOrderValidationDoesNotRequireBiweeklyCommitmentOnOppositeWeek() {
        let currentMember = member(
            id: "member_1",
            ecoCommitmentMode: .biweekly,
            ecoCommitmentParity: .even
        )
        let producerEven = producer(id: "producer_even", parity: .even)
        let producerOdd = producer(id: "producer_odd", parity: .odd)
        let ecoOdd = ecoBasketProduct(id: "eco_odd", vendorId: producerOdd.id, name: "Ecocesta impar")

        let result = validateMyOrderCheckout(
            currentMember: currentMember,
            members: [currentMember, producerEven, producerOdd],
            products: [ecoOdd],
            selectedQuantities: [:],
            selectedEcoBasketOptions: [:],
            currentWeekParity: .odd
        )

        #expect(result.isValid == true)
        #expect(result.missingCommitmentProductNames.isEmpty)
    }

    @Test
    func myOrderValidationBlocksMissingSeasonalCommitmentProduct() {
        let currentMember = member(id: "member_1", ecoCommitmentMode: .weekly)
        let producerEven = producer(id: "producer_even", parity: .even)
        let avocados = regularProduct(id: "seasonal_avocado", vendorId: producerEven.id, name: "Aguacates")

        let result = validateMyOrderCheckout(
            currentMember: currentMember,
            members: [currentMember, producerEven],
            products: [avocados],
            seasonalCommitments: [seasonalCommitment(productId: avocados.id, fixedQtyPerOfferedWeek: 1)],
            selectedQuantities: [:],
            selectedEcoBasketOptions: [:],
            currentWeekParity: .even
        )

        #expect(result.isValid == false)
        #expect(result.missingCommitmentProductNames == ["Aguacates"])
    }

    @Test
    func myOrderValidationBlocksExceededSeasonalCommitmentQuantity() {
        let currentMember = member(id: "member_1", ecoCommitmentMode: .weekly)
        let producerEven = producer(id: "producer_even", parity: .even)
        let avocados = regularProduct(id: "seasonal_avocado", vendorId: producerEven.id, name: "Aguacates")

        let result = validateMyOrderCheckout(
            currentMember: currentMember,
            members: [currentMember, producerEven],
            products: [avocados],
            seasonalCommitments: [seasonalCommitment(productId: avocados.id, fixedQtyPerOfferedWeek: 2)],
            selectedQuantities: [avocados.id: 3],
            selectedEcoBasketOptions: [:],
            currentWeekParity: .even
        )

        #expect(result.isValid == false)
        #expect(result.exceededCommitmentProductNames == ["Aguacates"])
    }

    @Test
    func myOrderValidationFlagsIncompatibleSeasonalCommitmentStep() {
        let currentMember = member(id: "member_1", ecoCommitmentMode: .weekly)
        let producerEven = producer(id: "producer_even", parity: .even)
        var avocados = regularProduct(id: "seasonal_avocado", vendorId: producerEven.id, name: "Aguacates")
        avocados = Product(
            id: avocados.id,
            vendorId: avocados.vendorId,
            companyName: avocados.companyName,
            name: avocados.name,
            description: avocados.description,
            productImageUrl: avocados.productImageUrl,
            price: avocados.price,
            pricingMode: .weight,
            unitName: "kg",
            unitAbbreviation: "kg",
            unitPlural: "kg",
            unitQty: 1.0,
            packContainerName: avocados.packContainerName,
            packContainerAbbreviation: avocados.packContainerAbbreviation,
            packContainerPlural: avocados.packContainerPlural,
            packContainerQty: avocados.packContainerQty,
            isAvailable: avocados.isAvailable,
            stockMode: avocados.stockMode,
            stockQty: avocados.stockQty,
            isEcoBasket: avocados.isEcoBasket,
            isCommonPurchase: avocados.isCommonPurchase,
            commonPurchaseType: avocados.commonPurchaseType,
            archived: avocados.archived,
            createdAtMillis: avocados.createdAtMillis,
            updatedAtMillis: avocados.updatedAtMillis
        )

        let result = validateMyOrderCheckout(
            currentMember: currentMember,
            members: [currentMember, producerEven],
            products: [avocados],
            seasonalCommitments: [seasonalCommitment(productId: avocados.id, fixedQtyPerOfferedWeek: 3.5)],
            selectedQuantities: [avocados.id: 3],
            selectedEcoBasketOptions: [:],
            currentWeekParity: .even
        )

        #expect(result.isValid == false)
        #expect(result.incompatibleCommitmentProductNames == ["Aguacates"])
    }

    @Test
    func myOrderValidationIgnoresSeasonalCommitmentWhenProductNotOffered() {
        let currentMember = member(id: "member_1", ecoCommitmentMode: .weekly)

        let result = validateMyOrderCheckout(
            currentMember: currentMember,
            members: [currentMember],
            products: [],
            seasonalCommitments: [seasonalCommitment(productId: "seasonal_hidden", fixedQtyPerOfferedWeek: 1)],
            selectedQuantities: [:],
            selectedEcoBasketOptions: [:],
            currentWeekParity: .even
        )

        #expect(result.isValid == true)
        #expect(result.missingCommitmentProductNames.isEmpty)
    }

    @Test
    func myOrderValidationBlocksMissingSeasonalCommitmentUsingSeasonKeyFallback() {
        let currentMember = member(id: "member_1", ecoCommitmentMode: .weekly)
        let avocados = regularProduct(
            id: "product_common_avocado",
            vendorId: "compras_reguerta",
            name: "Aguacates"
        )

        let result = validateMyOrderCheckout(
            currentMember: currentMember,
            members: [currentMember],
            products: [avocados],
            seasonalCommitments: [
                seasonalCommitment(
                    productId: "legacy_mango_commitment",
                    seasonKey: "2026-aguacate",
                    fixedQtyPerOfferedWeek: 1
                )
            ],
            selectedQuantities: [:],
            selectedEcoBasketOptions: [:],
            currentWeekParity: .even
        )

        #expect(result.isValid == false)
        #expect(result.missingCommitmentProductNames == ["Aguacates"])
    }

    @Test
    func myOrderValidationBlocksMissingSeasonalCommitmentUsingSeasonCodeFallback() {
        let currentMember = member(id: "member_1", ecoCommitmentMode: .weekly)
        let avocados = regularProduct(
            id: "product_common_avocado",
            vendorId: "compras_reguerta",
            name: "Aguacates"
        )

        let result = validateMyOrderCheckout(
            currentMember: currentMember,
            members: [currentMember],
            products: [avocados],
            seasonalCommitments: [
                seasonalCommitment(
                    productId: "legacy_code_commitment",
                    seasonKey: "AVO-2025-26",
                    fixedQtyPerOfferedWeek: 1
                )
            ],
            selectedQuantities: [:],
            selectedEcoBasketOptions: [:],
            currentWeekParity: .even
        )

        #expect(result.isValid == false)
        #expect(result.missingCommitmentProductNames == ["Aguacates"])
    }

    @Test
    func myOrderValidationBlocksExceededSeasonalCommitmentUsingSeasonCodeFallback() {
        let currentMember = member(id: "member_1", ecoCommitmentMode: .weekly)
        let avocados = regularProduct(
            id: "product_common_avocado",
            vendorId: "compras_reguerta",
            name: "Aguacates"
        )

        let result = validateMyOrderCheckout(
            currentMember: currentMember,
            members: [currentMember],
            products: [avocados],
            seasonalCommitments: [
                seasonalCommitment(
                    productId: "legacy_code_commitment",
                    seasonKey: "AVO-2025-26",
                    fixedQtyPerOfferedWeek: 2
                )
            ],
            selectedQuantities: [avocados.id: 3],
            selectedEcoBasketOptions: [:],
            currentWeekParity: .even
        )

        #expect(result.isValid == false)
        #expect(result.exceededCommitmentProductNames == ["Aguacates"])
    }

    @Test
    func myOrderValidationFlagsEcoBasketPriceMismatch() {
        let currentMember = member(id: "member_1", ecoCommitmentMode: .weekly)
        let producerEven = producer(id: "producer_even", parity: .even)
        let producerOdd = producer(id: "producer_odd", parity: .odd)
        let ecoEven = ecoBasketProduct(id: "eco_even", vendorId: producerEven.id, price: 2.0)
        let ecoOdd = ecoBasketProduct(id: "eco_odd", vendorId: producerOdd.id, price: 2.5)

        let result = validateMyOrderCheckout(
            currentMember: currentMember,
            members: [currentMember, producerEven, producerOdd],
            products: [ecoEven, ecoOdd],
            selectedQuantities: [ecoEven.id: 1],
            selectedEcoBasketOptions: [ecoEven.id: ecoBasketOptionPickup]
        )

        #expect(result.hasEcoBasketPriceMismatch == true)
    }

    @Test
    func seasonalCommitmentLookupKeysIncludeMemberIdAuthUIDAndEmail() {
        let member = Member(
            id: "member_1",
            displayName: "Member",
            normalizedEmail: "member_1@reguerta.app",
            authUid: "uid_member_1",
            roles: [.member],
            isActive: true,
            producerCatalogEnabled: true
        )

        #expect(member.seasonalCommitmentLookupKeys == ["member_1", "uid_member_1", "member_1@reguerta.app"])
    }

    @Test
    func seasonalCommitmentLookupKeysRemoveDuplicatesAndBlanks() {
        let member = Member(
            id: "member_1",
            displayName: "Member",
            normalizedEmail: "   ",
            authUid: " member_1 ",
            roles: [.member],
            isActive: true,
            producerCatalogEnabled: true
        )

        #expect(member.seasonalCommitmentLookupKeys == ["member_1"])
    }

    @Test
    func canonicalMatrixCapabilitiesMatchIOSPermissionMatrix() throws {
        let matrix = try loadCanonicalMatrix()

        for role in CanonicalAccessRole.allCases {
            let expected = Set(
                matrix[role.rawValue, default: []]
                    .compactMap(AccessCapability.init(rawValue:))
            )
            #expect(MemberPermissionMatrix.capabilities(for: role) == expected)
        }
    }

    @Test
    func commonPurchaseManagerOverrideGrantsCatalogManagement() {
        let member = Member(
            id: "member_common_purchase_001",
            displayName: "Compra común",
            normalizedEmail: "compras@reguerta.app",
            authUid: nil,
            roles: [.member],
            isActive: true,
            producerCatalogEnabled: true,
            isCommonPurchaseManager: true
        )

        #expect(member.canManageProductCatalog)
    }

    @Test
    func inMemoryFixturesStayAlignedWithCanonicalMatrix() async {
        let repository = InMemoryMemberRepository()
        let membersById = Dictionary(
            uniqueKeysWithValues: await repository.allMembers().map { ($0.id, $0) }
        )

        if let admin = membersById["member_admin_001"] {
            #expect(admin.canManageMembers)
            #expect(admin.canGrantAdminRole)
            #expect(admin.canPublishNews)
            #expect(admin.canSendAdminNotifications)
        } else {
            Issue.record("Missing seeded admin fixture")
        }

        if let producer = membersById["member_producer_001"] {
            #expect(producer.canManageProductCatalog)
            #expect(producer.canAccessReceivedOrders)
        } else {
            Issue.record("Missing seeded producer fixture")
        }

        if let member = membersById["member_member_001"] {
            #expect(member.canAccessCommonHomeModules)
            #expect(member.canManageMembers == false)
            #expect(member.canAccessReceivedOrders == false)
        } else {
            Issue.record("Missing seeded member fixture")
        }
    }

    private func loadCanonicalMatrix() throws -> [String: Set<String>] {
        let matrixURL = try findCanonicalMatrixURL()
        let data = try Data(contentsOf: matrixURL)
        guard let root = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              let roles = root["roles"] as? [String: [String: Any]] else {
            throw MatrixLoadError.invalidPayload
        }

        func resolveCapabilities(
            roleName: String,
            visiting: inout Set<String>
        ) throws -> Set<String> {
            guard let role = roles[roleName] else { return [] }
            if visiting.contains(roleName) {
                throw MatrixLoadError.inheritanceCycle(roleName)
            }
            visiting.insert(roleName)
            defer { visiting.remove(roleName) }

            let direct = Set(stringArray(role["capabilities"]))
            let inherited = stringArray(role["inherits"])
            let inheritedCapabilities = try inherited.reduce(into: Set<String>()) { partialResult, inheritedRole in
                partialResult.formUnion(try resolveCapabilities(roleName: inheritedRole, visiting: &visiting))
            }
            return direct.union(inheritedCapabilities)
        }

        return try roles.keys.reduce(into: [String: Set<String>]()) { partialResult, roleName in
            var visiting = Set<String>()
            partialResult[roleName] = try resolveCapabilities(roleName: roleName, visiting: &visiting)
        }
    }

    private func findCanonicalMatrixURL() throws -> URL {
        var cursor = URL(fileURLWithPath: #filePath).deletingLastPathComponent()
        let fileManager = FileManager.default
        while true {
            let candidate = cursor.appendingPathComponent(Self.matrixRelativePath)
            if fileManager.fileExists(atPath: candidate.path) {
                return candidate
            }
            let parent = cursor.deletingLastPathComponent()
            if parent.path == cursor.path {
                break
            }
            cursor = parent
        }
        throw MatrixLoadError.fileNotFound
    }

    private func stringArray(_ value: Any?) -> [String] {
        (value as? [String])?
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty } ?? []
    }

    private enum MatrixLoadError: Error {
        case fileNotFound
        case invalidPayload
        case inheritanceCycle(String)
    }

    @Test
    func homeWeeklySummaryUsesCurrentWeekBeforeDelivery() {
        let display = resolveHomeWeeklySummaryDisplay(
            nowMillis: testMillis(year: 2026, month: 5, day: 6),
            defaultDeliveryDayOfWeek: .friday,
            deliveryCalendarOverrides: [],
            shifts: [testDeliveryShift(id: "delivery_w19", year: 2026, month: 5, day: 8)],
            members: homeSummaryMembers
        )

        #expect(display.weekKey == "2026-W19")
        #expect(display.weekRangeLabel == "4 may - 10 may")
        #expect(display.producerName == "Huerta Sur")
        #expect(display.isConsultaPhase)
        #expect(display.myOrderSubtitleKey == AccessL10nKey.homeDashboardMyOrderSubtitleLastOrder)
        #expect(display.responsibleName == "Carmen")
        #expect(display.helperName == "Javier")
    }

    @Test
    func homeWeeklySummaryMovesToNextWeekAfterDelivery() {
        let display = resolveHomeWeeklySummaryDisplay(
            nowMillis: testMillis(year: 2026, month: 5, day: 9),
            defaultDeliveryDayOfWeek: .friday,
            deliveryCalendarOverrides: [],
            shifts: [
                testDeliveryShift(id: "delivery_w19", year: 2026, month: 5, day: 8),
                testDeliveryShift(id: "delivery_w20", year: 2026, month: 5, day: 15)
            ],
            members: homeSummaryMembers
        )

        #expect(display.weekKey == "2026-W20")
        #expect(display.weekRangeLabel == "11 may - 17 may")
        #expect(display.producerName == "Huerta Norte")
        #expect(!display.isConsultaPhase)
        #expect(display.myOrderSubtitleKey == AccessL10nKey.homeDashboardMyOrderSubtitleEdit)
    }

    @Test
    func homeOrderStateMappingUsesConfirmedBeforeDraft() {
        let suiteName = "home-order-state-\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suiteName)!
        defer {
            defaults.removePersistentDomain(forName: suiteName)
        }
        let cartKey = "reguerta_my_order_cart.member_member_1_week_2026-W19.quantities"
        let confirmedKey = "reguerta_my_order_cart.member_member_1_week_2026-W19.confirmed_quantities"

        #expect(resolveHomeOrderState(userDefaults: defaults, memberId: "member_1", weekKey: "2026-W19") == .notStarted)
        defaults.set(["product_1": 2], forKey: cartKey)
        #expect(resolveHomeOrderState(userDefaults: defaults, memberId: "member_1", weekKey: "2026-W19") == .unconfirmed)
        defaults.set(["product_1": 2], forKey: confirmedKey)
        #expect(resolveHomeOrderState(userDefaults: defaults, memberId: "member_1", weekKey: "2026-W19") == .completed)
    }

    private static let matrixRelativePath =
        "spec/app/hu-044-canonical-role-permission-matrix-and-test-fixtures/role-permission-matrix.v1.json"
}
