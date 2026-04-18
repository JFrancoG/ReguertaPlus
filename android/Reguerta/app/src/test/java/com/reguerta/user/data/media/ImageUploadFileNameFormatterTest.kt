package com.reguerta.user.data.media

import org.junit.Assert.assertEquals
import org.junit.Test

class ImageUploadFileNameFormatterTest {
    @Test
    fun `format prefix uses underscores and trims to 16 characters`() {
        val prefix = ImageUploadFileNameFormatter.formatPrefix(
            nameHint = "Tomate Cherry Extra Dulce",
            namespace = ImageUploadNamespace.PRODUCTS,
        )

        assertEquals("tomate_cherry_ex", prefix)
    }

    @Test
    fun `format prefix removes accents and special symbols`() {
        val prefix = ImageUploadFileNameFormatter.formatPrefix(
            nameHint = "Título de Noticia: ¡ÚLTIMA HORA!",
            namespace = ImageUploadNamespace.NEWS,
        )

        assertEquals("titulo_de_notici", prefix)
    }

    @Test
    fun `format prefix falls back when hint is blank`() {
        val profilePrefix = ImageUploadFileNameFormatter.formatPrefix(
            nameHint = "   ",
            namespace = ImageUploadNamespace.SHARED_PROFILES,
        )

        assertEquals("profile", profilePrefix)
    }
}
