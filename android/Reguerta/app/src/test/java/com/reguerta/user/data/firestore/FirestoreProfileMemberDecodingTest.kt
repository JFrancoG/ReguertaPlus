package com.reguerta.user.data.firestore

import com.google.firebase.Timestamp
import com.google.firebase.firestore.FieldValue
import com.reguerta.user.data.access.decodeDirectoryMemberDocument
import com.reguerta.user.data.access.decodeMemberDocument
import com.reguerta.user.data.profiles.decodeSharedProfileDocument
import com.reguerta.user.data.profiles.sharedProfileUpsertPayload
import com.reguerta.user.domain.RepositoryErrorKind
import com.reguerta.user.domain.RepositoryException
import com.reguerta.user.domain.access.EcoCommitmentMode
import com.reguerta.user.domain.access.MemberRole
import com.reguerta.user.domain.profiles.SharedProfile
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class FirestoreProfileMemberDecodingTest {
    @Test
    fun `shared profile keeps optional legacy absence but rejects corrupt identity and types`() {
        val minimal = mapOf<String, Any?>(
            "userId" to "member_1",
            "updatedAt" to Timestamp(123, 0),
        )

        val decoded = decodeSharedProfileDocument("member_1", minimal)
        assertEquals("", decoded.familyNames)
        assertNull(decoded.photoUrl)
        assertEquals("", decoded.about)
        assertEquals(123_000L, decoded.updatedAtMillis)

        assertEquals(
            null,
            decodeSharedProfileDocument("member_1", minimal + ("photoUrl" to null)).photoUrl,
        )
        assertInvalidData("sharedProfiles.document") {
            decodeSharedProfileDocument("member_1", minimal + ("userId" to "member_2"))
        }
        assertInvalidData("sharedProfiles.document") {
            decodeSharedProfileDocument("member_1", minimal + ("about" to 42L))
        }
        assertInvalidData("sharedProfiles.document") {
            decodeSharedProfileDocument("member_1", mapOf("userId" to "member_1"))
        }
    }

    @Test
    fun `shared profile merge payload deletes a cleared photo`() {
        val payload = sharedProfileUpsertPayload(
            SharedProfile(
                userId = "member_1",
                familyNames = "Familia",
                photoUrl = null,
                about = "Perfil",
                updatedAtMillis = 1L,
            ),
        )

        assertTrue(payload["photoUrl"] is FieldValue)
    }

    @Test
    fun `member directory requires canonical public fields and ignores extra pii`() {
        val valid = mapOf<String, Any?>(
            "userId" to "member_1",
            "displayName" to " Member One ",
            "companyName" to null,
            "roles" to listOf("member", "producer"),
            "isActive" to true,
            "producerCatalogEnabled" to true,
            "isCommonPurchaseManager" to false,
            "producerParity" to "odd",
            "ecoCommitment" to mapOf("mode" to "biweekly", "parity" to "even"),
            "normalizedEmail" to 123L,
            "authUid" to listOf("ignored"),
        )

        val member = decodeDirectoryMemberDocument("member_1", valid)
        assertEquals("Member One", member.displayName)
        assertEquals("", member.normalizedEmail)
        assertNull(member.authUid)
        assertEquals(setOf(MemberRole.MEMBER, MemberRole.PRODUCER), member.roles)
        assertEquals(EcoCommitmentMode.BIWEEKLY, member.ecoCommitmentMode)

        assertInvalidData("members.directory.document") {
            decodeDirectoryMemberDocument("member_1", valid + ("userId" to "member_2"))
        }
        assertInvalidData("members.directory.document") {
            decodeDirectoryMemberDocument("member_1", valid + ("roles" to listOf("member", "observer")))
        }
        assertInvalidData("members.directory.document") {
            decodeDirectoryMemberDocument("member_1", valid + ("ecoCommitment" to "weekly"))
        }
    }

    @Test
    fun `full member keeps legacy aliases but rejects a conflicting canonical type`() {
        val legacy = mapOf<String, Any?>(
            "name" to "Ana",
            "surname" to "Reguerta",
            "email" to " ANA@EXAMPLE.COM ",
            "isProducer" to true,
        )

        val member = decodeMemberDocument("member_1", legacy)
        assertEquals("Ana Reguerta", member.displayName)
        assertEquals("ana@example.com", member.normalizedEmail)
        assertEquals(setOf(MemberRole.MEMBER, MemberRole.PRODUCER), member.roles)
        assertEquals(EcoCommitmentMode.WEEKLY, member.ecoCommitmentMode)

        assertInvalidData("members.document") {
            decodeMemberDocument("member_1", legacy + ("normalizedEmail" to 123L))
        }
    }

    private fun assertInvalidData(resource: String, block: () -> Unit) {
        try {
            block()
            throw AssertionError("Expected RepositoryException")
        } catch (error: RepositoryException) {
            assertEquals(RepositoryErrorKind.INVALID_DATA, error.kind)
            assertEquals(resource, error.resource)
        }
    }
}
