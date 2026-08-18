package com.reguerta.user.data.firestore

import com.google.firebase.firestore.FirebaseFirestoreException
import com.reguerta.user.domain.RepositoryErrorKind
import com.reguerta.user.domain.RepositoryException
import kotlinx.coroutines.CancellationException
import java.util.logging.Level
import java.util.logging.Logger

private val firestoreRepositoryLogger = Logger.getLogger("FirestoreRepository")

internal fun Throwable.toRepositoryException(resource: String): Throwable {
    if (this is CancellationException) return this
    if (this is RepositoryException) {
        logRepositoryFailure(this)
        return this
    }

    val firestoreException = firestoreCause()
        ?: return RepositoryException(
            kind = RepositoryErrorKind.UNKNOWN,
            resource = resource,
            cause = this,
        ).also(::logRepositoryFailure)

    val kind = repositoryErrorKind(firestoreCode = firestoreException.code.value())
    return RepositoryException(kind = kind, resource = resource, cause = this)
        .also(::logRepositoryFailure)
}

internal fun repositoryErrorKind(firestoreCode: Int): RepositoryErrorKind = when (firestoreCode) {
    5 -> RepositoryErrorKind.NOT_FOUND
    7, 16 -> RepositoryErrorKind.PERMISSION_DENIED
    1, 4, 8, 10, 13, 14 -> RepositoryErrorKind.UNAVAILABLE
    15 -> RepositoryErrorKind.INVALID_DATA
    else -> RepositoryErrorKind.UNKNOWN
}

private fun Throwable.firestoreCause(): FirebaseFirestoreException? {
    var current: Throwable? = this
    while (current != null) {
        if (current is FirebaseFirestoreException) return current
        current = current.cause
    }
    return null
}

private fun logRepositoryFailure(error: RepositoryException) {
    val resourceCategory = error.resource.substringBefore('/')
    firestoreRepositoryLogger.log(
        Level.SEVERE,
        "Firestore operation failed for $resourceCategory: ${error.kind}",
    )
}
