import Foundation
import Security
import Synchronization
import Testing

@testable import Reguerta

@Suite(.timeLimit(.minutes(1)))
@MainActor
struct UsersOrdersDeviceAuthorizationEntryTests {
    @Test func usersRejectsPrivateReadsAndMutationsWhenTheLiveSessionIsBroken() async {
        let admin = authorizationEntryMember(
            id: "broken_admin",
            authUID: "another_principal",
            roles: [.member, .admin]
        )
        let target = authorizationEntryMember(id: "target", authUID: nil)
        let session = authorizationEntrySession(
            principalUID: "principal",
            authenticatedMember: admin,
            selectedMember: admin,
            members: [admin, target]
        )
        let sessionViewModel = SessionViewModel(dependencies: .preview())
        sessionViewModel.mode = .authorized(session)
        let repository = AuthorizationEntryMemberRepository()
        let upserter = AuthorizationEntryMemberUpserter()
        let viewModel = UsersFeatureViewModel(
            sessionViewModel: sessionViewModel,
            memberRepository: repository,
            upsertMemberByAdmin: upserter
        )
        viewModel.currentSession = session
        viewModel.currentMember = admin
        viewModel.membersFeed = [admin, target]

        await viewModel.refreshMembers()
        let didMutate = await viewModel.toggleActive(memberId: target.id)

        #expect(!didMutate)
        #expect(repository.directoryReadCount == 0)
        #expect(upserter.writeCount == 0)
    }

    @Test func everyOrdersRouteRejectsInactiveBrokenAndUnauthorizedImpersonationBeforeRepositoryCalls() async {
        for session in authorizationEntryInvalidOrdersSessions() {
            let repository = EnvironmentSwitchOrdersRepository(blockedCalls: [])
            let sessionViewModel = SessionViewModel(dependencies: .preview())
            sessionViewModel.mode = .authorized(session)
            let nowMillis = testMillis(year: 2026, month: 5, day: 11)

            let myOrderViewModel = MyOrderRouteViewModel(
                sessionViewModel: sessionViewModel,
                ordersRepository: repository,
                cartStore: InMemoryMyOrderCartStore(),
                nowMillisProvider: { nowMillis }
            )
            await myOrderViewModel.appear(context: authorizationEntryMyOrderContext(
                session: session,
                nowMillis: nowMillis
            ))
            await myOrderViewModel.submitValidatedCheckout()

            let myOrdersHistoryViewModel = MyOrdersHistoryRouteViewModel(
                sessionViewModel: sessionViewModel,
                ordersRepository: repository
            )
            await myOrdersHistoryViewModel.appear(context: MyOrdersHistoryRouteContext(
                currentMember: session.member,
                nowMillis: nowMillis,
                environment: session.environment
            ))

            let receivedHistoryViewModel = ReceivedOrdersHistoryRouteViewModel(
                sessionViewModel: sessionViewModel,
                ordersRepository: repository
            )
            await receivedHistoryViewModel.appear(context: ReceivedOrdersHistoryRouteContext(
                currentMember: session.member,
                nowMillis: nowMillis,
                environment: session.environment
            ))

            let receivedViewModel = ReceivedOrdersRouteViewModel(
                sessionViewModel: sessionViewModel,
                ordersRepository: repository,
                nowMillisProvider: { nowMillis }
            )
            await receivedViewModel.appear(context: receivedOrdersContext(
                currentMember: session.member,
                nowMillis: nowMillis,
                environment: session.environment
            ))
            receivedViewModel.loadState = .loaded(receivedOrdersSnapshot(status: .unread))
            await receivedViewModel.updateProducerStatus(orderId: "order_1", status: .prepared)

            #expect(await repository.recordedCalls().isEmpty)
        }
    }

