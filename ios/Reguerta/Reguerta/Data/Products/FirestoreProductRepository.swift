import FirebaseFirestore
import Foundation

final class FirestoreProductRepository: @unchecked Sendable, ProductRepository {
    private let db: Firestore
    private let environment: ReguertaFirestoreEnvironment?

    init(db: Firestore = Firestore.firestore(), environment: ReguertaFirestoreEnvironment? = nil) {
        self.db = db
        self.environment = environment
    }

    private var productsCollection: CollectionReference {
        db.reguertaCollection(.products, environment: environment)
    }

    func allProducts() async throws -> [Product] {
        do {
            let snapshot = try await productsCollection.getDocuments()
            return try Self.products(from: snapshot.documents)
        } catch {
            throw FirestoreRepositoryErrorMapper.map(error, resource: "products")
        }
    }

    func products(vendorId: String) async throws -> [Product] {
        do {
            let snapshot = try await productsCollection
                .whereField("vendorId", isEqualTo: vendorId)
                .getDocuments()
            return try Self.products(from: snapshot.documents)
        } catch {
            throw FirestoreRepositoryErrorMapper.map(error, resource: "products.vendor")
        }
    }

    func upsert(product: Product) async throws -> Product {
        let documentId = product.id.isEmpty ? productsCollection.document().documentID : product.id
        let persisted = persistedProduct(from: product, with: documentId)

        do {
            try await productsCollection.document(documentId).setData(
                Self.upsertPayload(for: persisted),
                merge: true
            )
        } catch {
            throw FirestoreRepositoryErrorMapper.map(error, resource: "products.write")
        }
        return persisted
    }

    private func persistedProduct(from product: Product, with documentId: String) -> Product {
        Product(
            id: documentId,
            vendorId: product.vendorId,
            companyName: product.companyName,
            name: product.name,
            description: product.description,
            productImageUrl: product.productImageUrl,
            price: product.price,
            pricingMode: product.pricingMode,
            unitName: product.unitName,
            unitAbbreviation: product.unitAbbreviation,
            unitPlural: product.unitPlural,
            unitQty: product.unitQty,
            packContainerName: product.packContainerName,
            packContainerAbbreviation: product.packContainerAbbreviation,
            packContainerPlural: product.packContainerPlural,
            packContainerQty: product.packContainerQty,
            isAvailable: product.isAvailable,
            stockMode: product.stockMode,
            stockQty: product.stockQty,
            isEcoBasket: product.isEcoBasket,
            isCommonPurchase: product.isCommonPurchase,
            commonPurchaseType: product.commonPurchaseType,
            archived: product.archived,
            createdAtMillis: product.createdAtMillis,
            updatedAtMillis: product.updatedAtMillis
        )
    }

    static func upsertPayload(for product: Product) -> [String: Any] {
        [
            "vendorId": product.vendorId,
            "companyName": product.companyName,
            "name": product.name,
            "description": product.description,
            "productImageUrl": firestoreValue(product.productImageUrl),
            "price": product.price,
            "pricingMode": product.pricingMode.rawValue,
            "unitName": product.unitName,
            "unitAbbreviation": firestoreValue(product.unitAbbreviation),
            "unitPlural": product.unitPlural,
            "unitQty": product.unitQty,
            "packContainerName": firestoreValue(product.packContainerName),
            "packContainerAbbreviation": firestoreValue(product.packContainerAbbreviation),
            "packContainerPlural": firestoreValue(product.packContainerPlural),
            "packContainerQty": firestoreValue(product.packContainerQty),
            "isAvailable": product.isAvailable,
            "stockMode": product.stockMode.rawValue,
            "stockQty": firestoreValue(product.stockQty),
            "isEcoBasket": product.isEcoBasket,
            "isCommonPurchase": product.isCommonPurchase,
            "commonPurchaseType": firestoreValue(product.commonPurchaseType?.rawValue),
            "archived": product.archived,
            "createdAt": timestamp(for: product.createdAtMillis),
            "updatedAt": timestamp(for: product.updatedAtMillis),
            "weightStep": firestoreValue(product.weightStep),
            "minWeight": firestoreValue(product.minWeight),
            "maxWeight": firestoreValue(product.maxWeight)
        ]
    }

    private static func timestamp(for millis: Int64) -> Timestamp {
        Timestamp(date: Date(timeIntervalSince1970: TimeInterval(millis) / 1_000))
    }

    private static func firestoreValue<Value>(_ value: Value?) -> Any {
        if let value {
            return value
        }
        return FieldValue.delete()
    }

    private static func sortProducts(_ lhs: Product, _ rhs: Product) -> Bool {
        if lhs.archived != rhs.archived {
            return !lhs.archived && rhs.archived
        }
        return lhs.name.localizedCaseInsensitiveCompare(rhs.name) == .orderedAscending
    }

    private static func products(from documents: [QueryDocumentSnapshot]) throws -> [Product] {
        try documents
            .map { document in
                try product(documentID: document.documentID, data: document.data())
            }
            .sorted(by: sortProducts)
    }

