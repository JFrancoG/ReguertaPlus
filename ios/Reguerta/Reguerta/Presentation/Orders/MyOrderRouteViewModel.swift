import Observation

@MainActor
@Observable
final class MyOrderRouteViewModel {
    struct ContextOperation {
        let context: MyOrderRouteContext
        let generation: UInt64
        let sessionStateRevision: UInt64
    }

    struct PreviousOrderOperation {
        let contextOperation: ContextOperation
        let generation: UInt64
    }

    struct ProducerStatusOperation {
        let contextOperation: ContextOperation
        let generation: UInt64
    }

    struct CheckoutOperation {
        let contextOperation: ContextOperation
        let generation: UInt64
        let request: MyOrderCheckoutRequest
        let snapshot: MyOrderCartSnapshot
        let storageKey: String
        let total: Double
        let noPickupEcoBaskets: Int
    }

    struct CartPersistenceRequest {
        let generation: UInt64
        let storageKey: String
        let snapshot: MyOrderCartSnapshot
        let currentMember: Member?
        let environment: SessionEnvironment
        let sessionStateRevision: UInt64
    }

    @ObservationIgnored let sessionViewModel: SessionViewModel
    @ObservationIgnored let ordersRepository: any OrdersRepository
    @ObservationIgnored let cartStore: any MyOrderCartStore
    @ObservationIgnored let nowMillisProvider: @MainActor () -> Int64

    var context: MyOrderRouteContext = .empty
    var searchQuery = ""
    var selectedQuantities: [String: Int] = [:]
    var selectedEcoBasketOptions: [String: String] = [:]
    var confirmedQuantities: [String: Int] = [:]
    var confirmedEcoBasketOptions: [String: String] = [:]
    var isCartVisible = false
    var isSubmittingCheckout = false
    var checkoutAlert: MyOrderCheckoutAlert?
    var isViewingConfirmedOrder = false
    var previousOrderState: MyOrderPreviousOrderState = .loading
    var confirmedProducerStatusesByVendor: [String: ProducerOrderStatus] = [:]
    var confirmedLegacyProducerStatus: ProducerOrderStatus = .unread

    var hasRestoredCartState = false
    var restoredCartStorageKey: String?
    var loadedConsultaTaskID: String?
    var loadedStatusTaskID: String?

    @ObservationIgnored var contextGeneration: UInt64 = 0
    @ObservationIgnored var previousOrderOperationGeneration: UInt64 = 0
    @ObservationIgnored var producerStatusOperationGeneration: UInt64 = 0
    @ObservationIgnored var checkoutOperationGeneration: UInt64 = 0
    @ObservationIgnored var consultaLoadOwnerGeneration: UInt64?
    @ObservationIgnored var statusLoadOwnerGeneration: UInt64?
    @ObservationIgnored var contextSessionStateRevision: UInt64 = 0
    @ObservationIgnored var cartPersistenceTask: Task<Void, Never>?
    @ObservationIgnored var cartPersistenceTaskGeneration: UInt64 = 0
    @ObservationIgnored var cartPersistenceRequestGeneration: UInt64 = 0
    @ObservationIgnored var pendingCartPersistenceRequest: CartPersistenceRequest?

    init(
        sessionViewModel: SessionViewModel,
        ordersRepository: any OrdersRepository,
        cartStore: any MyOrderCartStore,
        nowMillisProvider: @escaping @MainActor () -> Int64
    ) {
        self.sessionViewModel = sessionViewModel
        self.ordersRepository = ordersRepository
        self.cartStore = cartStore
        self.nowMillisProvider = nowMillisProvider
        contextSessionStateRevision = sessionViewModel.sessionStateRevision
    }

    func beginContextOperation(_ newContext: MyOrderRouteContext) -> ContextOperation {
        let contextChanged = context.identity != newContext.identity
        let nextSessionStateRevision = sessionViewModel.sessionStateRevision
        let sessionChanged = contextSessionStateRevision != nextSessionStateRevision
        if context.cartStorageKey != newContext.cartStorageKey || sessionChanged {
            invalidateCartPersistenceForContextChange()
        }
        contextGeneration &+= 1
        previousOrderOperationGeneration &+= 1
        producerStatusOperationGeneration &+= 1
        if contextChanged || sessionChanged {
            checkoutOperationGeneration &+= 1
            isSubmittingCheckout = false
        }
        context = newContext
        contextSessionStateRevision = nextSessionStateRevision
        return ContextOperation(
            context: newContext,
            generation: contextGeneration,
            sessionStateRevision: nextSessionStateRevision
        )
    }

    func captureContextOperation() -> ContextOperation {
        ContextOperation(
            context: context,
            generation: contextGeneration,
            sessionStateRevision: contextSessionStateRevision
        )
    }

    func beginPreviousOrderOperation(for contextOperation: ContextOperation) -> PreviousOrderOperation {
        previousOrderOperationGeneration &+= 1
        return PreviousOrderOperation(
            contextOperation: contextOperation,
            generation: previousOrderOperationGeneration
        )
    }

    func beginProducerStatusOperation(for contextOperation: ContextOperation) -> ProducerStatusOperation {
        producerStatusOperationGeneration &+= 1
        return ProducerStatusOperation(
            contextOperation: contextOperation,
            generation: producerStatusOperationGeneration
        )
    }

    func invalidatePreviousOrderOperation() {
        previousOrderOperationGeneration &+= 1
    }

    func invalidateProducerStatusOperation() {
        producerStatusOperationGeneration &+= 1
    }

    func isCurrent(_ operation: ContextOperation) -> Bool {
        contextGeneration == operation.generation &&
            context.identity == operation.context.identity &&
            sessionViewModel.sessionStateRevision == operation.sessionStateRevision &&
            ordersRouteHasActiveAuthorization(
                sessionViewModel: sessionViewModel,
                currentMember: operation.context.currentMember,
                environment: operation.context.environment
            )
    }

    func isCurrent(_ operation: PreviousOrderOperation) -> Bool {
        previousOrderOperationGeneration == operation.generation && isCurrent(operation.contextOperation)
    }

    func isCurrent(_ operation: ProducerStatusOperation) -> Bool {
        producerStatusOperationGeneration == operation.generation && isCurrent(operation.contextOperation)
    }

    func isCurrent(_ operation: CheckoutOperation) -> Bool {
        checkoutOperationGeneration == operation.generation &&
            context.identity == operation.contextOperation.context.identity &&
            sessionViewModel.sessionStateRevision == operation.contextOperation.sessionStateRevision &&
            ordersRouteHasActiveAuthorization(
                sessionViewModel: sessionViewModel,
                currentMember: operation.contextOperation.context.currentMember,
                environment: operation.contextOperation.context.environment
            )
    }
}
