package com.reguerta.user.data.news

import com.google.android.gms.tasks.Tasks
import com.google.firebase.Timestamp
import com.google.firebase.firestore.FirebaseFirestore
import com.reguerta.user.data.firestore.ReguertaFirestoreCollection
import com.reguerta.user.data.firestore.ReguertaFirestoreEnvironment
import com.reguerta.user.data.firestore.ReguertaFirestorePath
import com.reguerta.user.domain.news.NewsArticle
import com.reguerta.user.domain.news.NewsRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class FirestoreNewsRepository(
    private val firestore: FirebaseFirestore,
    private val environment: ReguertaFirestoreEnvironment? = null,
) : NewsRepository {
    private val firestorePath = ReguertaFirestorePath(environment = environment)

    private val newsCollectionPath: String
        get() = firestorePath.collectionPath(ReguertaFirestoreCollection.NEWS)

    override suspend fun getAllNews(): List<NewsArticle> = withContext(Dispatchers.IO) {
        runCatching {
            val snapshot = Tasks.await(
                firestore.collection(newsCollectionPath).get(),
            )
            snapshot.documents
                .mapNotNull { it.toNewsArticle() }
                .sortedByDescending { it.publishedAtMillis }
        }.getOrDefault(emptyList())
    }

    override suspend fun upsertNews(article: NewsArticle): NewsArticle = withContext(Dispatchers.IO) {
        val documentId = article.id.ifBlank {
            firestore.collection(newsCollectionPath).document().id
        }
        val persisted = article.copy(id = documentId)
        val payload = mapOf(
            "title" to persisted.title,
            "body" to persisted.body,
            "active" to persisted.active,
            "publishedBy" to persisted.publishedBy,
            "publishedAt" to Timestamp(persisted.publishedAtMillis / 1_000, ((persisted.publishedAtMillis % 1_000) * 1_000_000).toInt()),
            "urlImage" to persisted.urlImage,
        )

        runCatching {
            Tasks.await(
                firestore.collection(newsCollectionPath)
                    .document(documentId)
                    .set(payload, com.google.firebase.firestore.SetOptions.merge()),
            )
            persisted
        }.getOrDefault(persisted)
    }

    override suspend fun deleteNews(newsId: String): Boolean = withContext(Dispatchers.IO) {
        runCatching {
            Tasks.await(
                firestore.collection(newsCollectionPath)
                    .document(newsId)
                    .delete(),
            )
            true
        }.getOrDefault(false)
    }
}

private fun com.google.firebase.firestore.DocumentSnapshot.toNewsArticle(): NewsArticle? {
    val title = getString("title")?.trim().orEmpty()
    val body = getString("body")?.trim().orEmpty()
    if (title.isBlank() || body.isBlank()) {
        return null
    }

    val publishedBy = getString("publishedBy")?.trim().orEmpty()
    val publishedAt = getTimestamp("publishedAt")?.toDate()?.time ?: 0L
    val urlImage = getString("urlImage")?.trim()?.ifBlank { null }

    return NewsArticle(
        id = id,
        title = title,
        body = body,
        active = getBoolean("active") ?: true,
        publishedBy = publishedBy.ifBlank { "La Reguerta" },
        publishedAtMillis = publishedAt,
        urlImage = urlImage,
    )
}
