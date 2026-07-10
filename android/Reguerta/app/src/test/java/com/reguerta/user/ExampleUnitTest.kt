package com.reguerta.user

import com.reguerta.user.data.news.InMemoryNewsRepository
import com.reguerta.user.data.notifications.InMemoryNotificationRepository
import com.reguerta.user.domain.news.NewsArticle
import com.reguerta.user.domain.notifications.NotificationAudience
import com.reguerta.user.domain.notifications.NotificationEvent
import com.reguerta.user.presentation.root.SessionUiState
import kotlinx.coroutines.runBlocking
import org.junit.Test
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue

class ExampleUnitTest {
    @Test
    fun inMemoryNewsRepository_returnsNewestFirst() = runBlocking {
        val repository = InMemoryNewsRepository()

        repository.upsertNews(
            NewsArticle(
                id = "news_002",
                title = "Nueva noticia",
                body = "Texto",
                active = true,
                publishedBy = "Ana Admin",
                publishedAtMillis = 4_000_000_000_000,
                urlImage = null,
            ),
        )

        val news = repository.getAllNews()

        assertEquals("news_002", news.first().id)
    }

    @Test
    fun inMemoryNewsRepository_deletesExistingNews() = runBlocking {
        val repository = InMemoryNewsRepository()

        val deleted = repository.deleteNews("news_welcome_001")

        assertTrue(deleted)
        assertTrue(repository.getAllNews().none { it.id == "news_welcome_001" })
    }

    @Test
    fun inMemoryNotificationRepository_returnsNewestFirst() = runBlocking {
        val repository = InMemoryNotificationRepository()

        repository.sendNotification(
            NotificationEvent(
                id = "notification_002",
                title = "Aviso",
                body = "Texto",
                type = "admin_broadcast",
                target = NotificationAudience.ALL.toTarget(),
                userIds = emptyList(),
                segmentType = null,
                targetRole = null,
                createdBy = "adminUid",
                sentAtMillis = 4_000_000_000_000,
                weekKey = null,
            ),
        )

        val notifications = repository.getAllNotifications()

        assertEquals("notification_002", notifications.first().id)
    }

    @Test
    fun inMemoryNotificationRepository_tracksReadIdsByMember() = runBlocking {
        val repository = InMemoryNotificationRepository()

        repository.markNotificationsRead(
            memberId = "member_1",
            notificationIds = setOf("notification_welcome_001", "notification_admin_001"),
            readAtMillis = 123,
        )

        assertEquals(
            setOf("notification_welcome_001", "notification_admin_001"),
            repository.getReadNotificationIds("member_1"),
        )
        assertTrue(repository.getReadNotificationIds("member_2").isEmpty())
    }

    @Test
    fun sessionUiState_buildsNotificationFeedItemsAndUnreadIndicator() {
        val read = notificationEvent(id = "read", sentAtMillis = 10)
        val unread = notificationEvent(id = "unread", sentAtMillis = 20)
        val state = SessionUiState(
            notificationsFeed = listOf(unread, read),
            readNotificationIds = setOf("read"),
        )

        assertEquals(listOf("unread", "read"), state.notificationFeedItems.map { it.notification.id })
        assertEquals(listOf(false, true), state.notificationFeedItems.map { it.isRead })
        assertTrue(state.hasUnreadNotifications)
    }
}

private fun notificationEvent(
    id: String,
    sentAtMillis: Long,
): NotificationEvent =
    NotificationEvent(
        id = id,
        title = "Aviso",
        body = "Texto",
        type = "admin_broadcast",
        target = NotificationAudience.ALL.toTarget(),
        userIds = emptyList(),
        segmentType = null,
        targetRole = null,
        createdBy = "system",
        sentAtMillis = sentAtMillis,
        weekKey = null,
    )

private fun NotificationAudience.toTarget(): String =
    when (this) {
        NotificationAudience.ALL -> "all"
        NotificationAudience.MEMBERS,
        NotificationAudience.PRODUCERS,
        NotificationAudience.ADMINS,
            -> "segment"
    }
