package com.reguerta.user.domain.news

interface NewsRepository {
    suspend fun getAllNews(): List<NewsArticle>

    suspend fun upsertNews(article: NewsArticle): NewsArticle

    suspend fun deleteNews(newsId: String): Boolean
}
