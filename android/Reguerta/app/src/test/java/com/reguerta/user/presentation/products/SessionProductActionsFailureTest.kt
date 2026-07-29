package com.reguerta.user.presentation.products

import android.net.Uri
import com.reguerta.user.R
import com.reguerta.user.data.media.ImagePipelineManager
import com.reguerta.user.data.media.ImageUploadNamespace
import com.reguerta.user.data.media.ImageUploadResult
import com.reguerta.user.domain.access.AuthPrincipal
import com.reguerta.user.domain.access.Member
import com.reguerta.user.domain.access.MemberRepository
import com.reguerta.user.domain.access.MemberRole
import com.reguerta.user.domain.access.ProducerParity
import com.reguerta.user.domain.commitments.SeasonalCommitment
import com.reguerta.user.domain.commitments.SeasonalCommitmentRepository
import com.reguerta.user.domain.freshness.CriticalDataRefreshPayload
import com.reguerta.user.domain.products.Product
import com.reguerta.user.domain.products.ProductPricingMode
import com.reguerta.user.domain.products.ProductRepository
import com.reguerta.user.domain.products.ProductStockMode
import com.reguerta.user.presentation.root.ProductDraft
import com.reguerta.user.presentation.root.SessionMode
import com.reguerta.user.presentation.root.SessionUiState
import com.reguerta.user.presentation.auth.toSignedOutSessionState
import com.reguerta.user.presentation.auth.resetProductEditorUnlessAuthorizedRefreshCanPreserve
import com.reguerta.user.presentation.root.toDraft
import java.io.IOException
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class SessionProductActionsFailureTest {
    @Test
    fun `failed refresh preserves the last catalog and reports a retryable load error`() = runTest {
        val product = product(name = "Tomates")
        val repository = ControlledProductRepository(
            items = listOf(product),
            rejectsReads = true,
        )
        val messages = mutableListOf<Int>()
        val state = MutableStateFlow(
            authorizedState().copy(productsFeed = listOf(product)),
        )
        val actions = actions(
            state = state,
            repository = repository,
            emitMessage = messages::add,
        )

        actions.refreshProducts()
        advanceUntilIdle()

        assertEquals(listOf(product), state.value.productsFeed)
        assertEquals(false, state.value.isLoadingProducts)
        assertEquals(R.string.feedback_unable_load_data, messages.last())
    }

    @Test
    fun `confirmed save updates the local catalog without a read back`() = runTest {
        val product = product(name = "Tomates")
        val repository = ControlledProductRepository(
            items = listOf(product),
            rejectsReads = true,
        )
        val messages = mutableListOf<Int>()
        val state = MutableStateFlow(
            authorizedState().copy(
                productsFeed = listOf(product),
                editingProductId = product.id,
                productDraft = ProductDraft(
                    name = "Tomates cherry",
                    price = "3",
                    unitName = "unidad",
                    unitPlural = "unidades",
                    unitQty = "1",
                    stockMode = ProductStockMode.INFINITE,
                ),
            ),
        )
        val actions = actions(
            state = state,
            repository = repository,
            emitMessage = messages::add,
        )

        actions.saveProduct()
        advanceUntilIdle()

        assertEquals("Tomates cherry", state.value.productsFeed.single().name)
        assertEquals(false, state.value.isSavingProduct)
        assertEquals(1, repository.upsertCount)
        assertEquals(0, repository.readCount)
        assertEquals(R.string.feedback_product_updated, messages.last())
    }

    @Test
    fun `rejected save preserves the draft and reports a save error`() = runTest {
        val product = product(name = "Tomates")
        val draft = ProductDraft(
            name = "Tomates cherry",
            price = "3",
            unitName = "unidad",
            unitPlural = "unidades",
            unitQty = "1",
            stockMode = ProductStockMode.INFINITE,
        )
        val repository = ControlledProductRepository(
            items = listOf(product),
            rejectsReads = false,
            rejectsWrites = true,
        )
        val messages = mutableListOf<Int>()
        val state = MutableStateFlow(
            authorizedState().copy(
                productsFeed = listOf(product),
                editingProductId = product.id,
                productDraft = draft,
            ),
        )
        val actions = actions(
            state = state,
            repository = repository,
            emitMessage = messages::add,
        )

        actions.saveProduct()
        advanceUntilIdle()

        assertEquals(listOf(product), state.value.productsFeed)
        assertEquals(draft, state.value.productDraft)
        assertEquals(product.id, state.value.editingProductId)
        assertEquals(false, state.value.isSavingProduct)
        assertEquals(R.string.feedback_unable_save_changes, messages.last())
    }

    @Test
    fun `ambiguous create retry reuses the same product id`() = runTest {
        val draft = ProductDraft(
            name = "Tomates",
            price = "3",
            unitName = "unidad",
            unitPlural = "unidades",
            unitQty = "1",
            stockMode = ProductStockMode.INFINITE,
        )
        val repository = ControlledProductRepository(
            items = emptyList(),
            rejectsReads = false,
            ambiguousFirstWrite = true,
        )
        val state = MutableStateFlow(
            authorizedState().copy(
                editingProductId = "",
                productDraft = draft,
            ),
        )
        val actions = actions(
            state = state,
            repository = repository,
            emitMessage = {},
        )

        actions.saveProduct()
        advanceUntilIdle()
        val draftAfterFirstAttempt = state.value.productDraft
        val pendingIdAfterFirstAttempt = state.value.pendingNewProductId
        actions.saveProduct()
        advanceUntilIdle()

        assertEquals(draft, draftAfterFirstAttempt)
        assertEquals(false, pendingIdAfterFirstAttempt.isNullOrBlank())
        assertEquals(2, repository.attemptedProductIds.size)
        assertEquals(1, repository.attemptedProductIds.distinct().size)
        assertEquals(1, repository.storedProductCount)
    }

    @Test
    fun `failed commitment refresh preserves the last ordering snapshot`() = runTest {
        val product = product(name = "Tomates")
        val commitment = SeasonalCommitment(
            id = "commitment",
            userId = "producer",
            productId = product.id,
            seasonKey = "2026",
            fixedQtyPerOfferedWeek = 1.0,
            active = true,
            createdAtMillis = 1L,
            updatedAtMillis = 1L,
        )
        val repository = ControlledProductRepository(
            items = listOf(product),
            rejectsReads = false,
        )
        val messages = mutableListOf<Int>()
        val state = MutableStateFlow(
            authorizedState().copy(
                myOrderProductsFeed = listOf(product),
                myOrderSeasonalCommitmentsFeed = listOf(commitment),
            ),
        )
        val actions = actions(
            state = state,
            repository = repository,
            seasonalCommitmentRepository = RejectingSeasonalCommitmentRepository,
            emitMessage = messages::add,
        )

        actions.refreshMyOrderProducts()
        advanceUntilIdle()

        assertEquals(listOf(product), state.value.myOrderProductsFeed)
        assertEquals(listOf(commitment), state.value.myOrderSeasonalCommitmentsFeed)
        assertEquals(false, state.value.isLoadingMyOrderProducts)
        assertEquals(R.string.feedback_unable_load_data, messages.last())
    }

    @Test
    fun `freshness materialization uses server payload and applies commitments before success`() = runTest {
        val product = product(name = "Tomates")
        val commitment = SeasonalCommitment(
            id = "commitment",
            userId = "producer",
            productId = product.id,
            seasonKey = "2026",
            fixedQtyPerOfferedWeek = 1.0,
            active = true,
            createdAtMillis = 1L,
            updatedAtMillis = 1L,
        )
        val repository = ControlledProductRepository(
            items = listOf(product),
            rejectsReads = true,
        )
        val selectedMember = producer().copy(producerParity = ProducerParity.ODD)
        val state = MutableStateFlow(authorizedState())
        val actions = actions(
            state = state,
            repository = repository,
            seasonalCommitmentRepository = RejectingSeasonalCommitmentRepository,
            emitMessage = {},
        )

        val didApply = actions.refreshMyOrderProductsForFreshness(
            prefetchedPayload = CriticalDataRefreshPayload(
                authenticatedMemberId = selectedMember.id,
                authenticatedMember = selectedMember,
                selectedMember = selectedMember,
                seasonalCommitments = listOf(commitment),
                members = listOf(selectedMember),
                products = listOf(product),
            ),
        )

        assertEquals(true, didApply != null)
        assertEquals(0, repository.readCount)
        assertEquals(listOf(product), state.value.myOrderProductsFeed)
        assertEquals(listOf(commitment), state.value.myOrderSeasonalCommitmentsFeed)
        assertEquals(false, state.value.isLoadingMyOrderProducts)
    }

    @Test
    fun `identity only payload revokes admin impersonation without consumer repository reads`() = runTest {
        val previousProduct = product(name = "Anterior")
        val authenticatedAdmin = producer().copy(
            id = "admin",
            displayName = "Admin",
            normalizedEmail = "admin@reguerta.test",
            authUid = "auth-admin",
            roles = setOf(MemberRole.MEMBER, MemberRole.ADMIN),
            producerCatalogEnabled = false,
        )
        val selectedMember = producer()
        val demotedAuthenticatedMember = authenticatedAdmin.copy(
            roles = setOf(MemberRole.MEMBER),
        )
        val state = MutableStateFlow(
            SessionUiState(
                mode = SessionMode.Authorized(
                    principal = AuthPrincipal(
                        uid = "auth-admin",
                        email = authenticatedAdmin.normalizedEmail,
                    ),
                    authenticatedMember = authenticatedAdmin,
                    member = selectedMember,
                    members = listOf(authenticatedAdmin, selectedMember),
                ),
                myOrderProductsFeed = listOf(previousProduct),
            ),
        )
        val repository = ControlledProductRepository(
            items = emptyList(),
            rejectsReads = true,
        )
        val actions = actions(
            state = state,
            repository = repository,
            memberRepository = ConfirmingThenRejectingMemberRepository,
            seasonalCommitmentRepository = RejectingSeasonalCommitmentRepository,
            emitMessage = {},
        )

        val didApply = actions.refreshMyOrderProductsForFreshness(
            prefetchedPayload = CriticalDataRefreshPayload(
                authenticatedMemberId = demotedAuthenticatedMember.id,
                authenticatedMember = demotedAuthenticatedMember,
                selectedMember = null,
                seasonalCommitments = null,
                requiresAccessScopeRetry = true,
            ),
        )

        val refreshedMode = state.value.mode as SessionMode.Authorized
        assertEquals(true, didApply != null)
        assertEquals(0, repository.readCount)
        assertEquals(demotedAuthenticatedMember, refreshedMode.authenticatedMember)
        assertEquals(demotedAuthenticatedMember, refreshedMode.member)
        assertEquals(listOf(demotedAuthenticatedMember), refreshedMode.members)
        assertEquals(listOf(previousProduct), state.value.myOrderProductsFeed)
        assertEquals(false, state.value.isLoadingMyOrderProducts)
    }

    @Test
    fun `users only freshness payload rematerializes visible products`() = runTest {
        val product = product(name = "Tomates")
        val repository = ControlledProductRepository(
            items = listOf(product),
            rejectsReads = false,
        )
        val state = MutableStateFlow(authorizedState())
        val selectedMember = producer().copy(producerParity = ProducerParity.ODD)
        val actions = actions(
            state = state,
            repository = repository,
            emitMessage = {},
        )

        val didApply = actions.refreshMyOrderProductsForFreshness(
            prefetchedPayload = CriticalDataRefreshPayload(
                authenticatedMemberId = selectedMember.id,
                authenticatedMember = selectedMember,
                selectedMember = selectedMember,
                seasonalCommitments = emptyList(),
                members = listOf(selectedMember),
            ),
        )

        assertEquals(true, didApply != null)
        assertEquals(1, repository.readCount)
        assertEquals(listOf(product), state.value.myOrderProductsFeed)
    }

    @Test
    fun `freshness generation fence prevents consumer payload from being applied`() = runTest {
        val previousProduct = product(name = "Anterior")
        val refreshedProduct = product(name = "Nuevo")
        val state = MutableStateFlow(
            authorizedState().copy(myOrderProductsFeed = listOf(previousProduct)),
        )
        val actions = actions(
            state = state,
            repository = ControlledProductRepository(listOf(refreshedProduct), rejectsReads = true),
            emitMessage = {},
        )

        val didApply = actions.refreshMyOrderProductsForFreshness(
            prefetchedPayload = CriticalDataRefreshPayload(
                authenticatedMemberId = "producer",
                authenticatedMember = producer(),
                selectedMember = producer(),
                seasonalCommitments = emptyList(),
                members = listOf(producer()),
                products = listOf(refreshedProduct),
            ),
            additionalFence = { false },
        )

        assertEquals(null, didApply)
        assertEquals(listOf(previousProduct), state.value.myOrderProductsFeed)
    }

    @Test
    fun `latest my order materialization wins over an older normal refresh`() = runTest {
        val oldProduct = product(name = "Anterior")
        val refreshedProduct = product(name = "Nuevo")
        val repository = SuspendedFirstProductReadRepository(oldProduct)
        val state = MutableStateFlow(authorizedState())
        val actions = actions(
            state = state,
            repository = repository,
            emitMessage = {},
        )

        actions.refreshMyOrderProducts()
        repository.firstReadStarted.await()

        val didApply = actions.refreshMyOrderProductsForFreshness(
            prefetchedPayload = CriticalDataRefreshPayload(
                authenticatedMemberId = "producer",
                authenticatedMember = producer().copy(producerParity = ProducerParity.ODD),
                selectedMember = producer().copy(producerParity = ProducerParity.ODD),
                seasonalCommitments = emptyList(),
                products = listOf(refreshedProduct),
            ),
        )
        repository.releaseFirstRead.complete(Unit)
        advanceUntilIdle()

        assertEquals(true, didApply != null)
        assertEquals(listOf(refreshedProduct), state.value.myOrderProductsFeed)
    }

    @Test
    fun `cancelled refresh clears loading without feedback`() = runTest {
        val messages = mutableListOf<Int>()
        val state = MutableStateFlow(authorizedState())
        val actions = actions(
            state = state,
            repository = CancellingProductRepository,
            emitMessage = messages::add,
        )

        actions.refreshProducts()
        advanceUntilIdle()

        assertEquals(false, state.value.isLoadingProducts)
        assertEquals(emptyList<Int>(), messages)
    }

    @Test
    fun `stale save from a previous same identity session publishes nothing`() = runTest {
        val repository = SuspendedProductRepository()
        val messages = mutableListOf<Int>()
        var callbackProductId: String? = null
        val draft = ProductDraft(
            name = "Tomates",
            price = "3",
            unitName = "unidad",
            unitPlural = "unidades",
            unitQty = "1",
            stockMode = ProductStockMode.INFINITE,
        )
        val state = MutableStateFlow(
            authorizedState().copy(editingProductId = "", productDraft = draft),
        )
        val actions = actions(state, repository, emitMessage = messages::add)

        actions.saveProduct { callbackProductId = it }
        runCurrent()
        repository.awaitWriteStarted()
        val reloggedState = authorizedState().copy(
            sessionEpoch = state.value.sessionEpoch + 1,
            productsFeed = emptyList(),
            productDraft = ProductDraft(),
            editingProductId = null,
            pendingNewProductId = null,
            isSavingProduct = false,
        )
        state.value = reloggedState
        repository.completeWrite()
        advanceUntilIdle()

        assertEquals(reloggedState, state.value)
        assertEquals(emptyList<Int>(), messages)
        assertEquals(null, callbackProductId)
    }

    @Test
    fun `confirmed visibility update survives secondary refresh failure`() = runTest {
        val messages = mutableListOf<Int>()
        val state = MutableStateFlow(authorizedState())
        val actions = actions(
            state = state,
            repository = ControlledProductRepository(emptyList(), rejectsReads = true),
            memberRepository = ConfirmingThenRejectingMemberRepository,
            emitMessage = messages::add,
        )

        actions.setOwnProducerCatalogVisibility(isEnabled = false)
        advanceUntilIdle()

        val mode = state.value.mode as SessionMode.Authorized
        assertEquals(false, mode.member.producerCatalogEnabled)
        assertEquals(false, state.value.isUpdatingProducerCatalogVisibility)
        assertEquals(
            listOf(R.string.feedback_producer_catalog_disabled, R.string.feedback_unable_load_data),
            messages,
        )
    }

    @Test
    fun `confirmed old editor save updates catalog without clobbering new editor`() = runTest {
        val first = product(name = "Primero")
        val second = product(name = "Segundo").copy(id = "second")
        val repository = SuspendedProductRepository()
        val messages = mutableListOf<Int>()
        var callbackProductId: String? = null
        val state = MutableStateFlow(
            authorizedState().copy(
                productsFeed = listOf(first, second),
                editingProductId = first.id,
                productDraft = first.toDraft().copy(name = "Primero guardado"),
            ),
        )
        val actions = actions(state, repository, emitMessage = messages::add)

        actions.saveProduct { callbackProductId = it }
        runCurrent()
        repository.awaitWriteStarted()
        val secondDraft = second.toDraft()
        state.value = state.value.copy(
            editingProductId = second.id,
            pendingNewProductId = null,
            productDraft = secondDraft,
            isSavingProduct = false,
        )
        actions.saveProduct { callbackProductId = it }
        runCurrent()
        assertEquals(1, repository.writeCount)
        repository.completeWrite()
        advanceUntilIdle()

        assertEquals("Primero guardado", state.value.productsFeed.first { it.id == first.id }.name)
        assertEquals(second.id, state.value.editingProductId)
        assertEquals(secondDraft, state.value.productDraft)
        assertEquals(emptyList<Int>(), messages)
        assertEquals(null, callbackProductId)
    }

    @Test
    fun `sign out clears ambiguous create identity before another login`() {
        val signedOut = authorizedState().copy(
            editingProductId = "",
            pendingNewProductId = "old-session-product",
            productDraft = ProductDraft(name = "Old draft"),
        ).toSignedOutSessionState(showSessionExpiredDialog = false)

        assertEquals(null, signedOut.editingProductId)
        assertEquals(null, signedOut.pendingNewProductId)
        assertEquals(ProductDraft(), signedOut.productDraft)
    }

    @Test
    fun `confirmed save preserves newer draft revision for the same product`() = runTest {
        val product = product(name = "Primero")
        val repository = SuspendedProductRepository()
        val messages = mutableListOf<Int>()
        var callbackProductId: String? = null
        val state = MutableStateFlow(
            authorizedState().copy(
                productsFeed = listOf(product),
                editingProductId = product.id,
                productDraft = product.toDraft().copy(name = "Versión enviada"),
            ),
        )
        val actions = actions(state, repository, emitMessage = messages::add)

        actions.saveProduct { callbackProductId = it }
        runCurrent()
        repository.awaitWriteStarted()
        val newerDraft = state.value.productDraft.copy(name = "Versión más nueva")
        state.value = state.value.copy(
            productDraft = newerDraft,
            productEditorRevision = state.value.productEditorRevision + 1,
            isSavingProduct = false,
        )
        repository.completeWrite()
        advanceUntilIdle()

        assertEquals("Versión enviada", state.value.productsFeed.single().name)
        assertEquals(product.id, state.value.editingProductId)
        assertEquals(newerDraft, state.value.productDraft)
        assertEquals(emptyList<Int>(), messages)
        assertEquals(null, callbackProductId)
    }

    @Test
    fun `new session can save while an old session write remains suspended`() = runTest {
        val repository = MultiSuspendedProductRepository()
        val state = MutableStateFlow(
            authorizedState().copy(
                editingProductId = "",
                pendingNewProductId = "old-product",
                productDraft = validDraft("Old product"),
            ),
        )
        val actions = actions(state, repository, emitMessage = {})

        actions.saveProduct()
        runCurrent()
        assertEquals(1, repository.writeCount)

        state.value = authorizedState().copy(
            sessionEpoch = state.value.sessionEpoch + 1,
            editingProductId = "",
            pendingNewProductId = "new-product",
            productDraft = validDraft("New product"),
        )
        actions.saveProduct()
        runCurrent()

        assertEquals(2, repository.writeCount)
        repository.completeWrite(index = 1)
        runCurrent()
        repository.completeWrite(index = 0)
        advanceUntilIdle()
        assertEquals(listOf("new-product"), state.value.productsFeed.map(Product::id))
    }

    @Test
    fun `stale upload cleanup unblocks editor without overwriting newer draft`() = runTest {
        val repository = ControlledProductRepository(emptyList(), rejectsReads = false)
        val pipeline = SuspendedImagePipelineManager()
        val messages = mutableListOf<Int>()
        val state = MutableStateFlow(
            authorizedState().copy(
                editingProductId = "",
                pendingNewProductId = "new-product",
                productDraft = validDraft("Tomates"),
            ),
        )
        val actions = actions(
            state = state,
            repository = repository,
            imagePipelineManager = pipeline,
            emitMessage = messages::add,
        )

        actions.uploadProductImage { _, _ -> pipeline.upload() }
        runCurrent()
        pipeline.awaitUploadStarted()
        state.value = state.value.resetProductEditorUnlessAuthorizedRefreshCanPreserve(
            principalUid = "auth-producer",
            member = producer(),
        )
        assertEquals(true, state.value.isUploadingProductImage)
        val newerDraft = state.value.productDraft.copy(name = "Tomates nuevos")
        state.value = state.value.copy(
            productDraft = newerDraft,
            productEditorRevision = state.value.productEditorRevision + 1,
        )
        actions.uploadProductImage { _, _ -> pipeline.upload() }
        actions.saveProduct()
        runCurrent()
        pipeline.completeUpload("https://cdn.reguerta.test/old.jpg")
        advanceUntilIdle()

        assertEquals(1, pipeline.uploadCount)
        assertEquals(0, repository.upsertCount)
        assertEquals(false, state.value.isUploadingProductImage)
        assertEquals(newerDraft, state.value.productDraft)
        assertEquals(emptyList<Int>(), messages)
    }

    private suspend fun actions(
        state: MutableStateFlow<SessionUiState>,
        repository: ProductRepository,
        memberRepository: MemberRepository = TestMemberRepository,
        seasonalCommitmentRepository: SeasonalCommitmentRepository = EmptySeasonalCommitmentRepository,
        imagePipelineManager: ImagePipelineManager = NoOpImagePipelineManager,
        emitMessage: (Int) -> Unit,
    ) = SessionProductActions(
        uiState = state,
        scope = kotlinx.coroutines.CoroutineScope(kotlinx.coroutines.currentCoroutineContext()),
        memberRepository = memberRepository,
        productRepository = repository,
        seasonalCommitmentRepository = seasonalCommitmentRepository,
        imagePipelineManager = imagePipelineManager,
        nowMillisProvider = { 100L },
        emitMessage = emitMessage,
    )

    private fun authorizedState(): SessionUiState {
        val member = producer()
        return SessionUiState(
            mode = SessionMode.Authorized(
                principal = AuthPrincipal(uid = "auth-producer", email = member.normalizedEmail),
                authenticatedMember = member,
                member = member,
                members = listOf(member),
            ),
        )
    }

    private fun producer() = Member(
        id = "producer",
        displayName = "Productor",
        normalizedEmail = "producer@reguerta.test",
        authUid = "auth-producer",
        roles = setOf(MemberRole.MEMBER, MemberRole.PRODUCER),
        isActive = true,
        producerCatalogEnabled = true,
        producerParity = ProducerParity.EVEN,
    )

    private fun product(name: String) = Product(
        id = "tomato",
        vendorId = "producer",
        companyName = "Productor",
        name = name,
        description = "",
        productImageUrl = null,
        price = 2.0,
        pricingMode = ProductPricingMode.FIXED,
        unitName = "unidad",
        unitAbbreviation = "ud",
        unitPlural = "unidades",
        unitQty = 1.0,
        packContainerName = null,
        packContainerAbbreviation = null,
        packContainerPlural = null,
        packContainerQty = null,
        isAvailable = true,
        stockMode = ProductStockMode.INFINITE,
        stockQty = null,
        isEcoBasket = false,
        isCommonPurchase = false,
        commonPurchaseType = null,
        archived = false,
        createdAtMillis = 1L,
        updatedAtMillis = 1L,
    )

    private fun validDraft(name: String) = ProductDraft(
        name = name,
        price = "3",
        unitName = "unidad",
        unitPlural = "unidades",
        unitQty = "1",
        stockMode = ProductStockMode.INFINITE,
    )
}

