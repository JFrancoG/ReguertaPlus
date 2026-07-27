package com.reguerta.user.domain.news

import com.reguerta.user.domain.access.Member

interface NewsRepository {
    suspend fun getNewsFor(member: Member): List<NewsArticle>

    suspend fun upsertNews(article: NewsArticle): NewsArticle

    suspend fun deleteNews(newsId: String): Boolean
}
