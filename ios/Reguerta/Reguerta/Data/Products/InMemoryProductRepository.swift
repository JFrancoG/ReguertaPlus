import Foundation

actor InMemoryProductRepository: ProductRepository {
    private var productsById: [String: Product]

    init(items: [Product] = []) {
        self.productsById = Dictionary(uniqueKeysWithValues: items.map { ($0.id, $0) })
    }

    func allProducts() async -> [Product] {
        productsById.values.sorted {
            if $0.archived != $1.archived {
                return !$0.archived && $1.archived
            }
            return $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending
        }
    }

    func products(vendorId: String) async -> [Product] {
        productsById.values
            .filter { $0.vendorId == vendorId }
            .sorted {
                if $0.archived != $1.archived {
                    return !$0.archived && $1.archived
                }
                return $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending
            }
    }

    func upsert(product: Product) async -> Product {
        productsById[product.id] = product
        return product
    }
}
