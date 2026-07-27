import Foundation

actor ChainedProductRepository: ProductRepository {
    private let primary: any ProductRepository
    private let fallback: any ProductRepository

    init(primary: any ProductRepository, fallback: any ProductRepository) {
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
