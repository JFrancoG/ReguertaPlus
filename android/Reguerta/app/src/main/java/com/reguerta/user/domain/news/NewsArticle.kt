package com.reguerta.user.domain.news

data class NewsArticle(
    val id: String,
    val title: String,
    val body: String,
    val active: Boolean,
    val publishedBy: String,
    val publishedAtMillis: Long,
    val urlImage: String?,
)
