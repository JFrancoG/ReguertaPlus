import Foundation
import Synchronization

@testable import Reguerta

final class SessionRevisionOperation: Sendable {
    private let started = SessionRevisionTestGate()
    private let release = SessionRevisionTestGate()

    func suspend() async throws {
        started.open()
        try await release.wait()
    }

    func waitUntilStarted() async throws {
        try await started.wait()
    }

    func complete() {
        release.open()
    }

    func cancelAll() {
        started.cancelAll()
        release.cancelAll()
    }
}

final class SessionRevisionProductRepository: ProductRepository, Sendable {
    let operation = SessionRevisionOperation()

    func allProducts(environment _: SessionEnvironment) async -> [Product] { [] }
    func products(vendorId _: String, environment _: SessionEnvironment) async -> [Product] { [] }

    func upsert(product: Product, environment _: SessionEnvironment) async throws -> Product {
        try await operation.suspend()
        return product
    }

    func waitUntilSaveStarts() async throws { try await operation.waitUntilStarted() }
    func completeSave() { operation.complete() }
    func cancelAll() { operation.cancelAll() }
}

final class SessionRevisionProductReadRepository: ProductRepository, Sendable {
    private let catalogReadOperations = [SessionRevisionOperation(), SessionRevisionOperation()]
    private let orderingReadOperations = [SessionRevisionOperation(), SessionRevisionOperation()]
    private let nextCatalogReadIndex = Mutex(0)
    private let nextOrderingReadIndex = Mutex(0)

    func allProducts(environment _: SessionEnvironment) async throws -> [Product] {
        let index = nextOrderingReadIndex.withLock { index in
            defer { index += 1 }
            return index
        }
        guard orderingReadOperations.indices.contains(index) else { return [] }
        try await orderingReadOperations[index].suspend()
        return []
    }

    func products(vendorId _: String, environment _: SessionEnvironment) async throws -> [Product] {
        let index = nextCatalogReadIndex.withLock { index in
            defer { index += 1 }
            return index
        }
        guard catalogReadOperations.indices.contains(index) else { return [] }
        try await catalogReadOperations[index].suspend()
        return []
    }

    func upsert(product: Product, environment _: SessionEnvironment) async throws -> Product { product }

    func waitUntilCatalogReadStarts(_ index: Int = 0) async throws {
        try await catalogReadOperations[index].waitUntilStarted()
    }

    func waitUntilOrderingReadStarts(_ index: Int = 0) async throws {
        try await orderingReadOperations[index].waitUntilStarted()
    }

    func completeCatalogRead(_ index: Int = 0) { catalogReadOperations[index].complete() }
    func completeOrderingRead(_ index: Int = 0) { orderingReadOperations[index].complete() }

    func cancelAll() {
        catalogReadOperations.forEach { $0.cancelAll() }
        orderingReadOperations.forEach { $0.cancelAll() }
    }
}

final class SessionRevisionShiftReadRepository: ShiftRepository, Sendable {
    private let readOperations = [SessionRevisionOperation(), SessionRevisionOperation()]
    private let nextReadIndex = Mutex(0)

    func allShifts(environment _: SessionEnvironment) async throws -> [ShiftAssignment] {
        let index = nextReadIndex.withLock { index in
            defer { index += 1 }
            return index
        }
        guard readOperations.indices.contains(index) else { return [] }
        try await readOperations[index].suspend()
        return []
    }

    func waitUntilReadStarts(_ index: Int = 0) async throws {
        try await readOperations[index].waitUntilStarted()
    }

    func completeRead(_ index: Int = 0) { readOperations[index].complete() }
    func cancelAll() { readOperations.forEach { $0.cancelAll() } }
}

final class SessionRevisionCalendarReadRepository: DeliveryCalendarRepository, Sendable {
    private let readOperation = SessionRevisionOperation()

    func defaultDeliveryDayOfWeek(environment _: SessionEnvironment) async throws -> DeliveryWeekday {
        try await readOperation.suspend()
        return .wednesday
    }

    func allOverrides(environment _: SessionEnvironment) async throws -> [DeliveryCalendarOverride] { [] }

    func upsertOverride(
        _ override: DeliveryCalendarOverride,
        environment _: SessionEnvironment
    ) async throws -> DeliveryCalendarOverride {
        override
    }

