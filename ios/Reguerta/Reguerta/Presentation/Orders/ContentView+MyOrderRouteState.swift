import SwiftUI

extension MyOrderRouteView {
    @ViewBuilder
    var readOnlyOrderContent: some View {
        if viewModel.shouldShowDatabaseOrderSummary {
            previousOrderView
        } else {
            confirmedOrderView
        }
    }
}
