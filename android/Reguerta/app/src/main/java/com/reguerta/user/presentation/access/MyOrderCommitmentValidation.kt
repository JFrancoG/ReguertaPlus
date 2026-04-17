package com.reguerta.user.presentation.access

import com.reguerta.user.domain.access.EcoCommitmentMode
import com.reguerta.user.domain.access.Member
import com.reguerta.user.domain.access.ProducerParity
import com.reguerta.user.domain.access.isMember
import com.reguerta.user.domain.access.isProducer
import com.reguerta.user.domain.commitments.SeasonalCommitment
import com.reguerta.user.domain.products.Product
import com.reguerta.user.domain.products.ProductPricingMode
import java.text.Normalizer
import java.util.Locale
import kotlin.math.abs
import kotlin.math.roundToInt

internal const val EcoBasketOptionPickup = "pickup"
internal const val EcoBasketOptionNoPickup = "no_pickup"
private val CommitmentDiacriticMarksRegex = "\\p{Mn}+".toRegex()
private val CommitmentTokenRegex = "[a-z0-9]+".toRegex()

internal data class MyOrderCheckoutValidationResult(
    val missingCommitmentProductNames: List<String>,
    val exceededCommitmentProductNames: List<String>,
    val incompatibleCommitmentProductNames: List<String>,
    val hasEcoBasketPriceMismatch: Boolean,
) {
    val isValid: Boolean
        get() = missingCommitmentProductNames.isEmpty() &&
            exceededCommitmentProductNames.isEmpty() &&
            incompatibleCommitmentProductNames.isEmpty() &&
            !hasEcoBasketPriceMismatch
}

internal fun validateMyOrderCheckout(
    currentMember: Member?,
    members: List<Member>,
    products: List<Product>,
    seasonalCommitments: List<SeasonalCommitment> = emptyList(),
    selectedQuantities: Map<String, Int>,
    selectedEcoBasketOptions: Map<String, String>,
    currentWeekParity: ProducerParity = currentIsoWeekProducerParity(),
): MyOrderCheckoutValidationResult {
    val requiredEcoBasketProducts = requiredEcoBasketCommitmentProducts(
        currentMember = currentMember,
        members = members,
        products = products,
        currentWeekParity = currentWeekParity,
    )
    val requiredSeasonalProducts = requiredSeasonalCommitmentProducts(
        products = products,
        seasonalCommitments = seasonalCommitments,
    )

    val hasRequiredEcoBasket = requiredEcoBasketProducts.isEmpty() || requiredEcoBasketProducts.any { product ->
        val selectedQuantity = selectedQuantities[product.id].orZero
        if (selectedQuantity <= 0) {
            return@any false
        }
        val selectedOption = selectedEcoBasketOptions[product.id]
        selectedOption == EcoBasketOptionPickup || selectedOption == EcoBasketOptionNoPickup
    }
    val missingEcoNames = if (hasRequiredEcoBasket) {
        emptyList()
    } else {
        requiredEcoBasketProducts.map(Product::name)
    }

    val missingSeasonalNames = mutableListOf<String>()
    val exceededSeasonalNames = mutableListOf<String>()
    val incompatibleSeasonalNames = mutableListOf<String>()
    requiredSeasonalProducts.forEach { requirement ->
        if (!requirement.isRepresentableBySelectionStep) {
            incompatibleSeasonalNames.add(requirement.product.name)
            return@forEach
        }

        val selectedUnits = selectedQuantities[requirement.product.id].orZero
        val selectedQuantity = selectedUnits.toDouble() * requirement.selectionStep
        if (selectedQuantity + SeasonalCommitmentTolerance < requirement.requiredQuantity) {
            missingSeasonalNames.add(requirement.product.name)
            return@forEach
        }
        if (selectedQuantity - SeasonalCommitmentTolerance > requirement.requiredQuantity) {
            exceededSeasonalNames.add(requirement.product.name)
        }
    }

    val missingNames = (missingEcoNames + missingSeasonalNames).distinct()
    val exceededNames = exceededSeasonalNames.distinct()
    val incompatibleNames = incompatibleSeasonalNames.distinct()

    val distinctEcoBasketPrices = products
        .asSequence()
        .filter(Product::isEcoBasket)
        .filter(Product::isVisibleInOrdering)
        .map { product -> product.price.normalizedEcoBasketPriceKey() }
        .toSet()
    val hasPriceMismatch = distinctEcoBasketPrices.size > 1

    return MyOrderCheckoutValidationResult(
        missingCommitmentProductNames = missingNames,
        exceededCommitmentProductNames = exceededNames,
        incompatibleCommitmentProductNames = incompatibleNames,
        hasEcoBasketPriceMismatch = hasPriceMismatch,
    )
}

internal fun seasonalCommitmentUnitLimitsByProductId(
    products: List<Product>,
    seasonalCommitments: List<SeasonalCommitment>,
): Map<String, Int> = requiredSeasonalCommitmentProducts(
    products = products,
    seasonalCommitments = seasonalCommitments,
).mapNotNull { requirement ->
    if (!requirement.isRepresentableBySelectionStep) {
        return@mapNotNull null
    }
    val expectedUnits = requirement.requiredQuantity / requirement.selectionStep
    val requiredUnits = expectedUnits.roundToInt()
    if (requiredUnits > 0) {
        requirement.product.id to requiredUnits
    } else {
        null
    }
}.toMap()

