import Testing

@testable import Reguerta

@MainActor
@Suite(.timeLimit(.minutes(1)))
struct ReguertaOrdersSessionRevisionSafetyTests {
    @Test func myOrderReloginRestartsThePreviousOrderLoadForTheSameRouteIdentity() async throws {
        let repository = EnvironmentSwitchOrdersRepository(
            blockedCalls: [.previousOrderSnapshot(.develop)],
            previousSnapshots: [.develop: previousOrderSnapshot(weekKey: "current-session")]
        )
        let currentMember = member(id: "member_1", ecoCommitmentMode: .weekly)
        let session = ordersAuthorizedSession(for: currentMember)
        let sessionViewModel = ordersSessionViewModel(session: session)
        let nowMillis = testMillis(year: 2026, month: 5, day: 15)
        let context = myOrderContext(nowMillis: nowMillis, currentMember: currentMember)
        let viewModel = MyOrderRouteViewModel(
            sessionViewModel: sessionViewModel,
            ordersRepository: repository,
            cartStore: InMemoryMyOrderCartStore(),
            nowMillisProvider: { nowMillis }
        )
        let staleAppearance = Task { await viewModel.appear(context: context) }
        defer {
            staleAppearance.cancel()
            repository.cancelAll()
        }

        try await repository.waitForCallCount(1)
        cycleOrdersSession(session, in: sessionViewModel)
        await repository.resume(.previousOrderSnapshot(.develop))
        await staleAppearance.value

        await viewModel.appear(context: context)

        guard case .loaded(let snapshot) = viewModel.previousOrderState else {
            Issue.record("Expected the relogged session to publish its previous-order snapshot")
            return
        }
        #expect(snapshot.weekKey == "current-session")
        #expect(
            await repository.recordedCalls() == [
                .previousOrderSnapshot(.develop),
                .previousOrderSnapshot(.develop)
            ]
        )
    }

    @Test func myOrdersHistoryReloginRestartsTheWeekIndexForTheSameRouteIdentity() async throws {
        let repository = EnvironmentSwitchOrdersRepository(
            blockedCalls: [.orderHistoryWeekKeys(.develop)],
            previousSnapshots: [.develop: previousOrderSnapshot(weekKey: "current-session")]
        )
        let currentMember = member(id: "member_1", ecoCommitmentMode: .weekly)
        let session = ordersAuthorizedSession(for: currentMember)
        let sessionViewModel = ordersSessionViewModel(session: session)
        let context = myOrdersHistoryContext(
            nowMillis: testMillis(year: 2026, month: 5, day: 25),
            currentMember: currentMember
        )
        let viewModel = MyOrdersHistoryRouteViewModel(
            sessionViewModel: sessionViewModel,
            ordersRepository: repository
        )
        let staleAppearance = Task { await viewModel.appear(context: context) }
        defer {
            staleAppearance.cancel()
            repository.cancelAll()
        }

        try await repository.waitForCallCount(1)
        cycleOrdersSession(session, in: sessionViewModel)
        await repository.resume(.orderHistoryWeekKeys(.develop))
        await staleAppearance.value

        await viewModel.appear(context: context)

        guard case .loaded(let snapshot) = viewModel.loadState else {
            Issue.record("Expected the relogged session to publish its order-history snapshot")
            return
        }
        #expect(snapshot.weekKey == "current-session")
        #expect(
            await repository.recordedCalls() == [
                .orderHistoryWeekKeys(.develop),
                .orderHistoryWeekKeys(.develop),
                .orderSummarySnapshot(.develop)
            ]
        )
    }

    @Test func receivedOrdersHistoryReloginRestartsTheWeekIndexForTheSameRouteIdentity() async throws {
        let currentMember = producer(id: "producer_even", parity: .even)
        let repository = EnvironmentSwitchOrdersRepository(
            blockedCalls: [.receivedOrdersHistoryWeekKeys(.develop)],
            receivedSnapshots: [.develop: receivedOrdersSnapshot(status: .prepared)]
        )
        let session = ordersAuthorizedSession(for: currentMember)
        let sessionViewModel = ordersSessionViewModel(session: session)
        let context = receivedOrdersHistoryContext(
            nowMillis: testMillis(year: 2026, month: 5, day: 25),
            currentMember: currentMember
        )
        let viewModel = ReceivedOrdersHistoryRouteViewModel(
            sessionViewModel: sessionViewModel,
            ordersRepository: repository
        )
        let staleAppearance = Task { await viewModel.appear(context: context) }
        defer {
            staleAppearance.cancel()
            repository.cancelAll()
        }

        try await repository.waitForCallCount(1)
        cycleOrdersSession(session, in: sessionViewModel)
        await repository.resume(.receivedOrdersHistoryWeekKeys(.develop))
        await staleAppearance.value

        await viewModel.appear(context: context)

        guard case .loaded(let snapshot) = viewModel.loadState else {
            Issue.record("Expected the relogged session to publish its received-order history snapshot")
            return
        }
        #expect(snapshot.byMemberGroups.first?.producerStatus == .prepared)
        #expect(
            await repository.recordedCalls() == [
                .receivedOrdersHistoryWeekKeys(.develop),
                .receivedOrdersHistoryWeekKeys(.develop),
                .receivedOrdersHistorySnapshot(.develop)
            ]
        )
    }

    @Test func receivedOrdersReloginRestartsTheSnapshotLoadForTheSameRouteIdentity() async throws {
        let currentMember = producer(id: "producer_even", parity: .even)
        let repository = EnvironmentSwitchOrdersRepository(
            blockedCalls: [.receivedOrdersSnapshot(.develop)],
            receivedSnapshots: [.develop: receivedOrdersSnapshot(status: .prepared)]
        )
        let session = ordersAuthorizedSession(for: currentMember)
        let sessionViewModel = ordersSessionViewModel(session: session)
        let nowMillis = testMillis(year: 2026, month: 5, day: 11)
        let context = receivedOrdersContext(currentMember: currentMember, nowMillis: nowMillis)
        let viewModel = ReceivedOrdersRouteViewModel(
            sessionViewModel: sessionViewModel,
            ordersRepository: repository,
            nowMillisProvider: { nowMillis }
        )
        let staleAppearance = Task { await viewModel.appear(context: context) }
        defer {
            staleAppearance.cancel()
            repository.cancelAll()
        }

        try await repository.waitForCallCount(1)
        cycleOrdersSession(session, in: sessionViewModel)
        await repository.resume(.receivedOrdersSnapshot(.develop))
        await staleAppearance.value

        await viewModel.appear(context: context)

        guard case .loaded(let snapshot) = viewModel.loadState else {
            Issue.record("Expected the relogged session to publish its received-orders snapshot")
            return
        }
        #expect(snapshot.byMemberGroups.first?.producerStatus == .prepared)
        #expect(
            await repository.recordedCalls() == [
                .receivedOrdersSnapshot(.develop),
                .receivedOrdersSnapshot(.develop)
            ]
        )
    }

    @Test func myOrderReloginRejectsTheOldCheckoutBeforeAllowingTheSuccessor() async throws {
        let repository = EnvironmentSwitchOrdersRepository(
            cancellationDeferredOneShotCalls: [.submitMyOrder(.develop)],
            submitResults: [.develop: true]
        )
        let currentMember = member(id: "member_1", ecoCommitmentMode: .weekly)
        let session = ordersAuthorizedSession(for: currentMember)
        let sessionViewModel = ordersSessionViewModel(session: session)
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

        let firstSubmitCallCount = await repository.recordedCalls().count + 1
        let staleCheckout = Task { await viewModel.validateCheckout() }
        defer {
            staleCheckout.cancel()
            repository.cancelAll()
        }
        try await repository.waitForCallCount(firstSubmitCallCount)

        cycleOrdersSession(session, in: sessionViewModel)
        #expect(viewModel.checkoutAlert == nil)
        #expect(!viewModel.isViewingConfirmedOrder)
        await viewModel.appear(context: context)
        #expect(!viewModel.isSubmittingCheckout)

        await viewModel.validateCheckout()

        guard case .readyToSubmit = viewModel.checkoutAlert else {
            Issue.record("Expected only the relogged checkout to publish success")
            return
        }
        await repository.resume(.submitMyOrder(.develop))
        await staleCheckout.value

        guard case .readyToSubmit = viewModel.checkoutAlert else {
            Issue.record("Expected the late checkout to preserve the relogged success")
            return
        }
        #expect(!viewModel.isSubmittingCheckout)
        let submitCalls = await repository.recordedCalls().filter { $0 == .submitMyOrder(.develop) }
        #expect(submitCalls.count == 2)
    }

    @Test func receivedOrdersReloginRejectsTheOldStatusWriteBeforeAllowingTheSuccessor() async throws {
        let currentMember = producer(id: "producer_even", parity: .even)
        let repository = EnvironmentSwitchOrdersRepository(
            cancellationDeferredOneShotCalls: [.updateReceivedOrderProducerStatus(.develop)],
            receivedSnapshots: [.develop: receivedOrdersSnapshot(status: .unread)]
        )
        let session = ordersAuthorizedSession(for: currentMember)
        let sessionViewModel = ordersSessionViewModel(session: session)
        let nowMillis = testMillis(year: 2026, month: 5, day: 11)
        let context = receivedOrdersContext(currentMember: currentMember, nowMillis: nowMillis)
        let viewModel = ReceivedOrdersRouteViewModel(
            sessionViewModel: sessionViewModel,
            ordersRepository: repository,
            nowMillisProvider: { nowMillis }
        )
        await viewModel.appear(context: context)

        let staleStatusWrite = Task {
            await viewModel.updateProducerStatus(orderId: "order_1", status: .prepared)
        }
        defer {
            staleStatusWrite.cancel()
            repository.cancelAll()
        }
        try await repository.waitForCallCount(2)

        cycleOrdersSession(session, in: sessionViewModel)
        await viewModel.appear(context: context)
        #expect(viewModel.updatingStatusOrderId == nil)

        await viewModel.updateProducerStatus(orderId: "order_1", status: .prepared)

        guard case .loaded(let currentSnapshot) = viewModel.loadState else {
            Issue.record("Expected only the relogged status write to publish success")
            return
        }
        #expect(currentSnapshot.byMemberGroups.first?.producerStatus == .prepared)
        await repository.resume(.updateReceivedOrderProducerStatus(.develop))
        await staleStatusWrite.value

        guard case .loaded(let finalSnapshot) = viewModel.loadState else {
            Issue.record("Expected the late status write to preserve the relogged snapshot")
            return
        }
        #expect(finalSnapshot.byMemberGroups.first?.producerStatus == .prepared)
        #expect(viewModel.updatingStatusOrderId == nil)
        let statusWriteCalls = await repository.recordedCalls().filter {
            $0 == .updateReceivedOrderProducerStatus(.develop)
        }
        #expect(statusWriteCalls.count == 2)
    }

}

@MainActor
private func ordersAuthorizedSession(
    for member: Member,
    environment: SessionEnvironment = .develop
) -> AuthorizedSession {
    AuthorizedSession(
        principal: AuthPrincipal(uid: "auth_\(member.id)", email: member.normalizedEmail),
        authenticatedMember: member,
        member: member,
        members: [member],
        environment: environment
    )
}

@MainActor
private func ordersSessionViewModel(session: AuthorizedSession) -> SessionViewModel {
    let viewModel = SessionViewModel(dependencies: .preview())
    viewModel.mode = .authorized(session)
    return viewModel
}

@MainActor
private func cycleOrdersSession(_ session: AuthorizedSession, in viewModel: SessionViewModel) {
    viewModel.mode = .signedOut
    viewModel.mode = .authorized(session)
}
