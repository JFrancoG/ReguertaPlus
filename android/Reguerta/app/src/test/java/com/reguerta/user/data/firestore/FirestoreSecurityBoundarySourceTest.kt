package com.reguerta.user.data.firestore

import java.nio.file.Files
import java.nio.file.Path
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class FirestoreSecurityBoundarySourceTest {
    @Test
    fun `member lookup uses auth link document and never global identity queries`() {
        val source = readMainSource("data/access/FirestoreMemberRepository.kt")

        assertTrue(source.contains("ReguertaFirestoreCollection.AUTH_LINKS"))
        assertTrue(source.contains("document(authUid)"))
        assertFalse(source.contains("whereEqualTo(\"authUid\""))
        assertFalse(source.contains("whereEqualTo(\"normalizedEmail\""))
        assertFalse(source.contains("whereEqualTo(\"emailNormalized\""))
    }

    @Test
    fun `only active admins list inactive members`() {
        val source = readMainSource("data/access/FirestoreMemberRepository.kt")
        val permissions = readMainSource("domain/access/MemberPermissionMatrix.kt")

        assertTrue(source.contains("getMembersVisibleTo(member: Member)"))
        assertTrue(source.contains("val canReadPrivateMembers = member.canManageMembers"))
        assertTrue(source.contains("if (canReadPrivateMembers)"))
        assertTrue(source.contains("ReguertaFirestoreCollection.MEMBER_DIRECTORY"))
        assertTrue(source.contains("whereEqualTo(\"isActive\", true)"))
        assertTrue(source.contains("if (candidate.id == member.id) member"))
        assertTrue(permissions.contains("get() = isActive && MemberPermissionMatrix.hasCapability"))
    }

    @Test
    fun `production composition has no in-memory or chained repositories`() {
        val source = readMainSource("presentation/root/ReguertaRootViewModelFactory.kt")

        assertFalse(source.contains("InMemory"))
        assertFalse(source.contains("Chained"))
        assertFalse(source.contains("developImpersonationEnabled = BuildConfig.DEBUG"))
    }

    @Test
    fun `anonymous startup reads public config document`() {
        val source = readMainSource("data/startup/FirestoreStartupVersionPolicyRepository.kt")

        assertTrue(source.contains("ReguertaFirestoreDocument.PUBLIC"))
        assertFalse(source.contains("ReguertaFirestoreDocument.GLOBAL"))
    }

    @Test
    fun `member operational config excludes private global config`() {
        val calendar = readMainSource("data/calendar/FirestoreDeliveryCalendarRepository.kt")
        val freshness = readMainSource("data/freshness/FirestoreCriticalDataFreshnessRemoteRepository.kt")

        assertTrue(calendar.contains("ReguertaFirestoreDocument.MEMBER"))
        assertTrue(freshness.contains("ReguertaFirestoreDocument.MEMBER"))
        assertFalse(calendar.contains("ReguertaFirestoreDocument.GLOBAL"))
        assertFalse(freshness.contains("ReguertaFirestoreDocument.GLOBAL"))
    }

    @Test
    fun `owner order fallbacks never query globally by week`() {
        val repository = readMainSource("data/orders/FirestoreOrdersRepository.kt")
        val route = readMainSource("presentation/orders/ReguertaRootMyOrderRoute.kt")
        val checkout = route
            .substringAfter("internal suspend fun submitCheckoutOrderToFirestore(")
            .substringBefore("private fun ProductPricingMode.wireValue()")
        val producerStatusLookup = route
            .substringAfter("private suspend fun loadMyOrderProducerStatuses(")
            .substringBefore("private fun resolveMyOrderConsultaWindow(")
        val globalOrdersByWeek = Regex("collection\\(ordersPath\\)\\s*\\.whereEqualTo\\(\"weekKey\"")
        val globalLinesByWeek = Regex("collection\\(orderLinesPath\\)\\s*\\.whereEqualTo\\(\"weekKey\"")

        assertFalse(globalOrdersByWeek.containsMatchIn(repository))
        assertFalse(globalLinesByWeek.containsMatchIn(repository))
        assertFalse(globalOrdersByWeek.containsMatchIn(route))
        assertFalse(globalLinesByWeek.containsMatchIn(route))
        assertFalse(repository.contains("collection(ordersPath)\n                .orderBy(\"weekKey\")"))
        assertFalse(route.contains("val currentOrder = runCatching"))
        assertFalse(route.contains("val existingLinesSnapshot = runCatching"))
        assertTrue(checkout.contains("val effectiveOrderId = resolveMyOrderCheckoutOrderId("))
        assertTrue(checkout.contains(".whereEqualTo(\"orderId\", effectiveOrderId)"))
        assertTrue(checkout.contains("\"orderId\" to effectiveOrderId"))
        assertTrue(checkout.contains("\"${'$'}{effectiveOrderId}_${'$'}{line.product.id}\""))
        assertTrue(producerStatusLookup.contains(".whereEqualTo(ownerFieldName, memberId)"))
        assertTrue(producerStatusLookup.contains(".whereEqualTo(\"weekKey\", weekKey)"))
        assertTrue(producerStatusLookup.contains("resolveUniqueExistingMyOrderId(orderDocuments.keys)"))
        assertFalse(producerStatusLookup.contains("firestore.document("))
    }

    @Test
    fun `notification feed reads only the member inbox`() {
        val source = readMainSource("data/notifications/FirestoreNotificationRepository.kt")

        assertTrue(source.contains("notificationInboxCollectionPath(member.id)"))
        assertTrue(source.contains("/notificationInbox"))
        assertTrue(source.contains("orderBy(\"sentAt\", Query.Direction.DESCENDING)"))
        assertFalse(source.contains("firestore.collection(notificationsCollectionPath).get()"))
        assertFalse(source.contains("whereArrayContains(\"recipientUserIds\""))
    }

    @Test
    fun `member news query constrains inactive documents`() {
        val source = readMainSource("data/news/FirestoreNewsRepository.kt")

        assertTrue(source.contains("if (member.isAdmin)"))
        assertTrue(source.contains("whereEqualTo(\"active\", true)"))
    }

    @Test
    fun `news writes carry canonical publisher id without replacing display text`() {
        val repository = readMainSource("data/news/FirestoreNewsRepository.kt")
        val actions = readMainSource("presentation/root/SessionCommunityActions.kt")

        assertTrue(repository.contains("\"publishedByUserId\" to publishedByUserId"))
        assertTrue(actions.contains("publishedByUserId = mode.member.id"))
        assertTrue(actions.contains("publishedBy = existing?.publishedBy ?: mode.member.displayName"))
    }

    @Test
    fun `shift swaps have no direct firestore write path`() {
        val repository = readMainSource("data/shiftswap/FirestoreShiftSwapRequestRepository.kt")
        val client = readMainSource("data/shiftswap/FirebaseShiftSwapTransitionClient.kt")

        assertFalse(repository.contains(".set("))
        assertFalse(repository.contains(".update("))
        assertFalse(repository.contains(".delete("))
        assertTrue(client.contains("transitionShiftSwap"))
        assertFalse(client.contains("actorAuthUid"))
        assertFalse(client.contains("requesterUserId"))
    }

    private fun readMainSource(relativePath: String): String {
        val projectRoot = findProjectRoot(Path.of(System.getProperty("user.dir")))
        return Files.readString(projectRoot.resolve("app/src/main/java/com/reguerta/user/$relativePath"))
    }

    private fun findProjectRoot(start: Path): Path =
        generateSequence(start.toAbsolutePath()) { it.parent }
            .first { Files.exists(it.resolve("app/src/main/java/com/reguerta/user")) }
}
