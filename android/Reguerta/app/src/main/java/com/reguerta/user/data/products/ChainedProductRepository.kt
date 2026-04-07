package com.reguerta.user.data.products

import com.reguerta.user.domain.products.Product
import com.reguerta.user.domain.products.ProductRepository

class ChainedProductRepository(
    private val primary: ProductRepository,
    private val fallback: ProductRepository,
) : ProductRepository {
    override suspend fun getAllProducts(): List<Product> {
        val primaryProducts = primary.getAllProducts()
        return if (primaryProducts.isNotEmpty()) primaryProducts else fallback.getAllProducts()
    }

    override suspend fun getProductsForVendor(vendorId: String): List<Product> {
        val primaryProducts = primary.getProductsForVendor(vendorId)
        return if (primaryProducts.isNotEmpty()) primaryProducts else fallback.getProductsForVendor(vendorId)
    }

    override suspend fun upsertProduct(product: Product): Product {
        val fallbackUpdated = fallback.upsertProduct(product)
        val primaryUpdated = runCatching { primary.upsertProduct(product) }.getOrNull()
        return primaryUpdated ?: fallbackUpdated
    }
}
