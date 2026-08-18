package com.reguerta.user.data.news

import com.google.firebase.Timestamp
import com.google.firebase.firestore.FirebaseFirestore
import com.reguerta.user.data.firestore.ReguertaFirestoreCollection
import com.reguerta.user.data.firestore.ReguertaFirestoreEnvironment
import com.reguerta.user.data.firestore.ReguertaFirestorePath
import com.reguerta.user.data.firestore.toRepositoryException
import com.reguerta.user.domain.RepositoryErrorKind
import com.reguerta.user.domain.RepositoryException
import com.reguerta.user.domain.access.Member
import com.reguerta.user.domain.news.NewsArticle
import com.reguerta.user.domain.news.NewsRepository
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext

class FirestoreNewsRepository(
    private val firestore: FirebaseFirestore,
    private val environment: ReguertaFirestoreEnvironment? = null,
) : NewsRepository {
    private val firestorePath = ReguertaFirestorePath(environment = environment)

    private val newsCollectionPath: String
        get() = firestorePath.collectionPath(ReguertaFirestoreCollection.NEWS)

    override suspend fun getNewsFor(member: Member): List<NewsArticle> = withContext(Dispatchers.IO) {
        val query = if (member.isAdmin) {
            firestore.collection(newsCollectionPath)
        } else {
            firestore.collection(newsCollectionPath).whereEqualTo("active", true)
        }
        try {
            val snapshot = query.get().await()
            decodeNewsDocuments(
                snapshot.documents.map { document -> document.id to document.data.orEmpty() },
            )
        } catch (cancellation: CancellationException) {
            throw cancellation
        } catch (error: Exception) {
            throw error.toRepositoryException(resource = "news")
        }
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

        try {
            firestore.collection(newsCollectionPath)
                .document(documentId)
                .set(payload, com.google.firebase.firestore.SetOptions.merge())
                .await()
            persisted
        } catch (cancellation: CancellationException) {
            throw cancellation
        } catch (error: Exception) {
            throw error.toRepositoryException(resource = "news/$documentId")
        }
    }

    override suspend fun deleteNews(newsId: String): Boolean = withContext(Dispatchers.IO) {
        try {
            firestore.collection(newsCollectionPath)
                .document(newsId)
                .delete()
                .await()
            true
        } catch (cancellation: CancellationException) {
            throw cancellation
        } catch (error: Exception) {
            throw error.toRepositoryException(resource = "news/$newsId")
        }
    }
}

internal fun decodeNewsDocuments(
    documents: List<Pair<String, Map<String, Any?>>>,
): List<NewsArticle> = documents
    .map { (documentId, data) -> decodeNewsDocument(documentId, data) }
    .sortedByDescending(NewsArticle::publishedAtMillis)

internal fun decodeNewsDocument(
    documentId: String,
    data: Map<String, Any?>,
): NewsArticle = NewsDocumentDto.decode(documentId, data).toDomain()

internal data class NewsDocumentDto(
    val id: String,
    val title: String,
    val body: String,
    val active: Boolean,
    val publishedBy: String,
    val publishedAtMillis: Long,
    val urlImage: String?,
) {
    fun toDomain(): NewsArticle = NewsArticle(
        id = id,
        title = title,
        body = body,
        active = active,
        publishedBy = publishedBy,
        publishedAtMillis = publishedAtMillis,
        urlImage = urlImage,
    )

    companion object {
        fun decode(documentId: String, data: Map<String, Any?>): NewsDocumentDto {
            if (documentId.isBlank() || documentId != documentId.trim()) {
                invalidNewsDocument(documentId)
            }
            return NewsDocumentDto(
                id = documentId,
                title = data.requiredNewsString("title", documentId),
                body = data.requiredNewsString("body", documentId),
                active = data.requiredNewsBoolean("active", documentId),
                publishedBy = data.requiredNewsString("publishedBy", documentId),
                publishedAtMillis = data.requiredNewsTimestampMillis("publishedAt", documentId),
                urlImage = data.optionalNewsString("urlImage", documentId),
            )
        }
    }
}

private fun Map<String, Any?>.requiredNewsString(field: String, documentId: String): String =
    optionalNewsString(field, documentId) ?: invalidNewsDocument(documentId)

private fun Map<String, Any?>.optionalNewsString(field: String, documentId: String): String? {
    val value = this[field] ?: return null
    if (value !is String) invalidNewsDocument(documentId)
    return value.trim().ifEmpty { invalidNewsDocument(documentId) }
}

private fun Map<String, Any?>.requiredNewsBoolean(field: String, documentId: String): Boolean =
    (this[field] as? Boolean) ?: invalidNewsDocument(documentId)

private fun Map<String, Any?>.requiredNewsTimestampMillis(field: String, documentId: String): Long =
    (this[field] as? Timestamp)?.toDate()?.time ?: invalidNewsDocument(documentId)

private fun invalidNewsDocument(documentId: String): Nothing = throw RepositoryException(
    kind = RepositoryErrorKind.INVALID_DATA,
    resource = "news/$documentId",
)
