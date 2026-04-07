package com.reguerta.user.domain.products

interface ProductRepository {
    suspend fun getAllProducts(): List<Product>
    suspend fun getProductsForVendor(vendorId: String): List<Product>
    suspend fun upsertProduct(product: Product): Product
}
