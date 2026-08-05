import Foundation

@testable import Reguerta

@MainActor
final class ConfirmingVisibilityMemberRepository: MemberRepository {
    private let memberValue: Member

    init(member: Member) {
        memberValue = member
    }

    func member(id: String) async -> Member? {
        id == memberValue.id ? memberValue : nil
    }

    func members(visibleTo _: Member) async throws -> [Member] {
        throw ProductReadTestError.rejected
    }

    func updateOwnProducerCatalogEnabled(member: Member, enabled: Bool) async -> Member {
        member.copy(producerCatalogEnabled: enabled)
    }
}

@MainActor
final class SuspendedProductRepository: ProductRepository {
    private var continuation: CheckedContinuation<Product, Never>?
    private var submittedProduct: Product?
    private(set) var writeCount = 0

    func allProducts() async -> [Product] { [] }

    func products(vendorId _: String) async -> [Product] { [] }

    func upsert(product: Product) async -> Product {
        writeCount += 1
        submittedProduct = product
        return await withCheckedContinuation { continuation in
            self.continuation = continuation
        }
    }

    func waitUntilWriteStarts() async {
        while continuation == nil {
            await Task.yield()
        }
    }

    func completeWrite() {
        guard let submittedProduct, let continuation else { return }
        self.continuation = nil
        continuation.resume(returning: submittedProduct)
    }
}

@MainActor
final class MultiSuspendedProductRepository: ProductRepository {
    private var continuations: [CheckedContinuation<Product, Never>?] = []
    private var submittedProducts: [Product] = []

    func allProducts() async -> [Product] { [] }

    func products(vendorId _: String) async -> [Product] { [] }

    func upsert(product: Product) async -> Product {
        let index = submittedProducts.count
        submittedProducts.append(product)
        continuations.append(nil)
        return await withCheckedContinuation { continuation in
            continuations[index] = continuation
        }
    }

    func waitUntilWriteCount(_ expectedCount: Int) async {
        while submittedProducts.count < expectedCount || continuations[expectedCount - 1] == nil {
            await Task.yield()
        }
    }

    func completeWrite(at index: Int) {
        guard submittedProducts.indices.contains(index),
              continuations.indices.contains(index),
              let continuation = continuations[index] else { return }
        continuations[index] = nil
        continuation.resume(returning: submittedProducts[index])
    }
}

actor SuspendedImagePipelineManager: ImagePipelineManager {
    private var continuation: CheckedContinuation<ImageUploadResult, Never>?
    private(set) var uploadCount = 0

    func processAndUpload(imageData _: Data, request _: ImageUploadRequest) async throws -> ImageUploadResult {
        uploadCount += 1
        return await withCheckedContinuation { continuation in
            self.continuation = continuation
        }
    }

    func waitUntilUploadStarts() async {
        while continuation == nil {
            await Task.yield()
        }
    }

    func completeUpload(downloadURL: String) {
        guard let continuation else { return }
        self.continuation = nil
        continuation.resume(
            returning: ImageUploadResult(
                downloadURL: downloadURL,
                widthPx: 1,
                heightPx: 1,
                byteSize: 1,
                mimeType: "image/jpeg"
            )
        )
    }
}

@MainActor
final class ControlledProductRepository: ProductRepository {
    private var itemsById: [String: Product]
    private let rejectsReads: Bool
    private(set) var readCount = 0
    private(set) var writeCount = 0

    init(items: [Product], rejectsReads: Bool) {
        itemsById = Dictionary(uniqueKeysWithValues: items.map { ($0.id, $0) })
        self.rejectsReads = rejectsReads
    }

    func allProducts() async throws -> [Product] {
        readCount += 1
        try rejectReadIfNeeded()
        return Array(itemsById.values)
    }

    func products(vendorId: String) async throws -> [Product] {
        readCount += 1
        try rejectReadIfNeeded()
        return itemsById.values.filter { $0.vendorId == vendorId }
    }

    func upsert(product: Product) async -> Product {
        writeCount += 1
        itemsById[product.id] = product
        return product
    }

    private func rejectReadIfNeeded() throws {
        if rejectsReads {
            throw ProductReadTestError.rejected
        }
    }
}

@MainActor
final class RejectingSeasonalCommitmentRepository: SeasonalCommitmentRepository {
    func activeCommitments(userId _: String) async throws -> [SeasonalCommitment] {
        throw ProductReadTestError.rejected
    }
}

enum ProductReadTestError: Error {
    case rejected
}

@MainActor
final class AmbiguousCreateProductRepository: ProductRepository {
    private var itemsById: [String: Product] = [:]
    private(set) var attemptedProductIds: [String] = []

    var storedProductCount: Int {
        itemsById.count
    }

    func allProducts() async -> [Product] {
        Array(itemsById.values)
    }

    func products(vendorId: String) async -> [Product] {
        itemsById.values.filter { $0.vendorId == vendorId }
    }

    func upsert(product: Product) async throws -> Product {
        attemptedProductIds.append(product.id)
        itemsById[product.id] = product
        if attemptedProductIds.count == 1 {
            throw ProductReadTestError.rejected
        }
        return product
    }
}

@MainActor
final class CancellingProductRepository: ProductRepository {
    func allProducts() async throws -> [Product] {
        throw CancellationError()
    }

    func products(vendorId _: String) async throws -> [Product] {
        throw CancellationError()
    }

    func upsert(product: Product) async -> Product {
        product
    }
}
