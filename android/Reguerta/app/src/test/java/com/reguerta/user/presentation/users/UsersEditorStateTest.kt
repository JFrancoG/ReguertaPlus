package com.reguerta.user.presentation.users

import com.reguerta.user.R
import com.reguerta.user.presentation.root.MemberDraft
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class UsersEditorStateTest {
    @Test
    fun `screen title follows list create and edit modes`() {
        assertEquals(R.string.users_list_title, usersEditorTitleRes(false, null))
        assertEquals(R.string.users_editor_title_create, usersEditorTitleRes(true, null))
        assertEquals(R.string.users_editor_title_edit, usersEditorTitleRes(true, "member-id"))
    }

    @Test
    fun `common purchases manager selects producer and locks canonical company`() {
        val updated = MemberDraft(companyName = "Huerta").withCommonPurchaseManagerSelection(
            isSelected = true,
            commonPurchasesCompanyName = "Compras Regüerta",
        )

        assertTrue(updated.isCommonPurchaseManager)
        assertTrue(updated.isProducer)
        assertEquals("Compras Regüerta", updated.companyName)
    }

    @Test
    fun `clearing common purchases keeps producer and company editable`() {
        val updated = MemberDraft(
            companyName = "Compras Regüerta",
            isProducer = true,
            isCommonPurchaseManager = true,
        ).withCommonPurchaseManagerSelection(
            isSelected = false,
            commonPurchasesCompanyName = "Compras Regüerta",
        )

        assertFalse(updated.isCommonPurchaseManager)
        assertTrue(updated.isProducer)
        assertEquals("Compras Regüerta", updated.companyName)
    }

    @Test
    fun `clearing producer clears dependent common purchases state`() {
        val updated = MemberDraft(
            companyName = "Compras Regüerta",
            isProducer = true,
            isCommonPurchaseManager = true,
        ).withProducerSelection(isSelected = false)

        assertFalse(updated.isProducer)
        assertFalse(updated.isCommonPurchaseManager)
        assertEquals("", updated.companyName)
    }
}