    @Test func revokedKnownSessionRejectsTokenUpdateBeforeAnotherDeviceRegistration() async throws {
        let authenticatedMember = authorizationEntryMember(
            id: "device_member",
            authUID: "device_principal"
        )
        let principal = AuthPrincipal(
            uid: "device_principal",
            email: authenticatedMember.normalizedEmail
        )
        let deviceRepository = AuthorizationEntryDeviceRepository()
        let keychainStore = KeychainStore(
            client: AuthorizationEntryKeychainClient(),
            service: "tests.active-authorization-entry"
        )
        let coordinator = FirebaseAuthorizedDeviceCoordinator(
            repository: deviceRepository,
            keychainStore: keychainStore,
            nowMillisProvider: { 1_000 },
            tokenProvider: { "initial-token" },
            currentAuthUidProvider: { principal.uid },
            deviceProvider: authorizationEntryDevice,
            retryDelay: {}
        )
        let memberRepository = InMemoryMemberRepository(items: [authenticatedMember])
        let environmentRouter = FixedSessionEnvironmentRouter()
        let viewModel = SessionViewModel(
            repository: memberRepository,
            resolveAuthorizedSession: ResolveAuthorizedSessionUseCase(
                repository: memberRepository,
                resolver: AuthorizationEntryMemberResolver(member: authenticatedMember)
            ),
            authorizedDeviceRegistrar: coordinator,
            environmentRouter: environmentRouter
        )

        await viewModel.applyAuthorizedSession(principal: principal)
        if let initialRegistration = viewModel.authorizedDeviceRegistrationTask {
            await initialRegistration.value
        }
        #expect(viewModel.authorizedDeviceRegistrationTask == nil)
        #expect(deviceRepository.registrationCount == 1)

        let revokedMember = authorizationEntryInactiveCopy(of: authenticatedMember)
        viewModel.mode = .authorized(authorizationEntrySession(
            principalUID: principal.uid,
            authenticatedMember: revokedMember,
            selectedMember: revokedMember,
            members: [revokedMember]
        ))
        try await coordinator.updateRegistrationToken("rotated-token")

        #expect(deviceRepository.registrationCount == 1)
    }
}

private final class AuthorizationEntryMemberRepository: MemberRepository {
    private let directoryReads = Mutex(0)

    var directoryReadCount: Int {
        directoryReads.withLock { $0 }
    }

    func member(id _: String, environment _: SessionEnvironment) async -> Member? { nil }

    func members(visibleTo _: Member, environment _: SessionEnvironment) async -> [Member] {
        directoryReads.withLock { $0 += 1 }
        return []
    }

    func updateOwnProducerCatalogEnabled(
        member: Member,
        enabled _: Bool,
        environment _: SessionEnvironment
    ) async -> Member {
        member
    }
}

private final class AuthorizationEntryMemberUpserter: MemberAdminUpserting {
    private let writes = Mutex(0)

    var writeCount: Int {
        writes.withLock { $0 }
    }

    func execute(target: Member, environment _: SessionEnvironment) async -> Member {
        writes.withLock { $0 += 1 }
        return target
    }
}

@MainActor
private final class AuthorizationEntryDeviceRepository: DeviceRegistrationRepository {
    private(set) var registrationCount = 0

    func register(
        memberId _: String,
        environment _: SessionEnvironment,
        device: RegisteredDevice,
        isRegistrationCurrent: @escaping @Sendable () async throws -> Bool
    ) async throws -> RegisteredDevice {
        guard try await isRegistrationCurrent() else { throw DeviceRegistrationRepositoryError.staleSession }
        registrationCount += 1
        return device
    }
}

private final class AuthorizationEntryKeychainClient: KeychainClient {
    private let storage = Mutex([String: Data]())

    func read(service: String, account: String) -> KeychainReadResult {
        let data = storage.withLock { $0[storageKey(service: service, account: account)] }
        return KeychainReadResult(status: data == nil ? errSecItemNotFound : errSecSuccess, data: data)
    }

    func update(service: String, account: String, data: Data) -> OSStatus {
        storage.withLock { storage in
            let key = storageKey(service: service, account: account)
            guard storage[key] != nil else { return errSecItemNotFound }
            storage[key] = data
            return errSecSuccess
        }
    }

    func add(service: String, account: String, data: Data) -> OSStatus {
        storage.withLock { storage in
            let key = storageKey(service: service, account: account)
            guard storage[key] == nil else { return errSecDuplicateItem }
            storage[key] = data
            return errSecSuccess
        }
    }

    func delete(service: String, account: String) -> OSStatus {
        storage.withLock { storage in
            storage.removeValue(forKey: storageKey(service: service, account: account)) == nil
                ? errSecItemNotFound
                : errSecSuccess
        }
    }

