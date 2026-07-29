package com.reguerta.user.presentation.products

import com.reguerta.user.presentation.root.ProductDraft
import com.reguerta.user.presentation.root.CriticalDataRefreshConsumerReceipt
import com.reguerta.user.presentation.root.SessionMode
import com.reguerta.user.presentation.root.SessionUiState
import com.reguerta.user.presentation.root.canManageSessionProductCatalog
import com.reguerta.user.presentation.root.criticalDataRefreshConsumerReceipt
import com.reguerta.user.presentation.root.isSessionProducer
import com.reguerta.user.presentation.root.normalized
import com.reguerta.user.presentation.root.toDraft
import com.reguerta.user.presentation.root.toNonNegativeDoubleOrNull
import com.reguerta.user.presentation.root.toPositiveDoubleOrNull

import android.net.Uri
import com.reguerta.user.R
import com.reguerta.user.data.media.ImagePipelineManager
import com.reguerta.user.data.media.ImageUploadNamespace
import com.reguerta.user.domain.RepositoryErrorKind
import com.reguerta.user.domain.RepositoryException
import com.reguerta.user.domain.access.MemberRepository
import com.reguerta.user.domain.access.canManageMembers
import com.reguerta.user.domain.commitments.SeasonalCommitmentRepository
import com.reguerta.user.domain.freshness.CriticalDataRefreshPayload
import com.reguerta.user.domain.products.Product
import com.reguerta.user.domain.products.ProductContainerOption
import com.reguerta.user.domain.products.ProductPricingMode
import com.reguerta.user.domain.products.ProductRepository
import com.reguerta.user.domain.products.ProductStockMode
import com.reguerta.user.presentation.orders.currentIsoWeekProducerParity
import com.reguerta.user.presentation.orders.matchesCurrentProducerWeek
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import java.util.UUID
import kotlin.math.abs
import kotlin.math.ceil
import kotlin.math.floor
import kotlin.math.round

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
    private var nextProductMutationToken = 0L
    private var activeProductMutation: ActiveProductMutation? = null
    private var nextProductUploadToken = 0L
    private var activeProductUpload: ActiveProductUpload? = null
    private val myOrderRefreshLock = Any()
    private var myOrderRefreshGeneration = 0L

    fun refreshProducts() {
        val initialState = uiState.value
        val mode = initialState.mode as? SessionMode.Authorized ?: return
        val context = ProductSessionContext.from(initialState, mode)
        if (!mode.member.canManageSessionProductCatalog) return
        scope.launch {
            if (!updateIfCurrent(context) { it.copy(isLoadingProducts = true) }) return@launch
            try {
                val products = productRepository.getProductsForVendor(mode.member.id)
                updateIfCurrent(context) {
                    it.copy(productsFeed = products, isLoadingProducts = false)
                }
            } catch (cancellation: CancellationException) {
                updateIfCurrent(context) { it.copy(isLoadingProducts = false) }
                throw cancellation
            } catch (_: Exception) {
                if (updateIfCurrent(context) { it.copy(isLoadingProducts = false) }) {
                    emitMessage(R.string.feedback_unable_load_data)
                }
            }
        }
    }

    fun refreshMyOrderProducts() {
        val initialState = uiState.value
        val mode = initialState.mode as? SessionMode.Authorized ?: return
        val context = ProductSessionContext.from(initialState, mode)
        scope.launch {
            try {
                refreshMyOrderProductsForFreshness(
                    additionalFence = { isCurrent(context) },
                )
            } catch (cancellation: CancellationException) {
                throw cancellation
            } catch (_: Exception) {
                if (isCurrent(context)) {
                    emitMessage(R.string.feedback_unable_load_data)
                }
            }
        }
    }

    internal suspend fun refreshMyOrderProductsForFreshness(
        prefetchedPayload: CriticalDataRefreshPayload? = null,
        additionalFence: () -> Boolean = { true },
    ): CriticalDataRefreshConsumerReceipt? {
        val initialState = uiState.value
        val mode = initialState.mode as? SessionMode.Authorized ?: return null
        val context = ProductSessionContext.from(initialState, mode)
        val refreshGeneration = synchronized(myOrderRefreshLock) {
            myOrderRefreshGeneration += 1
            myOrderRefreshGeneration
        }
        if (!updateMyOrderIfCurrent(context, refreshGeneration, additionalFence) {
                it.copy(isLoadingMyOrderProducts = true)
            }
        ) return null

        try {
            if (
                prefetchedPayload != null &&
                (
                    prefetchedPayload.authenticatedMemberId != mode.authenticatedMember.id ||
                        prefetchedPayload.authenticatedMember.authUid != mode.principal.uid
                )
            ) {
                throw RepositoryException(
                    kind = RepositoryErrorKind.PERMISSION_DENIED,
                    resource = "criticalDataRefresh.consumer.authenticatedMember",
                )
            }
            if (prefetchedPayload?.requiresAccessScopeRetry == true) {
                return updateMyOrderWithReceiptIfCurrent(
                    context = context,
                    refreshGeneration = refreshGeneration,
                    additionalFence = additionalFence,
                ) { state ->
                    val currentMode = state.mode as SessionMode.Authorized
                    val refreshedAuthenticatedMember = prefetchedPayload.authenticatedMember
                    val revokedMemberManagement = currentMode.authenticatedMember.canManageMembers &&
                        !refreshedAuthenticatedMember.canManageMembers
                    val refreshedMembers = if (revokedMemberManagement) {
                        listOf(refreshedAuthenticatedMember)
                    } else {
                        (
                            currentMode.members.filterNot { member ->
                                member.id == refreshedAuthenticatedMember.id
                            } + refreshedAuthenticatedMember
                        ).sortedBy { member -> member.displayName.lowercase() }
                    }
                    state.copy(
                        mode = currentMode.copy(
                            authenticatedMember = refreshedAuthenticatedMember,
                            member = if (
                                currentMode.member.id == refreshedAuthenticatedMember.id ||
                                !refreshedAuthenticatedMember.canManageMembers
                            ) {
                                refreshedAuthenticatedMember
                            } else {
                                currentMode.member
                            },
                            members = refreshedMembers,
                        ),
                        isLoadingMyOrderProducts = false,
                    )
                }
            }

            val payloadSelectedMember = prefetchedPayload?.selectedMember
            if (payloadSelectedMember != null && payloadSelectedMember.id != mode.member.id) {
                throw RepositoryException(
                    kind = RepositoryErrorKind.INVALID_DATA,
                    resource = "criticalDataRefresh.consumer.selectedMember",
                )
            }
            val loadedMembers = prefetchedPayload?.members
                ?: memberRepository.getMembersVisibleTo(
                    prefetchedPayload?.authenticatedMember ?: mode.authenticatedMember,
                ).ifEmpty { mode.members }
            val refreshedMembers = if (prefetchedPayload != null) {
                loadedMembers
                    .filterNot { member ->
                        member.id == prefetchedPayload.authenticatedMemberId ||
                            member.id == payloadSelectedMember?.id
                    }
                    .plus(prefetchedPayload.authenticatedMember)
                    .let { members ->
                        if (payloadSelectedMember?.id == prefetchedPayload.authenticatedMemberId) {
                            members
                        } else {
                            members + requireNotNull(payloadSelectedMember)
                        }
                    }
                    .sortedBy { member -> member.displayName.lowercase() }
            } else {
                loadedMembers
            }
            val membersById = refreshedMembers.associateBy { it.id }
            val refreshedCurrentMember = payloadSelectedMember ?: membersById[mode.member.id] ?: mode.member
            val currentWeekParity = currentIsoWeekProducerParity(nowMillis = nowMillisProvider())
            val seasonalCommitments = linkedMapOf<String, com.reguerta.user.domain.commitments.SeasonalCommitment>()
            if (prefetchedPayload != null) {
                requireNotNull(prefetchedPayload.seasonalCommitments).forEach { commitment ->
                    seasonalCommitments[commitment.id] = commitment
                }
            } else {
                coroutineScope {
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
                }
            }
            val allProducts = prefetchedPayload?.products ?: productRepository.getAllProducts()
            val visibleProducts = allProducts
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
            return updateMyOrderWithReceiptIfCurrent(
                context = context,
                refreshGeneration = refreshGeneration,
                additionalFence = additionalFence,
            ) {
                val currentMode = it.mode as SessionMode.Authorized
                it.copy(
                    mode = currentMode.copy(
                        authenticatedMember = prefetchedPayload?.authenticatedMember
                            ?: membersById[currentMode.authenticatedMember.id]
                            ?: currentMode.authenticatedMember,
                        member = membersById[currentMode.member.id] ?: currentMode.member,
                        members = refreshedMembers,
                    ),
                    myOrderProductsFeed = visibleProducts,
                    myOrderSeasonalCommitmentsFeed = seasonalCommitments.values.toList(),
                    isLoadingMyOrderProducts = false,
                )
            }
        } catch (cancellation: CancellationException) {
            updateMyOrderIfCurrent(context, refreshGeneration, additionalFence) {
                it.copy(isLoadingMyOrderProducts = false)
            }
            throw cancellation
        } catch (error: Exception) {
            if (updateMyOrderIfCurrent(context, refreshGeneration, additionalFence) {
                    it.copy(isLoadingMyOrderProducts = false)
                }
            ) {
                throw error
            }
            return null
        }
    }

    fun saveProduct(onSuccess: (String) -> Unit = {}) {
        val initialState = uiState.value
        val mode = initialState.mode as? SessionMode.Authorized ?: return
        val context = ProductSessionContext.from(initialState, mode)
        if (!mode.member.canManageSessionProductCatalog) {
            emitMessage(R.string.feedback_only_producer_manage_products)
            return
        }
        if (initialState.isUploadingProductImage || initialState.isSavingProduct) return
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
        val newProductId = existing?.id ?: initialState.pendingNewProductId ?: UUID.randomUUID().toString()
        if (existing == null && initialState.pendingNewProductId == null) {
            if (!updateIfCurrent(context) { state ->
                    if (state.editingProductId == initialState.editingProductId && state.pendingNewProductId == null) {
                        state.copy(pendingNewProductId = newProductId)
                    } else {
                        state
                    }
                }
            ) return
            if (!isCurrentEditor(
                    context,
                    initialState.editingProductId,
                    newProductId,
                    initialState.productEditorRevision,
                )
            ) return
        }
        val editorProductId = initialState.editingProductId
        val editorPendingProductId = if (existing == null) newProductId else initialState.pendingNewProductId
        val editorRevision = initialState.productEditorRevision
        val mutationToken = beginProductMutation(context) ?: return
        scope.launch {
            try {
                val canManageEcoBasket = mode.member.isSessionProducer && mode.member.producerParity != null
                val canManageCommonPurchase = mode.member.isCommonPurchaseManager && !mode.member.isSessionProducer
                if (canManageEcoBasket && draft.isEcoBasket) {
                    val activeEcoBasketPrice = try {
                        productRepository.getAllProducts().firstOrNull { product ->
                            product.isEcoBasket && !product.archived && product.id != existing?.id
                        }?.price
                    } catch (cancellation: CancellationException) {
                        throw cancellation
                    } catch (_: Exception) {
                        if (isCurrentEditor(context, editorProductId, editorPendingProductId, editorRevision)) {
                            emitMessage(R.string.feedback_unable_load_data)
                        }
                        return@launch
                    }
                    if (activeEcoBasketPrice != null && activeEcoBasketPrice != price) {
                        if (isCurrentEditor(context, editorProductId, editorPendingProductId, editorRevision)) {
                            emitMessage(R.string.feedback_product_eco_basket_price_mismatch)
                        }
                        return@launch
                    }
                }
                if (!isCurrentEditor(context, editorProductId, editorPendingProductId, editorRevision)) return@launch
                val saved = productRepository.upsertProduct(
                    Product(
                        id = newProductId,
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
                var editorWasCurrent = false
                if (!updateIfCurrent(context) { state ->
                    editorWasCurrent = isCurrentEditor(
                        context,
                        editorProductId,
                        editorPendingProductId,
                        editorRevision,
                        state,
                    )
                    state.copy(
                        productsFeed = state.productsFeed.replacing(saved),
                        productDraft = if (editorWasCurrent) saved.toDraft() else state.productDraft,
                        editingProductId = if (editorWasCurrent) saved.id else state.editingProductId,
                        pendingNewProductId = if (editorWasCurrent) null else state.pendingNewProductId,
                        productEditorRevision = if (editorWasCurrent) state.productEditorRevision + 1 else state.productEditorRevision,
                    )
                }) return@launch
                if (!editorWasCurrent) return@launch
                emitMessage(if (existing == null) R.string.feedback_product_created else R.string.feedback_product_updated)
                onSuccess(saved.id)
            } catch (cancellation: CancellationException) {
                throw cancellation
            } catch (_: Exception) {
                if (isCurrentEditor(context, editorProductId, editorPendingProductId, editorRevision)) {
                    emitMessage(R.string.feedback_unable_save_changes)
                }
            } finally {
                finishProductMutation(context, mutationToken)
            }
        }
    }

    fun uploadProductImageFromUri(sourceUri: Uri) {
        uploadProductImage { initialState, mode ->
            imagePipelineManager.processAndUpload(
                sourceUri = sourceUri,
                ownerId = mode.member.id,
                namespace = ImageUploadNamespace.PRODUCTS,
                entityId = initialState.editingProductId?.takeIf { id -> id.isNotBlank() },
                nameHint = initialState.productDraft.name,
            )
        }
    }

    internal fun uploadProductImage(
        processAndUpload: suspend (SessionUiState, SessionMode.Authorized) -> com.reguerta.user.data.media.ImageUploadResult?,
    ) {
        val initialState = uiState.value
        val mode = initialState.mode as? SessionMode.Authorized ?: return
        val context = ProductSessionContext.from(initialState, mode)
        val editorProductId = initialState.editingProductId
        val pendingProductId = initialState.pendingNewProductId
        val editorRevision = initialState.productEditorRevision
        if (!mode.member.canManageSessionProductCatalog) {
            emitMessage(R.string.feedback_only_producer_manage_products)
            return
        }
        if (initialState.isSavingProduct) return
        val uploadToken = beginProductUpload(context) ?: return
        scope.launch {
            try {
                if (!isCurrentEditor(context, editorProductId, pendingProductId, editorRevision)) return@launch
                val uploaded = processAndUpload(initialState, mode)
                if (!updateEditorIfCurrent(context, editorProductId, pendingProductId, editorRevision) { state ->
                    state.copy(
                        productDraft = state.productDraft.copy(
                            productImageUrl = uploaded?.downloadUrl ?: state.productDraft.productImageUrl,
                        ),
                        productEditorRevision = state.productEditorRevision + 1,
                    )
                }) return@launch
                emitMessage(
                    if (uploaded != null) {
                        R.string.feedback_product_image_uploaded
                    } else {
                        R.string.feedback_product_image_upload_failed
                    },
                )
            } catch (cancellation: CancellationException) {
                throw cancellation
            } catch (_: Exception) {
                if (isCurrentEditor(context, editorProductId, pendingProductId, editorRevision)) {
                    emitMessage(R.string.feedback_product_image_upload_failed)
                }
            } finally {
                finishProductUpload(context, uploadToken)
            }
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
        val initialState = uiState.value
        val mode = initialState.mode as? SessionMode.Authorized ?: return
        val context = ProductSessionContext.from(initialState, mode)
        if (!mode.member.canManageSessionProductCatalog) {
            emitMessage(R.string.feedback_only_producer_manage_products)
            return
        }
        val product = uiState.value.productsFeed.firstOrNull { it.id == productId } ?: return
        val mutationToken = beginProductMutation(context) ?: return
        scope.launch {
            try {
                val archived = productRepository.upsertProduct(
                    product.copy(
                        archived = true,
                        updatedAtMillis = nowMillisProvider(),
                    ),
                )
                if (!updateIfCurrent(context) {
                    it.copy(
                        productsFeed = it.productsFeed.replacing(archived),
                        productDraft = if (it.editingProductId == productId) ProductDraft() else it.productDraft,
                        editingProductId = if (it.editingProductId == productId) null else it.editingProductId,
                        productEditorRevision = if (it.editingProductId == productId) {
                            it.productEditorRevision + 1
                        } else {
                            it.productEditorRevision
                        },
                    )
                }) return@launch
                emitMessage(R.string.feedback_product_archived)
                onSuccess()
            } catch (cancellation: CancellationException) {
                throw cancellation
            } catch (_: Exception) {
                if (isCurrent(context)) {
                    emitMessage(R.string.feedback_unable_save_changes)
                }
            } finally {
                finishProductMutation(context, mutationToken)
            }
        }
    }

    fun setOwnProducerCatalogVisibility(
        isEnabled: Boolean,
        onSuccess: () -> Unit = {},
    ) {
        val initialState = uiState.value
        val mode = initialState.mode as? SessionMode.Authorized ?: return
        val context = ProductSessionContext.from(initialState, mode)
        if (!mode.member.isSessionProducer) {
            emitMessage(R.string.feedback_only_producer_toggle_catalog_visibility)
            return
        }
        if (mode.member.producerCatalogEnabled == isEnabled) {
            onSuccess()
            return
        }

        scope.launch {
            if (!updateIfCurrent(context) { it.copy(isUpdatingProducerCatalogVisibility = true) }) return@launch
            val updatedMember = try {
                memberRepository.updateOwnProducerCatalogEnabled(
                    member = mode.member,
                    isEnabled = isEnabled,
                )
            } catch (cancellation: CancellationException) {
                updateIfCurrent(context) { it.copy(isUpdatingProducerCatalogVisibility = false) }
                throw cancellation
            } catch (_: Exception) {
                if (updateIfCurrent(context) { it.copy(isUpdatingProducerCatalogVisibility = false) }) {
                    emitMessage(R.string.feedback_unable_save_changes)
                }
                return@launch
            }

            val locallyUpdatedMembers = mode.members.map { member ->
                if (member.id == updatedMember.id) updatedMember else member
            }
            if (!updateIfCurrent(context) {
                val currentMode = it.mode as SessionMode.Authorized
                it.copy(
                    mode = currentMode.copy(
                        authenticatedMember = if (currentMode.authenticatedMember.id == updatedMember.id) updatedMember else currentMode.authenticatedMember,
                        member = updatedMember,
                        members = locallyUpdatedMembers,
                    ),
                    isUpdatingProducerCatalogVisibility = false,
                )
            }) return@launch
            emitMessage(
                if (isEnabled) {
                    R.string.feedback_producer_catalog_enabled
                } else {
                    R.string.feedback_producer_catalog_disabled
                },
            )
            onSuccess()

            try {
                val visibilityActor = if (mode.authenticatedMember.id == updatedMember.id) {
                    updatedMember
                } else {
                    mode.authenticatedMember
                }
                val allMembers = memberRepository.getMembersVisibleTo(visibilityActor)
                val products = productRepository.getProductsForVendor(updatedMember.id)
                if (!updateIfCurrent(context) {
                    val currentMode = it.mode as SessionMode.Authorized
                    it.copy(
                        mode = currentMode.copy(
                            authenticatedMember = if (currentMode.authenticatedMember.id == updatedMember.id) updatedMember else currentMode.authenticatedMember,
                            member = updatedMember,
                            members = allMembers,
                        ),
                        productsFeed = products,
                    )
                }) return@launch
                refreshMyOrderProducts()
            } catch (cancellation: CancellationException) {
                throw cancellation
            } catch (_: Exception) {
                if (isCurrent(context)) emitMessage(R.string.feedback_unable_load_data)
            }
        }
    }

    private fun isCurrent(context: ProductSessionContext, state: SessionUiState = uiState.value): Boolean {
        val currentMode = state.mode as? SessionMode.Authorized ?: return false
        return state.sessionEpoch == context.epoch &&
            currentMode.principal.uid == context.principalUid &&
            currentMode.member.id == context.memberId
    }

    private fun beginProductMutation(context: ProductSessionContext): Long? {
        if (!isCurrent(context)) return null
        val activeMutation = activeProductMutation
        if (activeMutation?.context == context || (activeMutation == null && uiState.value.isSavingProduct)) return null
        nextProductMutationToken += 1
        val token = nextProductMutationToken
        activeProductMutation = ActiveProductMutation(context = context, token = token)
        if (!updateIfCurrent(context) { it.copy(isSavingProduct = true) }) {
            activeProductMutation = null
            return null
        }
        return token
    }

    private fun finishProductMutation(context: ProductSessionContext, token: Long) {
        if (activeProductMutation != ActiveProductMutation(context = context, token = token)) return
        activeProductMutation = null
        updateIfCurrent(context) { it.copy(isSavingProduct = false) }
    }

    private fun beginProductUpload(context: ProductSessionContext): Long? {
        if (!isCurrent(context)) return null
        val activeUpload = activeProductUpload
        if (activeUpload?.context == context || (activeUpload == null && uiState.value.isUploadingProductImage)) {
            return null
        }
        nextProductUploadToken += 1
        val token = nextProductUploadToken
        activeProductUpload = ActiveProductUpload(context = context, token = token)
        if (!updateIfCurrent(context) { it.copy(isUploadingProductImage = true) }) {
            activeProductUpload = null
            return null
        }
        return token
    }

    private fun finishProductUpload(context: ProductSessionContext, token: Long) {
        if (activeProductUpload != ActiveProductUpload(context = context, token = token)) return
        activeProductUpload = null
        updateIfCurrent(context) { it.copy(isUploadingProductImage = false) }
    }

    private fun updateIfCurrent(
        context: ProductSessionContext,
        transform: (SessionUiState) -> SessionUiState,
    ): Boolean = updateIfCurrent(context = context, additionalFence = { true }, transform = transform)

    private fun updateIfCurrent(
        context: ProductSessionContext,
        additionalFence: () -> Boolean,
        transform: (SessionUiState) -> SessionUiState,
    ): Boolean {
        if (!additionalFence() || !isCurrent(context)) return false
        var didUpdate = false
        uiState.update { state ->
            if (additionalFence() && isCurrent(context, state)) {
                didUpdate = true
                transform(state)
            } else {
                state
            }
        }
        return didUpdate
    }

    private fun updateMyOrderIfCurrent(
        context: ProductSessionContext,
        refreshGeneration: Long,
        additionalFence: () -> Boolean,
        transform: (SessionUiState) -> SessionUiState,
    ): Boolean {
        if (!isCurrentMyOrderRefresh(context, refreshGeneration, additionalFence)) return false
        var didUpdate = false
        uiState.update { state ->
            if (
                isCurrentMyOrderRefresh(
                    context = context,
                    refreshGeneration = refreshGeneration,
                    additionalFence = additionalFence,
                    state = state,
                )
            ) {
                didUpdate = true
                transform(state)
            } else {
                state
            }
        }
        return didUpdate
    }

    private fun updateMyOrderWithReceiptIfCurrent(
        context: ProductSessionContext,
        refreshGeneration: Long,
        additionalFence: () -> Boolean,
        transform: (SessionUiState) -> SessionUiState,
    ): CriticalDataRefreshConsumerReceipt? {
        var receipt: CriticalDataRefreshConsumerReceipt? = null
        val didUpdate = updateMyOrderIfCurrent(
            context = context,
            refreshGeneration = refreshGeneration,
            additionalFence = additionalFence,
        ) { state ->
            transform(state).also { updatedState ->
                receipt = updatedState.criticalDataRefreshConsumerReceipt()
            }
        }
        return receipt.takeIf { didUpdate }
    }

    private fun isCurrentMyOrderRefresh(
        context: ProductSessionContext,
        refreshGeneration: Long,
        additionalFence: () -> Boolean,
        state: SessionUiState = uiState.value,
    ): Boolean = synchronized(myOrderRefreshLock) {
        myOrderRefreshGeneration == refreshGeneration
    } && additionalFence() && isCurrent(context, state)

    private fun updateEditorIfCurrent(
        context: ProductSessionContext,
        editingProductId: String?,
        pendingProductId: String?,
        revision: Long,
        transform: (SessionUiState) -> SessionUiState,
    ): Boolean {
        if (!isCurrentEditor(context, editingProductId, pendingProductId, revision)) return false
        var didUpdate = false
        uiState.update { state ->
            if (isCurrentEditor(context, editingProductId, pendingProductId, revision, state)) {
                didUpdate = true
                transform(state)
            } else {
                state
            }
        }
        return didUpdate
    }

    private fun isCurrentEditor(
        context: ProductSessionContext,
        editingProductId: String?,
        pendingProductId: String?,
        revision: Long,
        state: SessionUiState = uiState.value,
    ): Boolean = isCurrent(context, state) &&
        state.editingProductId == editingProductId &&
        state.pendingNewProductId == pendingProductId &&
        state.productEditorRevision == revision
}

private data class ProductSessionContext(
    val epoch: Long,
    val principalUid: String,
    val memberId: String,
) {
    companion object {
        fun from(state: SessionUiState, mode: SessionMode.Authorized) = ProductSessionContext(
            epoch = state.sessionEpoch,
            principalUid = mode.principal.uid,
            memberId = mode.member.id,
        )
    }
}

private data class ActiveProductMutation(
    val context: ProductSessionContext,
    val token: Long,
)

private data class ActiveProductUpload(
    val context: ProductSessionContext,
    val token: Long,
)

internal fun isValidWeightRange(minWeight: Double?, maxWeight: Double?, step: Double?): Boolean {
    if (minWeight == null || maxWeight == null || step == null || minWeight > maxWeight) return false
    val minimumCount = ceil(minWeight / step)
    val maximumCount = floor(maxWeight / step)
    if (!minimumCount.isFinite() ||
        !maximumCount.isFinite() ||
        minimumCount < 1.0 ||
        maximumCount < minimumCount ||
        maximumCount > Int.MAX_VALUE.toDouble()
    ) return false
    val intervals = (maxWeight - minWeight) / step
    return intervals.isFinite() && abs(intervals - round(intervals)) < 0.000_001
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

private fun List<Product>.replacing(product: Product): List<Product> =
    (filterNot { it.id == product.id } + product)
        .sortedWith(compareBy<Product> { it.archived }.thenBy { it.name.lowercase() })
