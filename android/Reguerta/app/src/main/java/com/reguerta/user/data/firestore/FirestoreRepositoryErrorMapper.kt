package com.reguerta.user.data.firestore

import com.google.firebase.firestore.FirebaseFirestoreException
import com.reguerta.user.domain.RepositoryErrorKind
import com.reguerta.user.domain.RepositoryException
import kotlinx.coroutines.CancellationException

internal fun Throwable.toRepositoryException(resource: String): Throwable {
    if (this is CancellationException || this is RepositoryException) return this

    val firestoreException = firestoreCause()
        ?: return RepositoryException(
            kind = RepositoryErrorKind.UNKNOWN,
            resource = resource,
            cause = this,
        )

    val code = firestoreException.code.value()
    if (code == 1) {
        return CancellationException("Firestore operation cancelled", firestoreException)
    }
    val kind = repositoryErrorKind(firestoreCode = code)
    return RepositoryException(kind = kind, resource = resource, cause = this)
}

internal fun repositoryErrorKind(firestoreCode: Int): RepositoryErrorKind = when (firestoreCode) {
    5 -> RepositoryErrorKind.NOT_FOUND
    7, 16 -> RepositoryErrorKind.PERMISSION_DENIED
    4, 8, 10, 13, 14 -> RepositoryErrorKind.UNAVAILABLE
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
