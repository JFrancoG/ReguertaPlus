package com.reguerta.user.data.access

import com.google.firebase.firestore.FirebaseFirestore
import com.reguerta.user.data.firestore.ReguertaFirestoreCollection
import com.reguerta.user.data.firestore.ReguertaFirestoreEnvironment
import com.reguerta.user.data.firestore.ReguertaFirestorePath
import com.reguerta.user.data.firestore.toRepositoryException
import com.reguerta.user.domain.RepositoryErrorKind
import com.reguerta.user.domain.RepositoryException
import com.reguerta.user.domain.access.EcoCommitmentMode
import com.reguerta.user.domain.access.Member
import com.reguerta.user.domain.access.MemberRepository
import com.reguerta.user.domain.access.MemberRole
import com.reguerta.user.domain.access.ProducerParity
import com.reguerta.user.domain.access.canManageMembers
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext

class FirestoreMemberRepository(
    private val firestore: FirebaseFirestore,
    private val environment: ReguertaFirestoreEnvironment? = null,
) : MemberRepository {
    private val firestorePath = ReguertaFirestorePath(environment = environment)

    private val usersCollectionPath: String
        get() = firestorePath.collectionPath(ReguertaFirestoreCollection.USERS)

    private val authLinksCollectionPath: String
        get() = firestorePath.collectionPath(ReguertaFirestoreCollection.AUTH_LINKS)

    private val memberDirectoryCollectionPath: String
        get() = firestorePath.collectionPath(ReguertaFirestoreCollection.MEMBER_DIRECTORY)

    override suspend fun findByAuthUid(authUid: String): Member? = withContext(Dispatchers.IO) {
        try {
            val authLink = firestore.collection(authLinksCollectionPath)
                .document(authUid)
                .get()
                .await()
            if (!authLink.exists()) return@withContext null
            val authLinkData: Map<String, Any> = authLink.data ?: invalidDocument("authLinks.document")
            val memberId = authLinkData.requiredString(
                keys = arrayOf("memberId"),
                resource = "authLinks.document",
            )
            val memberSnapshot = firestore.collection(usersCollectionPath)
                .document(memberId)
                .get()
                .await()
            if (!memberSnapshot.exists()) {
                null
            } else {
                val memberData: Map<String, Any> = memberSnapshot.data ?: invalidDocument("members.document")
                decodeMemberDocument(memberSnapshot.id, memberData)
            }
        } catch (error: Exception) {
            throw error.toRepositoryException(resource = "members.authLink")
        }
    }

    override suspend fun getMembersVisibleTo(member: Member): List<Member> = withContext(Dispatchers.IO) {
        try {
            val canReadPrivateMembers = member.canManageMembers
            val snapshot = if (canReadPrivateMembers) {
                firestore.collection(usersCollectionPath).get()
            } else {
                firestore.collection(memberDirectoryCollectionPath)
                    .whereEqualTo("isActive", true)
                    .get()
            }.await()
            val visible = snapshot.documents.map { document ->
                val data: Map<String, Any> = document.data ?: invalidDocument(
                    if (canReadPrivateMembers) "members.document" else "members.directory.document",
                )
                if (canReadPrivateMembers) {
                    decodeMemberDocument(document.id, data)
                } else {
                    decodeDirectoryMemberDocument(document.id, data)
                }
            }.map { candidate ->
                if (candidate.id == member.id) member else candidate
            }.toMutableList()
            if (visible.none { it.id == member.id }) {
                visible += member
            }
            visible.sortedBy { it.displayName.lowercase() }
        } catch (error: Exception) {
            throw error.toRepositoryException(resource = "members")
        }
    }

    override suspend fun updateOwnProducerCatalogEnabled(
        member: Member,
        isEnabled: Boolean,
    ): Member = withContext(Dispatchers.IO) {
        try {
            firestore.collection(usersCollectionPath)
                .document(member.id)
                .update(mapOf("producerCatalogEnabled" to isEnabled))
                .await()
            member.copy(producerCatalogEnabled = isEnabled)
        } catch (error: Exception) {
            throw error.toRepositoryException(resource = "members.write")
        }
    }
}

