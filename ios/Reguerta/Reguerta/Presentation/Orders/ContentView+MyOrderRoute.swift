import SwiftUI

struct MyOrderProducerGroup: Identifiable {
    let vendorId: String
    let companyName: String
    let products: [Product]
    let hasCommonPurchase: Bool
    let isCommittedEcoBasketProducer: Bool
    let isCommonPurchasesGroup: Bool

    var id: String { vendorId }

    var sortPriority: Int {
        if isCommittedEcoBasketProducer { return 0 }
        if isCommonPurchasesGroup { return 1 }
        if hasCommonPurchase { return 2 }
        return 3
    }
}

enum MyOrderCheckoutAlert: Identifiable {
    case missingCommitments([String])
    case exceededCommitments([String])
    case incompatibleCommitments([String])
    case ecoBasketPriceMismatch
    case submitFailed
    case readyToSubmit(total: Double, noPickupEcoBaskets: Int)

    var id: String {
        switch self {
        case .missingCommitments(let names):
            return "missing:\(names.joined(separator: ","))"
        case .exceededCommitments(let names):
            return "exceeded:\(names.joined(separator: ","))"
        case .incompatibleCommitments(let names):
            return "incompatible:\(names.joined(separator: ","))"
        case .ecoBasketPriceMismatch:
            return "ecoBasketPriceMismatch"
        case .submitFailed:
            return "submitFailed"
        case .readyToSubmit(let total, let noPickupEcoBaskets):
            return "ready:\(total):\(noPickupEcoBaskets)"
        }
    }
}

enum MyOrderPreviousOrderState: Equatable, Sendable {
    case loading
    case loaded(MyOrderPreviousOrderSnapshot)
    case empty
    case error

    var isLoaded: Bool {
        if case .loaded = self {
            return true
        }
        return false
    }
}

struct MyOrderRouteView: View {
    let tokens: ReguertaDesignTokens
    let viewModel: MyOrderRouteViewModel
    let context: MyOrderRouteContext
    let cartOpenRequests: Int
    let onCartUnitsChange: (Int) -> Void
    let onReadOnlyModeChange: (Bool) -> Void
    let onCheckoutSuccessAcknowledge: () -> Void

    var body: some View {
        ZStack(alignment: .bottom) {
            if viewModel.isReadOnlyMode {
                readOnlyOrderContent
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            } else {
                VStack(alignment: .leading, spacing: tokens.spacing.sm) {
                    headerRow
                    if viewModel.context.isLoading {
                        loadingState
                    } else if viewModel.groupedProducts.isEmpty {
                        emptyState
                    } else {
                        productsList
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            }

            if !viewModel.isReadOnlyMode && !viewModel.isCartVisible {
                searchOverlay
            }

            if !viewModel.isReadOnlyMode && viewModel.isCartVisible {
                Color.black.opacity(0.22)
                    .ignoresSafeArea()
                    .onTapGesture {
                        withAnimation(.easeInOut(duration: 0.22)) {
                            viewModel.closeCartOverlay()
                        }
                    }
                cartOverlay
                    .transition(.move(edge: .trailing))
            }
        }
        .task(id: context.identity) {
            await viewModel.appear(context: context)
            onCartUnitsChange(viewModel.selectedUnits)
            onReadOnlyModeChange(viewModel.isReadOnlyMode)
        }
        .onChange(of: viewModel.selectedUnits) { _, units in
            onCartUnitsChange(units)
        }
        .onChange(of: viewModel.isReadOnlyMode) { _, isReadOnly in
            onReadOnlyModeChange(isReadOnly)
        }
        .onChange(of: cartOpenRequests) { _, newValue in
            withAnimation(.easeInOut(duration: 0.22)) {
                viewModel.handleCartOpenRequest(newValue)
            }
        }
        .overlay {
            if let checkoutAlert = viewModel.checkoutAlert {
                checkoutDialog(checkoutAlert)
            }
        }
    }
}