private class ControlledProductRepository(
    items: List<Product>,
    private val rejectsReads: Boolean,
    private val rejectsWrites: Boolean = false,
    private val ambiguousFirstWrite: Boolean = false,
) : ProductRepository {
    private val itemsById = items.associateBy(Product::id).toMutableMap()
    var readCount = 0
        private set
    var upsertCount = 0
        private set
    val attemptedProductIds = mutableListOf<String>()
    val storedProductCount: Int
        get() = itemsById.size

    override suspend fun getAllProducts(): List<Product> = read()

    override suspend fun getProductsForVendor(vendorId: String): List<Product> =
        read().filter { it.vendorId == vendorId }

    override suspend fun upsertProduct(product: Product): Product {
        upsertCount += 1
        attemptedProductIds += product.id
        if (rejectsWrites) throw IOException("rejected")
        itemsById[product.id] = product
        if (ambiguousFirstWrite && upsertCount == 1) throw IOException("ambiguous")
        return product
    }

    private fun read(): List<Product> {
        readCount += 1
        if (rejectsReads) throw IOException("rejected")
        return itemsById.values.toList()
    }
}

private class SuspendedFirstProductReadRepository(
    private val firstProduct: Product,
) : ProductRepository {
    val firstReadStarted = CompletableDeferred<Unit>()
    val releaseFirstRead = CompletableDeferred<Unit>()

    override suspend fun getAllProducts(): List<Product> {
        firstReadStarted.complete(Unit)
        releaseFirstRead.await()
        return listOf(firstProduct)
    }

    override suspend fun getProductsForVendor(vendorId: String): List<Product> = emptyList()

    override suspend fun upsertProduct(product: Product): Product = product
}

