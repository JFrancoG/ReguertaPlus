package com.reguerta.user.data.media

import java.text.Normalizer

internal object ImageUploadFileNameFormatter {
    fun formatPrefix(
        nameHint: String?,
        namespace: ImageUploadNamespace,
        maxLength: Int = DefaultPrefixMaxLength,
    ): String {
        val fallback = when (namespace) {
            ImageUploadNamespace.PRODUCTS -> "product"
            ImageUploadNamespace.NEWS -> "news"
            ImageUploadNamespace.SHARED_PROFILES -> "profile"
        }
        val normalized = normalizeHint(nameHint)
        return normalized
            .take(maxLength.coerceAtLeast(1))
            .ifBlank { fallback }
    }

    private fun normalizeHint(nameHint: String?): String {
        val deAccented = Normalizer.normalize(nameHint.orEmpty(), Normalizer.Form.NFD)
            .replace(Regex("\\p{Mn}+"), "")
        return deAccented
            .trim()
            .replace(Regex("\\s+"), "_")
            .replace(Regex("[^A-Za-z0-9_]"), "")
            .replace(Regex("_+"), "_")
            .trim('_')
            .lowercase()
    }

    private const val DefaultPrefixMaxLength = 16
}
