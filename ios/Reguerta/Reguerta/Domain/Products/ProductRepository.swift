import Foundation

protocol ProductRepository: Sendable {
    func allProducts() async throws -> [Product]
    func products(vendorId: String) async throws -> [Product]
    func upsert(product: Product) async throws -> Product
}
