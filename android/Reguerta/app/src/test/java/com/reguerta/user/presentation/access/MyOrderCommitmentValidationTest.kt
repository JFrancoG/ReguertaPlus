package com.reguerta.user.presentation.access

import com.reguerta.user.domain.access.EcoCommitmentMode
import com.reguerta.user.domain.access.Member
import com.reguerta.user.domain.access.MemberRole
import com.reguerta.user.domain.access.ProducerParity
import com.reguerta.user.domain.commitments.SeasonalCommitment
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
            currentWeekParity = ProducerParity.EVEN,
        )

        assertFalse(result.isValid)
        assertEquals(listOf("Ecocesta par"), result.missingCommitmentProductNames)
    }

    @Test
    fun `does not require biweekly eco commitment on opposite parity week`() {
        val member = member(
            id = "member_1",
            ecoCommitmentMode = EcoCommitmentMode.BIWEEKLY,
            ecoCommitmentParity = ProducerParity.EVEN,
        )
        val ecoOdd = ecoBasketProduct(id = "eco_odd", vendorId = "producer_odd", name = "Ecocesta impar")
        val members = listOf(
            member,
            producer(id = "producer_even", parity = ProducerParity.EVEN),
            producer(id = "producer_odd", parity = ProducerParity.ODD),
        )

        val result = validateMyOrderCheckout(
            currentMember = member,
            members = members,
            products = listOf(ecoOdd),
            selectedQuantities = emptyMap(),
            selectedEcoBasketOptions = emptyMap(),
            currentWeekParity = ProducerParity.ODD,
        )

        assertTrue(result.isValid)
        assertTrue(result.missingCommitmentProductNames.isEmpty())
    }

    @Test
    fun `blocks checkout when seasonal commitment product is missing`() {
        val member = member(id = "member_1", ecoCommitmentMode = EcoCommitmentMode.WEEKLY)
        val avocado = regularProduct(id = "seasonal_avocado", vendorId = "producer_even", name = "Aguacates")
        val commitments = listOf(
            seasonalCommitment(productId = avocado.id, fixedQtyPerOfferedWeek = 1.0),
        )

        val result = validateMyOrderCheckout(
            currentMember = member,
            members = listOf(member, producer(id = "producer_even", parity = ProducerParity.EVEN)),
            products = listOf(avocado),
            seasonalCommitments = commitments,
            selectedQuantities = emptyMap(),
            selectedEcoBasketOptions = emptyMap(),
            currentWeekParity = ProducerParity.EVEN,
        )

        assertFalse(result.isValid)
        assertEquals(listOf("Aguacates"), result.missingCommitmentProductNames)
    }

    @Test
    fun `ignores seasonal commitments when product is not offered this week`() {
        val member = member(id = "member_1", ecoCommitmentMode = EcoCommitmentMode.WEEKLY)
        val commitments = listOf(
            seasonalCommitment(productId = "seasonal_hidden", fixedQtyPerOfferedWeek = 1.0),
        )

        val result = validateMyOrderCheckout(
            currentMember = member,
            members = listOf(member),
            products = emptyList(),
            seasonalCommitments = commitments,
            selectedQuantities = emptyMap(),
            selectedEcoBasketOptions = emptyMap(),
            currentWeekParity = ProducerParity.EVEN,
        )

        assertTrue(result.isValid)
        assertTrue(result.missingCommitmentProductNames.isEmpty())
    }

    @Test
    fun `blocks checkout when seasonal commitment id differs but season key matches product name`() {
        val member = member(id = "member_1", ecoCommitmentMode = EcoCommitmentMode.WEEKLY)
        val avocados = regularProduct(id = "product_common_avocado", vendorId = "compras_reguerta", name = "Aguacates")
        val commitments = listOf(
            seasonalCommitment(
                productId = "legacy_mango_commitment",
                seasonKey = "2026-aguacate",
                fixedQtyPerOfferedWeek = 1.0,
            ),
        )

        val result = validateMyOrderCheckout(
            currentMember = member,
            members = listOf(member),
            products = listOf(avocados),
            seasonalCommitments = commitments,
            selectedQuantities = emptyMap(),
            selectedEcoBasketOptions = emptyMap(),
            currentWeekParity = ProducerParity.EVEN,
        )

        assertFalse(result.isValid)
        assertEquals(listOf("Aguacates"), result.missingCommitmentProductNames)
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

    private fun regularProduct(
        id: String,
        vendorId: String,
        name: String,
    ): Product = Product(
        id = id,
        vendorId = vendorId,
        companyName = vendorId,
        name = name,
        description = "",
        productImageUrl = null,
        price = 2.0,
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
        isEcoBasket = false,
        isCommonPurchase = false,
        commonPurchaseType = null,
        archived = false,
        createdAtMillis = 1L,
        updatedAtMillis = 1L,
    )

    private fun seasonalCommitment(
        productId: String,
        seasonKey: String = "2026",
        productNameHint: String? = null,
        fixedQtyPerOfferedWeek: Double,
    ): SeasonalCommitment = SeasonalCommitment(
        id = "commitment_$productId",
        userId = "member_1",
        productId = productId,
        productNameHint = productNameHint,
        seasonKey = seasonKey,
        fixedQtyPerOfferedWeek = fixedQtyPerOfferedWeek,
        active = true,
        createdAtMillis = 1L,
        updatedAtMillis = 1L,
    )
}
