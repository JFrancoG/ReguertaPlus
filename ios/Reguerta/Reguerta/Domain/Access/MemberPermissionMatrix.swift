import Foundation

enum AccessCapability: String, CaseIterable, Sendable {
    case accessCommonHomeModules = "access_common_home_modules"
    case manageProductCatalog = "manage_product_catalog"
    case accessReceivedOrders = "access_received_orders"
    case manageMembers = "manage_members"
    case grantAdminRole = "grant_admin_role"
    case publishNews = "publish_news"
    case sendAdminNotifications = "send_admin_notifications"
    case routeProductionReviewerToDevelop = "route_production_reviewer_to_develop"
}

enum CanonicalAccessRole: String, CaseIterable, Sendable {
    case member
    case producer
    case admin
    case reviewer
}

enum MemberPermissionMatrix {
    private static let roleCapabilities: [CanonicalAccessRole: Set<AccessCapability>] = [
        .member: [.accessCommonHomeModules],
        .producer: [.accessCommonHomeModules, .manageProductCatalog, .accessReceivedOrders],
        .admin: [.accessCommonHomeModules, .manageMembers, .grantAdminRole, .publishNews, .sendAdminNotifications],
        .reviewer: [.accessCommonHomeModules, .routeProductionReviewerToDevelop],
    ]

    static var reviewerCapabilities: Set<AccessCapability> {
        capabilities(for: .reviewer)
    }

    static func capabilities(for role: CanonicalAccessRole) -> Set<AccessCapability> {
        roleCapabilities[role, default: []]
    }

    static func capabilities(for role: MemberRole) -> Set<AccessCapability> {
        switch role {
        case .member:
            capabilities(for: CanonicalAccessRole.member)
        case .producer:
            capabilities(for: CanonicalAccessRole.producer)
        case .admin:
            capabilities(for: CanonicalAccessRole.admin)
        }
    }

    static func capabilities(for member: Member) -> Set<AccessCapability> {
        var merged = member.roles.reduce(into: Set<AccessCapability>()) { partialResult, role in
            partialResult.formUnion(capabilities(for: role))
        }
        if member.isCommonPurchaseManager {
            merged.insert(.manageProductCatalog)
        }
        return merged
    }

    static func hasCapability(_ capability: AccessCapability, for member: Member) -> Bool {
        capabilities(for: member).contains(capability)
    }
}

extension Member {
    var isMember: Bool {
        roles.contains(.member)
    }

    var isProducer: Bool {
        roles.contains(.producer)
    }

    var canAccessCommonHomeModules: Bool {
        MemberPermissionMatrix.hasCapability(.accessCommonHomeModules, for: self)
    }

    var canManageProductCatalog: Bool {
        MemberPermissionMatrix.hasCapability(.manageProductCatalog, for: self)
    }

    var canAccessReceivedOrders: Bool {
        MemberPermissionMatrix.hasCapability(.accessReceivedOrders, for: self)
    }

    var canManageMembers: Bool {
        MemberPermissionMatrix.hasCapability(.manageMembers, for: self)
    }

    var canGrantAdminRole: Bool {
        MemberPermissionMatrix.hasCapability(.grantAdminRole, for: self)
    }

    var canPublishNews: Bool {
        MemberPermissionMatrix.hasCapability(.publishNews, for: self)
    }

    var canSendAdminNotifications: Bool {
        MemberPermissionMatrix.hasCapability(.sendAdminNotifications, for: self)
    }
}
