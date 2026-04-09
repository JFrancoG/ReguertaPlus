package com.reguerta.user.presentation.access

import com.reguerta.user.R
import com.reguerta.user.domain.access.MemberRepository
import com.reguerta.user.domain.products.Product
import com.reguerta.user.domain.products.ProductPricingMode
import com.reguerta.user.domain.products.ProductRepository
import com.reguerta.user.domain.products.ProductStockMode
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

internal class SessionProductActions(
    private val uiState: MutableStateFlow<SessionUiState>,
    private val scope: CoroutineScope,
    private val memberRepository: MemberRepository,
    private val productRepository: ProductRepository,
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
            val membersById = mode.members.associateBy { it.id }
            val visibleProducts = productRepository.getAllProducts()
                .filter { product ->
                    product.isVisibleInOrdering &&
                        membersById[product.vendorId].isVisibleForOrdering()
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
                        myOrderProductsFeed = visibleProducts,
                        isLoadingMyOrderProducts = false,
                    )
                }
            }
        }
    }

    fun saveProduct(onSuccess: () -> Unit = {}) {
        val mode = uiState.value.mode as? SessionMode.Authorized ?: return
        if (!mode.member.canManageSessionProductCatalog) {
            emitMessage(R.string.feedback_only_producer_manage_products)
            return
        }
        val draft = uiState.value.productDraft.normalized()
        val nowMillis = nowMillisProvider()
        val existing = uiState.value.productsFeed.firstOrNull { it.id == uiState.value.editingProductId }
        val price = draft.price.toPositiveDoubleOrNull()
        val unitQty = draft.unitQty.toPositiveDoubleOrNull()
        val stockQty = if (draft.stockMode == ProductStockMode.FINITE) draft.stockQty.toNonNegativeDoubleOrNull() else null
        val packContainerQty = if (draft.packContainerName.isNotBlank()) draft.packContainerQty.toPositiveDoubleOrNull() else null
        if (draft.name.isBlank() || price == null || draft.unitName.isBlank() || draft.unitPlural.isBlank() || unitQty == null) {
            emitMessage(R.string.feedback_product_required_fields)
            return
        }
        if (draft.stockMode == ProductStockMode.FINITE && stockQty == null) {
            emitMessage(R.string.feedback_product_stock_required)
            return
        }
        if (draft.packContainerName.isNotBlank() && packContainerQty == null) {
            emitMessage(R.string.feedback_product_pack_qty_required)
            return
        }
        scope.launch {
            val canManageEcoBasket = mode.member.isSessionProducer
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
                    pricingMode = ProductPricingMode.FIXED,
                    unitName = draft.unitName,
                    unitAbbreviation = draft.unitAbbreviation.ifBlank { null },
                    unitPlural = draft.unitPlural,
                    unitQty = unitQty,
                    packContainerName = draft.packContainerName.ifBlank { null },
                    packContainerAbbreviation = draft.packContainerAbbreviation.ifBlank { null },
                    packContainerPlural = draft.packContainerPlural.ifBlank { null },
                    packContainerQty = packContainerQty,
                    isAvailable = draft.isAvailable,
                    stockMode = draft.stockMode,
                    stockQty = stockQty,
                    isEcoBasket = if (canManageEcoBasket) draft.isEcoBasket else false,
                    isCommonPurchase = if (canManageCommonPurchase) draft.isCommonPurchase else false,
                    commonPurchaseType = if (canManageCommonPurchase && draft.isCommonPurchase) draft.commonPurchaseType else null,
                    archived = existing?.archived ?: false,
                    createdAtMillis = existing?.createdAtMillis ?: nowMillis,
                    updatedAtMillis = nowMillis,
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
            onSuccess()
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

private fun com.reguerta.user.domain.access.Member?.isVisibleForOrdering(): Boolean =
    this?.isActive != false && this?.producerCatalogEnabled != false
