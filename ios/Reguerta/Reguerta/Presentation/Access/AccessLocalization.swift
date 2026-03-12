import Foundation

enum AccessL10nKey {
    static let brandReguerta = "common.brand.reguerta"

    static let membersRolesTitle = "access.members_roles.title"
    static let signedOutHint = "access.signed_out.hint"
    static let authenticationCardTitle = "access.card.authentication"
    static let emailLabel = "common.input.email.label"
    static let authUidLabel = "access.input.auth_uid.label"
    static let signingIn = "access.action.signing_in"
    static let signIn = "access.action.sign_in"
    static let signOut = "access.action.sign_out"
    static let dismissMessage = "access.action.dismiss_message"

    static let unauthorized = "auth_error.member.unauthorized"
    static let signedInEmail = "access.signed_in_email"
    static let restrictedModeInfo = "auth_info.member.restricted_mode"
    static let reason = "common.reason"

    static let homeTitle = "home.title"
    static let homeWelcome = "home.welcome"
    static let roles = "common.roles"
    static let status = "common.status"
    static let statusActive = "common.status.active"
    static let statusInactive = "common.status.inactive"

    static let operationalModulesTitle = "operational_modules.title"
    static let myOrder = "operational_modules.my_order"
    static let catalog = "operational_modules.catalog"
    static let shifts = "operational_modules.shifts"

    static let adminManageMembersTitle = "admin.manage_members.title"
    static let adminManageMembersSubtitle = "admin.manage_members.subtitle"
    static let adminCreatePreAuthorizedTitle = "admin.create_pre_authorized_member.title"
    static let displayNameLabel = "admin.input.display_name.label"
    static let roleMember = "role.member"
    static let roleProducer = "role.producer"
    static let roleAdmin = "role.admin"
    static let roleActive = "role.active"
    static let createMember = "admin.action.create_member"
    static let authLinked = "member.auth_linked"
    static let yes = "common.yes"
    static let no = "common.no"
    static let revokeAdmin = "admin.action.revoke_admin"
    static let grantAdmin = "admin.action.grant_admin"
    static let deactivate = "admin.action.deactivate"
    static let activate = "admin.action.activate"

    static let feedbackEmailUidRequired = "feedback.email_uid_required"
    static let feedbackOnlyAdminCreate = "feedback.only_admin_create"
    static let feedbackDisplayNameEmailRequired = "feedback.display_name_email_required"
    static let feedbackMemberExists = "feedback.member_exists"
    static let feedbackSelectRole = "feedback.select_role"
    static let feedbackOnlyAdminEditRoles = "feedback.only_admin_edit_roles"
    static let feedbackOnlyAdminToggleActive = "feedback.only_admin_toggle_active"
    static let feedbackOnlyAdminManageMembers = "feedback.only_admin_manage_members"
    static let feedbackCannotRemoveLastAdmin = "feedback.cannot_remove_last_admin"
    static let feedbackUnableSaveChanges = "feedback.unable_save_changes"

    static let roleValueMember = "role.value.member"
    static let roleValueProducer = "role.value.producer"
    static let roleValueAdmin = "role.value.admin"
}

func l10n(_ key: String) -> String {
    NSLocalizedString(key, comment: "")
}

func l10n(_ key: String, _ arguments: CVarArg...) -> String {
    String(format: NSLocalizedString(key, comment: ""), locale: Locale.current, arguments: arguments)
}

func localizedUnauthorizedReason(_ reason: UnauthorizedReason) -> String {
    switch reason {
    case .userNotAuthorized:
        return l10n(AccessL10nKey.unauthorized)
    }
}

func localizedRoleValue(_ role: MemberRole) -> String {
    switch role {
    case .member:
        return l10n(AccessL10nKey.roleValueMember)
    case .producer:
        return l10n(AccessL10nKey.roleValueProducer)
    case .admin:
        return l10n(AccessL10nKey.roleValueAdmin)
    }
}
