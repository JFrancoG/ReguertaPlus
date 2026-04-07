import Foundation

protocol ProductRepository: Sendable {
    func allProducts() async -> [Product]
    func products(vendorId: String) async -> [Product]
    func upsert(product: Product) async -> Product
}
