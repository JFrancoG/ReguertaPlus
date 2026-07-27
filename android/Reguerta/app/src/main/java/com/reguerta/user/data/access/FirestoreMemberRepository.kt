package com.reguerta.user.data.access

import com.google.android.gms.tasks.Tasks
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.QuerySnapshot
import com.reguerta.user.data.firestore.ReguertaFirestoreCollection
import com.reguerta.user.data.firestore.ReguertaFirestoreEnvironment
import com.reguerta.user.data.firestore.ReguertaFirestorePath
import com.reguerta.user.domain.access.EcoCommitmentMode
import com.reguerta.user.domain.access.Member
import com.reguerta.user.domain.access.MemberRepository
import com.reguerta.user.domain.access.MemberRole
import com.reguerta.user.domain.access.ProducerParity
import kotlinx.coroutines.Dispatchers
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
        val authLink = Tasks.await(
            firestore.collection(authLinksCollectionPath)
                .document(authUid)
                .get(),
        )
        if (!authLink.exists()) return@withContext null
        val memberId = authLink.getString("memberId")
            ?.trim()
            ?.takeIf(String::isNotBlank)
            ?: return@withContext null
        val memberSnapshot = Tasks.await(
            firestore.collection(usersCollectionPath)
                .document(memberId)
                .get(),
        )
        memberSnapshot.toMember()
    }

    override suspend fun getMembersVisibleTo(member: Member): List<Member> = withContext(Dispatchers.IO) {
        val snapshot: QuerySnapshot = Tasks.await(
            if (member.isAdmin) {
                firestore.collection(usersCollectionPath).get()
            } else {
                firestore.collection(memberDirectoryCollectionPath)
                    .whereEqualTo("isActive", true)
                    .get()
            },
        )
        val visible = snapshot.documents.mapNotNull { document ->
            if (member.isAdmin) document.toMember() else document.toDirectoryMember()
        }.map { candidate ->
            if (candidate.id == member.id) member else candidate
        }.toMutableList()
        if (visible.none { it.id == member.id }) {
            visible += member
        }
        visible
            .sortedBy { it.displayName.lowercase() }
    }

    override suspend fun updateOwnProducerCatalogEnabled(
        member: Member,
        isEnabled: Boolean,
    ): Member = withContext(Dispatchers.IO) {
        val document = firestore.collection(usersCollectionPath).document(member.id)
        Tasks.await(
            document.update(
                mapOf(
                    "producerCatalogEnabled" to isEnabled,
                ),
            ),
        )
        member.copy(producerCatalogEnabled = isEnabled)
    }
}

private fun com.google.firebase.firestore.DocumentSnapshot.toDirectoryMember(): Member? {
    val displayName = readFirstNonBlankString("displayName") ?: return null
    val companyName = readFirstNonBlankString("companyName")
    val roles = ((get("roles") as? List<*>)
        ?.mapNotNull { (it as? String)?.trim()?.lowercase()?.toMemberRoleOrNull() }
        ?.toSet()
        ?: emptySet()).ifEmpty { setOf(MemberRole.MEMBER) }
    val ecoCommitment = get("ecoCommitment") as? Map<*, *>
    return Member(
        id = id,
        displayName = displayName,
        companyName = companyName,
        phoneNumber = null,
        normalizedEmail = "",
        authUid = null,
        roles = roles,
        isActive = getBoolean("isActive") == true,
        producerCatalogEnabled = getBoolean("producerCatalogEnabled") ?: true,
        isCommonPurchaseManager = getBoolean("isCommonPurchaseManager") ?: false,
        producerParity = getString("producerParity").toProducerParityOrNull(),
        ecoCommitmentMode = (ecoCommitment?.get("mode") as? String)
            .toEcoCommitmentModeOrDefault(),
        ecoCommitmentParity = (ecoCommitment?.get("parity") as? String)
            .toProducerParityOrNull(),
    )
}

private fun com.google.firebase.firestore.DocumentSnapshot.toMember(): Member? {
    val id = id
    val displayName = readFirstNonBlankString("displayName")
        ?: listOf(
            readFirstNonBlankString("name"),
            readFirstNonBlankString("surname"),
        ).filterNotNull().joinToString(" ").trim().takeIf { it.isNotEmpty() }
        ?: return null
    val companyName = readFirstNonBlankString("companyName", "company_name", "company")
    val phoneNumber = readFirstNonBlankString("phoneNumber", "phone", "telephone", "telefono")
    val normalizedEmail = readFirstNonBlankString("normalizedEmail", "emailNormalized", "email")
        ?.lowercase()
        ?: return null
    val authUid = getString("authUid")?.trim()?.takeIf { it.isNotEmpty() }
    val isActive = getBoolean("isActive") ?: getBoolean("available") ?: true
    val producerCatalogEnabled = getBoolean("producerCatalogEnabled") ?: true
    val isCommonPurchaseManager = getBoolean("isCommonPurchaseManager") ?: false
    val producerParity = getString("producerParity").toProducerParityOrNull()
    val ecoCommitment = get("ecoCommitment") as? Map<*, *>
    val ecoCommitmentMode = (ecoCommitment?.get("mode") as? String).toEcoCommitmentModeOrDefault()
    val ecoCommitmentParity = (ecoCommitment?.get("parity") as? String).toProducerParityOrNull()

    val rawRoles = get("roles") as? List<*>
    val parsedRoles = rawRoles
        ?.mapNotNull { value ->
            (value as? String)?.trim()?.lowercase()?.toMemberRoleOrNull()
        }
        ?.toSet()
        ?: emptySet()

    val roles = parsedRoles.withLegacyRoles(
        isProducer = getBoolean("isProducer") ?: false,
        isAdmin = getBoolean("isAdmin") ?: false,
    )

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

private fun String.toMemberRoleOrNull(): MemberRole? = when (this) {
    "member" -> MemberRole.MEMBER
    "socio" -> MemberRole.MEMBER
    "producer" -> MemberRole.PRODUCER
    "productor" -> MemberRole.PRODUCER
    "admin" -> MemberRole.ADMIN
    "administrador" -> MemberRole.ADMIN
    else -> null
}

private fun Set<MemberRole>.withLegacyRoles(
    isProducer: Boolean,
    isAdmin: Boolean,
): Set<MemberRole> {
    if (isNotEmpty()) {
        return this
    }
    val roles = mutableSetOf(MemberRole.MEMBER)
    if (isProducer) roles.add(MemberRole.PRODUCER)
    if (isAdmin) roles.add(MemberRole.ADMIN)
    return roles
}

private fun com.google.firebase.firestore.DocumentSnapshot.readFirstNonBlankString(
    vararg fieldNames: String,
): String? {
    fieldNames.forEach { key ->
        val value = get(key) as? String
        val normalized = value?.trim()?.takeIf { it.isNotEmpty() }
        if (normalized != null) {
            return normalized
        }
    }
    return null
}

private fun String?.toProducerParityOrNull(): ProducerParity? = when (this?.trim()?.lowercase()) {
    "even" -> ProducerParity.EVEN
    "odd" -> ProducerParity.ODD
    else -> null
}

private fun String?.toEcoCommitmentModeOrDefault(): EcoCommitmentMode = when (this?.trim()?.lowercase()) {
    "biweekly" -> EcoCommitmentMode.BIWEEKLY
    else -> EcoCommitmentMode.WEEKLY
}
