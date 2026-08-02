import Foundation

actor ChainedProductRepository<Primary: ProductRepository, Fallback: ProductRepository>: ProductRepository {
    private let primary: Primary
    private let fallback: Fallback

    init(primary: Primary, fallback: Fallback) {
        self.primary = primary
        self.fallback = fallback
    }

    func allProducts() async throws -> [Product] {
        let primaryProducts = try await primary.allProducts()
        if !primaryProducts.isEmpty {
            return primaryProducts
        }
        return try await fallback.allProducts()
    }

    func products(vendorId: String) async throws -> [Product] {
        let primaryProducts = try await primary.products(vendorId: vendorId)
        if !primaryProducts.isEmpty {
            return primaryProducts
        }
        return try await fallback.products(vendorId: vendorId)
    }

    func upsert(product: Product) async throws -> Product {
        try await primary.upsert(product: product)
    }
}
