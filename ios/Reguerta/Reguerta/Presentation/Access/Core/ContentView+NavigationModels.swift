enum HomeDestination: String, Sendable {
    case dashboard
    case myOrder
    case myOrders
    case shifts
    case shiftSwapRequest
    case news
    case notifications
    case profile
    case settings
    case products
    case receivedOrders
    case users
    case publishNews
    case adminBroadcast
}

extension HomeDestination {
    var titleKey: String {
        switch self {
        case .dashboard: AccessL10nKey.homeTitle
        case .myOrder: AccessL10nKey.myOrder
        case .myOrders: AccessL10nKey.myOrders
        case .shifts: AccessL10nKey.shifts
        case .shiftSwapRequest: AccessL10nKey.shifts
        case .news: AccessL10nKey.homeShellNewsTitle
        case .notifications: AccessL10nKey.homeShellNotifications
        case .profile: AccessL10nKey.homeShellActionProfile
        case .settings: AccessL10nKey.homeShellActionSettings
        case .products: AccessL10nKey.homeShellActionProducts
        case .receivedOrders: AccessL10nKey.homeShellActionReceivedOrders
        case .users: AccessL10nKey.homeShellActionUsers
        case .publishNews: AccessL10nKey.homeShellActionPublishNews
        case .adminBroadcast: AccessL10nKey.homeShellActionAdminBroadcast
        }
    }

    var subtitleKey: String {
        switch self {
        case .dashboard: AccessL10nKey.homePlaceholderSubtitle
        case .myOrder: AccessL10nKey.homePlaceholderMyOrder
        case .myOrders: AccessL10nKey.homePlaceholderMyOrders
        case .shifts: AccessL10nKey.homePlaceholderShifts
        case .shiftSwapRequest: AccessL10nKey.homePlaceholderShifts
        case .news: AccessL10nKey.newsListSubtitle
        case .notifications: AccessL10nKey.notificationsListSubtitle
        case .profile: AccessL10nKey.homePlaceholderProfile
        case .settings: AccessL10nKey.homePlaceholderSettings
        case .products: AccessL10nKey.homePlaceholderProducts
        case .receivedOrders: AccessL10nKey.homePlaceholderReceivedOrders
        case .users: AccessL10nKey.homePlaceholderUsers
        case .publishNews: AccessL10nKey.newsEditorSubtitle
        case .adminBroadcast: AccessL10nKey.notificationsEditorSubtitle
        }
    }
}

enum StartupGateUIState: Equatable {
    case checking
    case ready
    case optionalUpdate(storeURL: String)
    case forcedUpdate(storeURL: String)
    case optionalDismissed

    var allowsContinuation: Bool {
        self == .ready || self == .optionalDismissed
    }
}
