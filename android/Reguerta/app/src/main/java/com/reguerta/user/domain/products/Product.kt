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
    val weightStep: Double? = null,
    val minWeight: Double? = null,
    val maxWeight: Double? = null,
) {
    val isVisibleInOrdering: Boolean
        get() = !archived && isAvailable
}

val Product.effectiveWeightStep: Double
    get() = weightStep?.takeIf { it > 0.0 } ?: unitQty.takeIf { it > 0.0 } ?: 1.0

val Product.minimumSelectionCount: Int
    get() = if (pricingMode == ProductPricingMode.WEIGHT) {
        kotlin.math.ceil((minWeight ?: effectiveWeightStep) / effectiveWeightStep).toInt().coerceAtLeast(1)
    } else {
        1
    }

val Product.maximumSelectionCount: Int?
    get() = if (pricingMode == ProductPricingMode.WEIGHT) {
        maxWeight?.let {
            kotlin.math.floor(it / effectiveWeightStep).toInt().coerceAtLeast(minimumSelectionCount)
        }
    } else {
        null
    }

fun Product.selectedQuantity(selectionCount: Int): Double =
    if (pricingMode == ProductPricingMode.WEIGHT) {
        selectionCount * effectiveWeightStep
    } else {
        selectionCount.toDouble()
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
