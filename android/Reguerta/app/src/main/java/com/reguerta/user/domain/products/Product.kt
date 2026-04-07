package com.reguerta.user.domain.products

data class Product(
    val id: String,
    val vendorId: String,
    val companyName: String,
    val name: String,
    val description: String,
    val productImageUrl: String?,
    val price: Double,
    val pricingMode: ProductPricingMode = ProductPricingMode.FIXED,
    val unitName: String,
    val unitAbbreviation: String?,
    val unitPlural: String,
    val unitQty: Double,
    val packContainerName: String?,
    val packContainerAbbreviation: String?,
    val packContainerPlural: String?,
    val packContainerQty: Double?,
    val isAvailable: Boolean,
    val stockMode: ProductStockMode,
    val stockQty: Double?,
    val isEcoBasket: Boolean,
    val isCommonPurchase: Boolean,
    val commonPurchaseType: CommonPurchaseType?,
    val archived: Boolean,
    val createdAtMillis: Long,
    val updatedAtMillis: Long,
) {
    val isVisibleInOrdering: Boolean
        get() = !archived && isAvailable
}

enum class ProductPricingMode {
    FIXED,
    WEIGHT,
}

enum class ProductStockMode {
    FINITE,
    INFINITE,
}

enum class CommonPurchaseType {
    SEASONAL,
    SPOT,
}
