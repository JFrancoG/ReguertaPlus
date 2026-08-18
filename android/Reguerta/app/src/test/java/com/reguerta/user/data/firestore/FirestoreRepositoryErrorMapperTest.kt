package com.reguerta.user.data.firestore

import com.reguerta.user.domain.RepositoryErrorKind
import kotlinx.coroutines.CancellationException
import org.junit.Assert.assertEquals
import org.junit.Assert.assertSame
import org.junit.Test

class FirestoreRepositoryErrorMapperTest {
    @Test
    fun `maps Firestore codes to domain errors`() {
        assertEquals(
            RepositoryErrorKind.PERMISSION_DENIED,
            repositoryErrorKind(firestoreCode = 7),
        )
        assertEquals(
            RepositoryErrorKind.UNAVAILABLE,
            repositoryErrorKind(firestoreCode = 14),
        )
        assertEquals(
            RepositoryErrorKind.UNAVAILABLE,
            repositoryErrorKind(firestoreCode = 1),
        )
        assertEquals(
            RepositoryErrorKind.INVALID_DATA,
            repositoryErrorKind(firestoreCode = 15),
        )
    }

    @Test
    fun `preserves cancellation`() {
        val cancellation = CancellationException("cancelled")

        assertSame(cancellation, cancellation.toRepositoryException("products"))
    }
}
