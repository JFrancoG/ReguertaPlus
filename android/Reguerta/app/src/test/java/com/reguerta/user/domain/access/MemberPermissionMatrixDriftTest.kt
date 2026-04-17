package com.reguerta.user.domain.access

import com.reguerta.user.data.access.InMemoryMemberRepository
import java.nio.file.Files
import java.nio.file.Path
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class MemberPermissionMatrixDriftTest {
    @Test
    fun `canonical matrix capabilities match android permission matrix`() {
        val matrix = loadCanonicalMatrix()

        CanonicalAccessRole.entries.forEach { role ->
            val expected = matrix
                .resolvedCapabilitiesByRole
                .getValue(role.wireValue)
                .mapNotNull(AccessCapability::fromWireValue)
                .toSet()
            val actual = MemberPermissionMatrix.capabilitiesFor(role)
            assertEquals("Role ${role.wireValue} drift detected", expected, actual)
        }
    }

    @Test
    fun `common purchase manager override grants catalog management`() {
        val member = Member(
            id = "member_common_purchase_001",
            displayName = "Compra común",
            normalizedEmail = "compras@reguerta.app",
            authUid = null,
            roles = setOf(MemberRole.MEMBER),
            isActive = true,
            producerCatalogEnabled = true,
            isCommonPurchaseManager = true,
        )

        assertTrue(member.canManageProductCatalog)
    }

    @Test
    fun `in-memory fixtures stay aligned with canonical matrix`() = runBlocking {
        val membersById = InMemoryMemberRepository()
            .getAllMembers()
            .associateBy(Member::id)

        val admin = checkNotNull(membersById["member_admin_001"])
        assertTrue(admin.canManageMembers)
        assertTrue(admin.canGrantAdminRole)
        assertTrue(admin.canPublishNews)
        assertTrue(admin.canSendAdminNotifications)

        val producer = checkNotNull(membersById["member_producer_001"])
        assertTrue(producer.canManageProductCatalog)
        assertTrue(producer.canAccessReceivedOrders)

        val member = checkNotNull(membersById["member_member_001"])
        assertTrue(member.canAccessCommonHomeModules)
        assertTrue(!member.canManageMembers)
        assertTrue(!member.canAccessReceivedOrders)
    }

    private fun loadCanonicalMatrix(): CanonicalMatrix {
        val matrixPath = findRepoRoot(Path.of(System.getProperty("user.dir")))
            .resolve(MATRIX_RELATIVE_PATH)
        val raw = String(Files.readAllBytes(matrixPath))
        val directCapabilitiesByRole = mutableMapOf<String, MutableSet<String>>()
        val inheritedRolesByRole = mutableMapOf<String, MutableSet<String>>()
        val tokenRegex = "\"([a-z_]+)\"".toRegex()

        var inRolesSection = false
        var currentRole: String? = null
        var currentArrayKey: String? = null

        raw.lineSequence().forEach { originalLine ->
            val line = originalLine.trim()
            if (line.isEmpty()) return@forEach

            if (!inRolesSection) {
                if (line.startsWith("\"roles\"")) {
                    inRolesSection = true
                }
                return@forEach
            }

            if (currentRole == null && line.startsWith("},")) {
                inRolesSection = false
                return@forEach
            }

            if (currentRole == null) {
                tokenRegex.find(line)
                    ?.groupValues
                    ?.getOrNull(1)
                    ?.takeIf { line.endsWith("{") && it in setOf("member", "producer", "admin", "reviewer") }
                    ?.let { roleName ->
                        currentRole = roleName
                        directCapabilitiesByRole.putIfAbsent(roleName, mutableSetOf())
                        inheritedRolesByRole.putIfAbsent(roleName, mutableSetOf())
                    }
                return@forEach
            }

            if (line.startsWith("\"capabilities\"")) {
                currentArrayKey = "capabilities"
            } else if (line.startsWith("\"inherits\"")) {
                currentArrayKey = "inherits"
            }

            if (currentArrayKey != null) {
                val matches = tokenRegex.findAll(line).map { matchResult -> matchResult.groupValues[1] }
                when (currentArrayKey) {
                    "capabilities" -> directCapabilitiesByRole.getValue(currentRole).addAll(matches.toList())
                    "inherits" -> inheritedRolesByRole.getValue(currentRole).addAll(matches.toList())
                }
                if (line.contains(']')) {
                    currentArrayKey = null
                }
            }

            if (currentArrayKey == null && (line == "}" || line == "},")) {
                currentRole = null
            }
        }

        fun resolveRoleCapabilities(roleName: String, visiting: MutableSet<String> = mutableSetOf()): Set<String> {
            if (!visiting.add(roleName)) {
                error("Cycle detected while resolving role inheritance for $roleName")
            }
            val directCapabilities = directCapabilitiesByRole[roleName].orEmpty()
            val inheritedCapabilities = inheritedRolesByRole[roleName]
                .orEmpty()
                .flatMap { inheritedRole -> resolveRoleCapabilities(inheritedRole, visiting) }
                .toSet()
            visiting.remove(roleName)
            return directCapabilities + inheritedCapabilities
        }

        val resolved = directCapabilitiesByRole.keys.associateWith { roleName -> resolveRoleCapabilities(roleName) }
        return CanonicalMatrix(resolvedCapabilitiesByRole = resolved)
    }

    private fun findRepoRoot(start: Path): Path =
        generateSequence(start) { path -> path.parent }
            .firstOrNull { candidate -> Files.exists(candidate.resolve(MATRIX_RELATIVE_PATH)) }
            ?: error("Could not locate repository root from ${start.toAbsolutePath()}")

    private data class CanonicalMatrix(
        val resolvedCapabilitiesByRole: Map<String, Set<String>>,
    )

    private companion object {
        const val MATRIX_RELATIVE_PATH = "spec/app/hu-044-canonical-role-permission-matrix-and-test-fixtures/role-permission-matrix.v1.json"
    }
}
