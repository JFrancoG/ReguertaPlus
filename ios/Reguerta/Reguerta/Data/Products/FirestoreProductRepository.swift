import FirebaseFirestore
import Foundation

final class FirestoreProductRepository: @unchecked Sendable, ProductRepository {
    private let db: Firestore
    private let environment: ReguertaFirestoreEnvironment?

    init(
        db: Firestore = Firestore.firestore(),
        environment: ReguertaFirestoreEnvironment? = nil
    ) {
        self.db = db
        self.environment = environment
    }

    private var productsCollection: CollectionReference {
        db.reguertaCollection(.products, environment: environment)
    }

    func allProducts() async -> [Product] {
        do {
            let snapshot = try await productsCollection.getDocuments()
            return snapshot.documents
                .compactMap(Self.toProduct)
                .sorted(by: Self.sortProducts)
        } catch {
            return []
        }
    }

    func products(vendorId: String) async -> [Product] {
        do {
            let snapshot = try await productsCollection
                .whereField("vendorId", isEqualTo: vendorId)
                .getDocuments()
            return snapshot.documents
                .compactMap(Self.toProduct)
                .sorted(by: Self.sortProducts)
        } catch {
            return []
        }
    }

    func upsert(product: Product) async -> Product {
        let documentId = product.id.isEmpty ? productsCollection.document().documentID : product.id
        let persisted = persistedProduct(from: product, with: documentId)

        do {
            try await productsCollection.document(documentId).setData(
                upsertPayload(for: persisted),
                merge: true
            )
            return persisted
        } catch {
            return persisted
        }
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

    private func upsertPayload(for product: Product) -> [String: Any] {
        [
            "vendorId": product.vendorId,
            "companyName": product.companyName,
            "name": product.name,
            "description": product.description,
            "productImageUrl": product.productImageUrl as Any,
            "price": product.price,
            "pricingMode": product.pricingMode.rawValue,
            "unitName": product.unitName,
            "unitAbbreviation": product.unitAbbreviation as Any,
            "unitPlural": product.unitPlural,
            "unitQty": product.unitQty,
            "packContainerName": product.packContainerName as Any,
            "packContainerAbbreviation": product.packContainerAbbreviation as Any,
            "packContainerPlural": product.packContainerPlural as Any,
            "packContainerQty": product.packContainerQty as Any,
            "isAvailable": product.isAvailable,
            "stockMode": product.stockMode.rawValue,
            "stockQty": product.stockQty as Any,
            "isEcoBasket": product.isEcoBasket,
            "isCommonPurchase": product.isCommonPurchase,
            "commonPurchaseType": product.commonPurchaseType?.rawValue as Any,
            "archived": product.archived,
            "createdAt": timestamp(for: product.createdAtMillis),
            "updatedAt": timestamp(for: product.updatedAtMillis),
        ]
    }

    private func timestamp(for millis: Int64) -> Timestamp {
        Timestamp(date: Date(timeIntervalSince1970: TimeInterval(millis) / 1_000))
    }

    private static func sortProducts(_ lhs: Product, _ rhs: Product) -> Bool {
        if lhs.archived != rhs.archived {
            return !lhs.archived && rhs.archived
        }
        return lhs.name.localizedCaseInsensitiveCompare(rhs.name) == .orderedAscending
    }

    private static func toProduct(_ document: QueryDocumentSnapshot) -> Product? {
        let data = document.data()
        guard let vendorId = normalizedString(data["vendorId"]),
              let companyName = normalizedString(data["companyName"]),
              let name = normalizedString(data["name"]),
              let price = data["price"] as? Double,
              let unitName = normalizedString(data["unitName"]),
              let unitPlural = normalizedString(data["unitPlural"]),
              let unitQty = data["unitQty"] as? Double else {
            return nil
        }

        let createdAtMillis = ((data["createdAt"] as? Timestamp)?.dateValue().timeIntervalSince1970 ?? 0) * 1_000
        let updatedAtMillis = ((data["updatedAt"] as? Timestamp)?.dateValue().timeIntervalSince1970 ?? 0) * 1_000

        return Product(
            id: document.documentID,
            vendorId: vendorId,
            companyName: companyName,
            name: name,
            description: normalizedString(data["description"]) ?? "",
            productImageUrl: normalizedString(data["productImageUrl"]),
            price: price,
            pricingMode: ProductPricingMode(rawValue: normalizedString(data["pricingMode"]) ?? "fixed") ?? .fixed,
            unitName: unitName,
            unitAbbreviation: normalizedString(data["unitAbbreviation"]),
            unitPlural: unitPlural,
            unitQty: unitQty,
            packContainerName: normalizedString(data["packContainerName"]),
            packContainerAbbreviation: normalizedString(data["packContainerAbbreviation"]),
            packContainerPlural: normalizedString(data["packContainerPlural"]),
            packContainerQty: data["packContainerQty"] as? Double,
            isAvailable: (data["isAvailable"] as? Bool) ?? true,
            stockMode: ProductStockMode(rawValue: normalizedString(data["stockMode"]) ?? "infinite") ?? .infinite,
            stockQty: data["stockQty"] as? Double,
            isEcoBasket: (data["isEcoBasket"] as? Bool) ?? false,
            isCommonPurchase: (data["isCommonPurchase"] as? Bool) ?? false,
            commonPurchaseType: normalizedString(data["commonPurchaseType"]).flatMap(CommonPurchaseType.init(rawValue:)),
            archived: (data["archived"] as? Bool) ?? false,
            createdAtMillis: Int64(createdAtMillis),
            updatedAtMillis: Int64(updatedAtMillis)
        )
    }

    private static func normalizedString(_ value: Any?) -> String? {
        guard let string = value as? String else { return nil }
        let trimmed = string.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }
}