private object TestMemberRepository : MemberRepository {
    override suspend fun findByAuthUid(authUid: String): Member? = null

    override suspend fun getMembersVisibleTo(member: Member): List<Member> = listOf(member)

    override suspend fun updateOwnProducerCatalogEnabled(member: Member, isEnabled: Boolean): Member =
        error("Not used")
}

private object ConfirmingThenRejectingMemberRepository : MemberRepository {
    override suspend fun findByAuthUid(authUid: String): Member? = null

    override suspend fun getMembersVisibleTo(member: Member): List<Member> =
        throw IOException("secondary refresh failed")

    override suspend fun updateOwnProducerCatalogEnabled(member: Member, isEnabled: Boolean): Member =
        member.copy(producerCatalogEnabled = isEnabled)
}

private object CancellingProductRepository : ProductRepository {
    override suspend fun getAllProducts(): List<Product> = throw CancellationException("cancelled")

    override suspend fun getProductsForVendor(vendorId: String): List<Product> =
        throw CancellationException("cancelled")

    override suspend fun upsertProduct(product: Product): Product = product
}

private class SuspendedProductRepository : ProductRepository {
    private val started = CompletableDeferred<Unit>()
    private val release = CompletableDeferred<Unit>()
    private lateinit var submittedProduct: Product
    var writeCount = 0
        private set