    private func storageKey(service: String, account: String) -> String {
        "\(service)|\(account)"
    }
}

private struct AuthorizationEntryMemberResolver: AuthorizedMemberResolving {
    let member: Member

    func resolve(
        authPrincipal _: AuthPrincipal,
        requestedEnvironment: SessionEnvironment
    ) async -> AuthorizedMemberResolution {
        AuthorizedMemberResolution(
            memberId: member.id,
            roles: member.roles,
            isActive: member.isActive,
            environment: requestedEnvironment,
            firstLoginLinked: false
        )
    }
}

@MainActor
private func authorizationEntryInvalidOrdersSessions() -> [AuthorizedSession] {
    let inactiveMember = authorizationEntryMember(id: "inactive", authUID: "inactive_uid", isActive: false)
    let brokenMember = authorizationEntryMember(id: "broken", authUID: "other_uid")
    let regularMember = authorizationEntryMember(id: "regular", authUID: "regular_uid")
    let impersonatedProducer = authorizationEntryMember(
        id: "impersonated_producer",
        authUID: nil,
        roles: [.member, .producer]
    )
    return [
        authorizationEntrySession(
            principalUID: "inactive_uid",
            authenticatedMember: inactiveMember,
            selectedMember: inactiveMember,
            members: [inactiveMember]
        ),
        authorizationEntrySession(
            principalUID: "broken_uid",
            authenticatedMember: brokenMember,
            selectedMember: brokenMember,
            members: [brokenMember]
        ),
        authorizationEntrySession(
            principalUID: "regular_uid",
            authenticatedMember: regularMember,
            selectedMember: impersonatedProducer,
            members: [regularMember, impersonatedProducer]
        )
    ]
}

@MainActor
private func authorizationEntryMyOrderContext(session: AuthorizedSession, nowMillis: Int64) -> MyOrderRouteContext {
    MyOrderRouteContext(
        products: [],
        seasonalCommitments: [],
        shifts: [],
        defaultDeliveryDayOfWeek: .wednesday,
        deliveryCalendarOverrides: [],
        nowMillis: nowMillis,
        isLoading: false,
        currentMember: session.member,
        members: session.members,
        environment: session.environment
    )
}

@MainActor
private func authorizationEntrySession(
    principalUID: String,
    authenticatedMember: Member,
    selectedMember: Member,
    members: [Member]
) -> AuthorizedSession {
    AuthorizedSession(
        principal: AuthPrincipal(uid: principalUID, email: authenticatedMember.normalizedEmail),
        authenticatedMember: authenticatedMember,
        member: selectedMember,
        members: members,
        environment: .develop
    )
}

@MainActor
private func authorizationEntryMember(
    id: String,
    authUID: String?,
    roles: Set<MemberRole> = [.member],
    isActive: Bool = true
) -> Member {
    Member(
        id: id,
        displayName: id,
        normalizedEmail: "\(id)@reguerta.test",
        authUid: authUID,
        roles: roles,
        isActive: isActive,
        producerCatalogEnabled: true,
        producerParity: roles.contains(.producer) ? .even : nil
    )
}

@MainActor
private func authorizationEntryInactiveCopy(of member: Member) -> Member {
    Member(
        id: member.id,
        displayName: member.displayName,
        companyName: member.companyName,
        phoneNumber: member.phoneNumber,
        normalizedEmail: member.normalizedEmail,
        authUid: member.authUid,
        roles: member.roles,
        isActive: false,
        producerCatalogEnabled: member.producerCatalogEnabled,
        isCommonPurchaseManager: member.isCommonPurchaseManager,
        producerParity: member.producerParity,
        ecoCommitmentMode: member.ecoCommitmentMode,
        ecoCommitmentParity: member.ecoCommitmentParity
    )
}

@MainActor
private func authorizationEntryDevice(token: String?, nowMillis: Int64) -> RegisteredDevice {
    RegisteredDevice(
        deviceId: "active-authorization-device",
        platform: "ios",
        appVersion: "1.0",
        osVersion: "26.0",
        apiLevel: nil,
        manufacturer: "Apple",
        model: "iPhone",
        fcmToken: token,
        firstSeenAtMillis: nowMillis,
        lastSeenAtMillis: nowMillis,
        tokenUpdatedAtMillis: token == nil ? nil : nowMillis
    )
}
