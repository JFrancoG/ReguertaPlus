import Foundation
import Synchronization
import Testing

@testable import Reguerta

struct AuthorizedDeviceRegistrationOwnershipScenario {
    let member: Member
    let principal: AuthPrincipal
    let provider: ControlledSessionAuthProvider
    let sleeper: ControlledSessionOperationSleeper
    let registrar: ControlledAuthorizedDeviceRegistrationRegistrar
    let viewModel: SessionViewModel
}

@MainActor
func makeAuthorizedDeviceRegistrationOwnershipScenario(
    isAuthenticated: Bool = false,
    registrar: ControlledAuthorizedDeviceRegistrationRegistrar = ControlledAuthorizedDeviceRegistrationRegistrar()
) -> AuthorizedDeviceRegistrationOwnershipScenario {
    let member = authorizedDeviceRegistrationOwnershipMember()
    let principal = AuthPrincipal(uid: member.authUid ?? "", email: member.normalizedEmail)
    let provider = ControlledSessionAuthProvider(isAuthenticated: isAuthenticated)
    let sleeper = ControlledSessionOperationSleeper()
    let repository = DeviceRegistrationOwnershipMemberRepository(member: member)
    let environmentRouter = FixedSessionEnvironmentRouter()
    let viewModel = SessionViewModel(
        repository: repository,
        authSessionProvider: provider,
        resolveAuthorizedSession: ResolveAuthorizedSessionUseCase(
            repository: repository,
            resolver: DeviceRegistrationOwnershipMemberResolver(member: member)
        ),
        authorizedDeviceRegistrar: registrar,
        environmentRouter: environmentRouter,
        sessionRefreshPolicy: SessionRefreshPolicy(minimumForegroundIntervalMillis: 0),
        nowMillisProvider: { 1_000 },
        sessionOperationTimeout: .seconds(30),
        sessionOperationSleeper: { try await sleeper.sleep(for: $0) }
    )
    return AuthorizedDeviceRegistrationOwnershipScenario(
        member: member,
        principal: principal,
        provider: provider,
        sleeper: sleeper,
        registrar: registrar,
        viewModel: viewModel
    )
}

@MainActor
func authorizeDeviceRegistrationOwnershipScenario(_ scenario: AuthorizedDeviceRegistrationOwnershipScenario) async {
    await scenario.viewModel.applyAuthorizedSession(principal: scenario.principal)
}

@MainActor
private func authorizedDeviceRegistrationOwnershipMember() -> Member {
    Member(
        id: "device_registration_member",
        displayName: "Device Registration Member",
        normalizedEmail: "device-registration@example.com",
        authUid: "device_registration_auth",
        roles: [.member],
        isActive: true,
        producerCatalogEnabled: true
    )
}

func replacingDeviceRegistrationOwnershipActiveState(in member: Member, isActive: Bool) -> Member {
    Member(
        id: member.id,
        displayName: member.displayName,
        companyName: member.companyName,
        phoneNumber: member.phoneNumber,
        normalizedEmail: member.normalizedEmail,
        authUid: member.authUid,
        roles: member.roles,
        isActive: isActive,
        producerCatalogEnabled: member.producerCatalogEnabled,
        isCommonPurchaseManager: member.isCommonPurchaseManager,
        producerParity: member.producerParity,
        ecoCommitmentMode: member.ecoCommitmentMode,
        ecoCommitmentParity: member.ecoCommitmentParity
    )
}

func replacingDeviceRegistrationOwnershipID(in member: Member, id: String) -> Member {
    Member(
        id: id,
        displayName: member.displayName,
        companyName: member.companyName,
        phoneNumber: member.phoneNumber,
        normalizedEmail: member.normalizedEmail,
        authUid: member.authUid,
        roles: member.roles,
        isActive: member.isActive,
        producerCatalogEnabled: member.producerCatalogEnabled,
        isCommonPurchaseManager: member.isCommonPurchaseManager,
        producerParity: member.producerParity,
        ecoCommitmentMode: member.ecoCommitmentMode,
        ecoCommitmentParity: member.ecoCommitmentParity
    )
}

private struct DeviceRegistrationOwnershipMemberResolver: AuthorizedMemberResolving {
    let member: Member

    func resolve(
        authPrincipal _: AuthPrincipal,
        requestedEnvironment: SessionEnvironment
    ) async throws -> AuthorizedMemberResolution {
        AuthorizedMemberResolution(
            memberId: member.id,
            roles: member.roles,
            isActive: member.isActive,
            environment: requestedEnvironment,
            firstLoginLinked: false
        )
    }
}

private struct DeviceRegistrationOwnershipMemberRepository: MemberRepository {
    let member: Member

    func member(id: String, environment _: SessionEnvironment) async throws -> Member? {
        id == member.id ? member : nil
    }

