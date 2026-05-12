import SwiftUI

extension MyOrderRouteView {
    @ViewBuilder
    var readOnlyOrderContent: some View {
        if viewModel.isConsultaPhase {
            previousOrderView
        } else {
            confirmedOrderView
        }
    }
}
