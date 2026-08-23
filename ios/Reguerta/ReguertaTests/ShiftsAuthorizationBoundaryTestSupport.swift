@testable import Reguerta

enum ShiftsAuthorizationDrift: CaseIterable {
    case principalAuthentication
    case authenticatedMember
    case authenticatedMemberAdminAccess
    case selectedMember
    case selectedMemberAdminAccess
    case environment

    var preservesShiftSwapReceipts: Bool {
        switch self {
        case .selectedMemberAdminAccess:
            true
        case .principalAuthentication, .authenticatedMember, .authenticatedMemberAdminAccess,
             .selectedMember, .environment:
            false
        }
    }
}

struct ShiftsAuthorizationScenario {
    let initial: AuthorizedSession
    let successor: AuthorizedSession
    let environment: ShiftsEnvironmentBox
}

@MainActor
final class ShiftsEnvironmentBox {
    var value: SessionEnvironment

    init(_ value: SessionEnvironment) {
        self.value = value
    }
}
