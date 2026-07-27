package com.reguerta.user.data.firestore

import com.google.firebase.firestore.FieldValue
import com.reguerta.user.data.commitments.decodeSeasonalCommitmentDocument
import com.reguerta.user.data.products.decodeProductDocument
import com.reguerta.user.data.products.decodeProductDocuments
import com.reguerta.user.data.products.productUpsertPayload
import com.reguerta.user.domain.RepositoryErrorKind
import com.reguerta.user.domain.RepositoryException
import com.reguerta.user.domain.products.Product
import com.reguerta.user.domain.products.ProductPricingMode
import com.reguerta.user.domain.products.ProductStockMode
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test

class FirestoreDocumentDecodingTest {
    @Test
    fun `empty successful product query decodes as an empty list`() {
        assertTrue(decodeProductDocuments(emptyList()).isEmpty())
    }

    @Test
    fun `invalid product enum and boolean are invalid data`() {
        val invalidEnum = validProductData().toMutableMap().apply {
            this["pricingMode"] = "mystery"
        }
        assertInvalidData("products.document") {
            decodeProductDocument("product", invalidEnum)
        }

        val invalidCasing = validProductData().toMutableMap().apply {
            this["pricingMode"] = "FIXED"
        }
        assertInvalidData("products.document") {
            decodeProductDocument("product", invalidCasing)
        }

        val blankEnum = validProductData().toMutableMap().apply {
            this["pricingMode"] = "   "
        }
        assertInvalidData("products.document") {
            decodeProductDocument("product", blankEnum)
        }

        val invalidBoolean = validProductData().toMutableMap().apply {
            this["archived"] = "false"
        }
        assertInvalidData("products.document") {
            decodeProductDocument("product", invalidBoolean)
        }

        val infinitePrice = validProductData().toMutableMap().apply {
            this["price"] = Double.POSITIVE_INFINITY
        }
        assertInvalidData("products.document") {
            decodeProductDocument("product", infinitePrice)
        }

        val excessiveSelectionRange = validProductData().toMutableMap().apply {
            this["pricingMode"] = "weight"
            this["weightStep"] = 1.0
            this["minWeight"] = 1.0
            this["maxWeight"] = 1e300
        }
        assertInvalidData("products.document") {
            decodeProductDocument("product", excessiveSelectionRange)
        }
    }

    @Test
    fun `invalid seasonal commitment boolean is invalid data`() {
        assertInvalidData("seasonalCommitments.document") {
            decodeSeasonalCommitmentDocument(
                documentId = "commitment",
                data = mapOf(
                    "userId" to "member",
                    "productId" to "product",
                    "seasonKey" to "2026",
                    "fixedQty" to 1.0,
                    "active" to "true",
                ),
            )
        }

        assertInvalidData("seasonalCommitments.document") {
            decodeSeasonalCommitmentDocument(
                documentId = "commitment",
                data = mapOf(
                    "userId" to "member",
                    "productId" to "product",
                    "seasonKey" to "2026",
                    "fixedQty" to Double.POSITIVE_INFINITY,
                ),
            )
        }
    }

    @Test
    fun `merge payload deletes every cleared optional product field`() {
        val payload = productUpsertPayload(product())

        listOf(
            "productImageUrl",
            "unitAbbreviation",
            "packContainerName",
            "packContainerAbbreviation",
            "packContainerPlural",
            "packContainerQty",
            "stockQty",
            "commonPurchaseType",
            "weightStep",
            "minWeight",
            "maxWeight",
        ).forEach { field ->
            assertTrue("Expected $field to be deleted", payload[field] is FieldValue)
        }
    }

    private fun validProductData(): Map<String, Any?> = mapOf(
        "vendorId" to "producer",
        "companyName" to "Productor",
        "name" to "Tomates",
        "price" to 2.0,
        "pricingMode" to "fixed",
        "unitName" to "unidad",
        "unitPlural" to "unidades",
        "unitQty" to 1.0,
        "isAvailable" to true,
        "stockMode" to "infinite",
        "archived" to false,
    )

    private fun product() = Product(
        id = "product",
        vendorId = "producer",
        companyName = "Productor",
        name = "Tomates",
        description = "",
        productImageUrl = null,
        price = 2.0,
        pricingMode = ProductPricingMode.FIXED,
        unitName = "unidad",
        unitAbbreviation = null,
        unitPlural = "unidades",
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
        weightStep = null,
        minWeight = null,
        maxWeight = null,
    )

    private fun assertInvalidData(resource: String, block: () -> Unit) {
        try {
            block()
            fail("Expected invalid data")
        } catch (error: RepositoryException) {
            assertEquals(RepositoryErrorKind.INVALID_DATA, error.kind)
            assertEquals(resource, error.resource)
        }
    }
}
