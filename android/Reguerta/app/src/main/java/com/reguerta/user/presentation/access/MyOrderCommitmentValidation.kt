package com.reguerta.user.presentation.access

import com.reguerta.user.domain.access.EcoCommitmentMode
import com.reguerta.user.domain.access.Member
import com.reguerta.user.domain.access.MemberRole
import com.reguerta.user.domain.products.Product
import java.util.Locale

internal const val EcoBasketOptionPickup = "pickup"
internal const val EcoBasketOptionNoPickup = "no_pickup"

internal data class MyOrderCheckoutValidationResult(
    val missingCommitmentProductNames: List<String>,
    val hasEcoBasketPriceMismatch: Boolean,
) {
    val isValid: Boolean
        get() = missingCommitmentProductNames.isEmpty() && !hasEcoBasketPriceMismatch
}

internal fun validateMyOrderCheckout(
    currentMember: Member?,
    members: List<Member>,
    products: List<Product>,
    selectedQuantities: Map<String, Int>,
    selectedEcoBasketOptions: Map<String, String>,
): MyOrderCheckoutValidationResult {
    val requiredCommitmentProducts = requiredEcoBasketCommitmentProducts(
        currentMember = currentMember,
        members = members,
        products = products,
    )

    val hasRequiredEcoBasket = requiredCommitmentProducts.isEmpty() || requiredCommitmentProducts.any { product ->
        val selectedQuantity = selectedQuantities[product.id].orZero
        if (selectedQuantity <= 0) {
            return@any false
        }
        val selectedOption = selectedEcoBasketOptions[product.id]
        selectedOption == EcoBasketOptionPickup || selectedOption == EcoBasketOptionNoPickup
    }
    val missingNames = if (hasRequiredEcoBasket) {
        emptyList()
    } else {
        requiredCommitmentProducts.map(Product::name).distinct()
    }

    val distinctEcoBasketPrices = products
        .asSequence()
        .filter(Product::isEcoBasket)
        .filter(Product::isVisibleInOrdering)
        .map { product -> product.price.normalizedEcoBasketPriceKey() }
        .toSet()
    val hasPriceMismatch = distinctEcoBasketPrices.size > 1

    return MyOrderCheckoutValidationResult(
        missingCommitmentProductNames = missingNames,
        hasEcoBasketPriceMismatch = hasPriceMismatch,
    )
}

private fun requiredEcoBasketCommitmentProducts(
    currentMember: Member?,
    members: List<Member>,
    products: List<Product>,
): List<Product> {
    val member = currentMember ?: return emptyList()
    if (!member.isActive || !member.roles.contains(MemberRole.MEMBER)) {
        return emptyList()
    }

    val ecoBasketProducts = products
        .filter(Product::isEcoBasket)
        .filter(Product::isVisibleInOrdering)
    if (ecoBasketProducts.isEmpty()) {
        return emptyList()
    }

    return when (member.ecoCommitmentMode) {
        EcoCommitmentMode.WEEKLY -> ecoBasketProducts
        EcoCommitmentMode.BIWEEKLY -> {
            val parity = member.ecoCommitmentParity ?: return ecoBasketProducts
            val eligibleProducerIds = members
                .asSequence()
                .filter { producer ->
                    producer.roles.contains(MemberRole.PRODUCER) &&
                        producer.isActive &&
                        producer.producerCatalogEnabled &&
                        producer.producerParity == parity
                }
                .map(Member::id)
                .toSet()

            val parityProducts = ecoBasketProducts.filter { product ->
                eligibleProducerIds.contains(product.vendorId)
            }
            if (parityProducts.isEmpty()) ecoBasketProducts else parityProducts
        }
    }
}

private fun Double.normalizedEcoBasketPriceKey(): String =
    String.format(Locale.US, "%.4f", this)

private val Int?.orZero: Int
    get() = this ?: 0
