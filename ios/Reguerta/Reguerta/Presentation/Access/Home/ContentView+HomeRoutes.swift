import SwiftUI

extension ContentView {
    @ViewBuilder
    var homeRouteContent: some View {
        switch homeDestination {
        case .dashboard:
            dashboardRoute
        case .shifts:
            shiftsRoute
        case .shiftSwapRequest:
            shiftSwapRequestRoute
        case .news:
            newsListRoute
        case .notifications:
            notificationsListRoute
        case .products:
            productsRoute
        case .myOrder:
            myOrderRoute
        case .profile:
            sharedProfileRoute
        case .settings:
            settingsRoute
        case .publishNews:
            newsEditorRoute
        case .adminBroadcast:
            notificationEditorRoute
        default:
            placeholderRoute(
                titleKey: homeDestination.titleKey,
                subtitleKey: homeDestination.subtitleKey
            )
        }
    }
}
