import Foundation

actor ChainedProductRepository: ProductRepository {
    private let primary: any ProductRepository
    private let fallback: any ProductRepository

    init(primary: any ProductRepository, fallback: any ProductRepository) {
        self.primary = primary
        self.fallback = fallback
    }

    func allProducts() async -> [Product] {
        let primaryProducts = await primary.allProducts()
        if !primaryProducts.isEmpty {
            return primaryProducts
        }
        return await fallback.allProducts()
    }

    func products(vendorId: String) async -> [Product] {
        let primaryProducts = await primary.products(vendorId: vendorId)
        if !primaryProducts.isEmpty {
            return primaryProducts
        }
        return await fallback.products(vendorId: vendorId)
    }

    func upsert(product: Product) async -> Product {
        _ = await fallback.upsert(product: product)
        return await primary.upsert(product: product)
    }
}
