package com.reguerta.user.presentation.access

internal enum class ReceivedOrderStatusWriteResult {
    SUCCESS,
    PERMISSION_DENIED,
    FAILURE,
}

internal fun Throwable.toReceivedOrderStatusWriteResult(): ReceivedOrderStatusWriteResult {
    val codeName = runCatching {
        javaClass.methods.firstOrNull { method -> method.name == "getCode" }
            ?.invoke(this)
            ?.toString()
            ?.uppercase()
    }.getOrNull()
    val normalizedMessage = message?.uppercase().orEmpty()

    return if (
        codeName?.contains("PERMISSION_DENIED") == true ||
        normalizedMessage.contains("PERMISSION_DENIED") ||
        normalizedMessage.contains("PERMISSION-DENIED")
    ) {
        ReceivedOrderStatusWriteResult.PERMISSION_DENIED
    } else {
        ReceivedOrderStatusWriteResult.FAILURE
    }
}
