package com.reguerta.user.data.news

import com.reguerta.user.domain.news.NewsArticle
import com.reguerta.user.domain.news.NewsRepository

class ChainedNewsRepository(
    private val primary: NewsRepository,
    private val fallback: NewsRepository,
) : NewsRepository {
    override suspend fun getAllNews(): List<NewsArticle> {
        val primaryNews = primary.getAllNews()
        return if (primaryNews.isNotEmpty()) primaryNews else fallback.getAllNews()
    }

    override suspend fun upsertNews(article: NewsArticle): NewsArticle {
        val fallbackUpdated = fallback.upsertNews(article)
        val primaryUpdated = runCatching { primary.upsertNews(article) }.getOrNull()
        return primaryUpdated ?: fallbackUpdated
    }

    override suspend fun deleteNews(newsId: String): Boolean {
        val fallbackDeleted = fallback.deleteNews(newsId)
        val primaryDeleted = runCatching { primary.deleteNews(newsId) }.getOrDefault(false)
        return primaryDeleted || fallbackDeleted
    }
}
