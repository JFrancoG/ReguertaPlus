package com.reguerta.user.data.products

import com.reguerta.user.domain.products.Product
import com.reguerta.user.domain.products.ProductRepository
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

class InMemoryProductRepository(
    items: List<Product> = emptyList(),
) : ProductRepository {
    private val mutex = Mutex()
    private val products = items.associateBy { it.id }.toMutableMap()

    override suspend fun getAllProducts(): List<Product> = mutex.withLock {
        products.values.sortedWith(compareBy<Product> { it.archived }.thenBy { it.name.lowercase() })
    }

    override suspend fun getProductsForVendor(vendorId: String): List<Product> = mutex.withLock {
        products.values
            .filter { it.vendorId == vendorId }
            .sortedWith(compareBy<Product> { it.archived }.thenBy { it.name.lowercase() })
    }

    override suspend fun upsertProduct(product: Product): Product = mutex.withLock {
        products[product.id] = product
        product
    }
}
