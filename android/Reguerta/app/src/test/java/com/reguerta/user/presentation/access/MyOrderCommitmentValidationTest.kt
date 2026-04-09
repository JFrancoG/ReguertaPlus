package com.reguerta.user.presentation.access

import com.reguerta.user.domain.access.EcoCommitmentMode
import com.reguerta.user.domain.access.Member
import com.reguerta.user.domain.access.MemberRole
import com.reguerta.user.domain.access.ProducerParity
import com.reguerta.user.domain.products.Product
import com.reguerta.user.domain.products.ProductStockMode
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class MyOrderCommitmentValidationTest {
    @Test
    fun `blocks checkout when weekly eco commitment is missing`() {
        val member = member(id = "member_1", ecoCommitmentMode = EcoCommitmentMode.WEEKLY)
        val eco = ecoBasketProduct(id = "eco_even", vendorId = "producer_even")

        val result = validateMyOrderCheckout(
            currentMember = member,
            members = listOf(member, producer(id = "producer_even", parity = ProducerParity.EVEN)),
            products = listOf(eco),
            selectedQuantities = emptyMap(),
            selectedEcoBasketOptions = emptyMap(),
        )

        assertFalse(result.isValid)
        assertEquals(listOf("Ecocesta"), result.missingCommitmentProductNames)
        assertFalse(result.hasEcoBasketPriceMismatch)
    }

    @Test
    fun `accepts weekly eco commitment when option is no_pickup`() {
        val member = member(id = "member_1", ecoCommitmentMode = EcoCommitmentMode.WEEKLY)
        val eco = ecoBasketProduct(id = "eco_even", vendorId = "producer_even")

        val result = validateMyOrderCheckout(
            currentMember = member,
            members = listOf(member, producer(id = "producer_even", parity = ProducerParity.EVEN)),
            products = listOf(eco),
            selectedQuantities = mapOf(eco.id to 1),
            selectedEcoBasketOptions = mapOf(eco.id to EcoBasketOptionNoPickup),
        )

        assertTrue(result.isValid)
        assertTrue(result.missingCommitmentProductNames.isEmpty())
    }

    @Test
    fun `does not count eco basket without pickup option`() {
        val member = member(id = "member_1", ecoCommitmentMode = EcoCommitmentMode.WEEKLY)
        val eco = ecoBasketProduct(id = "eco_even", vendorId = "producer_even")

        val result = validateMyOrderCheckout(
            currentMember = member,
            members = listOf(member, producer(id = "producer_even", parity = ProducerParity.EVEN)),
            products = listOf(eco),
            selectedQuantities = mapOf(eco.id to 1),
            selectedEcoBasketOptions = mapOf(eco.id to "renuncia"),
        )

        assertFalse(result.isValid)
        assertEquals(listOf("Ecocesta"), result.missingCommitmentProductNames)
    }

    @Test
    fun `uses parity producer products for biweekly commitment`() {
        val member = member(
            id = "member_1",
            ecoCommitmentMode = EcoCommitmentMode.BIWEEKLY,
            ecoCommitmentParity = ProducerParity.EVEN,
        )
        val ecoEven = ecoBasketProduct(id = "eco_even", vendorId = "producer_even", name = "Ecocesta par")
        val ecoOdd = ecoBasketProduct(id = "eco_odd", vendorId = "producer_odd", name = "Ecocesta impar")
        val members = listOf(
            member,
            producer(id = "producer_even", parity = ProducerParity.EVEN),
            producer(id = "producer_odd", parity = ProducerParity.ODD),
        )

        val result = validateMyOrderCheckout(
            currentMember = member,
            members = members,
            products = listOf(ecoEven, ecoOdd),
            selectedQuantities = mapOf(ecoOdd.id to 1),
            selectedEcoBasketOptions = mapOf(ecoOdd.id to EcoBasketOptionPickup),
        )

        assertFalse(result.isValid)
        assertEquals(listOf("Ecocesta par"), result.missingCommitmentProductNames)
    }

    @Test
    fun `flags eco basket price mismatch`() {
        val member = member(id = "member_1", ecoCommitmentMode = EcoCommitmentMode.WEEKLY)
        val ecoEven = ecoBasketProduct(id = "eco_even", vendorId = "producer_even", price = 2.0)
        val ecoOdd = ecoBasketProduct(id = "eco_odd", vendorId = "producer_odd", price = 2.5)
        val members = listOf(
            member,
            producer(id = "producer_even", parity = ProducerParity.EVEN),
            producer(id = "producer_odd", parity = ProducerParity.ODD),
        )

        val result = validateMyOrderCheckout(
            currentMember = member,
            members = members,
            products = listOf(ecoEven, ecoOdd),
            selectedQuantities = mapOf(ecoEven.id to 1),
            selectedEcoBasketOptions = mapOf(ecoEven.id to EcoBasketOptionPickup),
        )

        assertTrue(result.hasEcoBasketPriceMismatch)
    }

    private fun member(
        id: String,
        ecoCommitmentMode: EcoCommitmentMode,
        ecoCommitmentParity: ProducerParity? = null,
    ): Member = Member(
        id = id,
        displayName = "Member",
        normalizedEmail = "$id@reguerta.app",
        authUid = "auth_$id",
        roles = setOf(MemberRole.MEMBER),
        isActive = true,
        producerCatalogEnabled = true,
        ecoCommitmentMode = ecoCommitmentMode,
        ecoCommitmentParity = ecoCommitmentParity,
    )

    private fun producer(id: String, parity: ProducerParity): Member = Member(
        id = id,
        displayName = id,
        normalizedEmail = "$id@reguerta.app",
        authUid = null,
        roles = setOf(MemberRole.PRODUCER),
        isActive = true,
        producerCatalogEnabled = true,
        producerParity = parity,
    )

    private fun ecoBasketProduct(
        id: String,
        vendorId: String,
        name: String = "Ecocesta",
        price: Double = 2.0,
    ): Product = Product(
        id = id,
        vendorId = vendorId,
        companyName = vendorId,
        name = name,
        description = "",
        productImageUrl = null,
        price = price,
        unitName = "unit",
        unitAbbreviation = "ud",
        unitPlural = "units",
        unitQty = 1.0,
        packContainerName = null,
        packContainerAbbreviation = null,
        packContainerPlural = null,
        packContainerQty = null,
        isAvailable = true,
        stockMode = ProductStockMode.INFINITE,
        stockQty = null,
        isEcoBasket = true,
        isCommonPurchase = false,
        commonPurchaseType = null,
        archived = false,
        createdAtMillis = 1L,
        updatedAtMillis = 1L,
    )
}