    static func product(documentID: String, data: [String: Any]) throws -> Product {
        let product = Product(
            id: documentID,
            vendorId: try requiredString(data, field: "vendorId"),
            companyName: try requiredString(data, field: "companyName"),
            name: try requiredString(data, field: "name"),
            description: try optionalString(data, field: "description") ?? "",
            productImageUrl: try optionalString(data, field: "productImageUrl"),
            price: try requiredPositiveDouble(data, field: "price"),
            pricingMode: try pricingMode(data),
            unitName: try requiredString(data, field: "unitName"),
            unitAbbreviation: try optionalString(data, field: "unitAbbreviation"),
            unitPlural: try requiredString(data, field: "unitPlural"),
            unitQty: try requiredPositiveDouble(data, field: "unitQty"),
            packContainerName: try optionalString(data, field: "packContainerName"),
            packContainerAbbreviation: try optionalString(data, field: "packContainerAbbreviation"),
            packContainerPlural: try optionalString(data, field: "packContainerPlural"),
            packContainerQty: try optionalPositiveDouble(data, field: "packContainerQty"),
            isAvailable: try optionalBool(data, field: "isAvailable", default: true),
            stockMode: try stockMode(data),
            stockQty: try optionalNonNegativeDouble(data, field: "stockQty"),
            isEcoBasket: try optionalBool(data, field: "isEcoBasket", default: false),
            isCommonPurchase: try optionalBool(data, field: "isCommonPurchase", default: false),
            commonPurchaseType: try commonPurchaseType(data),
            archived: try optionalBool(data, field: "archived", default: false),
            createdAtMillis: try optionalTimestampMillis(data, field: "createdAt"),
            updatedAtMillis: try optionalTimestampMillis(data, field: "updatedAt"),
            weightStep: try optionalPositiveDouble(data, field: "weightStep"),
            minWeight: try optionalPositiveDouble(data, field: "minWeight"),
            maxWeight: try optionalPositiveDouble(data, field: "maxWeight")
        )
        try validateSelectionRange(product)
        return product
    }

    private static func requiredString(_ data: [String: Any], field: String) throws -> String {
        guard let value = try optionalString(data, field: field) else { throw invalidDocumentError }
        return value
    }

    private static func optionalString(_ data: [String: Any], field: String) throws -> String? {
        guard let value = data[field] else { return nil }
        if value is NSNull { return nil }
        guard let string = value as? String else { throw invalidDocumentError }
        let trimmed = string.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }

    private static func requiredDouble(_ data: [String: Any], field: String) throws -> Double {
        guard let value = try optionalDouble(data, field: field) else { throw invalidDocumentError }
        return value
    }

    private static func requiredPositiveDouble(_ data: [String: Any], field: String) throws -> Double {
        let value = try requiredDouble(data, field: field)
        guard value > 0 else { throw invalidDocumentError }
        return value
    }

    private static func optionalDouble(_ data: [String: Any], field: String) throws -> Double? {
        guard let value = data[field] else { return nil }
        if value is NSNull { return nil }
        guard !(value is Bool), let number = value as? NSNumber else { throw invalidDocumentError }
        let double = number.doubleValue
        guard double.isFinite else { throw invalidDocumentError }
        return double
    }

    private static func optionalPositiveDouble(_ data: [String: Any], field: String) throws -> Double? {
        guard let value = try optionalDouble(data, field: field) else { return nil }
        guard value > 0 else { throw invalidDocumentError }
        return value
    }

    private static func optionalNonNegativeDouble(_ data: [String: Any], field: String) throws -> Double? {
        guard let value = try optionalDouble(data, field: field) else { return nil }
        guard value >= 0 else { throw invalidDocumentError }
        return value
    }

    private static func optionalBool(_ data: [String: Any], field: String, default defaultValue: Bool) throws -> Bool {
        guard let value = data[field] else { return defaultValue }
        if value is NSNull { return defaultValue }
        guard let bool = value as? Bool else { throw invalidDocumentError }
        return bool
    }

    private static func optionalTimestampMillis(_ data: [String: Any], field: String) throws -> Int64 {
        guard let value = data[field] else { return 0 }
        if value is NSNull { return 0 }
        guard let timestamp = value as? Timestamp else { throw invalidDocumentError }
        return Int64(timestamp.dateValue().timeIntervalSince1970 * 1_000)
    }

    private static func pricingMode(_ data: [String: Any]) throws -> ProductPricingMode {
        guard let rawValue = try optionalEnumString(data, field: "pricingMode") else { return .fixed }
        guard let value = ProductPricingMode(rawValue: rawValue) else { throw invalidDocumentError }
        return value
    }

    private static func stockMode(_ data: [String: Any]) throws -> ProductStockMode {
        guard let rawValue = try optionalEnumString(data, field: "stockMode") else { return .infinite }
        guard let value = ProductStockMode(rawValue: rawValue) else { throw invalidDocumentError }
        return value
    }

    private static func commonPurchaseType(_ data: [String: Any]) throws -> CommonPurchaseType? {
        guard let rawValue = try optionalString(data, field: "commonPurchaseType") else { return nil }
        guard let value = CommonPurchaseType(rawValue: rawValue) else { throw invalidDocumentError }
        return value
    }

    private static func optionalEnumString(_ data: [String: Any], field: String) throws -> String? {
        guard let value = data[field] else { return nil }
        if value is NSNull { return nil }
        guard let string = value as? String else { throw invalidDocumentError }
        let trimmed = string.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { throw invalidDocumentError }
        return trimmed
    }

    private static func validateSelectionRange(_ product: Product) throws {
        guard product.pricingMode == .weight else { return }
        let step = product.effectiveWeightStep
        let minimumCount = ceil((product.minWeight ?? step) / step)
        guard minimumCount.isFinite,
              minimumCount >= 1,
              minimumCount <= Double(Int32.max) else {
            throw invalidDocumentError
        }
        guard let maxWeight = product.maxWeight else { return }
        let maximumCount = floor(maxWeight / step)
        guard maximumCount.isFinite,
              maximumCount >= minimumCount,
              maximumCount <= Double(Int32.max) else {
            throw invalidDocumentError
        }
    }

    private static var invalidDocumentError: RepositoryError {
        .invalidData(resource: "products.document")
    }
}
