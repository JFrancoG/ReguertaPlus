import SwiftUI

extension AccessRootRoutingView {
    var bylawsRoute: some View {
        BylawsRouteView(
            tokens: tokens,
            viewModel: rootViewModel.bylawsViewModel,
            isDevelopBuild: viewModel.isDevelopImpersonationEnabled
        )
    }
}