    override suspend fun getAllProducts(): List<Product> = emptyList()

    override suspend fun getProductsForVendor(vendorId: String): List<Product> = emptyList()

    override suspend fun upsertProduct(product: Product): Product {
        writeCount += 1
        submittedProduct = product
        started.complete(Unit)
        release.await()
        return submittedProduct
    }

    suspend fun awaitWriteStarted() = started.await()

    fun completeWrite() {
        release.complete(Unit)
    }
}

private class MultiSuspendedProductRepository : ProductRepository {
    private val releases = mutableListOf<CompletableDeferred<Unit>>()
    private val submittedProducts = mutableListOf<Product>()
    val writeCount: Int
        get() = submittedProducts.size

    override suspend fun getAllProducts(): List<Product> = emptyList()

    override suspend fun getProductsForVendor(vendorId: String): List<Product> = emptyList()

    override suspend fun upsertProduct(product: Product): Product {
        val release = CompletableDeferred<Unit>()
        submittedProducts += product
        releases += release
        release.await()
        return product
    }

    fun completeWrite(index: Int) {
        releases[index].complete(Unit)
    }
}

private object EmptySeasonalCommitmentRepository : SeasonalCommitmentRepository {
    override suspend fun getActiveCommitmentsForUser(userId: String): List<SeasonalCommitment> = emptyList()
}

