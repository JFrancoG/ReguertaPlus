package com.reguerta.user.data.access

import com.google.android.gms.tasks.Tasks
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.QuerySnapshot
import com.reguerta.user.domain.access.Member
import com.reguerta.user.domain.access.MemberRepository
import com.reguerta.user.domain.access.MemberRole
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class FirestoreMemberRepository(
    private val firestore: FirebaseFirestore,
    private val env: String = "develop",
) : MemberRepository {
    private val usersCollectionPath: String
        get() = "$env/collections/users"

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
            "normalizedEmail" to member.normalizedEmail,
            "email" to FieldValue.delete(),
            "emailNormalized" to FieldValue.delete(),
            "authUid" to member.authUid,
            "roles" to member.roles.map { role -> role.toWireValue() },
            "isActive" to member.isActive,
            "producerCatalogEnabled" to member.producerCatalogEnabled,
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
    val displayName = getString("displayName") ?: return null
    val normalizedEmail = getString("normalizedEmail")
        ?: getString("emailNormalized")
        ?: getString("email")?.trim()?.lowercase()
        ?: return null
    val authUid = getString("authUid")
    val isActive = getBoolean("isActive") ?: true
    val producerCatalogEnabled = getBoolean("producerCatalogEnabled") ?: true

    val rawRoles = get("roles") as? List<*>
    val parsedRoles = rawRoles
        ?.mapNotNull { value ->
            (value as? String)?.trim()?.lowercase()?.toMemberRoleOrNull()
        }
        ?.toSet()
        ?: setOf(MemberRole.MEMBER)

    val roles = if (parsedRoles.isEmpty()) {
        setOf(MemberRole.MEMBER)
    } else {
        parsedRoles
    }

    return Member(
        id = id,
        displayName = displayName,
        normalizedEmail = normalizedEmail,
        authUid = authUid,
        roles = roles,
        isActive = isActive,
        producerCatalogEnabled = producerCatalogEnabled,
    )
}

private fun String.toMemberRoleOrNull(): MemberRole? = when (this) {
    "member" -> MemberRole.MEMBER
    "producer" -> MemberRole.PRODUCER
    "admin" -> MemberRole.ADMIN
    else -> null
}

private fun MemberRole.toWireValue(): String = when (this) {
    MemberRole.MEMBER -> "member"
    MemberRole.PRODUCER -> "producer"
    MemberRole.ADMIN -> "admin"
}
