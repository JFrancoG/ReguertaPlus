package com.reguerta.user.data.firestore

import com.google.android.gms.tasks.Tasks
import com.google.firebase.firestore.DocumentSnapshot
import com.google.firebase.firestore.FirebaseFirestore
import com.reguerta.user.domain.access.AccessCapability
import com.reguerta.user.domain.access.AuthPrincipal
import com.reguerta.user.domain.access.MemberPermissionMatrix
import com.reguerta.user.presentation.access.ReviewerEnvironmentRouter
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class FirestoreReviewerEnvironmentRouter(
    private val firestore: FirebaseFirestore,
) : ReviewerEnvironmentRouter {
    override suspend fun applyRoutingFor(principal: AuthPrincipal) {
        if (ReguertaRuntimeEnvironment.baseFirestoreEnvironment != ReguertaFirestoreEnvironment.PRODUCTION) {
            ReguertaRuntimeEnvironment.resetToBaseEnvironment()
            return
        }
        val reviewerPolicy = loadReviewerPolicy()
        val normalizedEmail = principal.email.trim().lowercase()
        val isAllowlisted = reviewerPolicy.emails.contains(normalizedEmail) ||
            reviewerPolicy.uids.contains(principal.uid)
        val reviewerRoutingEnabled = MemberPermissionMatrix.reviewerCapabilities.contains(
            AccessCapability.ROUTE_PRODUCTION_REVIEWER_TO_DEVELOP,
        )
        val targetEnvironment = if (isAllowlisted && reviewerRoutingEnabled) {
            ReguertaFirestoreEnvironment.DEVELOP
        } else {
            ReguertaFirestoreEnvironment.PRODUCTION
        }
        ReguertaRuntimeEnvironment.applySessionEnvironment(targetEnvironment)
    }

    override fun resetToBaseEnvironment() {
        ReguertaRuntimeEnvironment.resetToBaseEnvironment()
    }

    private suspend fun loadReviewerPolicy(): ReviewerRoutingPolicy = withContext(Dispatchers.IO) {
        val candidates = listOf(
            "production/plus-collections/config/global",
            "production/collections/config/global",
            "production/config/global",
        )
        val snapshot = candidates.firstNotNullOfOrNull { path ->
            runCatching { Tasks.await(firestore.document(path).get()) }
                .getOrNull()
                ?.takeIf { it.exists() }
        } ?: return@withContext ReviewerRoutingPolicy.EMPTY
        snapshot.toReviewerRoutingPolicy()
    }
}

private data class ReviewerRoutingPolicy(
    val emails: Set<String>,
    val uids: Set<String>,
) {
    companion object {
        val EMPTY = ReviewerRoutingPolicy(emptySet(), emptySet())
    }
}

private fun DocumentSnapshot.toReviewerRoutingPolicy(): ReviewerRoutingPolicy {
    val payload = data.orEmpty()
    val rootEmails = payload.extractStringSet(
        "reviewerAllowlistEmails",
        "reviewerAllowlist",
        "reviewerEmails",
    )
    val rootUids = payload.extractStringSet(
        "reviewerAllowlistUids",
        "reviewerUids",
    )
    val nestedAllowlist = payload["reviewerAllowlist"] as? Map<*, *>
    val nestedEmails = nestedAllowlist.extractStringSet(
        "emails",
        "allowlistedEmails",
    )
    val nestedUids = nestedAllowlist.extractStringSet(
        "uids",
        "allowlistedUids",
    )
    return ReviewerRoutingPolicy(
        emails = (rootEmails + nestedEmails).mapTo(linkedSetOf()) { it.trim().lowercase() },
        uids = (rootUids + nestedUids).mapTo(linkedSetOf()) { it.trim() },
    )
}

private fun Map<*, *>?.extractStringSet(vararg keys: String): Set<String> {
    if (this == null || keys.isEmpty()) return emptySet()
    val values = linkedSetOf<String>()
    keys.forEach { key ->
        val value = this[key]
        when (value) {
            is String -> {
                val normalized = value.trim()
                if (normalized.isNotEmpty()) {
                    values += normalized
                }
            }

            is List<*> -> {
                value.forEach { item ->
                    val normalized = (item as? String)?.trim()
                    if (!normalized.isNullOrEmpty()) {
                        values += normalized
                    }
                }
            }
        }
    }
    return values
}
