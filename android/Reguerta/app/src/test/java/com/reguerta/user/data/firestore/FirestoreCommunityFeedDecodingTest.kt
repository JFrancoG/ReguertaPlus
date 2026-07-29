package com.reguerta.user.data.firestore

import com.google.firebase.Timestamp
import com.reguerta.user.data.news.decodeNewsDocument
import com.reguerta.user.data.news.decodeNewsDocuments
import com.reguerta.user.data.notifications.NotificationDocumentSource
import com.reguerta.user.data.notifications.decodeNotificationDocument
import com.reguerta.user.data.notifications.decodeNotificationDocuments
import com.reguerta.user.domain.RepositoryErrorKind
import com.reguerta.user.domain.RepositoryException
import com.reguerta.user.domain.access.MemberRole
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class FirestoreCommunityFeedDecodingTest {
    @Test
    fun `empty news and notification snapshots decode as empty lists`() {
        assertTrue(decodeNewsDocuments(emptyList()).isEmpty())
        assertTrue(
            decodeNotificationDocuments(
                documents = emptyList(),
                source = NotificationDocumentSource.INBOX,
            ).isEmpty(),
        )
    }

    @Test
    fun `news snapshot is atomic when one present document is corrupt`() {
        val error = repositoryError {
            decodeNewsDocuments(
                listOf(
                    "news-valid" to validNewsDocument(),
                    "news-corrupt" to (validNewsDocument() - "title"),
                ),
            )
        }

        assertEquals(RepositoryErrorKind.INVALID_DATA, error.kind)
        assertEquals("news/news-corrupt", error.resource)
    }

    @Test
    fun `news decoder rejects blank ids and invalid required field types without defaults`() {
        val invalidDocuments = listOf(
            " " to validNewsDocument(),
            " news-1 " to validNewsDocument(),
            "news-1" to (validNewsDocument() - "title"),
            "news-1" to (validNewsDocument() + ("title" to "  ")),
            "news-1" to (validNewsDocument() + ("body" to 7L)),
            "news-1" to (validNewsDocument() + ("publishedBy" to "")),
            "news-1" to (validNewsDocument() + ("publishedByUserId" to null)),
            "news-1" to (validNewsDocument() + ("active" to "true")),
            "news-1" to (validNewsDocument() + ("publishedAt" to 123L)),
            "news-1" to (validNewsDocument() + ("urlImage" to 42L)),
            "news-1" to (validNewsDocument() + ("urlImage" to "  ")),
        )

        invalidDocuments.forEach { (id, data) ->
            val error = repositoryError { decodeNewsDocument(id, data) }
            assertEquals(RepositoryErrorKind.INVALID_DATA, error.kind)
            assertEquals("news/$id", error.resource)
        }
    }

    @Test
    fun `news optional image accepts only missing null or a valid string`() {
        val missing = decodeNewsDocument("news-missing", validNewsDocument() - "urlImage")
        val explicitNull = decodeNewsDocument(
            "news-null",
            validNewsDocument() + ("urlImage" to null),
        )
        val present = decodeNewsDocument(
            "news-present",
            validNewsDocument() + ("urlImage" to " https://example.test/news.jpg "),
        )

        assertNull(missing.urlImage)
        assertNull(explicitNull.urlImage)
        assertEquals("https://example.test/news.jpg", present.urlImage)
        assertEquals("publisher-1", present.publishedByUserId)
        assertEquals(123_000L, present.publishedAtMillis)
    }

    @Test
    fun `notification decoder accepts only canonical target payload variants`() {
        val all = decodeNotificationDocument(
            "event-all",
            validNotificationDocument(target = "all", targetPayload = emptyMap<String, Any?>()),
            NotificationDocumentSource.EVENT,
        )
        val users = decodeNotificationDocument(
            "event-users",
            validNotificationDocument(
                target = "users",
                targetPayload = mapOf("userIds" to listOf("member-1", "member-2")),
            ),
            NotificationDocumentSource.EVENT,
        )
        val segment = decodeNotificationDocument(
            "event-segment",
            validNotificationDocument(
                target = "segment",
                targetPayload = mapOf("segmentType" to "role", "role" to "producer"),
            ),
            NotificationDocumentSource.EVENT,
        )

        assertEquals("all", all.target)
        assertTrue(all.userIds.isEmpty())
        assertEquals(listOf("member-1", "member-2"), users.userIds)
        assertEquals("role", segment.segmentType)
        assertEquals(MemberRole.PRODUCER, segment.targetRole)
    }

    @Test
    fun `notification decoder rejects invalid fields enums timestamps and payload shapes`() {
        val invalidDocuments = listOf(
            " " to validNotificationDocument(),
            " event-1 " to validNotificationDocument(),
            "event-1" to (validNotificationDocument() - "title"),
            "event-1" to (validNotificationDocument() + ("body" to 1L)),
            "event-1" to (validNotificationDocument() + ("type" to "ADMIN_BROADCAST")),
            "event-1" to (validNotificationDocument() + ("type" to " admin_broadcast ")),
            "event-1" to (validNotificationDocument() + ("type" to "unknown")),
            "event-1" to (validNotificationDocument() + ("target" to "ALL")),
            "event-1" to (validNotificationDocument() + ("target" to " all ")),
            "event-1" to (validNotificationDocument() + ("sentAt" to 123L)),
            "event-1" to (validNotificationDocument() + ("createdBy" to " ")),
            "event-1" to (validNotificationDocument() - "targetPayload"),
            "event-1" to validNotificationDocument(
                target = "all",
                targetPayload = mapOf("userIds" to emptyList<String>()),
            ),
            "event-1" to validNotificationDocument(
                target = "users",
                targetPayload = mapOf("userIds" to emptyList<String>()),
            ),
            "event-1" to validNotificationDocument(
                target = "users",
                targetPayload = mapOf("userIds" to listOf("member-1", 2L)),
            ),
            "event-1" to validNotificationDocument(
                target = "users",
                targetPayload = mapOf(
                    "userIds" to listOf("member-1"),
                    "role" to "member",
                ),
            ),
            "event-1" to validNotificationDocument(
                target = "segment",
                targetPayload = mapOf("segmentType" to "ROLE", "role" to "member"),
            ),
            "event-1" to validNotificationDocument(
                target = "segment",
                targetPayload = mapOf("segmentType" to "role", "role" to "observer"),
            ),
            "event-1" to (validNotificationDocument() + ("weekKey" to 42L)),
            "event-1" to (validNotificationDocument() + ("weekKey" to " ")),
        )

        invalidDocuments.forEach { (id, data) ->
            val error = repositoryError {
                decodeNotificationDocument(id, data, NotificationDocumentSource.EVENT)
            }
            assertEquals(RepositoryErrorKind.INVALID_DATA, error.kind)
            assertEquals("notificationEvents/$id", error.resource)
        }
    }

    @Test
    fun `notification snapshot is atomic and inbox identity must match document id`() {
        val mismatch = validNotificationDocument() + ("notificationEventId" to "another-event")
        val error = repositoryError {
            decodeNotificationDocuments(
                documents = listOf(
                    "event-valid" to (
                        validNotificationDocument() + ("notificationEventId" to "event-valid")
                    ),
                    "event-corrupt" to mismatch,
                ),
                source = NotificationDocumentSource.INBOX,
            )
        }

        assertEquals(RepositoryErrorKind.INVALID_DATA, error.kind)
        assertEquals("notificationInbox/event-corrupt", error.resource)

        val paddedIdentityError = repositoryError {
            decodeNotificationDocument(
                "event-valid",
                validNotificationDocument() + ("notificationEventId" to " event-valid "),
                NotificationDocumentSource.INBOX,
            )
        }
        assertEquals(RepositoryErrorKind.INVALID_DATA, paddedIdentityError.kind)
        assertEquals("notificationInbox/event-valid", paddedIdentityError.resource)

        val missingTimestampError = repositoryError {
            decodeNotificationDocuments(
                documents = listOf(
                    "event-valid" to (
                        validNotificationDocument() + ("notificationEventId" to "event-valid")
                    ),
                    "event-without-timestamp" to (
                        (validNotificationDocument() - "sentAt") +
                            ("notificationEventId" to "event-without-timestamp")
                    ),
                ),
                source = NotificationDocumentSource.INBOX,
            )
        }
        assertEquals(RepositoryErrorKind.INVALID_DATA, missingTimestampError.kind)
        assertEquals("notificationInbox/event-without-timestamp", missingTimestampError.resource)
    }

    @Test
    fun `notification optional week accepts missing null or a valid string`() {
        val missing = decodeNotificationDocument(
            "event-missing",
            validNotificationDocument() - "weekKey",
            NotificationDocumentSource.EVENT,
        )
        val explicitNull = decodeNotificationDocument(
            "event-null",
            validNotificationDocument() + ("weekKey" to null),
            NotificationDocumentSource.EVENT,
        )
        val present = decodeNotificationDocument(
            "event-present",
            validNotificationDocument() + ("weekKey" to " 2026-W31 "),
            NotificationDocumentSource.EVENT,
        )

        assertNull(missing.weekKey)
        assertNull(explicitNull.weekKey)
        assertEquals("2026-W31", present.weekKey)
    }

    @Test
    fun `notification decoder sorts the complete inbox after strict decoding`() {
        val decoded = decodeNotificationDocuments(
            documents = listOf(
                "older" to (
                    validNotificationDocument() +
                        ("notificationEventId" to "older") +
                        ("sentAt" to Timestamp(100, 0))
                ),
                "newer" to (
                    validNotificationDocument() +
                        ("notificationEventId" to "newer") +
                        ("sentAt" to Timestamp(200, 0))
                ),
            ),
            source = NotificationDocumentSource.INBOX,
        )

        assertEquals(listOf("newer", "older"), decoded.map { it.id })
    }

    private fun repositoryError(block: () -> Unit): RepositoryException = try {
        block()
        throw AssertionError("Expected RepositoryException")
    } catch (error: RepositoryException) {
        error
    }
}

private fun validNewsDocument(): Map<String, Any?> = mapOf(
    "title" to "News title",
    "body" to "News body",
    "publishedBy" to "Publisher",
    "publishedByUserId" to "publisher-1",
    "publishedAt" to Timestamp(123, 0),
    "active" to true,
    "urlImage" to null,
)

private fun validNotificationDocument(
    target: String = "all",
    targetPayload: Map<String, Any?> = emptyMap(),
): Map<String, Any?> = mapOf(
    "title" to "Notification title",
    "body" to "Notification body",
    "type" to "admin_broadcast",
    "target" to target,
    "targetPayload" to targetPayload,
    "sentAt" to Timestamp(456, 0),
    "createdBy" to "admin-1",
    "weekKey" to null,
)
