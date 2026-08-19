import Foundation

protocol ProductRepository: Sendable {
    func allProducts(environment: SessionEnvironment) async throws -> [Product]
    func products(vendorId: String, environment: SessionEnvironment) async throws -> [Product]
    func upsert(product: Product, environment: SessionEnvironment) async throws -> Product
}
