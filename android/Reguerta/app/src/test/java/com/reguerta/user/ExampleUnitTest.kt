package com.reguerta.user

import com.reguerta.user.data.news.InMemoryNewsRepository
import com.reguerta.user.domain.news.NewsArticle
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
}