    func deleteOverride(weekKey _: String, environment _: SessionEnvironment) async throws {}

    func waitUntilReadStarts() async throws { try await readOperation.waitUntilStarted() }
    func completeRead() { readOperation.complete() }
    func cancelAll() { readOperation.cancelAll() }
}

actor EntryCountingDeliveryCalendarRepository: DeliveryCalendarRepository {
    private var reads = 0

    func defaultDeliveryDayOfWeek(environment _: SessionEnvironment) async throws -> DeliveryWeekday {
        reads += 1
        return .wednesday
    }

    func allOverrides(environment _: SessionEnvironment) async throws -> [DeliveryCalendarOverride] {
        reads += 1
        return []
    }

    func upsertOverride(
        _ override: DeliveryCalendarOverride,
        environment _: SessionEnvironment
    ) async throws -> DeliveryCalendarOverride {
        override
    }

    func deleteOverride(weekKey _: String, environment _: SessionEnvironment) async throws {}
    func readCount() -> Int { reads }
}

final class SessionRevisionPlanningRepository: ShiftPlanningRequestRepository, Sendable {
    let operation = SessionRevisionOperation()

    func submit(request: ShiftPlanningRequest, environment _: SessionEnvironment) async throws -> ShiftPlanningRequest {
        try await operation.suspend()
        return request
    }

    func waitUntilSubmissionStarts() async throws { try await operation.waitUntilStarted() }
    func completeSubmission() { operation.complete() }
    func cancelAll() { operation.cancelAll() }
}

private final class SessionRevisionTestGate: Sendable {
    private enum WaitRegistration {
        case suspended
        case opened
        case cancelled
    }

    private struct State {
        var isOpen = false
        var isCancelled = false
        var waiters: [UUID: CheckedContinuation<Void, any Error>] = [:]
    }

    private let state = Mutex(State())

    func wait() async throws {
        let waiterID = UUID()
        try await withTaskCancellationHandler {
            try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, any Error>) in
                let registration = state.withLock { state -> WaitRegistration in
                    guard !Task.isCancelled, !state.isCancelled else { return .cancelled }
                    guard !state.isOpen else { return .opened }
                    state.waiters[waiterID] = continuation
                    return .suspended
                }
                switch registration {
                case .suspended:
                    break
                case .opened:
                    continuation.resume()
                case .cancelled:
                    continuation.resume(throwing: CancellationError())
                }
            }
        } onCancel: {
            self.cancel(waiterID)
        }
    }

    func open() {
        let waiters = state.withLock { state in
            state.isOpen = true
            let waiters = Array(state.waiters.values)
            state.waiters.removeAll()
            return waiters
        }
        waiters.forEach { $0.resume() }
    }

    func cancelAll() {
        let waiters = state.withLock { state in
            state.isCancelled = true
            let waiters = Array(state.waiters.values)
            state.waiters.removeAll()
            return waiters
        }
        waiters.forEach { $0.resume(throwing: CancellationError()) }
    }

    private func cancel(_ waiterID: UUID) {
        let continuation = state.withLock { $0.waiters.removeValue(forKey: waiterID) }
        continuation?.resume(throwing: CancellationError())
    }
}

func replacingRoles(in member: Member, with roles: Set<MemberRole>) -> Member {
    replacingMember(member, displayName: member.displayName, roles: roles)
}

func replacingDisplayName(in member: Member, with displayName: String) -> Member {
    replacingMember(member, displayName: displayName, roles: member.roles)
}

private func replacingMember(_ member: Member, displayName: String, roles: Set<MemberRole>) -> Member {
    Member(
        id: member.id,
        displayName: displayName,
        companyName: member.companyName,
        phoneNumber: member.phoneNumber,
        normalizedEmail: member.normalizedEmail,
        authUid: member.authUid,
        roles: roles,
        isActive: member.isActive,
        producerCatalogEnabled: member.producerCatalogEnabled,
        isCommonPurchaseManager: member.isCommonPurchaseManager,
        producerParity: member.producerParity,
        ecoCommitmentMode: member.ecoCommitmentMode,
        ecoCommitmentParity: member.ecoCommitmentParity
    )
}