    func members(visibleTo _: Member, environment _: SessionEnvironment) async throws -> [Member] {
        [member]
    }

    func updateOwnProducerCatalogEnabled(
        member _: Member,
        enabled _: Bool,
        environment _: SessionEnvironment
    ) async throws -> Member {
        member
    }
}

final class ControlledAuthorizedDeviceRegistrationRegistrar: AuthorizedDeviceRegistrar, Sendable {
    typealias SessionFence = @MainActor @Sendable () -> Bool

    private struct RegistrationRequest {
        let command: AuthorizedDeviceRegistrationCommand
        let sessionFence: SessionFence
        var cancellationObserved = false
    }

    private struct ClearRequest {
        let lease: AuthorizedDeviceSessionLease
        let cancellationObservedBeforeEntry: Bool
        var sessionWasCurrentAtEntry: Bool?
    }

    private struct State {
        var registrationRequests: [RegistrationRequest] = []
        var clearRequests: [ClearRequest] = []
    }

    private let state = Mutex(State())
    private let registrationStarts = AuthorizedDeviceRegistrationEventCounter()
    private let registrationReturns = AuthorizedDeviceRegistrationEventCounter()
    private let registrationGate = AuthorizedDeviceRegistrationIndexedGate()
    private let clearStarts = AuthorizedDeviceRegistrationEventCounter()
    private let clearGate = AuthorizedDeviceRegistrationIndexedGate()

    func register(
        command: AuthorizedDeviceRegistrationCommand,
        isSessionCurrent: @escaping SessionFence
    ) async throws -> AuthorizedDeviceRegistrationResult {
        let requestIndex = state.withLock { state in
            let requestIndex = state.registrationRequests.count
            state.registrationRequests.append(
                RegistrationRequest(command: command, sessionFence: isSessionCurrent)
            )
            return requestIndex
        }
        registrationStarts.recordEvent()
        try await withTaskCancellationHandler {
            try await registrationGate.wait(for: requestIndex, ignoringTaskCancellation: true)
        } onCancel: {
            self.state.withLock { state in
                guard state.registrationRequests.indices.contains(requestIndex) else { return }
                state.registrationRequests[requestIndex].cancellationObserved = true
            }
        }
        registrationReturns.recordEvent()
        return .registered
    }

    func updateRegistrationToken(_ token: String?) async throws {}

    func clearAuthorization(ifOwnedBy lease: AuthorizedDeviceSessionLease) async throws {
        let clearSnapshot = state.withLock { state -> (index: Int, fence: SessionFence?) in
            let registration = state.registrationRequests.last { $0.command.lease == lease }
            let clearIndex = state.clearRequests.count
            state.clearRequests.append(
                ClearRequest(
                    lease: lease,
                    cancellationObservedBeforeEntry: registration?.cancellationObserved == true
                )
            )
            return (clearIndex, registration?.sessionFence)
        }
        let sessionWasCurrent = await clearSnapshot.fence?() ?? false
        state.withLock { state in
            guard state.clearRequests.indices.contains(clearSnapshot.index) else { return }
            state.clearRequests[clearSnapshot.index].sessionWasCurrentAtEntry = sessionWasCurrent
        }
        clearStarts.recordEvent()
        try await clearGate.wait(for: clearSnapshot.index)
    }

    func waitForRegistrationCount(_ count: Int) async throws {
        try await registrationStarts.waitForEventCount(count)
    }

    func waitForRegistrationReturnCount(_ count: Int) async throws {
        try await registrationReturns.waitForEventCount(count)
    }

    func releaseRegistration(at index: Int) {
        registrationGate.open(index)
    }

    func waitForClearCount(_ count: Int) async throws {
        try await clearStarts.waitForEventCount(count)
    }

    func releaseClear(at index: Int) {
        clearGate.open(index)
    }

    func isSessionCurrent(forRegistrationAt index: Int) async -> Bool {
        guard let sessionFence = state.withLock({ state -> SessionFence? in
            guard state.registrationRequests.indices.contains(index) else { return nil }
            return state.registrationRequests[index].sessionFence
        }) else {
            Issue.record("No existe el registro autorizado \(index)")
            return false
        }
        return await sessionFence()
    }

    func cancellationWasObservedBeforeClear(at index: Int) -> Bool {
        guard let cancellationWasObserved = state.withLock({ state -> Bool? in
            guard state.clearRequests.indices.contains(index) else { return nil }
            return state.clearRequests[index].cancellationObservedBeforeEntry
        }) else {
            Issue.record("No existe el cleanup autorizado \(index)")
            return false
        }
        return cancellationWasObserved
    }

    func sessionWasCurrentAtClearEntry(at index: Int) -> Bool? {
        state.withLock { state in
            guard state.clearRequests.indices.contains(index) else {
                Issue.record("No existe el cleanup autorizado \(index)")
                return nil
            }
            return state.clearRequests[index].sessionWasCurrentAtEntry
        }
    }

