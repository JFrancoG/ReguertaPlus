package com.reguerta.user.domain

enum class RepositoryErrorKind {
    NOT_FOUND,
    UNAVAILABLE,
    PERMISSION_DENIED,
    INVALID_DATA,
    UNKNOWN,
}

class RepositoryException(
    val kind: RepositoryErrorKind,
    val resource: String,
    cause: Throwable? = null,
) : Exception("Repository operation failed for $resource: $kind", cause)
