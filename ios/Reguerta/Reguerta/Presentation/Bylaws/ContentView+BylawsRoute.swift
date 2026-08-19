import SwiftUI

extension HomeShellView {
    var bylawsRoute: some View {
        BylawsRouteView(
            tokens: tokens,
            viewModel: rootViewModel.bylawsViewModel,
            isDevelopBuild: sessionViewModel.isDevelopImpersonationEnabled
        )
    }
}
