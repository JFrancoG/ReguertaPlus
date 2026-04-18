package com.reguerta.user.data.access

import com.google.android.gms.tasks.Tasks
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.FieldValue
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

    override suspend fun findByEmailNormalized(emailNormalized: String): Member? = withContext(Dispatchers.IO) {
        runCatching {
            var snapshot = Tasks.await(
                firestore.collection(usersCollectionPath)
                    .whereEqualTo("normalizedEmail", emailNormalized)
                    .limit(1)
                    .get(),
            )
            if (snapshot.isEmpty) {
                snapshot = Tasks.await(
                    firestore.collection(usersCollectionPath)
                        .whereEqualTo("emailNormalized", emailNormalized)
                        .limit(1)
                        .get(),
                )
            }
            snapshot.documents.firstOrNull()?.toMember()
        }.getOrNull()
    }

    override suspend fun findByAuthUid(authUid: String): Member? = withContext(Dispatchers.IO) {
        runCatching {
            val snapshot = Tasks.await(
                firestore.collection(usersCollectionPath)
                    .whereEqualTo("authUid", authUid)
                    .limit(1)
                    .get(),
            )
            snapshot.documents.firstOrNull()?.toMember()
        }.getOrNull()
    }

    override suspend fun linkAuthUid(memberId: String, authUid: String): Member = withContext(Dispatchers.IO) {
        val docRef = firestore.collection(usersCollectionPath).document(memberId)
        val defaultMember = Member(
            id = memberId,
            displayName = "",
            normalizedEmail = "",
            authUid = authUid,
            roles = setOf(MemberRole.MEMBER),
            isActive = true,
            producerCatalogEnabled = true,
            isCommonPurchaseManager = false,
            producerParity = null,
            ecoCommitmentMode = EcoCommitmentMode.WEEKLY,
            ecoCommitmentParity = null,
        )

        runCatching {
            Tasks.await(docRef.set(mapOf("authUid" to authUid), com.google.firebase.firestore.SetOptions.merge()))
            val snapshot = Tasks.await(docRef.get())
            snapshot.toMember() ?: defaultMember
        }.getOrDefault(defaultMember)
    }

    override suspend fun getAllMembers(): List<Member> = withContext(Dispatchers.IO) {
        runCatching {
            val snapshot: QuerySnapshot = Tasks.await(
                firestore.collection(usersCollectionPath).get(),
            )
            snapshot.documents.mapNotNull { it.toMember() }
                .sortedBy { it.displayName.lowercase() }
        }.getOrDefault(emptyList())
    }

    override suspend fun upsertMember(member: Member): Member = withContext(Dispatchers.IO) {
        val payload = mapOf(
            "displayName" to member.displayName,
            "companyName" to (member.companyName ?: FieldValue.delete()),
            "phoneNumber" to (member.phoneNumber ?: FieldValue.delete()),
            "normalizedEmail" to member.normalizedEmail,
            "email" to FieldValue.delete(),
            "emailNormalized" to FieldValue.delete(),
            "authUid" to member.authUid,
            "roles" to member.roles.map { role -> role.toWireValue() },
            "isProducer" to member.roles.contains(MemberRole.PRODUCER),
            "isAdmin" to member.roles.contains(MemberRole.ADMIN),
            "isActive" to member.isActive,
            "available" to member.isActive,
            "producerCatalogEnabled" to member.producerCatalogEnabled,
            "isCommonPurchaseManager" to member.isCommonPurchaseManager,
        )

        runCatching {
            Tasks.await(
                firestore.collection(usersCollectionPath)
                    .document(member.id)
                    .set(payload, com.google.firebase.firestore.SetOptions.merge()),
            )
            member
        }.getOrDefault(member)
    }
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

private fun MemberRole.toWireValue(): String = when (this) {
    MemberRole.MEMBER -> "member"
    MemberRole.PRODUCER -> "producer"
    MemberRole.ADMIN -> "admin"
}
