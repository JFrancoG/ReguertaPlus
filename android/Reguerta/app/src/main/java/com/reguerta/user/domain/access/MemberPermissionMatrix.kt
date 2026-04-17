package com.reguerta.user.domain.access

enum class AccessCapability(val wireValue: String) {
    ACCESS_COMMON_HOME_MODULES("access_common_home_modules"),
    MANAGE_PRODUCT_CATALOG("manage_product_catalog"),
    ACCESS_RECEIVED_ORDERS("access_received_orders"),
    MANAGE_MEMBERS("manage_members"),
    GRANT_ADMIN_ROLE("grant_admin_role"),
    PUBLISH_NEWS("publish_news"),
    SEND_ADMIN_NOTIFICATIONS("send_admin_notifications"),
    ROUTE_PRODUCTION_REVIEWER_TO_DEVELOP("route_production_reviewer_to_develop"),
    ;

    companion object {
        private val byWireValue = entries.associateBy(AccessCapability::wireValue)

        fun fromWireValue(value: String): AccessCapability? = byWireValue[value]
    }
}

enum class CanonicalAccessRole(val wireValue: String) {
    MEMBER("member"),
    PRODUCER("producer"),
    ADMIN("admin"),
    REVIEWER("reviewer"),
    ;

    companion object {
        private val byWireValue = entries.associateBy(CanonicalAccessRole::wireValue)

        fun fromWireValue(value: String): CanonicalAccessRole? = byWireValue[value]
    }
}

object MemberPermissionMatrix {
    private val roleCapabilities = mapOf(
        CanonicalAccessRole.MEMBER to setOf(
            AccessCapability.ACCESS_COMMON_HOME_MODULES,
        ),
        CanonicalAccessRole.PRODUCER to setOf(
            AccessCapability.ACCESS_COMMON_HOME_MODULES,
            AccessCapability.MANAGE_PRODUCT_CATALOG,
            AccessCapability.ACCESS_RECEIVED_ORDERS,
        ),
        CanonicalAccessRole.ADMIN to setOf(
            AccessCapability.ACCESS_COMMON_HOME_MODULES,
            AccessCapability.MANAGE_MEMBERS,
            AccessCapability.GRANT_ADMIN_ROLE,
            AccessCapability.PUBLISH_NEWS,
            AccessCapability.SEND_ADMIN_NOTIFICATIONS,
        ),
        CanonicalAccessRole.REVIEWER to setOf(
            AccessCapability.ACCESS_COMMON_HOME_MODULES,
            AccessCapability.ROUTE_PRODUCTION_REVIEWER_TO_DEVELOP,
        ),
    )

    fun capabilitiesFor(role: CanonicalAccessRole): Set<AccessCapability> =
        roleCapabilities.getValue(role)

    fun capabilitiesFor(role: MemberRole): Set<AccessCapability> =
        when (role) {
            MemberRole.MEMBER -> capabilitiesFor(CanonicalAccessRole.MEMBER)
            MemberRole.PRODUCER -> capabilitiesFor(CanonicalAccessRole.PRODUCER)
            MemberRole.ADMIN -> capabilitiesFor(CanonicalAccessRole.ADMIN)
        }

    fun capabilitiesFor(member: Member): Set<AccessCapability> {
        val merged = member.roles
            .asSequence()
            .flatMap { role -> capabilitiesFor(role).asSequence() }
            .toMutableSet()
        if (member.isCommonPurchaseManager) {
            merged += AccessCapability.MANAGE_PRODUCT_CATALOG
        }
        return merged
    }

    fun hasCapability(member: Member, capability: AccessCapability): Boolean =
        capabilitiesFor(member).contains(capability)

    val reviewerCapabilities: Set<AccessCapability>
        get() = capabilitiesFor(CanonicalAccessRole.REVIEWER)
}

val Member.isMember: Boolean
    get() = roles.contains(MemberRole.MEMBER)

val Member.isProducer: Boolean
    get() = roles.contains(MemberRole.PRODUCER)

val Member.canAccessCommonHomeModules: Boolean
    get() = MemberPermissionMatrix.hasCapability(this, AccessCapability.ACCESS_COMMON_HOME_MODULES)

val Member.canManageProductCatalog: Boolean
    get() = MemberPermissionMatrix.hasCapability(this, AccessCapability.MANAGE_PRODUCT_CATALOG)

val Member.canAccessReceivedOrders: Boolean
    get() = MemberPermissionMatrix.hasCapability(this, AccessCapability.ACCESS_RECEIVED_ORDERS)

val Member.canManageMembers: Boolean
    get() = MemberPermissionMatrix.hasCapability(this, AccessCapability.MANAGE_MEMBERS)

val Member.canGrantAdminRole: Boolean
    get() = MemberPermissionMatrix.hasCapability(this, AccessCapability.GRANT_ADMIN_ROLE)

val Member.canPublishNews: Boolean
    get() = MemberPermissionMatrix.hasCapability(this, AccessCapability.PUBLISH_NEWS)

val Member.canSendAdminNotifications: Boolean
    get() = MemberPermissionMatrix.hasCapability(this, AccessCapability.SEND_ADMIN_NOTIFICATIONS)
