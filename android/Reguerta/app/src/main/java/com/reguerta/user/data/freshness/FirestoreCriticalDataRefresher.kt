package com.reguerta.user.data.freshness

import com.google.firebase.firestore.DocumentSnapshot
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Source
import com.reguerta.user.data.access.decodeDirectoryMemberDocument
import com.reguerta.user.data.access.decodeMemberDocument
import com.reguerta.user.data.commitments.FirestoreSeasonalCommitmentRepository
import com.reguerta.user.data.firestore.ReguertaFirestoreCollection
import com.reguerta.user.data.firestore.ReguertaFirestoreEnvironment
import com.reguerta.user.data.firestore.ReguertaFirestorePath
import com.reguerta.user.data.firestore.toRepositoryException
import com.reguerta.user.data.products.decodeProductDocuments
import com.reguerta.user.domain.RepositoryErrorKind
import com.reguerta.user.domain.RepositoryException
import com.reguerta.user.domain.access.Member
import com.reguerta.user.domain.access.canManageMembers
import com.reguerta.user.domain.freshness.CriticalCollection
import com.reguerta.user.domain.freshness.CriticalDataRefreshPayload
import com.reguerta.user.domain.freshness.CriticalDataRefreshScope
import com.reguerta.user.domain.freshness.CriticalDataRefresher
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.tasks.await

class FirestoreCriticalDataRefresher(
    private val firestore: FirebaseFirestore,
) : CriticalDataRefresher {
    override suspend fun refresh(
        scope: CriticalDataRefreshScope,
        collections: Set<CriticalCollection>,
    ): CriticalDataRefreshPayload = coroutineScope {
        val environment = scope.resolveEnvironment()
        val path = ReguertaFirestorePath(environment = environment)
        val authenticatedMember = refreshMember(
            path = path,
            memberId = scope.authenticatedMemberId,
            resource = "criticalDataRefresh.members.authenticated",
        ).requiringPrincipal(scope.principalUid)
        if (scope.requiresAccessScopeRetry(authenticatedMember)) {
            return@coroutineScope CriticalDataRefreshPayload(
                authenticatedMemberId = authenticatedMember.id,
                authenticatedMember = authenticatedMember,
                selectedMember = null,
                seasonalCommitments = null,
                requiresAccessScopeRetry = true,
            )
        }

        val selectedMember = if (scope.memberId == authenticatedMember.id) {
            authenticatedMember
        } else {
            refreshMember(
                path = path,
                memberId = scope.memberId,
                resource = "criticalDataRefresh.members.selected",
            ).also { member ->
                listOf(member).requiringActiveSelectedMember(scope.memberId)
            }
        }
        val seasonalCommitments = async {
            FirestoreSeasonalCommitmentRepository(
                firestore = firestore,
                environment = environment,
            ).getActiveCommitmentsForMemberFromServer(selectedMember)
        }
        val pendingResults = collections.map { collection ->
            async {
                refreshCollection(
                    collection = collection,
                    scope = scope,
                    path = path,
                    environment = environment,
                    authenticatedMember = authenticatedMember,
                    selectedMember = selectedMember,
                )
            }
        }
        val results = pendingResults.awaitAll()

        CriticalDataRefreshPayload(
            authenticatedMemberId = authenticatedMember.id,
            authenticatedMember = authenticatedMember,
            selectedMember = selectedMember,
            seasonalCommitments = seasonalCommitments.await(),
            members = results.filterIsInstance<CriticalRefreshResult.Members>()
                .singleOrNull()
                ?.value,
            products = results.filterIsInstance<CriticalRefreshResult.Products>()
                .singleOrNull()
                ?.value,
        )
    }

    private suspend fun refreshCollection(
        collection: CriticalCollection,
        scope: CriticalDataRefreshScope,
        path: ReguertaFirestorePath,
        environment: ReguertaFirestoreEnvironment,
        authenticatedMember: Member,
        selectedMember: Member,
    ): CriticalRefreshResult = try {
        when (collection) {
            CriticalCollection.USERS -> CriticalRefreshResult.Members(
                refreshMembers(
                    scope = scope,
                    path = path,
                    authenticatedMember = authenticatedMember,
                    selectedMember = selectedMember,
                ),
            )

            CriticalCollection.PRODUCTS -> CriticalRefreshResult.Products(
                refreshProducts(path = path),
            )

            CriticalCollection.ORDERS -> {
                coroutineScope {
                    listOf(
                        path.collectionPath(ReguertaFirestoreCollection.ORDERS),
                        environment.legacyCollectionPath("orders"),
                    ).map { collectionPath ->
                        async {
                            refreshOwnerScopedCollection(
                                collectionPath = collectionPath,
                                memberId = scope.memberId,
                            )
                        }
                    }.awaitAll()
                }
                CriticalRefreshResult.Completed
            }

            CriticalCollection.ORDERLINES -> {
                coroutineScope {
                    listOf(
                        path.collectionPath(ReguertaFirestoreCollection.ORDER_LINES),
                        environment.legacyCollectionPath("orderLines"),
                    ).map { collectionPath ->
                        async {
                            refreshOwnerScopedCollection(
                                collectionPath = collectionPath,
                                memberId = scope.memberId,
                            )
                        }
                    }.awaitAll()
                }
                CriticalRefreshResult.Completed
            }

            CriticalCollection.CONTAINERS -> {
                firestore.collection(environment.legacyCollectionPath("containers"))
                    .get(Source.SERVER)
                    .await()
                CriticalRefreshResult.Completed
            }

            CriticalCollection.MEASURES -> {
                firestore.collection(environment.legacyCollectionPath("measures"))
                    .get(Source.SERVER)
                    .await()
                CriticalRefreshResult.Completed
            }
        }
    } catch (error: CancellationException) {
        throw error
    } catch (error: Exception) {
        throw error.toRepositoryException(resource = "criticalDataRefresh.${collection.wireKey}")
    }

    private suspend fun refreshMembers(
        scope: CriticalDataRefreshScope,
        path: ReguertaFirestorePath,
        authenticatedMember: Member,
        selectedMember: Member,
    ): List<Member> {
        val usersPath = path.collectionPath(ReguertaFirestoreCollection.USERS)
        if (scope.canManageMembers) {
            val snapshot = firestore.collection(usersPath).get(Source.SERVER).await()
            return snapshot.documents
                .map { document -> decodeMemberDocument(document.id, document.requiredData("members.document")) }
                .associateByTo(linkedMapOf(), Member::id)
                .apply {
                    this[authenticatedMember.id] = authenticatedMember
                    this[selectedMember.id] = selectedMember
                }
                .values
                .sortedBy { member -> member.displayName.lowercase() }
                .requiringActiveSelectedMember(scope.memberId)
        }

        val directoryPath = path.collectionPath(ReguertaFirestoreCollection.MEMBER_DIRECTORY)
        return firestore.collection(directoryPath)
            .whereEqualTo("isActive", true)
            .get(Source.SERVER)
            .await()
            .documents
            .map { document ->
                decodeDirectoryMemberDocument(
                    documentId = document.id,
                    data = document.requiredData("members.directory.document"),
                )
            }
            .associateByTo(linkedMapOf(), Member::id)
            .apply {
                this[authenticatedMember.id] = authenticatedMember
                this[selectedMember.id] = selectedMember
            }
            .values
            .sortedBy { member -> member.displayName.lowercase() }
            .requiringActiveSelectedMember(scope.memberId)
    }

    private suspend fun refreshMember(
        path: ReguertaFirestorePath,
        memberId: String,
        resource: String,
    ): Member = try {
        val usersPath = path.collectionPath(ReguertaFirestoreCollection.USERS)
        val document = firestore.document("$usersPath/$memberId")
            .get(Source.SERVER)
            .await()
        if (!document.exists()) {
            throw RepositoryException(
                kind = RepositoryErrorKind.NOT_FOUND,
                resource = resource,
            )
        }
        decodeMemberDocument(
            documentId = document.id,
            data = document.requiredData(resource),
        )
    } catch (error: CancellationException) {
        throw error
    } catch (error: Exception) {
        throw error.toRepositoryException(resource = resource)
    }

    private suspend fun refreshProducts(path: ReguertaFirestorePath) =
        firestore.collection(path.collectionPath(ReguertaFirestoreCollection.PRODUCTS))
            .get(Source.SERVER)
            .await()
            .documents
            .map { document -> document.id to document.requiredData("products.document") }
            .let(::decodeProductDocuments)

    private suspend fun refreshOwnerScopedCollection(
        collectionPath: String,
        memberId: String,
    ) = coroutineScope {
        OWNER_FIELD_NAMES.map { ownerField ->
            async {
                firestore.collection(collectionPath)
                    .whereEqualTo(ownerField, memberId)
                    .get(Source.SERVER)
                    .await()
            }
        }.awaitAll()
        Unit
    }
}

