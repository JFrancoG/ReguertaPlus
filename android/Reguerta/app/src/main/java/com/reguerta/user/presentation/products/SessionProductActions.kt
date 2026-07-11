package com.reguerta.user.presentation.products

import com.reguerta.user.presentation.root.ProductDraft
import com.reguerta.user.presentation.root.SessionMode
import com.reguerta.user.presentation.root.SessionUiState
import com.reguerta.user.presentation.root.canManageSessionProductCatalog
import com.reguerta.user.presentation.root.isSessionProducer
import com.reguerta.user.presentation.root.normalized
import com.reguerta.user.presentation.root.toDraft
import com.reguerta.user.presentation.root.toNonNegativeDoubleOrNull
import com.reguerta.user.presentation.root.toPositiveDoubleOrNull

import android.net.Uri
import com.reguerta.user.R
import com.reguerta.user.data.media.ImagePipelineManager
import com.reguerta.user.data.media.ImageUploadNamespace
import com.reguerta.user.domain.access.MemberRepository
import com.reguerta.user.domain.commitments.SeasonalCommitmentRepository
import com.reguerta.user.domain.products.Product
import com.reguerta.user.domain.products.ProductContainerOption
import com.reguerta.user.domain.products.ProductPricingMode
import com.reguerta.user.domain.products.ProductRepository
import com.reguerta.user.domain.products.ProductStockMode
import com.reguerta.user.presentation.orders.currentIsoWeekProducerParity
import com.reguerta.user.presentation.orders.matchesCurrentProducerWeek
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.awaitAll
import kotlin.math.abs

