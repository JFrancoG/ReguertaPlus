package com.reguerta.user.validation

import com.google.firebase.FirebaseApp
import com.reguerta.user.BuildConfig
import com.reguerta.user.data.bylaws.BylawsKnowledgeDecoder
import org.junit.Assert.assertEquals
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Test

class LocalValidationSerializationTest {
    @Before
    fun requireLocalValidation() {
        assumeTrue("Requires the explicitly isolated QA variant", BuildConfig.LOCAL_VALIDATION)
        assertEquals("demo-reguerta-hu090", FirebaseApp.getInstance().options.projectId)
    }

    @Test
    fun productionGeneratedSerializerPreservesAnIndependentBylawsFixture() {
        val document = BylawsKnowledgeDecoder().decode(
            """
            {
              "metadata": {
                "documentId": "hu090-serialization-fixture",
                "title": "HU090 synthetic statutes",
                "language": "es",
                "sourceFileName": "hu090-local.pdf",
                "sourceDriveUrl": "https://example.invalid/never-fetched",
                "sourceSha256": "synthetic-sha256",
                "pageCount": 2,
                "generatedAtUtc": "2026-11-10T00:00:00Z",
                "schemaVersion": 1,
                "futureField": "ignored"
              },
              "chunks": [
                {
                  "id": "hu090-article-7",
                  "kind": "article",
                  "articleNumber": 7,
                  "pageStart": 1,
                  "pageEnd": 2,
                  "title": "Participación",
                  "text": "Texto sintético con á, ñ y 🍅.",
                  "searchAliases": ["socias", "socios"]
                },
                {
                  "id": "hu090-defaults",
                  "pageStart": 2,
                  "pageEnd": 2,
                  "title": "Default fields",
                  "text": "Synthetic default-value case"
                }
              ]
            }
            """.trimIndent(),
        )
        assertEquals("hu090-serialization-fixture", document.metadata.documentId)
        assertEquals("HU090 synthetic statutes", document.metadata.title)
        assertEquals("es", document.metadata.language)
        assertEquals("hu090-local.pdf", document.metadata.sourceFileName)
        assertEquals("synthetic-sha256", document.metadata.sourceSha256)
        assertEquals(2, document.metadata.pageCount)
        assertEquals(1, document.metadata.schemaVersion)
        val article = document.chunks[0]
        assertEquals("hu090-article-7", article.id)
        assertEquals("article", article.kind)
        assertEquals(7, article.articleNumber)
        assertEquals(1, article.pageStart)
        assertEquals(2, article.pageEnd)
        assertEquals("Participación", article.title)
        assertEquals("Texto sintético con á, ñ y 🍅.", article.text)
        assertEquals(listOf("socias", "socios"), article.searchAliases)
        val defaults = document.chunks[1]
        assertEquals("page", defaults.kind)
        assertEquals(null, defaults.articleNumber)
        assertEquals(emptyList<String>(), defaults.searchAliases)
    }
}
