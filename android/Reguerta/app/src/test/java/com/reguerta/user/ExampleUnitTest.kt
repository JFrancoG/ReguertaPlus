package com.reguerta.user

import com.reguerta.user.data.news.InMemoryNewsRepository
import com.reguerta.user.data.notifications.InMemoryNotificationRepository
import com.reguerta.user.domain.news.NewsArticle
import com.reguerta.user.domain.notifications.NotificationAudience
import com.reguerta.user.domain.notifications.NotificationEvent
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
}

private fun NotificationAudience.toTarget(): String =
    when (this) {
        NotificationAudience.ALL -> "all"
        NotificationAudience.MEMBERS,
        NotificationAudience.PRODUCERS,
        NotificationAudience.ADMINS,
            -> "segment"
    }