internal class SessionProductActions(
    private val uiState: MutableStateFlow<SessionUiState>,
    private val scope: CoroutineScope,
    private val memberRepository: MemberRepository,
    private val productRepository: ProductRepository,
    private val seasonalCommitmentRepository: SeasonalCommitmentRepository,
    private val imagePipelineManager: ImagePipelineManager,
    private val nowMillisProvider: () -> Long,
    private val emitMessage: (Int) -> Unit,
) {
    fun refreshProducts() {
        val mode = uiState.value.mode as? SessionMode.Authorized ?: return
        if (!mode.member.canManageSessionProductCatalog) return
        scope.launch {
            uiState.update { it.copy(isLoadingProducts = true) }
            val products = productRepository.getProductsForVendor(mode.member.id)
            uiState.update {
                val currentMode = it.mode as? SessionMode.Authorized
                if (currentMode?.principal?.uid != mode.principal.uid) {
                    it
                } else {
                    it.copy(
                        productsFeed = products,
                        isLoadingProducts = false,
                    )
                }
            }
        }
    }

    fun refreshMyOrderProducts() {
        val mode = uiState.value.mode as? SessionMode.Authorized ?: return
        scope.launch {
            uiState.update { it.copy(isLoadingMyOrderProducts = true) }
            val refreshedMembers = memberRepository.getAllMembers().ifEmpty { mode.members }
            val membersById = refreshedMembers.associateBy { it.id }
            val refreshedCurrentMember = membersById[mode.member.id] ?: mode.member
            val currentWeekParity = currentIsoWeekProducerParity(nowMillis = nowMillisProvider())
            val seasonalCommitments = linkedMapOf<String, com.reguerta.user.domain.commitments.SeasonalCommitment>()
            refreshedCurrentMember.seasonalCommitmentLookupKeys()
                .map { lookupKey ->
                    async {
                        seasonalCommitmentRepository.getActiveCommitmentsForUser(lookupKey)
                    }
                }
                .awaitAll()
                .flatten()
                .forEach {
                    seasonalCommitments[it.id] = it
                }
            val visibleProducts = productRepository.getAllProducts()
                .filter { product ->
                    product.isVisibleInOrdering &&
                        membersById[product.vendorId].isVisibleForOrdering() &&
                        product.matchesCurrentProducerWeek(
                            membersById = membersById,
                            currentWeekParity = currentWeekParity,
                        )
                }
                .sortedWith(
                    compareBy<Product> { it.companyName.lowercase() }
                        .thenBy { it.name.lowercase() },
                )
            uiState.update {
                val currentMode = it.mode as? SessionMode.Authorized
                if (currentMode?.principal?.uid != mode.principal.uid) {
                    it.copy(isLoadingMyOrderProducts = false)
                } else {
                    it.copy(
                        mode = currentMode.copy(
                            authenticatedMember = membersById[currentMode.authenticatedMember.id]
                                ?: currentMode.authenticatedMember,
                            member = membersById[currentMode.member.id] ?: currentMode.member,
                            members = refreshedMembers,
                        ),
                        myOrderProductsFeed = visibleProducts,
                        myOrderSeasonalCommitmentsFeed = seasonalCommitments.values.toList(),
                        isLoadingMyOrderProducts = false,
                    )
                }
            }
        }
    }

    fun saveProduct(onSuccess: (String) -> Unit = {}) {
        val mode = uiState.value.mode as? SessionMode.Authorized ?: return
        if (!mode.member.canManageSessionProductCatalog) {
            emitMessage(R.string.feedback_only_producer_manage_products)
            return
        }
        val draft = uiState.value.productDraft.normalized()
        val nowMillis = nowMillisProvider()
        val existing = uiState.value.productsFeed.firstOrNull { it.id == uiState.value.editingProductId }
        val price = draft.price.toPositiveDoubleOrNull()
        val container = ProductContainerOption.matching(draft.packContainerName)
        val isBulk = container == ProductContainerOption.BULK
        val weightStep = if (isBulk) draft.weightStep.toPositiveDoubleOrNull() else null
        val minWeight = if (isBulk) draft.minWeight.toPositiveDoubleOrNull() else null
        val maxWeight = if (isBulk) draft.maxWeight.toPositiveDoubleOrNull() else null
        val unitQty = if (isBulk) weightStep else draft.unitQty.toPositiveDoubleOrNull()
        val stockQty = if (draft.stockMode == ProductStockMode.FINITE) draft.stockQty.toNonNegativeDoubleOrNull() else null
        val packContainerQty = if (draft.packContainerName.isNotBlank() && !isBulk) {
            draft.packContainerQty.toPositiveDoubleOrNull()
        } else {
            null
        }
        if (draft.name.isBlank() || price == null || unitQty == null || (!isBulk && (draft.unitName.isBlank() || draft.unitPlural.isBlank()))) {
            emitMessage(R.string.feedback_product_required_fields)
            return
        }
        if (isBulk && !isValidWeightRange(minWeight = minWeight, maxWeight = maxWeight, step = weightStep)) {
            emitMessage(R.string.feedback_product_weight_range_invalid)
            return
        }
        if (draft.stockMode == ProductStockMode.FINITE && stockQty == null) {
            emitMessage(R.string.feedback_product_stock_required)
            return
        }
        if (draft.packContainerName.isNotBlank() && !isBulk && packContainerQty == null) {
            emitMessage(R.string.feedback_product_pack_qty_required)
            return
        }
        scope.launch {
            val canManageEcoBasket = mode.member.isSessionProducer && mode.member.producerParity != null
            val canManageCommonPurchase = mode.member.isCommonPurchaseManager && !mode.member.isSessionProducer
            val allProducts = productRepository.getAllProducts()
            val activeEcoBasketPrice = allProducts.firstOrNull { product ->
                product.isEcoBasket && !product.archived && product.id != existing?.id
            }?.price
            if (canManageEcoBasket && draft.isEcoBasket && activeEcoBasketPrice != null && activeEcoBasketPrice != price) {
                emitMessage(R.string.feedback_product_eco_basket_price_mismatch)
                return@launch
            }
            uiState.update { it.copy(isSavingProduct = true) }
            val saved = productRepository.upsertProduct(
                Product(
                    id = existing?.id.orEmpty(),
                    vendorId = existing?.vendorId ?: mode.member.id,
                    companyName = existing?.companyName ?: mode.member.displayName,
                    name = draft.name,
                    description = draft.description,
                    productImageUrl = draft.productImageUrl.ifBlank { null },
                    price = price,
                    pricingMode = if (isBulk) ProductPricingMode.WEIGHT else ProductPricingMode.FIXED,
                    unitName = if (isBulk) "kilo" else draft.unitName,
                    unitAbbreviation = if (isBulk) "kg" else draft.unitAbbreviation.ifBlank { null },
                    unitPlural = if (isBulk) "kilos" else draft.unitPlural,
                    unitQty = unitQty,
                    packContainerName = draft.packContainerName.ifBlank { null },
                    packContainerAbbreviation = draft.packContainerAbbreviation.ifBlank { null },
                    packContainerPlural = draft.packContainerPlural.ifBlank { null },
                    packContainerQty = packContainerQty,
                    isAvailable = draft.isAvailable,
                    stockMode = draft.stockMode,
                    stockQty = stockQty,
                    isEcoBasket = canManageEcoBasket && container == ProductContainerOption.ECO_BASKET,
                    isCommonPurchase = if (canManageCommonPurchase) draft.isCommonPurchase else false,
                    commonPurchaseType = if (canManageCommonPurchase && draft.isCommonPurchase) draft.commonPurchaseType else null,
                    archived = existing?.archived ?: false,
                    createdAtMillis = existing?.createdAtMillis ?: nowMillis,
                    updatedAtMillis = nowMillis,
                    weightStep = weightStep,
                    minWeight = minWeight,
                    maxWeight = maxWeight,
                ),
            )
            val products = productRepository.getProductsForVendor(mode.member.id)
            uiState.update {
                it.copy(
                    productsFeed = products,
                    productDraft = saved.toDraft(),
                    editingProductId = saved.id,
                    isSavingProduct = false,
                )
            }
            emitMessage(if (existing == null) R.string.feedback_product_created else R.string.feedback_product_updated)
            onSuccess(saved.id)
        }
    }

    fun uploadProductImageFromUri(sourceUri: Uri) {
        val mode = uiState.value.mode as? SessionMode.Authorized ?: return
        if (!mode.member.canManageSessionProductCatalog) {
            emitMessage(R.string.feedback_only_producer_manage_products)
            return
        }
        scope.launch {
            uiState.update { it.copy(isUploadingProductImage = true) }
            val uploaded = imagePipelineManager.processAndUpload(
                sourceUri = sourceUri,
                ownerId = mode.member.id,
                namespace = ImageUploadNamespace.PRODUCTS,
                entityId = uiState.value.editingProductId?.takeIf { id -> id.isNotBlank() },
                nameHint = uiState.value.productDraft.name,
            )
            uiState.update { state ->
                state.copy(
                    productDraft = state.productDraft.copy(
                        productImageUrl = uploaded?.downloadUrl ?: state.productDraft.productImageUrl,
                    ),
                    isUploadingProductImage = false,
                )
            }
            emitMessage(
                if (uploaded != null) {
                    R.string.feedback_product_image_uploaded
                } else {
                    R.string.feedback_product_image_upload_failed
                },
            )
        }
    }

    fun clearProductImage() {
        uiState.update { state ->
            state.copy(
                productDraft = state.productDraft.copy(productImageUrl = ""),
            )
        }
    }

    fun archiveProduct(
        productId: String,
        onSuccess: () -> Unit = {},
    ) {
        val mode = uiState.value.mode as? SessionMode.Authorized ?: return
        if (!mode.member.canManageSessionProductCatalog) {
            emitMessage(R.string.feedback_only_producer_manage_products)
            return
        }
        val product = uiState.value.productsFeed.firstOrNull { it.id == productId } ?: return
        scope.launch {
            uiState.update { it.copy(isSavingProduct = true) }
            productRepository.upsertProduct(
                product.copy(
                    archived = true,
                    updatedAtMillis = nowMillisProvider(),
                ),
            )
            val products = productRepository.getProductsForVendor(mode.member.id)
            uiState.update {
                it.copy(
                    productsFeed = products,
                    productDraft = if (it.editingProductId == productId) ProductDraft() else it.productDraft,
                    editingProductId = if (it.editingProductId == productId) null else it.editingProductId,
                    isSavingProduct = false,
                )
            }
            emitMessage(R.string.feedback_product_archived)
            onSuccess()
        }
    }

    fun setOwnProducerCatalogVisibility(
        isEnabled: Boolean,
        onSuccess: () -> Unit = {},
    ) {
        val mode = uiState.value.mode as? SessionMode.Authorized ?: return
        if (!mode.member.isSessionProducer) {
            emitMessage(R.string.feedback_only_producer_toggle_catalog_visibility)
            return
        }
        if (mode.member.producerCatalogEnabled == isEnabled) {
            onSuccess()
            return
        }

        scope.launch {
            uiState.update { it.copy(isUpdatingProducerCatalogVisibility = true) }
            try {
                val updatedMember = memberRepository.upsertMember(
                    mode.member.copy(
                        producerCatalogEnabled = isEnabled,
                    ),
                )
                val allMembers = memberRepository.getAllMembers()
                val products = productRepository.getProductsForVendor(updatedMember.id)
                uiState.update {
                    it.copy(
                        mode = SessionMode.Authorized(
                            principal = mode.principal,
                            authenticatedMember = if (mode.authenticatedMember.id == updatedMember.id) updatedMember else mode.authenticatedMember,
                            member = updatedMember,
                            members = allMembers,
                        ),
                        productsFeed = products,
                        isUpdatingProducerCatalogVisibility = false,
                    )
                }
                refreshMyOrderProducts()
                emitMessage(
                    if (isEnabled) {
                        R.string.feedback_producer_catalog_enabled
                    } else {
                        R.string.feedback_producer_catalog_disabled
                    },
                )
                onSuccess()
            } catch (_: Exception) {
                uiState.update { it.copy(isUpdatingProducerCatalogVisibility = false) }
                emitMessage(R.string.feedback_unable_save_changes)
            }
        }
    }
}

internal fun isValidWeightRange(minWeight: Double?, maxWeight: Double?, step: Double?): Boolean {
    if (minWeight == null || maxWeight == null || step == null || minWeight > maxWeight) return false
    val intervals = (maxWeight - minWeight) / step
    return abs(intervals - intervals.toInt()) < 0.000_001
}

internal fun com.reguerta.user.domain.access.Member?.isVisibleForOrdering(): Boolean =
    this?.isActive != false && this?.producerCatalogEnabled != false

internal fun com.reguerta.user.domain.access.Member.seasonalCommitmentLookupKeys(): List<String> =
    buildList {
        add(id)
        authUid
            ?.trim()
            ?.takeIf { it.isNotBlank() }
            ?.let(::add)
        normalizedEmail
            .trim()
            .takeIf { it.isNotBlank() }
            ?.let(::add)
    }
        .map(String::trim)
        .filter(String::isNotBlank)
        .distinct()