private fun requiredEcoBasketCommitmentProducts(
    currentMember: Member?,
    members: List<Member>,
    products: List<Product>,
    currentWeekParity: ProducerParity,
): List<Product> {
    val member = currentMember ?: return emptyList()
    if (!member.isActive || !member.isMember) {
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
            if (parity != currentWeekParity) {
                return emptyList()
            }
            val eligibleProducerIds = members
                .asSequence()
                .filter { producer ->
                    producer.isProducer &&
                        producer.isActive &&
                        producer.producerCatalogEnabled &&
                        producer.producerParity == parity
                }
                .map(Member::id)
                .toSet()

            ecoBasketProducts.filter { product ->
                eligibleProducerIds.contains(product.vendorId)
            }
        }
    }
}

private data class SeasonalProductRequirement(
    val product: Product,
    val requiredQuantity: Double,
    val selectionStep: Double,
    val isRepresentableBySelectionStep: Boolean,
)

private fun requiredSeasonalCommitmentProducts(
    products: List<Product>,
    seasonalCommitments: List<SeasonalCommitment>,
): List<SeasonalProductRequirement> {
    if (seasonalCommitments.isEmpty()) {
        return emptyList()
    }

    val visibleProducts = products
        .asSequence()
        .filter(Product::isVisibleInOrdering)
        .sortedWith(compareBy<Product> { it.companyName.lowercase() }.thenBy { it.name.lowercase() })
        .toList()
    val visibleProductsById = visibleProducts.associateBy(Product::id)
    val visibleProductsByName = linkedMapOf<String, Product>().apply {
        visibleProducts.forEach { product ->
            putIfAbsent(product.name.commitmentNormalized(), product)
        }
    }
    val visibleProductsWithNormalizedName = visibleProducts.map { product ->
        product to product.name.commitmentNormalized()
    }

    val requiredQuantityByProductId = seasonalCommitments
        .asSequence()
        .filter(SeasonalCommitment::active)
        .mapNotNull { commitment ->
            val matchedProductId = visibleProductsById[commitment.productId]?.id
                ?: commitment.productNameHint
                    ?.commitmentNormalized()
                    ?.let { visibleProductsByName[it]?.id }
                ?: commitment.commitmentSearchTerms().asSequence()
                    .mapNotNull { term ->
                        visibleProductsWithNormalizedName.firstOrNull { (_, normalizedName) ->
                            normalizedName.contains(term) || term.contains(normalizedName)
                        }?.first?.id
                    }
                    .firstOrNull()
                ?: return@mapNotNull null
            matchedProductId to commitment.fixedQtyPerOfferedWeek
        }
        .groupBy(
            keySelector = { it.first },
            valueTransform = { it.second },
        )
        .mapValues { (_, quantities) ->
            quantities.maxOrNull() ?: 0.0
        }

    return requiredQuantityByProductId
        .mapNotNull { (productId, requiredQuantity) ->
            if (requiredQuantity <= 0.0) {
                return@mapNotNull null
            }
            val product = visibleProductsById[productId] ?: return@mapNotNull null
            val selectionStep = product.commitmentSelectionStep()
            val expectedUnits = requiredQuantity / selectionStep
            val isRepresentableBySelectionStep =
                abs(expectedUnits - expectedUnits.roundToInt().toDouble()) <= SeasonalCommitmentTolerance
            SeasonalProductRequirement(
                product = product,
                requiredQuantity = requiredQuantity,
                selectionStep = selectionStep,
                isRepresentableBySelectionStep = isRepresentableBySelectionStep,
            )
        }
        .sortedWith(compareBy<SeasonalProductRequirement> { it.product.companyName.lowercase() }.thenBy { it.product.name.lowercase() })
}

private fun Product.commitmentSelectionStep(): Double =
    if (pricingMode == ProductPricingMode.WEIGHT) {
        unitQty.takeIf { it > 0.0 } ?: 1.0
    } else {
        1.0
    }

private fun Double.normalizedEcoBasketPriceKey(): String =
    String.format(Locale.US, "%.4f", this)

private fun String.commitmentNormalized(): String =
    Normalizer.normalize(trim(), Normalizer.Form.NFD)
        .replace(CommitmentDiacriticMarksRegex, "")
        .lowercase(Locale.getDefault())

private fun SeasonalCommitment.commitmentSearchTerms(): List<String> =
    listOfNotNull(productNameHint, seasonKey, productId)
        .flatMap { value ->
            CommitmentTokenRegex.findAll(value.commitmentNormalized())
                .map(MatchResult::value)
                .filter { token -> token.length >= 4 && token.any(Char::isLetter) }
                .toList()
        }
        .plus(seasonKey.commitmentSeasonAliasTerms())
        .distinct()

private fun String.commitmentSeasonAliasTerms(): List<String> {
    val firstToken = CommitmentTokenRegex.findAll(commitmentNormalized())
        .map(MatchResult::value)
        .firstOrNull()
        ?: return emptyList()

    return when (firstToken) {
        "avo", "avocado", "avocados", "aguacate", "aguacates" -> listOf(
            "aguacate",
            "aguacates",
            "avocado",
            "avocados",
        )
        "man", "mango", "mangos" -> listOf("mango", "mangos")
        else -> emptyList()
    }
}

private const val SeasonalCommitmentTolerance = 0.0001

private val Int?.orZero: Int
    get() = this ?: 0