internal fun decodeDirectoryMemberDocument(
    documentId: String,
    data: Map<String, Any?>,
): Member {
    val resource = "members.directory.document"
    val id = requiredDocumentId(documentId, resource)
    if (data.requiredString(arrayOf("userId"), resource) != id) invalidDocument(resource)
    val displayName = data.requiredString(arrayOf("displayName"), resource)
    val companyName = data.optionalString(arrayOf("companyName"), resource)
    val roles = data.directoryRoles(resource)
    if (!data.requiredBoolean("isActive", resource)) invalidDocument(resource)
    val producerCatalogEnabled = data.requiredBoolean("producerCatalogEnabled", resource)
    val isCommonPurchaseManager = data.requiredBoolean("isCommonPurchaseManager", resource)
    val producerParity = optionalParity(data["producerParity"], resource, acceptsLegacyCasing = false)
    val ecoCommitment = data.optionalMap("ecoCommitment", resource) ?: invalidDocument(resource)
    val ecoCommitmentMode = requiredEcoMode(ecoCommitment["mode"], resource)
    val ecoCommitmentParity = optionalParity(
        ecoCommitment["parity"],
        resource,
        acceptsLegacyCasing = false,
    )

    return Member(
        id = id,
        displayName = displayName,
        companyName = companyName,
        phoneNumber = null,
        normalizedEmail = "",
        authUid = null,
        roles = roles,
        isActive = true,
        producerCatalogEnabled = producerCatalogEnabled,
        isCommonPurchaseManager = isCommonPurchaseManager,
        producerParity = producerParity,
        ecoCommitmentMode = ecoCommitmentMode,
        ecoCommitmentParity = ecoCommitmentParity,
    )
}

internal fun decodeMemberDocument(
    documentId: String,
    data: Map<String, Any?>,
): Member {
    val resource = "members.document"
    val id = requiredDocumentId(documentId, resource)
    val displayName = data.optionalString(arrayOf("displayName"), resource)
        ?: listOfNotNull(
            data.optionalString(arrayOf("name"), resource),
            data.optionalString(arrayOf("surname"), resource),
        ).joinToString(" ").ifBlank { null }
        ?: invalidDocument(resource)
    val normalizedEmail = data.optionalString(
        arrayOf("normalizedEmail", "emailNormalized", "email"),
        resource,
    )?.lowercase() ?: invalidDocument(resource)
    val authUid = data.optionalString(arrayOf("authUid"), resource)
    val companyName = data.optionalString(arrayOf("companyName", "company_name", "company"), resource)
    val phoneNumber = data.optionalString(
        arrayOf("phoneNumber", "phone", "telephone", "telefono"),
        resource,
    )
    val isActive = data.optionalBoolean(arrayOf("isActive", "available"), true, resource)
    val producerCatalogEnabled = data.optionalBoolean(arrayOf("producerCatalogEnabled"), true, resource)
    val isCommonPurchaseManager = data.optionalBoolean(
        arrayOf("isCommonPurchaseManager"),
        false,
        resource,
    )
    val producerParity = optionalParity(data["producerParity"], resource, acceptsLegacyCasing = true)
    val ecoCommitment = data.optionalMap("ecoCommitment", resource)
    val ecoCommitmentMode = optionalEcoMode(
        ecoCommitment?.get("mode"),
        EcoCommitmentMode.WEEKLY,
        resource,
        acceptsLegacyCasing = true,
    )
    val ecoCommitmentParity = optionalParity(
        ecoCommitment?.get("parity"),
        resource,
        acceptsLegacyCasing = true,
    )
    val roles = data.fullMemberRoles(resource)

    return Member(
        id = id,
        displayName = displayName,
        companyName = companyName,
        phoneNumber = phoneNumber,
        normalizedEmail = normalizedEmail,
        authUid = authUid,
        roles = roles,
        isActive = isActive,
        producerCatalogEnabled = producerCatalogEnabled,
        isCommonPurchaseManager = isCommonPurchaseManager,
        producerParity = producerParity,
        ecoCommitmentMode = ecoCommitmentMode,
        ecoCommitmentParity = ecoCommitmentParity,
    )
}

private fun requiredDocumentId(documentId: String, resource: String): String {
    val normalized = documentId.trim()
    if (normalized.isBlank() || normalized.contains('/')) invalidDocument(resource)
    return normalized
}

private fun Map<String, Any?>.requiredString(keys: Array<String>, resource: String): String =
    optionalString(keys, resource) ?: invalidDocument(resource)

