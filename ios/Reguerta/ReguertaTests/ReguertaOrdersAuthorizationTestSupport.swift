import Foundation

@testable import Reguerta

@MainActor
func makeMyOrderViewModel(
    repository: InMemoryOrdersRepository? = nil,
    cartStore: (any MyOrderCartStore)? = nil,
    nowMillis: Int64? = nil,
    currentMember: Member? = nil,
    environment: SessionEnvironment = .develop
) -> MyOrderRouteViewModel {
    let resolvedNowMillis = nowMillis ?? testMillis(year: 2026, month: 5, day: 14)
    let resolvedMember = currentMember ?? member(id: "member_1", ecoCommitmentMode: .weekly)
    return MyOrderRouteViewModel(
        sessionViewModel: makeOrdersSessionViewModel(currentMember: resolvedMember, environment: environment),
        ordersRepository: repository ?? InMemoryOrdersRepository(),
        cartStore: cartStore ?? InMemoryMyOrderCartStore(),
        nowMillisProvider: { resolvedNowMillis }
    )
}

@MainActor
func makeReceivedOrdersViewModel(
    repository: (any OrdersRepository)? = nil,
    nowMillis: Int64? = nil,
    currentMember: Member? = nil,
    environment: SessionEnvironment = .develop
) -> ReceivedOrdersRouteViewModel {
    let resolvedNowMillis = nowMillis ?? testMillis(year: 2026, month: 5, day: 11)
    let resolvedMember = currentMember ?? producer(id: "producer_even", parity: .even)
    return ReceivedOrdersRouteViewModel(
        sessionViewModel: makeOrdersSessionViewModel(currentMember: resolvedMember, environment: environment),
        ordersRepository: repository ?? InMemoryOrdersRepository(),
        nowMillisProvider: { resolvedNowMillis }
    )
}

@MainActor
func makeReceivedOrdersHistoryViewModel(
    repository: InMemoryOrdersRepository? = nil,
    currentMember: Member? = nil,
    environment: SessionEnvironment = .develop
) -> ReceivedOrdersHistoryRouteViewModel {
    let resolvedMember = currentMember ?? producer(id: "producer_even", parity: .even)
    return ReceivedOrdersHistoryRouteViewModel(
        sessionViewModel: makeOrdersSessionViewModel(currentMember: resolvedMember, environment: environment),
        ordersRepository: repository ?? InMemoryOrdersRepository()
    )
}

@MainActor
func makeMyOrdersHistoryViewModel(
    repository: InMemoryOrdersRepository? = nil,
    currentMember: Member? = nil,
    environment: SessionEnvironment = .develop
) -> MyOrdersHistoryRouteViewModel {
    let resolvedMember = currentMember ?? member(id: "member_1", ecoCommitmentMode: .weekly)
    return MyOrdersHistoryRouteViewModel(
        sessionViewModel: makeOrdersSessionViewModel(currentMember: resolvedMember, environment: environment),
        ordersRepository: repository ?? InMemoryOrdersRepository()
    )
}

@MainActor
func makeOrdersAuthorizedSession(
    currentMember: Member,
    authenticatedMember: Member? = nil,
    environment: SessionEnvironment = .develop
) -> AuthorizedSession {
    let resolvedAuthenticatedMember = authenticatedMember ?? currentMember
    guard let principalUID = resolvedAuthenticatedMember.authUid else {
        preconditionFailure("An authorized Orders fixture requires an authenticated member linked to an auth UID")
    }
    precondition(resolvedAuthenticatedMember.isActive, "The authenticated Orders fixture member must be active")
    precondition(currentMember.isActive, "The selected Orders fixture member must be active")
    precondition(
        resolvedAuthenticatedMember.id == currentMember.id || resolvedAuthenticatedMember.canManageMembers,
        "An impersonating Orders fixture member must be allowed to manage members"
    )
    let visibleMembers = resolvedAuthenticatedMember.id == currentMember.id
        ? [currentMember]
        : [resolvedAuthenticatedMember, currentMember]
    return AuthorizedSession(
        principal: AuthPrincipal(uid: principalUID, email: resolvedAuthenticatedMember.normalizedEmail),
        authenticatedMember: resolvedAuthenticatedMember,
        member: currentMember,
        members: visibleMembers,
        environment: environment
    )
}

@MainActor
func makeOrdersSessionViewModel(
    currentMember: Member,
    authenticatedMember: Member? = nil,
    environment: SessionEnvironment = .develop
) -> SessionViewModel {
    let viewModel = SessionViewModel(dependencies: .preview())
    authorizeOrdersSession(
        viewModel,
        currentMember: currentMember,
        authenticatedMember: authenticatedMember,
        environment: environment
    )
    return viewModel
}

@MainActor
func authorizeOrdersSession(
    _ viewModel: SessionViewModel,
    currentMember: Member,
    authenticatedMember: Member? = nil,
    environment: SessionEnvironment = .develop
) {
    viewModel.mode = .authorized(
        makeOrdersAuthorizedSession(
            currentMember: currentMember,
            authenticatedMember: authenticatedMember,
            environment: environment
        )
    )
}
