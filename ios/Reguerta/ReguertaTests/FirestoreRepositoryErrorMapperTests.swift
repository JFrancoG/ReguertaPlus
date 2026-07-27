import FirebaseFirestore
import Foundation
import Testing

@testable import Reguerta

@MainActor
struct FirestoreRepositoryErrorMapperTests {
    @Test
    func mapsFirestoreFailuresToDomainErrors() {
        let resource = "products"

        #expect(
            mappedError(code: FirestoreErrorCode.permissionDenied.rawValue, resource: resource) ==
                .permissionDenied(resource: resource)
        )
        #expect(
            mappedError(code: FirestoreErrorCode.unavailable.rawValue, resource: resource) ==
                .unavailable(resource: resource)
        )
        #expect(
            mappedError(code: FirestoreErrorCode.dataLoss.rawValue, resource: resource) ==
                .invalidData(resource: resource)
        )
    }

    @Test
    func preservesCancellationWithoutDomainMapping() {
        let mapped = FirestoreRepositoryErrorMapper.map(
            CancellationError(),
            resource: "products"
        )

        #expect(mapped is CancellationError)
    }

    @Test
    func rejectsMalformedProductAndCommitmentDocumentsAsInvalidData() throws {
        var invalidProduct = validProductData()
        invalidProduct["pricingMode"] = "mystery"
        #expect(throws: RepositoryError.invalidData(resource: "products.document")) {
            try FirestoreProductRepository.product(documentID: "product", data: invalidProduct)
        }

        invalidProduct = validProductData()
        invalidProduct["archived"] = "false"
        #expect(throws: RepositoryError.invalidData(resource: "products.document")) {
            try FirestoreProductRepository.product(documentID: "product", data: invalidProduct)
        }

        invalidProduct = validProductData()
        invalidProduct["price"] = Double.infinity
        #expect(throws: RepositoryError.invalidData(resource: "products.document")) {
            try FirestoreProductRepository.product(documentID: "product", data: invalidProduct)
        }

        invalidProduct = validProductData()
        invalidProduct["pricingMode"] = "weight"
        invalidProduct["weightStep"] = 1.0
        invalidProduct["minWeight"] = 1.0
        invalidProduct["maxWeight"] = 1e300
        #expect(throws: RepositoryError.invalidData(resource: "products.document")) {
            try FirestoreProductRepository.product(documentID: "product", data: invalidProduct)
        }

        invalidProduct = validProductData()
        invalidProduct["pricingMode"] = "   "
        #expect(throws: RepositoryError.invalidData(resource: "products.document")) {
            try FirestoreProductRepository.product(documentID: "product", data: invalidProduct)
        }

        let invalidCommitment: [String: Any] = [
            "userId": "member",
            "productId": "product",
            "seasonKey": "2026",
            "fixedQty": 1.0,
            "active": "true"
        ]
        #expect(throws: RepositoryError.invalidData(resource: "seasonalCommitments.document")) {
            try FirestoreSeasonalCommitmentRepository.commitment(
                documentID: "commitment",
                data: invalidCommitment
            )
        }


        var infiniteQuantity = invalidCommitment
        infiniteQuantity["active"] = true
        infiniteQuantity["fixedQty"] = Double.infinity
        #expect(throws: RepositoryError.invalidData(resource: "seasonalCommitments.document")) {
            try FirestoreSeasonalCommitmentRepository.commitment(
                documentID: "commitment",
                data: infiniteQuantity
            )
        }

        var booleanQuantity = invalidCommitment
        booleanQuantity["active"] = true
        booleanQuantity["fixedQty"] = true
        #expect(throws: RepositoryError.invalidData(resource: "seasonalCommitments.document")) {
            try FirestoreSeasonalCommitmentRepository.commitment(
                documentID: "commitment",
                data: booleanQuantity
            )
        }

        var legacyNullProduct = validProductData()
        legacyNullProduct["productImageUrl"] = NSNull()
        #expect(try FirestoreProductRepository.product(
            documentID: "product",
            data: legacyNullProduct
        ).productImageUrl == nil)
    }

    @Test
    func productMergePayloadDeletesClearedOptionalFields() throws {
        let product = try FirestoreProductRepository.product(
            documentID: "product",
            data: validProductData()
        )
        let payload = FirestoreProductRepository.upsertPayload(for: product)

        #expect(payload["productImageUrl"] is FieldValue)
        #expect(payload["packContainerName"] is FieldValue)
        #expect(payload["stockQty"] is FieldValue)
        #expect(payload["weightStep"] is FieldValue)
        #expect(payload["commonPurchaseType"] is FieldValue)
    }

    @Test
    func sharedProfileContractDistinguishesLegacyAbsenceFromCorruption() throws {
        let timestamp = Timestamp(date: Date(timeIntervalSince1970: 123))
        let minimalProfile: [String: Any] = [
            "userId": "member_1",
            "updatedAt": timestamp
        ]

        let decoded = try FirestoreSharedProfileRepository.sharedProfile(
            documentID: "member_1",
            data: minimalProfile
        )
        #expect(decoded.familyNames.isEmpty)
        #expect(decoded.photoUrl == nil)
        #expect(decoded.about.isEmpty)
        #expect(decoded.updatedAtMillis == 123_000)

        var explicitNullPhoto = minimalProfile
        explicitNullPhoto["photoUrl"] = NSNull()
        #expect(
            try FirestoreSharedProfileRepository.sharedProfile(
                documentID: "member_1",
                data: explicitNullPhoto
            ).photoUrl == nil
        )

        var mismatchedIdentity = minimalProfile
        mismatchedIdentity["userId"] = "member_2"
        #expect(throws: RepositoryError.invalidData(resource: "sharedProfiles.document")) {
            try FirestoreSharedProfileRepository.sharedProfile(
                documentID: "member_1",
                data: mismatchedIdentity
            )
        }

        var invalidOptionalType = minimalProfile
        invalidOptionalType["about"] = 42
        #expect(throws: RepositoryError.invalidData(resource: "sharedProfiles.document")) {
            try FirestoreSharedProfileRepository.sharedProfile(
                documentID: "member_1",
                data: invalidOptionalType
            )
        }

        #expect(throws: RepositoryError.invalidData(resource: "sharedProfiles.document")) {
            try FirestoreSharedProfileRepository.sharedProfile(
                documentID: "member_1",
                data: ["userId": "member_1"]
            )
        }
    }

    @Test
    func sharedProfileMergePayloadDeletesClearedPhoto() {
        let payload = FirestoreSharedProfileRepository.upsertPayload(
            for: SharedProfile(
                userId: "member_1",
                familyNames: "Familia",
                photoUrl: nil,
                about: "Perfil",
                updatedAtMillis: 1
            )
        )

        #expect(payload["photoUrl"] is FieldValue)
    }

    @Test
    func memberDirectoryContractRequiresCanonicalPublicFieldsAndIdentity() throws {
        let validDirectory: [String: Any] = [
            "userId": "member_1",
            "displayName": " Member One ",
            "companyName": NSNull(),
            "roles": ["member", "producer"],
            "isActive": true,
            "producerCatalogEnabled": true,
            "isCommonPurchaseManager": false,
            "producerParity": "odd",
            "ecoCommitment": ["mode": "biweekly", "parity": "even"],
            "normalizedEmail": 123,
            "authUid": ["ignored"]
        ]

        let member = try FirestoreMemberRepository.directoryMember(
            documentID: "member_1",
            data: validDirectory
        )
        #expect(member.displayName == "Member One")
        #expect(member.normalizedEmail.isEmpty)
        #expect(member.authUid == nil)
        #expect(member.roles == [.member, .producer])
        #expect(member.ecoCommitmentMode == .biweekly)

        var mismatchedIdentity = validDirectory
        mismatchedIdentity["userId"] = "member_2"
        #expect(throws: RepositoryError.invalidData(resource: "members.directory.document")) {
            try FirestoreMemberRepository.directoryMember(
                documentID: "member_1",
                data: mismatchedIdentity
            )
        }

        var unknownRole = validDirectory
        unknownRole["roles"] = ["member", "observer"]
        #expect(throws: RepositoryError.invalidData(resource: "members.directory.document")) {
            try FirestoreMemberRepository.directoryMember(
                documentID: "member_1",
                data: unknownRole
            )
        }

        var invalidCommitment = validDirectory
        invalidCommitment["ecoCommitment"] = "weekly"
        #expect(throws: RepositoryError.invalidData(resource: "members.directory.document")) {
            try FirestoreMemberRepository.directoryMember(
                documentID: "member_1",
                data: invalidCommitment
            )
        }
    }

    @Test
    func fullMemberContractKeepsLegacyAliasesButRejectsConflictingTypes() throws {
        let legacyMember: [String: Any] = [
            "name": "Ana",
            "surname": "Reguerta",
            "email": " ANA@EXAMPLE.COM ",
            "isProducer": true
        ]
        let member = try FirestoreMemberRepository.member(
            documentID: "member_1",
            data: legacyMember
        )
        #expect(member.displayName == "Ana Reguerta")
        #expect(member.normalizedEmail == "ana@example.com")
        #expect(member.roles == [.member, .producer])
        #expect(member.ecoCommitmentMode == .weekly)

        var conflictingCanonicalType = legacyMember
        conflictingCanonicalType["normalizedEmail"] = 123
        #expect(throws: RepositoryError.invalidData(resource: "members.document")) {
            try FirestoreMemberRepository.member(
                documentID: "member_1",
                data: conflictingCanonicalType
            )
        }
    }

    private func mappedError(code: Int, resource: String) -> RepositoryError? {
        let error = NSError(
            domain: FirestoreErrorDomain,
            code: code
        )
        return FirestoreRepositoryErrorMapper.map(error, resource: resource) as? RepositoryError
    }

    private func validProductData() -> [String: Any] {
        [
            "vendorId": "producer",
            "companyName": "Productor",
            "name": "Tomates",
            "price": 2.0,
            "pricingMode": "fixed",
            "unitName": "unidad",
            "unitPlural": "unidades",
            "unitQty": 1.0,
            "isAvailable": true,
            "stockMode": "infinite",
            "archived": false
        ]
    }
}
