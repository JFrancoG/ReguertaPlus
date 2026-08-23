import Foundation
import Synchronization

@testable import Reguerta

enum ProductUploadInvalidationScenario: CaseIterable {
    case clearEditor
    case signedOutReset
    case identityAndEnvironmentChange
}

enum ProductUnsynchronizedSessionScenario: CaseIterable {
    case environmentSuccessor
    case sameSessionRelogin
}

final class RecordingProductsMutationRepository: ProductRepository, Sendable {
    private struct State {
        var products: [Product] = []
        var environments: [SessionEnvironment] = []
    }

    private let state = Mutex(State())

    var upsertCount: Int {
        state.withLock { $0.products.count }
    }

    var upsertEnvironments: [SessionEnvironment] {
        state.withLock { $0.environments }
    }

    func allProducts(environment _: SessionEnvironment) async -> [Product] { [] }
    func products(vendorId _: String, environment _: SessionEnvironment) async -> [Product] { [] }

    func upsert(product: Product, environment: SessionEnvironment) async throws -> Product {
        state.withLock { state in
            state.products.append(product)
            state.environments.append(environment)
        }
        return product
    }
}

final class ControlledProductsImagePipelineManager: ImagePipelineManager, Sendable {
    private struct State {
        var uploadCount = 0
        var cancellationCount = 0
    }

    private let firstUpload = SessionRevisionOperation()
    private let state = Mutex(State())
    let successorURL = "https://cdn.reguerta.test/successor.jpg"

    var uploadCount: Int {
        state.withLock { $0.uploadCount }
    }

    var cancellationCount: Int {
        state.withLock { $0.cancellationCount }
    }

    func processAndUpload(imageData _: Data, request _: ImageUploadRequest) async throws -> ImageUploadResult {
        let index = state.withLock { state in
            defer { state.uploadCount += 1 }
            return state.uploadCount
        }
        if index == 0 {
            do {
                try await firstUpload.suspend()
            } catch is CancellationError {
                state.withLock { $0.cancellationCount += 1 }
                throw CancellationError()
            }
        }
        return ImageUploadResult(
            downloadURL: index == 0 ? "https://cdn.reguerta.test/predecessor.jpg" : successorURL,
            widthPx: 1,
            heightPx: 1,
            byteSize: 1,
            mimeType: "image/jpeg"
        )
    }

    func waitUntilFirstUploadStarts() async throws {
        try await firstUpload.waitUntilStarted()
    }

    func completeFirstUpload() {
        firstUpload.complete()
    }

    func cancelAll() {
        firstUpload.cancelAll()
    }
}

final class ControlledProductsVisibilityMemberRepository: MemberRepository, Sendable {
    private struct State {
        var nextMutationIndex = 0
        var mutationEnvironments: [SessionEnvironment] = []
    }

    private let mutations = [SessionRevisionOperation(), SessionRevisionOperation()]
    private let state = Mutex(State())

    var mutationEnvironments: [SessionEnvironment] {
        state.withLock { $0.mutationEnvironments }
    }

    func member(id _: String, environment _: SessionEnvironment) async -> Member? {
        nil
    }

    func members(visibleTo member: Member, environment _: SessionEnvironment) async -> [Member] {
        [member]
    }

    func updateOwnProducerCatalogEnabled(
        member: Member,
        enabled: Bool,
        environment: SessionEnvironment
    ) async throws -> Member {
        let index = state.withLock { state in
            defer { state.nextMutationIndex += 1 }
            state.mutationEnvironments.append(environment)
            return state.nextMutationIndex
        }
        guard mutations.indices.contains(index) else { return member.copy(producerCatalogEnabled: enabled) }
        try await mutations[index].suspend()
        return member.copy(producerCatalogEnabled: enabled)
    }

    func waitUntilMutationStarts(_ index: Int) async throws {
        try await mutations[index].waitUntilStarted()
    }

    func completeMutation(_ index: Int) {
        mutations[index].complete()
    }

    func cancelAll() {
        mutations.forEach { $0.cancelAll() }
    }
}

@MainActor
func productsAuthorizedSession(member: Member, environment: SessionEnvironment) -> AuthorizedSession {
    AuthorizedSession(
        principal: AuthPrincipal(uid: member.authUid ?? "", email: member.normalizedEmail),
        authenticatedMember: member,
        member: member,
        members: [member],
        environment: environment
    )
}
