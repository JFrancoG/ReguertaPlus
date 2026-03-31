package com.reguerta.user.data.news

import com.reguerta.user.domain.news.NewsArticle
import com.reguerta.user.domain.news.NewsRepository
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

class InMemoryNewsRepository : NewsRepository {
    private val mutex = Mutex()
    private val news = mutableMapOf(
        "news_welcome_001" to NewsArticle(
            id = "news_welcome_001",
            title = "Bienvenida a La Reguerta",
            body = "Este espacio ya esta preparado para compartir avisos semanales y novedades de la comunidad.",
            active = true,
            publishedBy = "Ana Admin",
            publishedAtMillis = 1_711_849_600_000,
            urlImage = null,
        ),
    )

    override suspend fun getAllNews(): List<NewsArticle> = mutex.withLock {
        news.values.sortedByDescending { it.publishedAtMillis }
    }

    override suspend fun upsertNews(article: NewsArticle): NewsArticle = mutex.withLock {
        news[article.id] = article
        article
    }

    override suspend fun deleteNews(newsId: String): Boolean = mutex.withLock {
        news.remove(newsId) != null
    }
}
