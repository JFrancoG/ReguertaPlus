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
        case .bylaws:
            bylawsRoute
        case .news:
            newsListRoute
        case .notifications:
            notificationsListRoute
        case .products:
            productsRoute
        case .users:
            usersRoute
        case .myOrder:
            myOrderRoute
        case .receivedOrders:
            receivedOrdersRoute
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
