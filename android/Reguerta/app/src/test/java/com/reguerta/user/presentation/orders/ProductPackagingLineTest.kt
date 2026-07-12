package com.reguerta.user.presentation.orders

import com.reguerta.user.domain.products.Product
import com.reguerta.user.domain.products.ProductStockMode
import org.junit.Assert.assertEquals
import org.junit.Test

class ProductPackagingLineTest {
    @Test
    fun packagingLineKeepsContainerAndMeasureQuantitiesSeparate() {
        val product = product(packContainerQty = 1.0)

        assertEquals("Caja 6 ud(s).", product.packagingLine())
        assertEquals("2 Caja 6 ud(s).", product(packContainerQty = 2.0).packagingLine())
    }

    private fun product(packContainerQty: Double): Product = Product(
        id = "eggs",
        vendorId = "producer_even",
        companyName = "Yemaya",
        name = "Huevos media docena",
        description = "",
        productImageUrl = null,
        price = 2.25,
        unitName = "unidad",
        unitAbbreviation = null,
        unitPlural = "ud(s).",
        unitQty = 6.0,
        packContainerName = "Caja",
        packContainerAbbreviation = null,
        packContainerPlural = "Cajas",
        packContainerQty = packContainerQty,
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
}
