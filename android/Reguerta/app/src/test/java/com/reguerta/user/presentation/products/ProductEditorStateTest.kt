package com.reguerta.user.presentation.products

import com.reguerta.user.R
import com.reguerta.user.domain.products.ProductContainerOption
import com.reguerta.user.domain.products.ProductMeasureOption
import com.reguerta.user.domain.products.Product
import com.reguerta.user.domain.products.ProductPricingMode
import com.reguerta.user.domain.products.ProductStockMode
import com.reguerta.user.domain.products.maximumSelectionCount
import com.reguerta.user.domain.products.minimumSelectionCount
import com.reguerta.user.domain.products.selectedQuantity
import com.reguerta.user.presentation.root.ProductDraft
import org.junit.Assert.assertEquals
import org.junit.Test

class ProductEditorStateTest {
    @Test
    fun `stock increase adds ten and decrease removes one`() {
        assertEquals("10", adjustedFiniteStockQuantity("", 10))
        assertEquals("17", adjustedFiniteStockQuantity("7", 10))
        assertEquals("6", adjustedFiniteStockQuantity("7", -1))
    }

    @Test
    fun `stock never decreases below zero and accepts localized decimals`() {
        assertEquals("0", adjustedFiniteStockQuantity("0", -1))
        assertEquals("3", adjustedFiniteStockQuantity("4,8", -1))
        assertEquals(0, finiteStockQuantity("invalid"))
    }

    @Test
    fun `editor title distinguishes add and edit modes`() {
        assertEquals(R.string.products_editor_title_create, productEditorTitleRes(""))
        assertEquals(R.string.products_editor_title_edit, productEditorTitleRes("product-id"))
        assertEquals(true, isProductEditorOpen(""))
        assertEquals(false, isProductEditorOpen(null))
    }

    @Test
    fun `quantity catalogs provide plurals and new drafts start at one`() {
        assertEquals("1", ProductDraft().packContainerQty)
        assertEquals("1", ProductDraft().unitQty)
        assertEquals(ProductStockMode.FINITE, ProductDraft().stockMode)
        assertEquals("0", ProductDraft().stockQty)
        assertEquals("Cajas", ProductContainerOption.BOX.plural)
        assertEquals("kg", ProductMeasureOption.KILOGRAM.abbreviation)
        assertEquals(null, ProductMeasureOption.matching("gramos aprox"))
    }

    @Test
    fun `stock level follows error warning and normal thresholds`() {
        assertEquals(ProductStockLevel.ERROR, productStockLevel(0))
        assertEquals(ProductStockLevel.WARNING, productStockLevel(1))
        assertEquals(ProductStockLevel.WARNING, productStockLevel(10))
        assertEquals(ProductStockLevel.NORMAL, productStockLevel(11))
    }

    @Test
    fun `eco basket is restricted and bulk container configures kilograms`() {
        assertEquals(false, productContainerOptions(canSelectEcoBasket = false).contains(ProductContainerOption.ECO_BASKET))
        assertEquals(true, productContainerOptions(canSelectEcoBasket = true).contains(ProductContainerOption.ECO_BASKET))

        val bulk = ProductDraft().selectContainer(ProductContainerOption.BULK)
        assertEquals(true, bulk.isBulkProduct)
        assertEquals("kilo", bulk.unitName)
        assertEquals("kg", bulk.unitAbbreviation)
        assertEquals("", bulk.packContainerQty)
        assertEquals(false, bulk.isEcoBasket)

        val packaged = bulk.selectContainer(ProductContainerOption.BOX)
        assertEquals("1", packaged.packContainerQty)
        assertEquals("1", packaged.unitQty)
    }

    @Test
    fun `bulk weight range validates reachable maximum`() {
        assertEquals(true, isValidWeightRange(0.5, 3.0, 0.5))
        assertEquals(false, isValidWeightRange(1.0, 0.5, 0.5))
        assertEquals(false, isValidWeightRange(0.5, 3.0, 0.7))
    }

    @Test
    fun `bulk selection uses minimum maximum and step`() {
        val product = weightedProduct()
        assertEquals(2, product.minimumSelectionCount)
        assertEquals(6, product.maximumSelectionCount)
        assertEquals(1.0, product.selectedQuantity(2), 0.000_001)
        assertEquals(3.0, product.selectedQuantity(6), 0.000_001)
    }

    private fun weightedProduct(): Product = Product(
        id = "bulk",
        vendorId = "producer",
        companyName = "Producer",
        name = "Patatas",
        description = "",
        productImageUrl = null,
        price = 2.0,
        pricingMode = ProductPricingMode.WEIGHT,
        unitName = "kilo",
        unitAbbreviation = "kg",
        unitPlural = "kilos",
        unitQty = 0.5,
        packContainerName = "A granel",
        packContainerAbbreviation = "A granel",
        packContainerPlural = "A granel",
        packContainerQty = null,
        isAvailable = true,
        stockMode = ProductStockMode.INFINITE,
        stockQty = null,
        isEcoBasket = false,
        isCommonPurchase = false,
        commonPurchaseType = null,
        archived = false,
        createdAtMillis = 1,
        updatedAtMillis = 1,
        weightStep = 0.5,
        minWeight = 1.0,
        maxWeight = 3.0,
    )
}