private object RejectingSeasonalCommitmentRepository : SeasonalCommitmentRepository {
    override suspend fun getActiveCommitmentsForUser(userId: String): List<SeasonalCommitment> =
        throw IOException("rejected")
}

private class FixedSeasonalCommitmentRepository(
    private val commitment: SeasonalCommitment,
) : SeasonalCommitmentRepository {
    override suspend fun getActiveCommitmentsForUser(userId: String): List<SeasonalCommitment> =
        listOf(commitment)
}

private object NoOpImagePipelineManager : ImagePipelineManager {
    override suspend fun processAndUpload(
        sourceUri: Uri,
        ownerId: String,
        namespace: ImageUploadNamespace,
        entityId: String?,
        nameHint: String?,
    ): ImageUploadResult? = null
}

private class SuspendedImagePipelineManager : ImagePipelineManager {
    private val started = CompletableDeferred<Unit>()
    private val release = CompletableDeferred<String>()
    var uploadCount = 0
        private set

    override suspend fun processAndUpload(
        sourceUri: Uri,
        ownerId: String,
        namespace: ImageUploadNamespace,
        entityId: String?,
        nameHint: String?,
    ): ImageUploadResult = upload()

    suspend fun upload(): ImageUploadResult {
        uploadCount += 1
        started.complete(Unit)
        return ImageUploadResult(
            downloadUrl = release.await(),
            widthPx = 1,
            heightPx = 1,
            byteSize = 1,
            mimeType = "image/jpeg",
        )
    }

    suspend fun awaitUploadStarted() = started.await()

    fun completeUpload(downloadUrl: String) {
        release.complete(downloadUrl)
    }
}