    func cancelAll() {
        registrationStarts.cancelAll()
        registrationReturns.cancelAll()
        registrationGate.cancelAll()
        clearStarts.cancelAll()
        clearGate.cancelAll()
    }
}

private final class AuthorizedDeviceRegistrationEventCounter: Sendable {
    private enum WaitRegistration {
        case satisfied
        case suspended
        case cancelled
    }

    private struct Waiter {
        let expectedCount: Int
        let continuation: CheckedContinuation<Void, any Error>
    }

    private struct State {
        var eventCount = 0
        var isCancelled = false
        var waiters: [UUID: Waiter] = [:]
    }

    private let state = Mutex(State())

    func recordEvent() {
        let satisfiedWaiters = state.withLock { state in
            state.eventCount += 1
            let satisfiedWaiterIDs = state.waiters.compactMap { waiterID, waiter in
                waiter.expectedCount <= state.eventCount ? waiterID : nil
            }
            return satisfiedWaiterIDs.compactMap { state.waiters.removeValue(forKey: $0)?.continuation }
        }
        satisfiedWaiters.forEach { $0.resume() }
    }

    func waitForEventCount(_ expectedCount: Int) async throws {
        let waiterID = UUID()
        try await withTaskCancellationHandler {
            try await withCheckedThrowingContinuation { continuation in
                let registration = state.withLock { state -> WaitRegistration in
                    guard !Task.isCancelled, !state.isCancelled else { return .cancelled }
                    guard state.eventCount < expectedCount else { return .satisfied }
                    state.waiters[waiterID] = Waiter(
                        expectedCount: expectedCount,
                        continuation: continuation
                    )
                    return .suspended
                }
                switch registration {
                case .satisfied:
                    continuation.resume()
                case .suspended:
                    break
                case .cancelled:
                    continuation.resume(throwing: CancellationError())
                }
            }
        } onCancel: {
            self.cancel(waiterID)
        }
    }

    func cancelAll() {
        let waiters = state.withLock { state in
            state.isCancelled = true
            let waiters = state.waiters.values.map(\.continuation)
            state.waiters.removeAll()
            return waiters
        }
        waiters.forEach { $0.resume(throwing: CancellationError()) }
    }

    private func cancel(_ waiterID: UUID) {
        let continuation = state.withLock { $0.waiters.removeValue(forKey: waiterID)?.continuation }
        continuation?.resume(throwing: CancellationError())
    }
}

private final class AuthorizedDeviceRegistrationIndexedGate: Sendable {
    private enum WaitRegistration {
        case opened
        case suspended
        case cancelled
    }

    private struct Waiter {
        let index: Int
        let continuation: CheckedContinuation<Void, any Error>
    }

    private struct State {
        var openIndexes: Set<Int> = []
        var isCancelled = false
        var waiters: [UUID: Waiter] = [:]
    }

    private let state = Mutex(State())

    func wait(for index: Int, ignoringTaskCancellation: Bool = false) async throws {
        let waiterID = UUID()
        try await withTaskCancellationHandler {
            try await withCheckedThrowingContinuation { continuation in
                let registration = state.withLock { state -> WaitRegistration in
                    guard !state.isCancelled,
                          ignoringTaskCancellation || !Task.isCancelled else { return .cancelled }
                    guard !state.openIndexes.contains(index) else { return .opened }
                    state.waiters[waiterID] = Waiter(index: index, continuation: continuation)
                    return .suspended
                }
                switch registration {
                case .opened:
                    continuation.resume()
                case .suspended:
                    break
                case .cancelled:
                    continuation.resume(throwing: CancellationError())
                }
            }
        } onCancel: {
            guard !ignoringTaskCancellation else { return }
            self.cancel(waiterID)
        }
    }

    func open(_ index: Int) {
        let pendingWaiters = state.withLock { state in
            state.openIndexes.insert(index)
            let waiterIDs = state.waiters.compactMap { waiterID, waiter in
                waiter.index == index ? waiterID : nil
            }
            return waiterIDs.compactMap { state.waiters.removeValue(forKey: $0)?.continuation }
        }
        pendingWaiters.forEach { $0.resume() }
    }

    func cancelAll() {
        let waiters = state.withLock { state in
            state.isCancelled = true
            let waiters = state.waiters.values.map(\.continuation)
            state.waiters.removeAll()
            return waiters
        }
        waiters.forEach { $0.resume(throwing: CancellationError()) }
    }

    private func cancel(_ waiterID: UUID) {
        let continuation = state.withLock { $0.waiters.removeValue(forKey: waiterID)?.continuation }
        continuation?.resume(throwing: CancellationError())
    }
}