private fun Map<String, Any?>.optionalString(keys: Array<String>, resource: String): String? {
    keys.forEach { key ->
        val rawValue = this[key] ?: return@forEach
        val value = rawValue as? String ?: invalidDocument(resource)
        value.trim().ifBlank { null }?.let { return it }
    }
    return null
}

private fun Map<String, Any?>.requiredBoolean(field: String, resource: String): Boolean =
    this[field] as? Boolean ?: invalidDocument(resource)

private fun Map<String, Any?>.optionalBoolean(
    keys: Array<String>,
    default: Boolean,
    resource: String,
): Boolean {
    keys.forEach { key ->
        val rawValue = this[key] ?: return@forEach
        return rawValue as? Boolean ?: invalidDocument(resource)
    }
    return default
}

private fun Map<String, Any?>.optionalMap(field: String, resource: String): Map<String, Any?>? {
    val rawValue = this[field] ?: return null
    @Suppress("UNCHECKED_CAST")
    return rawValue as? Map<String, Any?> ?: invalidDocument(resource)
}

private fun Map<String, Any?>.fullMemberRoles(resource: String): Set<MemberRole> {
    val rawRoles = this["roles"]
    val parsedRoles = if (rawRoles == null) {
        emptySet()
    } else {
        val values = rawRoles as? List<*> ?: invalidDocument(resource)
        values.map { value ->
            (value as? String)?.toLegacyMemberRoleOrNull() ?: invalidDocument(resource)
        }.toSet()
    }
    if (parsedRoles.isNotEmpty()) return parsedRoles
    return buildSet {
        add(MemberRole.MEMBER)
        if (optionalBoolean(arrayOf("isProducer"), false, resource)) add(MemberRole.PRODUCER)
        if (optionalBoolean(arrayOf("isAdmin"), false, resource)) add(MemberRole.ADMIN)
    }
}

private fun Map<String, Any?>.directoryRoles(resource: String): Set<MemberRole> {
    val values = this["roles"] as? List<*> ?: invalidDocument(resource)
    if (values.isEmpty()) invalidDocument(resource)
    val roles = values.map { value ->
        when (value) {
            "member" -> MemberRole.MEMBER
            "producer" -> MemberRole.PRODUCER
            "admin" -> MemberRole.ADMIN
            else -> invalidDocument(resource)
        }
    }.toSet()
    if (!roles.contains(MemberRole.MEMBER)) invalidDocument(resource)
    return roles
}

private fun optionalParity(
    rawValue: Any?,
    resource: String,
    acceptsLegacyCasing: Boolean,
): ProducerParity? {
    val value = rawValue ?: return null
    val string = value as? String ?: invalidDocument(resource)
    val normalized = string.trim().let { if (acceptsLegacyCasing) it.lowercase() else it }
    return when (normalized) {
        "even" -> ProducerParity.EVEN
        "odd" -> ProducerParity.ODD
        else -> invalidDocument(resource)
    }
}

private fun requiredEcoMode(rawValue: Any?, resource: String): EcoCommitmentMode {
    val value = rawValue as? String ?: invalidDocument(resource)
    if (value != value.trim()) invalidDocument(resource)
    return when (value) {
        "weekly" -> EcoCommitmentMode.WEEKLY
        "biweekly" -> EcoCommitmentMode.BIWEEKLY
        else -> invalidDocument(resource)
    }
}

private fun optionalEcoMode(
    rawValue: Any?,
    default: EcoCommitmentMode,
    resource: String,
    acceptsLegacyCasing: Boolean,
): EcoCommitmentMode {
    val value = rawValue ?: return default
    val string = value as? String ?: invalidDocument(resource)
    val normalized = string.trim().let { if (acceptsLegacyCasing) it.lowercase() else it }
    return when (normalized) {
        "weekly" -> EcoCommitmentMode.WEEKLY
        "biweekly" -> EcoCommitmentMode.BIWEEKLY
        else -> invalidDocument(resource)
    }
}

private fun String.toLegacyMemberRoleOrNull(): MemberRole? = when (trim().lowercase()) {
    "member", "socio" -> MemberRole.MEMBER
    "producer", "productor" -> MemberRole.PRODUCER
    "admin", "administrador" -> MemberRole.ADMIN
    else -> null
}

private fun invalidDocument(resource: String): Nothing = throw RepositoryException(
    kind = RepositoryErrorKind.INVALID_DATA,
    resource = resource,
)
