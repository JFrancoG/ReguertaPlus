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
        assertTrue(source.contains("get(Source.SERVER).await()"))
        assertFalse(source.contains("Tasks.await"))
        assertFalse(source.contains("ReguertaFirestoreDocument.GLOBAL"))
    }

    @Test
    fun `delivery calendar prefers member config before legacy global fallback`() {
        val calendar = readMainSource("data/calendar/FirestoreDeliveryCalendarRepository.kt")
        val freshness = readMainSource("data/freshness/FirestoreCriticalDataFreshnessRemoteRepository.kt")

        assertTrue(calendar.contains("ReguertaFirestoreDocument.MEMBER"))
        assertTrue(calendar.contains("ReguertaFirestoreDocument.GLOBAL"))
        assertTrue(
            calendar.indexOf("ReguertaFirestoreDocument.MEMBER") <
                calendar.indexOf("ReguertaFirestoreDocument.GLOBAL"),
        )
        assertTrue(freshness.contains("ReguertaFirestoreDocument.MEMBER"))
        assertTrue(freshness.contains("get(Source.SERVER).await()"))
        assertFalse(freshness.contains("Tasks.await"))
        assertFalse(freshness.contains("ReguertaFirestoreDocument.GLOBAL"))
    }

    @Test
    fun `critical data refresh uses server only strict compatible reads`() {
        val source = readMainSource("data/freshness/FirestoreCriticalDataRefresher.kt")

        assertTrue(source.contains("get(Source.SERVER)"))
        assertFalse(source.contains("Tasks.await"))
        assertTrue(source.contains("if (scope.canManageMembers)"))
        assertTrue(source.contains("memberId = scope.authenticatedMemberId"))
        assertTrue(source.contains(".requiringPrincipal(scope.principalUid)"))
        assertTrue(source.contains("document(\"${'$'}usersPath/${'$'}memberId\")"))
        assertTrue(source.contains("ReguertaFirestoreCollection.MEMBER_DIRECTORY"))
        assertTrue(source.contains("whereEqualTo(\"isActive\", true)"))
        assertTrue(source.contains("ReguertaFirestoreCollection.PRODUCTS"))
        assertTrue(source.contains("ReguertaFirestoreCollection.ORDERS"))
        assertTrue(source.contains("ReguertaFirestoreCollection.ORDER_LINES"))
        assertTrue(source.contains("legacyCollectionPath(\"orders\")"))
        assertTrue(source.contains("legacyCollectionPath(\"orderLines\")"))
        assertTrue(source.contains("legacyCollectionPath(\"containers\")"))
        assertTrue(source.contains("legacyCollectionPath(\"measures\")"))
        assertTrue(source.contains("OWNER_FIELD_NAMES = listOf(\"userId\", \"memberId\")"))
        assertTrue(source.contains("whereEqualTo(ownerField, memberId)"))
        assertTrue(source.contains("count()"))
        assertTrue(source.contains("get(AggregateSource.SERVER)"))
        assertTrue(
            source.indexOf(".requiringPrincipal(scope.principalUid)") <
                source.indexOf("scope.requiresAccessScopeRetry(authenticatedMember)"),
        )
        assertTrue(
            source.indexOf("scope.requiresAccessScopeRetry(authenticatedMember)") <
                source.indexOf("val pendingResults"),
        )
    }

    @Test
    fun `my order materialization repositories use cancellable task awaits`() {
        val sources = listOf(
            readMainSource("data/access/FirestoreMemberRepository.kt"),
            readMainSource("data/products/FirestoreProductRepository.kt"),
            readMainSource("data/commitments/FirestoreSeasonalCommitmentRepository.kt"),
        )

        sources.forEach { source ->
            assertTrue(source.contains("kotlinx.coroutines.tasks.await"))
            assertFalse(source.contains("Tasks.await"))
        }
    }

    @Test
    fun `critical freshness reads commitments by canonical user id`() {
        val refresher = readMainSource("data/freshness/FirestoreCriticalDataRefresher.kt")
        val commitments = readMainSource("data/commitments/FirestoreSeasonalCommitmentRepository.kt")

        assertTrue(refresher.contains("getActiveCommitmentsForMemberFromServer"))
        assertTrue(commitments.contains("SeasonalCommitmentCanonicalUserField"))
        assertTrue(commitments.contains("loadActiveCommitmentsForMember"))
        assertFalse(commitments.contains("whereEqualTo(field, target)"))
        assertTrue(commitments.contains("get(Source.SERVER)"))
    }

    @Test
    fun `shift calendar and swap reads bypass the local firestore cache`() {
        val sources = listOf(
            readMainSource("data/shifts/FirestoreShiftRepository.kt"),
            readMainSource("data/calendar/FirestoreDeliveryCalendarRepository.kt"),
            readMainSource("data/shiftswap/FirestoreShiftSwapRequestRepository.kt"),
        )

        sources.forEach { source -> assertTrue(source.contains("get(Source.SERVER)")) }
    }

    @Test
    fun `shift planning retry uses create if absent transaction without merge writes`() {
        val source = readMainSource("data/shiftplanning/FirestoreShiftPlanningRequestRepository.kt")

        assertTrue(source.contains("runTransaction"))
        assertFalse(source.contains("SetOptions"))
        assertFalse(source.contains(".set(payload, SetOptions.merge())"))
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
    fun `notification feed reads the complete member inbox and sorts after strict decoding`() {
        val source = readMainSource("data/notifications/FirestoreNotificationRepository.kt")

        assertTrue(source.contains("notificationInboxCollectionPath(member.id)"))
        assertTrue(source.contains("/notificationInbox"))
        assertFalse(source.contains("orderBy(\"sentAt\""))
        assertTrue(source.contains("decodeNotificationDocuments("))
        assertTrue(source.contains(".sortedByDescending(NotificationEvent::sentAtMillis)"))
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
    fun `news writes retain the publisher display text`() {
        val repository = readMainSource("data/news/FirestoreNewsRepository.kt")
        val actions = readMainSource("presentation/root/SessionCommunityActions.kt")

        assertTrue(repository.contains("\"publishedBy\" to persisted.publishedBy"))
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

    @Test
    fun `delivery calendar mutations have no direct firestore write path`() {
        val repository = readMainSource("data/calendar/FirestoreDeliveryCalendarRepository.kt")
        val client = readMainSource("data/calendar/FirebaseDeliveryCalendarMutationClient.kt")

        assertFalse(repository.contains(".set("))
        assertFalse(repository.contains(".update("))
        assertFalse(repository.contains(".delete()"))
        assertTrue(client.contains("resolveDeliveryCalendarMutationContext"))
        assertTrue(client.contains("transitionDeliveryCalendarOverride"))
        assertFalse(client.contains("updatedByUserId"))
        assertFalse(client.contains("updatedAtMillisProvider"))
    }

    private fun readMainSource(relativePath: String): String {
        val projectRoot = findProjectRoot(Path.of(System.getProperty("user.dir")))
        return Files.readString(projectRoot.resolve("app/src/main/java/com/reguerta/user/$relativePath"))
    }

    private fun findProjectRoot(start: Path): Path =
        generateSequence(start.toAbsolutePath()) { it.parent }
            .first { Files.exists(it.resolve("app/src/main/java/com/reguerta/user")) }
}