private sealed interface CriticalRefreshResult {
    data class Members(val value: List<Member>) : CriticalRefreshResult

    data class Products(val value: List<com.reguerta.user.domain.products.Product>) : CriticalRefreshResult

    data object Completed : CriticalRefreshResult
}

private val OWNER_FIELD_NAMES = listOf("userId", "memberId")

private fun CriticalDataRefreshScope.resolveEnvironment(): ReguertaFirestoreEnvironment =
    ReguertaFirestoreEnvironment.entries.firstOrNull { candidate ->
        candidate.wireValue == environment
    } ?: throw RepositoryException(
        kind = RepositoryErrorKind.INVALID_DATA,
        resource = "criticalDataRefresh.environment",
    )

private fun ReguertaFirestoreEnvironment.legacyCollectionPath(collection: String): String =
    "$wireValue/collections/$collection"

private fun DocumentSnapshot.requiredData(resource: String): Map<String, Any> =
    data ?: throw RepositoryException(
        kind = RepositoryErrorKind.INVALID_DATA,
        resource = resource,
    )

internal fun CriticalDataRefreshScope.requiresAccessScopeRetry(
    authenticatedMember: Member,
): Boolean = authenticatedMember.id != authenticatedMemberId ||
    !authenticatedMember.isActive ||
    authenticatedMember.canManageMembers != canManageMembers ||
    (!authenticatedMember.canManageMembers && memberId != authenticatedMemberId)

internal fun Member.requiringPrincipal(principalUid: String): Member {
    if (authUid != principalUid) {
        throw RepositoryException(
            kind = RepositoryErrorKind.PERMISSION_DENIED,
            resource = "criticalDataRefresh.members.authenticatedPrincipal",
        )
    }
    return this
}

internal fun List<Member>.requiringActiveSelectedMember(memberId: String): List<Member> {
    val selectedMember = firstOrNull { member -> member.id == memberId }
        ?: throw RepositoryException(
            kind = RepositoryErrorKind.NOT_FOUND,
            resource = "criticalDataRefresh.members.selected",
        )
    if (!selectedMember.isActive) {
        throw RepositoryException(
            kind = RepositoryErrorKind.PERMISSION_DENIED,
            resource = "criticalDataRefresh.members.selected",
        )
    }
    return this
}
