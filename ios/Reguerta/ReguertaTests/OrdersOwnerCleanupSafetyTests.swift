import Testing

@testable import Reguerta

@Suite(.timeLimit(.minutes(1)))
@MainActor
struct OrdersOwnerCleanupSafetyTests {
    @Test func benignSessionRevisionReleasesTheCheckoutWithoutRouteHandler() async throws {
        let repository = EnvironmentSwitchOrdersRepository(
            blockedCalls: [.submitMyOrder(.develop)],
            submitResults: [.develop: true]
        )
        let currentMember = member(id: "member_checkout_cleanup", ecoCommitmentMode: .weekly)
        let session = ownerCleanupOrdersSession(for: currentMember)
        let sessionViewModel = ownerCleanupOrdersSessionViewModel(session: session)
        let nowMillis = testMillis(year: 2026, month: 5, day: 15)
        let product = regularProduct(id: "tomato", vendorId: "producer_even", name: "Tomates")
        let context = myOrderContext(
            products: [product],
            nowMillis: nowMillis,
            currentMember: currentMember
        )
        let viewModel = MyOrderRouteViewModel(
            sessionViewModel: sessionViewModel,
            ordersRepository: repository,
            cartStore: InMemoryMyOrderCartStore(),
            nowMillisProvider: { nowMillis }
        )
        await viewModel.appear(context: context)
        viewModel.increase(product)
        let checkout = Task { await viewModel.validateCheckout() }
        defer {
            checkout.cancel()
            repository.cancelAll()
        }
        let expectedCallCount = await repository.recordedCalls().count + 1
        try await repository.waitForCallCount(expectedCallCount)

        let refreshedMember = replacingDisplayName(in: currentMember, with: "Socia actualizada")
        sessionViewModel.applyUpdatedAuthorizedMember(refreshedMember, members: [refreshedMember])
        await repository.resume(.submitMyOrder(.develop))
        await checkout.value

        #expect(viewModel.isSubmittingCheckout == false)
        #expect(viewModel.checkoutAlert == nil)
        #expect(!viewModel.isViewingConfirmedOrder)
    }

    @Test func benignSessionRevisionReleasesTheStatusWriteWithoutRouteHandler() async throws {
        let currentMember = producer(id: "producer_status_cleanup", parity: .even)
        let repository = EnvironmentSwitchOrdersRepository(
            blockedCalls: [.updateReceivedOrderProducerStatus(.develop)],
            receivedSnapshots: [.develop: receivedOrdersSnapshot(status: .unread)]
        )
        let session = ownerCleanupOrdersSession(for: currentMember)
        let sessionViewModel = ownerCleanupOrdersSessionViewModel(session: session)
        let nowMillis = testMillis(year: 2026, month: 5, day: 11)
        let context = receivedOrdersContext(currentMember: currentMember, nowMillis: nowMillis)
        let viewModel = ReceivedOrdersRouteViewModel(
            sessionViewModel: sessionViewModel,
            ordersRepository: repository,
            nowMillisProvider: { nowMillis }
        )
        await viewModel.appear(context: context)
        let statusWrite = Task {
            await viewModel.updateProducerStatus(orderId: "order_1", status: .prepared)
        }
        defer {
            statusWrite.cancel()
            repository.cancelAll()
        }
        try await repository.waitForCallCount(2)

        let refreshedMember = replacingDisplayName(in: currentMember, with: "Productor actualizado")
        sessionViewModel.applyUpdatedAuthorizedMember(refreshedMember, members: [refreshedMember])
        await repository.resume(.updateReceivedOrderProducerStatus(.develop))
        await statusWrite.value

        #expect(viewModel.updatingStatusOrderId == nil)
        guard case .loaded(let snapshot) = viewModel.loadState else {
            Issue.record("Expected the original snapshot to remain loaded")
            return
        }
        #expect(snapshot.byMemberGroups.first?.producerStatus == .unread)
        #expect(viewModel.statusWriteFeedback == nil)
    }
}

@MainActor
func ownerCleanupOrdersSession(for member: Member) -> AuthorizedSession {
    AuthorizedSession(
        principal: AuthPrincipal(uid: "auth_\(member.id)", email: member.normalizedEmail),
        authenticatedMember: member,
        member: member,
        members: [member],
        environment: .develop
    )
}

@MainActor
func ownerCleanupOrdersSessionViewModel(session: AuthorizedSession) -> SessionViewModel {
    let viewModel = SessionViewModel(dependencies: .preview())
    viewModel.mode = .authorized(session)
    return viewModel
}
