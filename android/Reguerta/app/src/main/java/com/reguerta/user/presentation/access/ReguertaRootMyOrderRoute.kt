package com.reguerta.user.presentation.access

import android.content.Context
import androidx.annotation.VisibleForTesting
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Image
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.ShoppingCart
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import com.google.android.gms.tasks.Tasks
import com.google.firebase.Timestamp
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.SetOptions
import com.google.firebase.firestore.Source
import com.reguerta.user.R
import com.reguerta.user.data.firestore.ReguertaFirestoreCollection
import com.reguerta.user.data.firestore.ReguertaFirestoreEnvironment
import com.reguerta.user.data.firestore.ReguertaFirestorePath
import com.reguerta.user.domain.access.Member
import com.reguerta.user.domain.access.MemberRole
import com.reguerta.user.domain.calendar.DeliveryCalendarOverride
import com.reguerta.user.domain.calendar.DeliveryWeekday
import com.reguerta.user.domain.commitments.SeasonalCommitment
import com.reguerta.user.domain.products.Product
import com.reguerta.user.domain.products.ProductPricingMode
import com.reguerta.user.domain.products.ProductStockMode
import com.reguerta.user.domain.shifts.ShiftAssignment
import com.reguerta.user.domain.shifts.ShiftType
import com.reguerta.user.ui.components.auth.ReguertaDialog
import com.reguerta.user.ui.components.auth.ReguertaDialogAction
import com.reguerta.user.ui.components.auth.ReguertaDialogType
import java.text.Normalizer
import java.time.DayOfWeek
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.temporal.WeekFields
import java.util.Date
import java.util.Locale
import kotlin.math.floor
import kotlin.math.max
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.coroutines.launch
import org.json.JSONObject

private const val CommonPurchasesGroupId = "__my_order_reguerta_common_purchases__"
private const val MyOrderCartPrefsName = "reguerta_my_order_cart"
private const val MyOrderCartQuantitiesSuffix = ".quantities"
private const val MyOrderCartOptionsSuffix = ".eco_options"
private const val MyOrderConfirmedQuantitiesSuffix = ".confirmed_quantities"
private const val MyOrderConfirmedOptionsSuffix = ".confirmed_eco_options"
private val DiacriticMarksRegex = "\\p{Mn}+".toRegex()

private data class MyOrderProducerGroup(
    val vendorId: String,
    val companyName: String,
    val products: List<Product>,
    val isCommittedEcoBasketProducer: Boolean,
    val isCommonPurchasesGroup: Boolean,
) {
    val sortPriority: Int
        get() = when {
            isCommittedEcoBasketProducer -> 0
            isCommonPurchasesGroup -> 1
            else -> 2
        }
}

private sealed interface MyOrderCheckoutDialogState {
    data class MissingCommitments(val productNames: List<String>) : MyOrderCheckoutDialogState

    data class ExceededCommitments(val productNames: List<String>) : MyOrderCheckoutDialogState

    data class IncompatibleCommitments(val productNames: List<String>) : MyOrderCheckoutDialogState

    data object EcoBasketPriceMismatch : MyOrderCheckoutDialogState

    data object SubmitFailed : MyOrderCheckoutDialogState

    data class ReadyToSubmit(
        val total: Double,
        val noPickupEcoBaskets: Int,
    ) : MyOrderCheckoutDialogState
}

private data class MyOrderCartSnapshot(
    val selectedQuantities: Map<String, Int>,
    val selectedEcoBasketOptions: Map<String, String>,
)

private data class MyOrderConfirmedLine(
    val product: Product,
    val unitsSelected: Int,
    val quantityAtOrder: Double,
    val subtotal: Double,
)

private data class MyOrderConfirmedGroup(
    val vendorId: String,
    val companyName: String,
    val lines: List<MyOrderConfirmedLine>,
    val subtotal: Double,
)

private data class MyOrderPreviousOrderLine(
    val vendorId: String,
    val companyName: String,
    val productName: String,
    val packagingLine: String,
    val quantityLabel: String,
    val subtotal: Double,
)

private data class MyOrderPreviousOrderGroup(
    val vendorId: String,
    val companyName: String,
    val lines: List<MyOrderPreviousOrderLine>,
    val subtotal: Double,
)

private data class MyOrderPreviousOrderSnapshot(
    val weekKey: String,
    val groups: List<MyOrderPreviousOrderGroup>,
    val total: Double,
)

private sealed interface MyOrderPreviousOrderState {
    data object Loading : MyOrderPreviousOrderState

    data class Loaded(val snapshot: MyOrderPreviousOrderSnapshot) : MyOrderPreviousOrderState

    data object Empty : MyOrderPreviousOrderState

    data object Error : MyOrderPreviousOrderState
}

private data class MyOrderConsultaWindow(
    val isConsultaPhase: Boolean,
    val previousWeekKey: String,
)

@OptIn(ExperimentalFoundationApi::class)
@Composable
internal fun MyOrderRoute(
    modifier: Modifier = Modifier,
    currentMember: Member?,
    members: List<Member>,
    products: List<Product>,
    seasonalCommitments: List<SeasonalCommitment>,
    shifts: List<ShiftAssignment>,
    defaultDeliveryDayOfWeek: DeliveryWeekday?,
    deliveryCalendarOverrides: List<DeliveryCalendarOverride>,
    nowOverrideMillis: Long?,
    isLoading: Boolean,
    onRefresh: () -> Unit,
    onCheckoutSuccessAcknowledge: () -> Unit,
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    var searchQuery by rememberSaveable { mutableStateOf("") }
    var selectedQuantities by rememberSaveable { mutableStateOf<Map<String, Int>>(emptyMap()) }
    var selectedEcoBasketOptions by rememberSaveable { mutableStateOf<Map<String, String>>(emptyMap()) }
    var confirmedQuantities by rememberSaveable { mutableStateOf<Map<String, Int>>(emptyMap()) }
    var confirmedEcoBasketOptions by rememberSaveable { mutableStateOf<Map<String, String>>(emptyMap()) }
    var isCartVisible by rememberSaveable { mutableStateOf(false) }
    var isSubmittingCheckout by remember { mutableStateOf(false) }
    var checkoutDialogState by remember { mutableStateOf<MyOrderCheckoutDialogState?>(null) }
    var isViewingConfirmedOrder by rememberSaveable { mutableStateOf(false) }
    var previousOrderState by remember { mutableStateOf<MyOrderPreviousOrderState>(MyOrderPreviousOrderState.Loading) }
    val effectiveNowMillis = remember(nowOverrideMillis) { nowOverrideMillis ?: System.currentTimeMillis() }
    val currentWeekKey = remember(effectiveNowMillis) { effectiveNowMillis.toWeekKey() }
    val consultaWindow = remember(defaultDeliveryDayOfWeek, deliveryCalendarOverrides, shifts, effectiveNowMillis) {
        resolveMyOrderConsultaWindow(
            defaultDeliveryDayOfWeek = defaultDeliveryDayOfWeek,
            deliveryCalendarOverrides = deliveryCalendarOverrides,
            shifts = shifts,
            now = Instant.ofEpochMilli(effectiveNowMillis),
        )
    }
    val isConsultaPhase = consultaWindow.isConsultaPhase
    val cartStorageKey = remember(currentMember?.id, currentWeekKey) {
        "member_${currentMember?.id.orEmpty()}_week_$currentWeekKey"
    }
    var hasRestoredCartState by remember(cartStorageKey) { mutableStateOf(false) }

    val normalizedQuery = remember(searchQuery) { searchQuery.searchNormalized() }
    val currentWeekParity = remember(effectiveNowMillis) { currentIsoWeekProducerParity(nowMillis = effectiveNowMillis) }
    val committedProducerId = remember(currentMember, members) {
        currentMember?.committedEcoBasketProducerId(members = members)
    }
    val commonPurchasesGroupName = stringResource(R.string.my_order_common_purchases_group_name)

    val groupedProducts = remember(products, normalizedQuery, committedProducerId, commonPurchasesGroupName) {
        val filteredProducts = products.filter { product ->
            normalizedQuery.isBlank() || product.matchesOrderSearchQuery(normalizedQuery)
        }
        buildMyOrderProducerGroups(
            products = filteredProducts,
            committedEcoBasketProducerId = committedProducerId,
            commonPurchasesGroupName = commonPurchasesGroupName,
        )
    }
    val seasonalCommitmentLimitsByProductId = remember(products, seasonalCommitments) {
        seasonalCommitmentUnitLimitsByProductId(
            products = products,
            seasonalCommitments = seasonalCommitments,
        )
    }
    val selectedProducts = remember(products, selectedQuantities) {
        products.filter { product -> selectedQuantities[product.id].orZero > 0 }
    }
    val confirmedOrderGroups = remember(selectedProducts, selectedQuantities) {
        buildMyOrderConfirmedGroups(
            selectedProducts = selectedProducts,
            selectedQuantities = selectedQuantities,
        )
    }
    val selectedUnits = remember(selectedQuantities) {
        selectedQuantities.values.sum()
    }
    val hasConfirmedOrder = remember(confirmedQuantities) {
        confirmedQuantities.isNotEmpty()
    }
    val hasPendingConfirmedEdits = remember(
        hasConfirmedOrder,
        selectedQuantities,
        selectedEcoBasketOptions,
        confirmedQuantities,
        confirmedEcoBasketOptions,
    ) {
        hasConfirmedOrder && (
            selectedQuantities != confirmedQuantities ||
                selectedEcoBasketOptions != confirmedEcoBasketOptions
            )
    }
    val isReadOnlyConfirmedView = remember(
        hasConfirmedOrder,
        hasPendingConfirmedEdits,
        isViewingConfirmedOrder,
    ) {
        hasConfirmedOrder && !hasPendingConfirmedEdits && isViewingConfirmedOrder
    }
    val isReadOnlyMode = isReadOnlyConfirmedView || isConsultaPhase
    val finalizeActionLabel = if (hasConfirmedOrder && hasPendingConfirmedEdits) {
        stringResource(R.string.my_order_finalize_update_action)
    } else {
        stringResource(R.string.my_order_finalize_action)
    }
    val canSubmitOrder = !isSubmittingCheckout &&
        !isReadOnlyMode &&
        selectedUnits > 0 &&
        (!hasConfirmedOrder || hasPendingConfirmedEdits)
    val cartTotal = remember(selectedProducts, selectedQuantities) {
        selectedProducts.sumOf { product ->
            selectedQuantities[product.id].orZero.toDouble() * product.price
        }
    }
    val noPickupEcoBasketUnits = remember(products, selectedQuantities, selectedEcoBasketOptions) {
        countNoPickupEcoBasketUnits(
            products = products,
            selectedQuantities = selectedQuantities,
            selectedEcoBasketOptions = selectedEcoBasketOptions,
        )
    }
    LaunchedEffect(cartStorageKey) {
        val cartSnapshot = readMyOrderCartSnapshot(
            context = context,
            storageKey = cartStorageKey,
        )
        val confirmedSnapshot = readMyOrderConfirmedSnapshot(
            context = context,
            storageKey = cartStorageKey,
        )
        confirmedQuantities = confirmedSnapshot.selectedQuantities
        confirmedEcoBasketOptions = confirmedSnapshot.selectedEcoBasketOptions
        val initialSelectionSnapshot = if (cartSnapshot.selectedQuantities.isNotEmpty()) {
            cartSnapshot
        } else {
            confirmedSnapshot
        }
        val isSelectionEqualToConfirmed =
            initialSelectionSnapshot.selectedQuantities == confirmedSnapshot.selectedQuantities &&
                initialSelectionSnapshot.selectedEcoBasketOptions == confirmedSnapshot.selectedEcoBasketOptions
        isViewingConfirmedOrder = confirmedSnapshot.selectedQuantities.isNotEmpty() && isSelectionEqualToConfirmed
        selectedQuantities = initialSelectionSnapshot.selectedQuantities
        selectedEcoBasketOptions = initialSelectionSnapshot.selectedEcoBasketOptions
        if (initialSelectionSnapshot.selectedQuantities.isEmpty()) {
            isCartVisible = false
        } else if (isViewingConfirmedOrder) {
            isCartVisible = false
        }
        hasRestoredCartState = true
    }
    LaunchedEffect(
        cartStorageKey,
        hasRestoredCartState,
        selectedQuantities,
        selectedEcoBasketOptions,
    ) {
        if (!hasRestoredCartState) return@LaunchedEffect
        persistMyOrderCartSnapshot(
            context = context,
            storageKey = cartStorageKey,
            selectedQuantities = selectedQuantities,
            selectedEcoBasketOptions = selectedEcoBasketOptions,
        )
    }
    LaunchedEffect(isConsultaPhase, consultaWindow.previousWeekKey, currentMember?.id) {
        if (!isConsultaPhase) return@LaunchedEffect
        previousOrderState = loadMyOrderPreviousOrderState(
            currentMember = currentMember,
            previousWeekKey = consultaWindow.previousWeekKey,
        )
    }
    LaunchedEffect(products, seasonalCommitmentLimitsByProductId) {
        val productsById = products.associateBy(Product::id)
        val sanitizedQuantities = selectedQuantities.mapNotNull { (productId, qty) ->
            val product = productsById[productId] ?: return@mapNotNull null
            val finiteLimit = finiteStockLimit(product)
            val commitmentLimit = seasonalCommitmentLimitsByProductId[productId]
            val allowedByCommitment = commitmentLimit?.let { qty.coerceAtMost(it) } ?: qty
            val allowedQty = finiteLimit?.let { allowedByCommitment.coerceAtMost(it) } ?: allowedByCommitment
            if (allowedQty > 0) {
                productId to allowedQty
            } else {
                null
            }
        }.toMap()

        if (sanitizedQuantities != selectedQuantities) {
            selectedQuantities = sanitizedQuantities
        }
        val sanitizedOptions = sanitizedQuantities.mapNotNull { (productId, qty) ->
            if (qty <= 0) return@mapNotNull null
            val product = productsById[productId] ?: return@mapNotNull null
            if (!product.isEcoBasket) return@mapNotNull null
            val option = selectedEcoBasketOptions[productId]
                ?.takeIf { value ->
                    value == EcoBasketOptionPickup || value == EcoBasketOptionNoPickup
                }
                ?: EcoBasketOptionPickup
            productId to option
        }.toMap()
        if (sanitizedOptions != selectedEcoBasketOptions) {
            selectedEcoBasketOptions = sanitizedOptions
        }
        if (sanitizedQuantities.isEmpty()) {
            isCartVisible = false
        }
    }

    val decreaseProduct: (Product) -> Unit = { product ->
        if (!isReadOnlyMode) {
            val currentQty = selectedQuantities[product.id].orZero
            if (currentQty > 0) {
                val updatedQuantities = if (currentQty == 1) {
                    selectedQuantities - product.id
                } else {
                    selectedQuantities + (product.id to (currentQty - 1))
                }
                selectedQuantities = updatedQuantities
                if (product.isEcoBasket && updatedQuantities[product.id].orZero == 0) {
                    selectedEcoBasketOptions = selectedEcoBasketOptions - product.id
                }
                if (updatedQuantities.isEmpty()) {
                    isCartVisible = false
                }
            }
        }
    }

    val increaseProduct: (Product) -> Unit = { product ->
        if (!isReadOnlyMode) {
            val currentQty = selectedQuantities[product.id].orZero
            if (
                canIncrease(
                    product = product,
                    currentQuantity = currentQty,
                    commitmentLimit = seasonalCommitmentLimitsByProductId[product.id],
                )
            ) {
                selectedQuantities = selectedQuantities + (product.id to (currentQty + 1))
                if (product.isEcoBasket && selectedEcoBasketOptions[product.id] == null) {
                    selectedEcoBasketOptions = selectedEcoBasketOptions + (product.id to EcoBasketOptionPickup)
                }
            }
        }
    }

    BoxWithConstraints(modifier = modifier.fillMaxSize()) {
        val cartPanelWidth = (maxWidth * 0.9f).coerceIn(300.dp, 420.dp)
        val cartPanelOffsetX by animateDpAsState(
            targetValue = if (isCartVisible) 0.dp else cartPanelWidth + 24.dp,
            animationSpec = tween(durationMillis = 220),
            label = "my_order_cart_offset",
        )

        Box(modifier = Modifier.fillMaxSize()) {
            if (isReadOnlyMode) {
                if (isConsultaPhase) {
                    MyOrderPreviousOrderSummary(
                        state = previousOrderState,
                        onRefresh = {
                            coroutineScope.launch {
                                previousOrderState = loadMyOrderPreviousOrderState(
                                    currentMember = currentMember,
                                    previousWeekKey = consultaWindow.previousWeekKey,
                                )
                            }
                        },
                    )
                } else {
                    MyOrderConfirmedSummary(
                        groups = confirmedOrderGroups,
                        total = cartTotal,
                        onEdit = { isViewingConfirmedOrder = false },
                    )
                }
            } else {
                Column(
                    modifier = Modifier.fillMaxSize(),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                MyOrderHeader(
                    selectedUnits = selectedUnits,
                    onOpenCart = { isCartVisible = true },
                )

                when {
                    isLoading -> {
                        Card(modifier = Modifier.fillMaxWidth()) {
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(16.dp),
                                verticalArrangement = Arrangement.spacedBy(12.dp),
                            ) {
                                Row(
                                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                ) {
                                    CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.2.dp)
                                    Text(
                                        text = stringResource(R.string.my_order_products_loading),
                                        style = MaterialTheme.typography.bodyMedium,
                                    )
                                }
                                TextButton(onClick = onRefresh) {
                                    Text(text = stringResource(R.string.products_refresh_action))
                                }
                            }
                        }
                    }

                    groupedProducts.isEmpty() -> {
                        Card(modifier = Modifier.fillMaxWidth()) {
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(16.dp),
                                verticalArrangement = Arrangement.spacedBy(12.dp),
                            ) {
                                Text(
                                    text = stringResource(R.string.my_order_products_empty),
                                    style = MaterialTheme.typography.bodyMedium,
                                )
                                TextButton(onClick = onRefresh) {
                                    Text(text = stringResource(R.string.products_refresh_action))
                                }
                            }
                        }
                    }

                    else -> {
                        LazyColumn(
                            modifier = Modifier.fillMaxSize(),
                            contentPadding = PaddingValues(top = 4.dp, bottom = 112.dp),
                            verticalArrangement = Arrangement.spacedBy(12.dp),
                        ) {
                            groupedProducts.forEach { group ->
                                stickyHeader(key = "header_${group.vendorId}") {
                                    ProducerGroupHeader(group = group)
                                }
                                items(
                                    items = group.products,
                                    key = Product::id,
                                ) { product ->
                                MyOrderProductCard(
                                    product = product,
                                    quantity = selectedQuantities[product.id].orZero,
                                    commitmentLimit = seasonalCommitmentLimitsByProductId[product.id],
                                    isEditable = !isReadOnlyMode,
                                    onIncrease = { increaseProduct(product) },
                                    onDecrease = { decreaseProduct(product) },
                                )
                            }
                            }
                        }
                    }
                }
                }

                if (!isCartVisible) {
                SearchBarOverlay(
                    searchQuery = searchQuery,
                    onSearchQueryChange = { searchQuery = it },
                    modifier = Modifier
                        .align(Alignment.BottomCenter)
                        .padding(horizontal = 8.dp, vertical = 12.dp),
                )
                }

                if (isCartVisible) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(Color.Black.copy(alpha = 0.24f))
                        .clickable { isCartVisible = false },
                )
                }

                Surface(
                modifier = Modifier
                    .align(Alignment.CenterEnd)
                    .fillMaxHeight()
                    .width(cartPanelWidth)
                    .offset(x = cartPanelOffsetX),
                color = MaterialTheme.colorScheme.surface,
            ) {
                Box(modifier = Modifier.fillMaxSize()) {
                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        OutlinedButton(
                            onClick = {
                                if (isReadOnlyConfirmedView) {
                                    isViewingConfirmedOrder = false
                                    isCartVisible = false
                                } else {
                                    isCartVisible = false
                                }
                            },
                            shape = RoundedCornerShape(12.dp),
                        ) {
                            Icon(
                                imageVector = if (isReadOnlyConfirmedView) Icons.Default.Edit else Icons.Default.ShoppingCart,
                                contentDescription = null,
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = if (isReadOnlyConfirmedView) {
                                    stringResource(R.string.my_order_edit_confirmed_action)
                                } else {
                                    stringResource(R.string.my_order_continue_shopping_action)
                                },
                            )
                        }

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text(
                                text = stringResource(R.string.my_order_cart_title),
                                style = MaterialTheme.typography.titleLarge,
                                fontWeight = FontWeight.SemiBold,
                            )
                            Spacer(modifier = Modifier.weight(1f))
                            Text(
                                text = stringResource(
                                    R.string.my_order_total_format,
                                    cartTotal.toUiDecimal(),
                                ),
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.SemiBold,
                                color = MaterialTheme.colorScheme.primary,
                            )
                        }

                        if (selectedProducts.isEmpty()) {
                            Text(
                                text = stringResource(R.string.my_order_cart_empty),
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        } else {
                            LazyColumn(
                                modifier = Modifier.weight(1f),
                                contentPadding = PaddingValues(bottom = 96.dp),
                                verticalArrangement = Arrangement.spacedBy(10.dp),
                            ) {
                                items(
                                    items = selectedProducts,
                                    key = Product::id,
                                ) { product ->
                                    SelectedProductCard(
                                        product = product,
                                        quantity = selectedQuantities[product.id].orZero,
                                        commitmentLimit = seasonalCommitmentLimitsByProductId[product.id],
                                        ecoBasketOption = selectedEcoBasketOptions[product.id],
                                        isEditable = !isReadOnlyConfirmedView,
                                        onIncrease = { increaseProduct(product) },
                                        onDecrease = { decreaseProduct(product) },
                                        onEcoBasketOptionChange = { selectedOption ->
                                            if (!isReadOnlyConfirmedView) {
                                                selectedEcoBasketOptions = selectedEcoBasketOptions + (product.id to selectedOption)
                                            }
                                        },
                                    )
                                }
                            }
                        }
                    }

                    if (!isReadOnlyMode) {
                        Surface(
                            modifier = Modifier
                                .align(Alignment.BottomCenter)
                                .fillMaxWidth(),
                            tonalElevation = 4.dp,
                        ) {
                            Button(
                                onClick = {
                                    val validationResult = validateMyOrderCheckout(
                                        currentMember = currentMember,
                                        members = members,
                                        products = products,
                                        seasonalCommitments = seasonalCommitments,
                                        selectedQuantities = selectedQuantities,
                                        selectedEcoBasketOptions = selectedEcoBasketOptions,
                                        currentWeekParity = currentWeekParity,
                                    )
                                    checkoutDialogState = when {
                                        validationResult.hasEcoBasketPriceMismatch -> {
                                            MyOrderCheckoutDialogState.EcoBasketPriceMismatch
                                        }

                                        validationResult.incompatibleCommitmentProductNames.isNotEmpty() -> {
                                            MyOrderCheckoutDialogState.IncompatibleCommitments(
                                                validationResult.incompatibleCommitmentProductNames,
                                            )
                                        }

                                        validationResult.missingCommitmentProductNames.isNotEmpty() -> {
                                            MyOrderCheckoutDialogState.MissingCommitments(
                                                validationResult.missingCommitmentProductNames,
                                            )
                                        }

                                        validationResult.exceededCommitmentProductNames.isNotEmpty() -> {
                                            MyOrderCheckoutDialogState.ExceededCommitments(
                                                validationResult.exceededCommitmentProductNames,
                                            )
                                        }

                                        else -> {
                                            null
                                        }
                                    }
                                    if (checkoutDialogState != null) {
                                        return@Button
                                    }

                                    coroutineScope.launch {
                                        isSubmittingCheckout = true
                                        val didPersist = submitCheckoutOrderToFirestore(
                                            currentMember = currentMember,
                                            weekKey = currentWeekKey,
                                            products = products,
                                            selectedQuantities = selectedQuantities,
                                            selectedEcoBasketOptions = selectedEcoBasketOptions,
                                        )
                                        isSubmittingCheckout = false
                                        if (!didPersist) {
                                            checkoutDialogState = MyOrderCheckoutDialogState.SubmitFailed
                                            return@launch
                                        }

                                        persistMyOrderConfirmedSnapshot(
                                            context = context,
                                            storageKey = cartStorageKey,
                                            selectedQuantities = selectedQuantities,
                                            selectedEcoBasketOptions = selectedEcoBasketOptions,
                                        )
                                        confirmedQuantities = selectedQuantities
                                        confirmedEcoBasketOptions = selectedEcoBasketOptions
                                        isViewingConfirmedOrder = true
                                        checkoutDialogState = MyOrderCheckoutDialogState.ReadyToSubmit(
                                            total = cartTotal,
                                            noPickupEcoBaskets = noPickupEcoBasketUnits,
                                        )
                                    }
                                },
                                enabled = canSubmitOrder,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(horizontal = 16.dp, vertical = 12.dp),
                                shape = RoundedCornerShape(28.dp),
                            ) {
                                Text(
                                    text = finalizeActionLabel,
                                    fontWeight = FontWeight.SemiBold,
                                )
                            }
                        }
                    }
                }
            }
        }
    }

    checkoutDialogState?.let { dialogState ->
        when (dialogState) {
            is MyOrderCheckoutDialogState.MissingCommitments -> {
                ReguertaDialog(
                    type = ReguertaDialogType.ERROR,
                    title = stringResource(R.string.my_order_checkout_error_title),
                    message = stringResource(
                        R.string.my_order_checkout_error_message,
                        dialogState.productNames.joinToString(separator = ", "),
                    ),
                    primaryAction = ReguertaDialogAction(
                        label = stringResource(R.string.common_action_accept),
                        onClick = { checkoutDialogState = null },
                    ),
                    onDismissRequest = { checkoutDialogState = null },
                )
            }

            is MyOrderCheckoutDialogState.ExceededCommitments -> {
                ReguertaDialog(
                    type = ReguertaDialogType.ERROR,
                    title = stringResource(R.string.my_order_checkout_exceeded_title),
                    message = stringResource(
                        R.string.my_order_checkout_exceeded_message,
                        dialogState.productNames.joinToString(separator = ", "),
                    ),
                    primaryAction = ReguertaDialogAction(
                        label = stringResource(R.string.common_action_accept),
                        onClick = { checkoutDialogState = null },
                    ),
                    onDismissRequest = { checkoutDialogState = null },
                )
            }

            is MyOrderCheckoutDialogState.IncompatibleCommitments -> {
                ReguertaDialog(
                    type = ReguertaDialogType.ERROR,
                    title = stringResource(R.string.my_order_checkout_incompatible_title),
                    message = stringResource(
                        R.string.my_order_checkout_incompatible_message,
                        dialogState.productNames.joinToString(separator = ", "),
                    ),
                    primaryAction = ReguertaDialogAction(
                        label = stringResource(R.string.common_action_accept),
                        onClick = { checkoutDialogState = null },
                    ),
                    onDismissRequest = { checkoutDialogState = null },
                )
            }

            is MyOrderCheckoutDialogState.ReadyToSubmit -> {
                ReguertaDialog(
                    type = ReguertaDialogType.INFO,
                    title = stringResource(R.string.my_order_checkout_success_title),
                    message = if (dialogState.noPickupEcoBaskets > 0) {
                        stringResource(
                            R.string.my_order_checkout_success_message_with_no_pickup,
                            dialogState.total.toUiDecimal(),
                            dialogState.noPickupEcoBaskets,
                        )
                    } else {
                        stringResource(
                            R.string.my_order_checkout_success_message,
                            dialogState.total.toUiDecimal(),
                        )
                    },
                    primaryAction = ReguertaDialogAction(
                        label = stringResource(R.string.common_action_accept),
                        onClick = {
                            checkoutDialogState = null
                            isCartVisible = false
                            onCheckoutSuccessAcknowledge()
                        },
                    ),
                    dismissible = false,
                )
            }

            is MyOrderCheckoutDialogState.SubmitFailed -> {
                ReguertaDialog(
                    type = ReguertaDialogType.ERROR,
                    title = stringResource(R.string.my_order_checkout_submit_error_title),
                    message = stringResource(R.string.my_order_checkout_submit_error_message),
                    primaryAction = ReguertaDialogAction(
                        label = stringResource(R.string.common_action_accept),
                        onClick = { checkoutDialogState = null },
                    ),
                    onDismissRequest = { checkoutDialogState = null },
                )
            }

            is MyOrderCheckoutDialogState.EcoBasketPriceMismatch -> {
                ReguertaDialog(
                    type = ReguertaDialogType.ERROR,
                    title = stringResource(R.string.my_order_checkout_eco_price_error_title),
                    message = stringResource(R.string.my_order_checkout_eco_price_error_message),
                    primaryAction = ReguertaDialogAction(
                        label = stringResource(R.string.common_action_accept),
                        onClick = { checkoutDialogState = null },
                    ),
                    onDismissRequest = { checkoutDialogState = null },
                )
            }
        }
    }
}
}


@Composable
private fun MyOrderHeader(
    selectedUnits: Int,
    onOpenCart: () -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(
            verticalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            Text(
                text = stringResource(R.string.my_order_list_title),
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.SemiBold,
            )
            Text(
                text = stringResource(R.string.my_order_list_subtitle),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }

        Spacer(modifier = Modifier.weight(1f))

        OutlinedButton(
            onClick = onOpenCart,
            enabled = selectedUnits > 0,
            shape = RoundedCornerShape(12.dp),
            contentPadding = PaddingValues(horizontal = 14.dp, vertical = 10.dp),
            colors = ButtonDefaults.outlinedButtonColors(
                contentColor = if (selectedUnits > 0) {
                    MaterialTheme.colorScheme.primary
                } else {
                    MaterialTheme.colorScheme.onSurfaceVariant
                },
            ),
        ) {
            Text(
                text = stringResource(R.string.my_order_view_cart_action),
                fontWeight = FontWeight.SemiBold,
            )
            Spacer(modifier = Modifier.width(8.dp))
            Icon(
                imageVector = Icons.Default.ShoppingCart,
                contentDescription = null,
            )
        }
    }
}

@Composable
private fun MyOrderConfirmedSummary(
    groups: List<MyOrderConfirmedGroup>,
    total: Double,
    onEdit: () -> Unit,
) {
    Box(modifier = Modifier.fillMaxSize()) {
        Column(
            modifier = Modifier.fillMaxSize(),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = stringResource(R.string.module_my_order),
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.SemiBold,
                )
                Spacer(modifier = Modifier.weight(1f))
                OutlinedButton(
                    onClick = onEdit,
                    shape = RoundedCornerShape(12.dp),
                ) {
                    Icon(
                        imageVector = Icons.Default.Edit,
                        contentDescription = null,
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = stringResource(R.string.my_order_edit_confirmed_action),
                        fontWeight = FontWeight.SemiBold,
                    )
                }
            }

            if (groups.isEmpty()) {
                Card(modifier = Modifier.fillMaxWidth()) {
                    Text(
                        text = stringResource(R.string.my_order_cart_empty),
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(16.dp),
                    )
                }
            } else {
                LazyColumn(
                    modifier = Modifier.weight(1f),
                    contentPadding = PaddingValues(bottom = 84.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    items(
                        items = groups,
                        key = MyOrderConfirmedGroup::vendorId,
                    ) { group ->
                        MyOrderConfirmedProducerCard(group = group)
                    }
                }
            }
        }

        Surface(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth()
                .padding(horizontal = 8.dp, vertical = 8.dp),
            shape = RoundedCornerShape(14.dp),
            color = MaterialTheme.colorScheme.primary.copy(alpha = 0.22f),
        ) {
            Text(
                text = stringResource(
                    R.string.my_order_confirmed_total_sum_format,
                    total.toUiDecimal(),
                ),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp),
            )
        }
    }
}

@Composable
private fun MyOrderConfirmedProducerCard(group: MyOrderConfirmedGroup) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text(
                text = group.companyName,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.primary,
            )

            group.lines.forEachIndexed { index, line ->
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.Top,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Column(
                        modifier = Modifier.weight(1f),
                        verticalArrangement = Arrangement.spacedBy(2.dp),
                    ) {
                        Text(
                            text = line.product.name,
                            style = MaterialTheme.typography.bodyMedium,
                            fontWeight = FontWeight.SemiBold,
                        )
                        Text(
                            text = line.product.packagingLine(),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                    Text(
                        text = confirmedLineQuantityLabel(line = line),
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.SemiBold,
                    )
                    Text(
                        text = "${line.subtotal.toUiDecimal()} €",
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.SemiBold,
                    )
                }
                if (index != group.lines.lastIndex) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = 6.dp)
                            .background(MaterialTheme.colorScheme.outline.copy(alpha = 0.24f))
                            .height(1.dp),
                    )
                }
            }

            Row(modifier = Modifier.fillMaxWidth()) {
                Spacer(modifier = Modifier.weight(1f))
                Text(
                    text = stringResource(
                        R.string.my_order_producer_subtotal_format,
                        group.subtotal.toUiDecimal(),
                    ),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.error,
                )
            }
        }
    }
}

@Composable
private fun MyOrderPreviousOrderSummary(
    state: MyOrderPreviousOrderState,
    onRefresh: () -> Unit,
) {
    Box(modifier = Modifier.fillMaxSize()) {
        Column(
            modifier = Modifier.fillMaxSize(),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(
                text = stringResource(R.string.my_order_previous_title),
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.SemiBold,
            )
            when (state) {
                MyOrderPreviousOrderState.Loading -> {
                    Card(modifier = Modifier.fillMaxWidth()) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(16.dp),
                            horizontalArrangement = Arrangement.spacedBy(10.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.2.dp)
                            Text(
                                text = stringResource(R.string.my_order_previous_loading),
                                style = MaterialTheme.typography.bodyMedium,
                            )
                        }
                    }
                }

                MyOrderPreviousOrderState.Empty -> {
                    Card(modifier = Modifier.fillMaxWidth()) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(16.dp),
                            verticalArrangement = Arrangement.spacedBy(12.dp),
                        ) {
                            Text(
                                text = stringResource(R.string.my_order_previous_empty),
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                            TextButton(onClick = onRefresh) {
                                Text(text = stringResource(R.string.products_refresh_action))
                            }
                        }
                    }
                }

                MyOrderPreviousOrderState.Error -> {
                    Card(modifier = Modifier.fillMaxWidth()) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(16.dp),
                            verticalArrangement = Arrangement.spacedBy(12.dp),
                        ) {
                            Text(
                                text = stringResource(R.string.my_order_previous_error),
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                            TextButton(onClick = onRefresh) {
                                Text(text = stringResource(R.string.my_order_previous_retry))
                            }
                        }
                    }
                }

                is MyOrderPreviousOrderState.Loaded -> {
                    Text(
                        text = stringResource(
                            R.string.my_order_previous_week_format,
                            state.snapshot.weekKey,
                        ),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    LazyColumn(
                        modifier = Modifier.weight(1f),
                        contentPadding = PaddingValues(bottom = 84.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        items(
                            items = state.snapshot.groups,
                            key = MyOrderPreviousOrderGroup::vendorId,
                        ) { group ->
                            MyOrderPreviousProducerCard(group = group)
                        }
                    }
                }
            }
        }

        if (state is MyOrderPreviousOrderState.Loaded) {
            Surface(
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .fillMaxWidth()
                    .padding(horizontal = 8.dp, vertical = 8.dp),
                shape = RoundedCornerShape(14.dp),
                color = MaterialTheme.colorScheme.primary.copy(alpha = 0.22f),
            ) {
                Text(
                    text = stringResource(
                        R.string.my_order_confirmed_total_sum_format,
                        state.snapshot.total.toUiDecimal(),
                    ),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp),
                )
            }
        }
    }
}

@Composable
private fun MyOrderPreviousProducerCard(group: MyOrderPreviousOrderGroup) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text(
                text = group.companyName,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.primary,
            )

            group.lines.forEachIndexed { index, line ->
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.Top,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Column(
                        modifier = Modifier.weight(1f),
                        verticalArrangement = Arrangement.spacedBy(2.dp),
                    ) {
                        Text(
                            text = line.productName,
                            style = MaterialTheme.typography.bodyMedium,
                            fontWeight = FontWeight.SemiBold,
                        )
                        Text(
                            text = line.packagingLine,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                    Text(
                        text = line.quantityLabel,
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.SemiBold,
                    )
                    Text(
                        text = "${line.subtotal.toUiDecimal()} €",
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.SemiBold,
                    )
                }
                if (index != group.lines.lastIndex) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = 6.dp)
                            .background(MaterialTheme.colorScheme.outline.copy(alpha = 0.24f))
                            .height(1.dp),
                    )
                }
            }

            Row(modifier = Modifier.fillMaxWidth()) {
                Spacer(modifier = Modifier.weight(1f))
                Text(
                    text = stringResource(
                        R.string.my_order_producer_subtotal_format,
                        group.subtotal.toUiDecimal(),
                    ),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.error,
                )
            }
        }
    }
}

@Composable
private fun ProducerGroupHeader(group: MyOrderProducerGroup) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.surface.copy(alpha = 0.98f))
            .padding(vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = group.companyName,
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.SemiBold,
            color = MaterialTheme.colorScheme.primary,
        )
        if (group.isCommittedEcoBasketProducer) {
            Spacer(modifier = Modifier.width(8.dp))
            BadgeChip(title = stringResource(R.string.my_order_products_badge_committed_eco_producer))
        }
        if (group.isCommonPurchasesGroup) {
            Spacer(modifier = Modifier.width(8.dp))
            BadgeChip(title = stringResource(R.string.my_order_products_badge_common_purchase))
        }
    }
}

@Composable
private fun BadgeChip(title: String) {
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(999.dp))
            .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.14f))
            .padding(horizontal = 10.dp, vertical = 5.dp),
    ) {
        Text(
            text = title,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.primary,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

@Composable
private fun MyOrderProductCard(
    product: Product,
    quantity: Int,
    commitmentLimit: Int?,
    isEditable: Boolean,
    onIncrease: () -> Unit,
    onDecrease: () -> Unit,
) {
    val canIncrease = canIncrease(
        product = product,
        currentQuantity = quantity,
        commitmentLimit = commitmentLimit,
    )

    Card(modifier = Modifier.fillMaxWidth()) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalAlignment = Alignment.Top,
            ) {
                ProductImage(product = product)

                Column(
                    modifier = Modifier.weight(1f),
                    verticalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    QuantityControls(
                        quantity = quantity,
                        canIncrease = isEditable && canIncrease,
                        onIncrease = onIncrease,
                        onDecrease = onDecrease,
                        isEditable = isEditable,
                    )
                    Text(
                        text = product.name,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold,
                    )
                }
            }

            if (product.description.isNotBlank()) {
                Text(
                    text = product.description,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            Text(
                text = product.packagingLine(),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )

            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = stringResource(
                        R.string.my_order_price_per_unit_format,
                        product.price.toUiDecimal(),
                    ),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                )
                Spacer(modifier = Modifier.weight(1f))
                lowStockLabel(product)?.let { label ->
                    Text(
                        text = label,
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.SemiBold,
                        color = MaterialTheme.colorScheme.tertiary,
                    )
                }
            }
        }
    }
}

@Composable
private fun ProductImage(product: Product) {
    if (!product.productImageUrl.isNullOrBlank()) {
        AsyncImage(
            model = product.productImageUrl,
            contentDescription = product.name,
            modifier = Modifier
                .size(72.dp)
                .clip(RoundedCornerShape(12.dp)),
            contentScale = ContentScale.Crop,
        )
    } else {
        Box(
            modifier = Modifier
                .size(72.dp)
                .clip(RoundedCornerShape(12.dp))
                .background(MaterialTheme.colorScheme.surfaceVariant),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                imageVector = Icons.Default.Image,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(28.dp),
            )
        }
    }
}

@Composable
private fun QuantityControls(
    quantity: Int,
    canIncrease: Boolean,
    onIncrease: () -> Unit,
    onDecrease: () -> Unit,
    isEditable: Boolean,
) {
    if (!isEditable) {
        if (quantity > 0) {
            val quantityText = if (quantity == 1) {
                stringResource(R.string.my_order_quantity_single)
            } else {
                stringResource(R.string.my_order_quantity_plural_format, quantity)
            }
            Text(
                text = quantityText,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
            )
        }
        return
    }
    if (quantity == 0) {
        Button(
            onClick = onIncrease,
            enabled = canIncrease,
            shape = RoundedCornerShape(10.dp),
            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = MaterialTheme.colorScheme.primary,
                contentColor = MaterialTheme.colorScheme.onPrimary,
                disabledContainerColor = MaterialTheme.colorScheme.primary.copy(alpha = 0.45f),
                disabledContentColor = MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.8f),
            ),
        ) {
            Text(
                text = stringResource(R.string.my_order_add_action),
                fontWeight = FontWeight.SemiBold,
            )
            Spacer(modifier = Modifier.width(8.dp))
            Icon(
                imageVector = Icons.Default.ShoppingCart,
                contentDescription = null,
                modifier = Modifier.size(18.dp),
            )
        }
    } else {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            val quantityText = if (quantity == 1) {
                stringResource(R.string.my_order_quantity_single)
            } else {
                stringResource(R.string.my_order_quantity_plural_format, quantity)
            }
            Text(
                text = quantityText,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
            )

            QuantityActionButton(
                icon = if (quantity == 1) Icons.Default.Delete else Icons.Default.Remove,
                contentDescription = stringResource(R.string.my_order_decrease_action),
                onClick = onDecrease,
                containerColor = MaterialTheme.colorScheme.error.copy(alpha = 0.9f),
            )
            QuantityActionButton(
                icon = Icons.Default.Add,
                contentDescription = stringResource(R.string.my_order_increase_action),
                onClick = onIncrease,
                enabled = canIncrease,
                containerColor = MaterialTheme.colorScheme.primary,
            )
        }
    }
}

@Composable
private fun QuantityActionButton(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    contentDescription: String,
    onClick: () -> Unit,
    containerColor: Color,
    enabled: Boolean = true,
) {
    IconButton(
        onClick = onClick,
        enabled = enabled,
        modifier = Modifier
            .size(38.dp)
            .clip(RoundedCornerShape(9.dp))
            .background(if (enabled) containerColor else containerColor.copy(alpha = 0.45f)),
    ) {
        Icon(
            imageVector = icon,
            contentDescription = contentDescription,
            tint = Color.White,
        )
    }
}

@Composable
private fun SelectedProductCard(
    product: Product,
    quantity: Int,
    commitmentLimit: Int?,
    ecoBasketOption: String?,
    isEditable: Boolean,
    onIncrease: () -> Unit,
    onDecrease: () -> Unit,
    onEcoBasketOptionChange: (String) -> Unit,
) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalAlignment = Alignment.Top,
            ) {
                ProductImage(product = product)
                Column(
                    modifier = Modifier.weight(1f),
                    verticalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    Text(
                        text = product.name,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Text(
                        text = stringResource(
                            R.string.my_order_price_per_unit_format,
                            product.price.toUiDecimal(),
                        ),
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }

            QuantityControls(
                quantity = quantity,
                canIncrease = isEditable && canIncrease(
                    product = product,
                    currentQuantity = quantity,
                    commitmentLimit = commitmentLimit,
                ),
                onIncrease = onIncrease,
                onDecrease = onDecrease,
                isEditable = isEditable,
            )
            if (product.isEcoBasket && quantity > 0 && isEditable) {
                EcoBasketOptionSelector(
                    selectedOption = ecoBasketOption ?: EcoBasketOptionPickup,
                    onOptionSelected = onEcoBasketOptionChange,
                )
            }
        }
    }
}

@Composable
private fun EcoBasketOptionSelector(
    selectedOption: String,
    onOptionSelected: (String) -> Unit,
) {
    Column(
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Text(
            text = stringResource(R.string.my_order_eco_basket_option_label),
            style = MaterialTheme.typography.labelLarge,
            fontWeight = FontWeight.SemiBold,
        )
        Row(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            EcoBasketOptionButton(
                title = stringResource(R.string.my_order_eco_basket_option_pickup),
                isSelected = selectedOption == EcoBasketOptionPickup,
                onClick = { onOptionSelected(EcoBasketOptionPickup) },
                modifier = Modifier.weight(1f),
            )
            EcoBasketOptionButton(
                title = stringResource(R.string.my_order_eco_basket_option_no_pickup),
                isSelected = selectedOption == EcoBasketOptionNoPickup,
                onClick = { onOptionSelected(EcoBasketOptionNoPickup) },
                modifier = Modifier.weight(1f),
            )
        }
    }
}

@Composable
private fun EcoBasketOptionButton(
    title: String,
    isSelected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    OutlinedButton(
        onClick = onClick,
        modifier = modifier,
        shape = RoundedCornerShape(9.dp),
        colors = ButtonDefaults.outlinedButtonColors(
            containerColor = if (isSelected) {
                MaterialTheme.colorScheme.primary.copy(alpha = 0.14f)
            } else {
                Color.Transparent
            },
            contentColor = if (isSelected) {
                MaterialTheme.colorScheme.primary
            } else {
                MaterialTheme.colorScheme.onSurfaceVariant
            },
        ),
    ) {
        Text(
            text = title,
            style = MaterialTheme.typography.labelLarge,
            fontWeight = FontWeight.SemiBold,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

@Composable
private fun SearchBarOverlay(
    searchQuery: String,
    onSearchQueryChange: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    Surface(
        modifier = modifier.fillMaxWidth(),
        tonalElevation = 3.dp,
        shadowElevation = 1.dp,
        shape = RoundedCornerShape(14.dp),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Icon(
                imageVector = Icons.Default.Search,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            BasicTextField(
                value = searchQuery,
                onValueChange = onSearchQueryChange,
                singleLine = true,
                textStyle = MaterialTheme.typography.bodyMedium.copy(
                    color = MaterialTheme.colorScheme.onSurface,
                ),
                modifier = Modifier.weight(1f),
                decorationBox = { innerTextField ->
                    if (searchQuery.isBlank()) {
                        Text(
                            text = stringResource(R.string.my_order_products_search_label),
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                    innerTextField()
                },
            )
            if (searchQuery.isNotBlank()) {
                IconButton(
                    onClick = { onSearchQueryChange("") },
                    modifier = Modifier.size(24.dp),
                ) {
                    Icon(
                        imageVector = Icons.Default.Close,
                        contentDescription = stringResource(R.string.common_action_clear),
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
    }
}

private fun buildMyOrderProducerGroups(
    products: List<Product>,
    committedEcoBasketProducerId: String?,
    commonPurchasesGroupName: String,
): List<MyOrderProducerGroup> {
    val commonPurchases = products.filter(Product::isCommonPurchase)
    val regularProducts = products.filterNot(Product::isCommonPurchase)

    val groups = regularProducts.groupBy { product -> product.vendorId to product.companyName }
        .map { (groupKey, groupedProducts) ->
            val sortedProducts = groupedProducts.sortedBy { product ->
                product.name.lowercase(Locale.getDefault())
            }
            MyOrderProducerGroup(
                vendorId = groupKey.first,
                companyName = groupKey.second,
                products = sortedProducts,
                isCommittedEcoBasketProducer = committedEcoBasketProducerId == groupKey.first &&
                    groupedProducts.any(Product::isEcoBasket),
                isCommonPurchasesGroup = false,
            )
        }
        .toMutableList()

    if (commonPurchases.isNotEmpty()) {
        groups += MyOrderProducerGroup(
            vendorId = CommonPurchasesGroupId,
            companyName = commonPurchasesGroupName,
            products = commonPurchases.sortedBy { product ->
                product.name.lowercase(Locale.getDefault())
            },
            isCommittedEcoBasketProducer = false,
            isCommonPurchasesGroup = true,
        )
    }

    return groups.sortedWith(
        compareBy<MyOrderProducerGroup> { it.sortPriority }
            .thenBy { it.companyName.lowercase(Locale.getDefault()) },
    )
}

private fun buildMyOrderConfirmedGroups(
    selectedProducts: List<Product>,
    selectedQuantities: Map<String, Int>,
): List<MyOrderConfirmedGroup> {
    val lines = selectedProducts.mapNotNull { product ->
        val unitsSelected = selectedQuantities[product.id].orZero
        if (unitsSelected <= 0) {
            null
        } else {
            val quantityAtOrder = if (product.pricingMode == ProductPricingMode.WEIGHT) {
                unitsSelected.toDouble() * product.unitQty
            } else {
                unitsSelected.toDouble()
            }
            MyOrderConfirmedLine(
                product = product,
                unitsSelected = unitsSelected,
                quantityAtOrder = quantityAtOrder,
                subtotal = quantityAtOrder * product.price,
            )
        }
    }

    return lines
        .groupBy { line -> line.product.vendorId to line.product.companyName }
        .map { (groupKey, groupedLines) ->
            val sortedLines = groupedLines.sortedBy { line ->
                line.product.name.lowercase(Locale.getDefault())
            }
            MyOrderConfirmedGroup(
                vendorId = groupKey.first,
                companyName = groupKey.second,
                lines = sortedLines,
                subtotal = sortedLines.sumOf(MyOrderConfirmedLine::subtotal),
            )
        }
        .sortedBy { group -> group.companyName.lowercase(Locale.getDefault()) }
}

private fun Product.matchesOrderSearchQuery(normalizedQuery: String): Boolean {
    if (normalizedQuery.isBlank()) {
        return true
    }
    return name.searchNormalized().contains(normalizedQuery) ||
        description.searchNormalized().contains(normalizedQuery) ||
        companyName.searchNormalized().contains(normalizedQuery)
}

private fun Product.packagingLine(): String {
    val containerName = packContainerName?.takeIf(String::isNotBlank) ?: unitName
    val quantity = (packContainerQty ?: unitQty).toUiDecimal()
    val unitLabel = packContainerAbbreviation
        ?: packContainerPlural
        ?: unitAbbreviation
        ?: if ((packContainerQty ?: unitQty) == 1.0) unitName else unitPlural

    return listOf(containerName, quantity, unitLabel)
        .filter { item -> item.isNotBlank() }
        .joinToString(separator = " ")
}

private fun finiteStockLimit(product: Product): Int? {
    if (product.stockMode != ProductStockMode.FINITE) {
        return null
    }
    val stock = max(0.0, product.stockQty ?: 0.0)
    return floor(stock).toInt()
}

private fun canIncrease(
    product: Product,
    currentQuantity: Int,
    commitmentLimit: Int? = null,
): Boolean {
    if (commitmentLimit != null && currentQuantity >= commitmentLimit) {
        return false
    }
    val finiteLimit = finiteStockLimit(product) ?: return true
    return currentQuantity < finiteLimit
}

@Composable
private fun lowStockLabel(product: Product): String? {
    if (product.stockMode != ProductStockMode.FINITE) {
        return null
    }
    val stock = max(0.0, product.stockQty ?: 0.0)
    if (stock >= 20.0) {
        return null
    }
    return stringResource(
        R.string.my_order_stock_remaining_format,
        stock.toUiDecimal(),
    )
}

@Composable
private fun confirmedLineQuantityLabel(line: MyOrderConfirmedLine): String =
    if (line.product.pricingMode == ProductPricingMode.WEIGHT) {
        stringResource(
            R.string.my_order_quantity_weight_format,
            line.quantityAtOrder.toUiDecimal(),
            line.product.unitAbbreviation ?: line.product.unitName,
        )
    } else if (line.unitsSelected == 1) {
        stringResource(R.string.my_order_quantity_single)
    } else {
        stringResource(R.string.my_order_quantity_plural_format, line.unitsSelected)
    }

private fun String.searchNormalized(): String =
    Normalizer.normalize(trim(), Normalizer.Form.NFD)
        .replace(DiacriticMarksRegex, "")
        .lowercase(Locale.getDefault())

private fun Double.toUiDecimal(): String =
    if (this % 1.0 == 0.0) {
        toLong().toString()
    } else {
        String.format(Locale.getDefault(), "%.2f", this)
    }

private fun countNoPickupEcoBasketUnits(
    products: List<Product>,
    selectedQuantities: Map<String, Int>,
    selectedEcoBasketOptions: Map<String, String>,
): Int = products
    .asSequence()
    .filter(Product::isEcoBasket)
    .sumOf { product ->
        if (selectedEcoBasketOptions[product.id] == EcoBasketOptionNoPickup) {
            selectedQuantities[product.id].orZero
        } else {
            0
        }
    }

private fun Member.committedEcoBasketProducerId(members: List<Member>): String? {
    val parity = ecoCommitmentParity ?: return null
    return members.firstOrNull { producer ->
        producer.id != id &&
            producer.roles.contains(MemberRole.PRODUCER) &&
            producer.isActive &&
            producer.producerCatalogEnabled &&
            producer.producerParity == parity
    }?.id
}

private suspend fun loadMyOrderPreviousOrderState(
    currentMember: Member?,
    previousWeekKey: String,
): MyOrderPreviousOrderState = runCatching {
    fetchPreviousWeekOrderSnapshot(
        currentMember = currentMember,
        previousWeekKey = previousWeekKey,
    )
}.fold(
    onSuccess = { snapshot ->
        when {
            snapshot == null -> MyOrderPreviousOrderState.Empty
            snapshot.groups.isEmpty() -> MyOrderPreviousOrderState.Empty
            else -> MyOrderPreviousOrderState.Loaded(snapshot)
        }
    },
    onFailure = { MyOrderPreviousOrderState.Error },
)

private fun resolveMyOrderConsultaWindow(
    defaultDeliveryDayOfWeek: DeliveryWeekday?,
    deliveryCalendarOverrides: List<DeliveryCalendarOverride>,
    shifts: List<ShiftAssignment>,
    now: Instant = Instant.now(),
    zoneId: ZoneId = ZoneId.of("Europe/Madrid"),
): MyOrderConsultaWindow {
    val today = now.atZone(zoneId).toLocalDate()
    val currentWeekKey = today.toIsoWeekKey()
    val weekStart = currentWeekKey.toIsoWeekStartDate() ?: today.with(DayOfWeek.MONDAY)
    val effectiveDeliveryDate = resolveEffectiveDeliveryDate(
        currentWeekKey = currentWeekKey,
        defaultDeliveryDayOfWeek = defaultDeliveryDayOfWeek,
        deliveryCalendarOverrides = deliveryCalendarOverrides,
        shifts = shifts,
        fallbackWeekStart = weekStart,
        zoneId = zoneId,
    )
    val isConsultaPhase = !today.isBefore(weekStart) && !today.isAfter(effectiveDeliveryDate)
    return MyOrderConsultaWindow(
        isConsultaPhase = isConsultaPhase,
        previousWeekKey = weekStart.minusWeeks(1).toIsoWeekKey(),
    )
}

private fun resolveEffectiveDeliveryDate(
    currentWeekKey: String,
    defaultDeliveryDayOfWeek: DeliveryWeekday?,
    deliveryCalendarOverrides: List<DeliveryCalendarOverride>,
    shifts: List<ShiftAssignment>,
    fallbackWeekStart: LocalDate,
    zoneId: ZoneId,
): LocalDate {
    val override = deliveryCalendarOverrides.firstOrNull { it.weekKey == currentWeekKey }
    if (override != null) {
        return Instant.ofEpochMilli(override.deliveryDateMillis).atZone(zoneId).toLocalDate()
    }
    val weekStart = currentWeekKey.toIsoWeekStartDate() ?: fallbackWeekStart
    val weekEnd = weekStart.plusDays(6)
    val shiftDeliveryDate = shifts
        .asSequence()
        .filter { shift -> shift.type == ShiftType.DELIVERY }
        .map { shift -> Instant.ofEpochMilli(shift.dateMillis).atZone(zoneId).toLocalDate() }
        .filter { shiftDate -> !shiftDate.isBefore(weekStart) && !shiftDate.isAfter(weekEnd) }
        .sorted()
        .firstOrNull()
    if (shiftDeliveryDate != null) {
        return shiftDeliveryDate
    }
    val deliveryDay = defaultDeliveryDayOfWeek?.toDayOfWeek() ?: DayOfWeek.WEDNESDAY
    return weekStart.plusDays((deliveryDay.value - DayOfWeek.MONDAY.value).toLong())
}

private suspend fun fetchPreviousWeekOrderSnapshot(
    currentMember: Member?,
    previousWeekKey: String,
    firestore: FirebaseFirestore = FirebaseFirestore.getInstance(),
    environment: ReguertaFirestoreEnvironment = ReguertaFirestoreEnvironment.DEVELOP,
): MyOrderPreviousOrderSnapshot? = withContext(Dispatchers.IO) {
    val member = currentMember ?: return@withContext null
    val orderId = "${member.id}_$previousWeekKey"
    val path = ReguertaFirestorePath(environment = environment)
    val readTargets = listOf(
        path.collectionPath(ReguertaFirestoreCollection.ORDERS) to
            path.collectionPath(ReguertaFirestoreCollection.ORDER_LINES),
        "${environment.wireValue}/collections/orders" to
            "${environment.wireValue}/collections/orderLines",
        "${environment.wireValue}/collections/orders" to
            "${environment.wireValue}/collections/orderlines",
    ).distinct()

    var hadSuccessfulRead = false
    var lastFailure: Throwable? = null

    readTargets.forEach { (ordersPath, orderLinesPath) ->
        runCatching {
            val orderSnapshot = Tasks.await(
                firestore.document("$ordersPath/$orderId").get(),
            )
            val orderLinesSnapshot = Tasks.await(
                firestore.collection(orderLinesPath)
                    .whereEqualTo("orderId", orderId)
                    .get(),
            )
            hadSuccessfulRead = true
            val groups = orderLinesSnapshot.documents
                .mapNotNull { document -> document.data }
                .map { payload ->
                    payload.toMyOrderPreviousLine()
                }
                .groupBy { line -> line.vendorId to line.companyName }
                .map { (groupKey, lines) ->
                    val sortedLines = lines.sortedBy { line ->
                        line.productName.lowercase(Locale.getDefault())
                    }
                    MyOrderPreviousOrderGroup(
                        vendorId = groupKey.first,
                        companyName = groupKey.second,
                        lines = sortedLines,
                        subtotal = sortedLines.sumOf(MyOrderPreviousOrderLine::subtotal),
                    )
                }
                .sortedBy { group -> group.companyName.lowercase(Locale.getDefault()) }
            if (!orderSnapshot.exists() && groups.isEmpty()) {
                null
            } else {
                val total = orderSnapshot.getDouble("total")
                    ?: groups.sumOf(MyOrderPreviousOrderGroup::subtotal)
                MyOrderPreviousOrderSnapshot(
                    weekKey = previousWeekKey,
                    groups = groups,
                    total = total,
                )
            }
        }.onSuccess { snapshot ->
            if (snapshot != null) {
                return@withContext snapshot
            }
        }.onFailure { error ->
            lastFailure = error
        }
    }

    if (!hadSuccessfulRead && lastFailure != null) {
        throw lastFailure as Throwable
    }

    null
}

private fun Map<String, Any>.toMyOrderPreviousLine(): MyOrderPreviousOrderLine {
    val vendorId = (this["vendorId"] as? String)?.trim().orEmpty()
        .ifBlank { "__vendor_unknown__" }
    val companyName = (this["companyName"] as? String)?.trim().orEmpty()
        .ifBlank { vendorId }
    val productName = (this["productName"] as? String)?.trim().orEmpty()
        .ifBlank { this["productId"]?.toString().orEmpty().ifBlank { "Producto" } }
    val unitName = (this["unitName"] as? String)?.trim().orEmpty().ifBlank { "ud." }
    val quantity = (this["quantity"] as? Number)?.toDouble() ?: 0.0
    val subtotal = (this["subtotal"] as? Number)?.toDouble()
        ?: quantity * ((this["priceAtOrder"] as? Number)?.toDouble() ?: 0.0)

    return MyOrderPreviousOrderLine(
        vendorId = vendorId,
        companyName = companyName,
        productName = productName,
        packagingLine = packagingLineFromOrderLinePayload(this),
        quantityLabel = quantityLabelFromOrderLinePayload(
            quantity = quantity,
            pricingMode = (this["pricingModeAtOrder"] as? String)?.trim(),
            unitName = unitName,
            unitAbbreviation = (this["unitAbbreviation"] as? String)?.trim(),
        ),
        subtotal = subtotal,
    )
}

private fun packagingLineFromOrderLinePayload(payload: Map<String, Any>): String {
    val containerName = (payload["packContainerName"] as? String)
        ?.takeIf(String::isNotBlank)
        ?: (payload["unitName"] as? String).orEmpty()
    val quantity = ((payload["packContainerQty"] as? Number)?.toDouble()
        ?: (payload["unitQty"] as? Number)?.toDouble()
        ?: 1.0).toUiDecimal()
    val fallbackUnitName = (payload["unitName"] as? String).orEmpty()
    val fallbackUnitPlural = (payload["unitPlural"] as? String).orEmpty()
    val unitLabel = (payload["packContainerAbbreviation"] as? String)
        ?.takeIf(String::isNotBlank)
        ?: (payload["packContainerPlural"] as? String)?.takeIf(String::isNotBlank)
        ?: (payload["unitAbbreviation"] as? String)?.takeIf(String::isNotBlank)
        ?: if (((payload["packContainerQty"] as? Number)?.toDouble() ?: 1.0) == 1.0) {
            fallbackUnitName
        } else {
            fallbackUnitPlural
        }

    return listOf(containerName, quantity, unitLabel)
        .filter { value -> value.isNotBlank() }
        .joinToString(separator = " ")
}

private fun quantityLabelFromOrderLinePayload(
    quantity: Double,
    pricingMode: String?,
    unitName: String,
    unitAbbreviation: String?,
): String {
    if (pricingMode.equals("weight", ignoreCase = true)) {
        val labelUnit = unitAbbreviation?.takeIf(String::isNotBlank)
            ?: unitName.ifBlank { "kg" }
        return "${quantity.toUiDecimal()} $labelUnit"
    }
    return if (quantity == 1.0) {
        "1 unit"
    } else {
        "${quantity.toUiDecimal()} units"
    }
}

private fun LocalDate.toIsoWeekKey(): String {
    val week = get(WeekFields.ISO.weekOfWeekBasedYear())
    val year = get(WeekFields.ISO.weekBasedYear())
    return String.format(Locale.US, "%04d-W%02d", year, week)
}

private fun readMyOrderCartSnapshot(
    context: Context,
    storageKey: String,
): MyOrderCartSnapshot {
    val preferences = context.getSharedPreferences(MyOrderCartPrefsName, Context.MODE_PRIVATE)
    val quantitiesKey = "$storageKey$MyOrderCartQuantitiesSuffix"
    val optionsKey = "$storageKey$MyOrderCartOptionsSuffix"

    val restoredQuantities = runCatching {
        val raw = preferences.getString(quantitiesKey, null).orEmpty()
        if (raw.isBlank()) {
            emptyMap()
        } else {
            val objectPayload = JSONObject(raw)
            objectPayload.keys().asSequence()
                .mapNotNull { productId ->
                    val quantity = objectPayload.optInt(productId, 0)
                    if (quantity > 0) {
                        productId to quantity
                    } else {
                        null
                    }
                }
                .toMap()
        }
    }.getOrDefault(emptyMap())

    val restoredOptions = runCatching {
        val raw = preferences.getString(optionsKey, null).orEmpty()
        if (raw.isBlank()) {
            emptyMap()
        } else {
            val objectPayload = JSONObject(raw)
            objectPayload.keys().asSequence()
                .mapNotNull { productId ->
                    val option = objectPayload.optString(productId, "")
                    if (option == EcoBasketOptionPickup || option == EcoBasketOptionNoPickup) {
                        productId to option
                    } else {
                        null
                    }
                }
                .toMap()
        }
    }.getOrDefault(emptyMap())

    return MyOrderCartSnapshot(
        selectedQuantities = restoredQuantities,
        selectedEcoBasketOptions = restoredOptions,
    )
}

private fun persistMyOrderCartSnapshot(
    context: Context,
    storageKey: String,
    selectedQuantities: Map<String, Int>,
    selectedEcoBasketOptions: Map<String, String>,
) {
    val preferences = context.getSharedPreferences(MyOrderCartPrefsName, Context.MODE_PRIVATE)
    val quantitiesKey = "$storageKey$MyOrderCartQuantitiesSuffix"
    val optionsKey = "$storageKey$MyOrderCartOptionsSuffix"

    val normalizedQuantities = selectedQuantities
        .filterValues { quantity -> quantity > 0 }
    val normalizedOptions = selectedEcoBasketOptions
        .filterKeys { productId -> normalizedQuantities[productId].orZero > 0 }
        .filterValues { option -> option == EcoBasketOptionPickup || option == EcoBasketOptionNoPickup }

    preferences.edit().apply {
        if (normalizedQuantities.isEmpty()) {
            remove(quantitiesKey)
        } else {
            val quantitiesPayload = JSONObject().apply {
                normalizedQuantities.forEach { (productId, quantity) ->
                    put(productId, quantity)
                }
            }
            putString(quantitiesKey, quantitiesPayload.toString())
        }

        if (normalizedOptions.isEmpty()) {
            remove(optionsKey)
        } else {
            val optionsPayload = JSONObject().apply {
                normalizedOptions.forEach { (productId, option) ->
                    put(productId, option)
                }
            }
            putString(optionsKey, optionsPayload.toString())
        }
    }.apply()
}

private fun readMyOrderConfirmedSnapshot(
    context: Context,
    storageKey: String,
): MyOrderCartSnapshot {
    val preferences = context.getSharedPreferences(MyOrderCartPrefsName, Context.MODE_PRIVATE)
    val quantitiesKey = "$storageKey$MyOrderConfirmedQuantitiesSuffix"
    val optionsKey = "$storageKey$MyOrderConfirmedOptionsSuffix"

    val restoredQuantities = runCatching {
        val raw = preferences.getString(quantitiesKey, null).orEmpty()
        if (raw.isBlank()) {
            emptyMap()
        } else {
            val objectPayload = JSONObject(raw)
            objectPayload.keys().asSequence()
                .mapNotNull { productId ->
                    val quantity = objectPayload.optInt(productId, 0)
                    if (quantity > 0) {
                        productId to quantity
                    } else {
                        null
                    }
                }
                .toMap()
        }
    }.getOrDefault(emptyMap())

    val restoredOptions = runCatching {
        val raw = preferences.getString(optionsKey, null).orEmpty()
        if (raw.isBlank()) {
            emptyMap()
        } else {
            val objectPayload = JSONObject(raw)
            objectPayload.keys().asSequence()
                .mapNotNull { productId ->
                    val option = objectPayload.optString(productId, "")
                    if (option == EcoBasketOptionPickup || option == EcoBasketOptionNoPickup) {
                        productId to option
                    } else {
                        null
                    }
                }
                .toMap()
        }
    }.getOrDefault(emptyMap())

    return MyOrderCartSnapshot(
        selectedQuantities = restoredQuantities,
        selectedEcoBasketOptions = restoredOptions,
    )
}

private fun persistMyOrderConfirmedSnapshot(
    context: Context,
    storageKey: String,
    selectedQuantities: Map<String, Int>,
    selectedEcoBasketOptions: Map<String, String>,
) {
    val preferences = context.getSharedPreferences(MyOrderCartPrefsName, Context.MODE_PRIVATE)
    val quantitiesKey = "$storageKey$MyOrderConfirmedQuantitiesSuffix"
    val optionsKey = "$storageKey$MyOrderConfirmedOptionsSuffix"

    val normalizedQuantities = selectedQuantities
        .filterValues { quantity -> quantity > 0 }
    val normalizedOptions = selectedEcoBasketOptions
        .filterKeys { productId -> normalizedQuantities[productId].orZero > 0 }
        .filterValues { option -> option == EcoBasketOptionPickup || option == EcoBasketOptionNoPickup }

    preferences.edit().apply {
        if (normalizedQuantities.isEmpty()) {
            remove(quantitiesKey)
        } else {
            val quantitiesPayload = JSONObject().apply {
                normalizedQuantities.forEach { (productId, quantity) ->
                    put(productId, quantity)
                }
            }
            putString(quantitiesKey, quantitiesPayload.toString())
        }

        if (normalizedOptions.isEmpty()) {
            remove(optionsKey)
        } else {
            val optionsPayload = JSONObject().apply {
                normalizedOptions.forEach { (productId, option) ->
                    put(productId, option)
                }
            }
            putString(optionsKey, optionsPayload.toString())
        }
    }.apply()
}

private data class MyOrderCheckoutLineSnapshot(
    val product: Product,
    val unitsSelected: Int,
    val quantityAtOrder: Double,
    val subtotal: Double,
    val ecoBasketOption: String?,
)

@VisibleForTesting
internal suspend fun submitCheckoutOrderToFirestore(
    currentMember: Member?,
    weekKey: String,
    products: List<Product>,
    selectedQuantities: Map<String, Int>,
    selectedEcoBasketOptions: Map<String, String>,
    firestore: FirebaseFirestore = FirebaseFirestore.getInstance(),
    environment: ReguertaFirestoreEnvironment = ReguertaFirestoreEnvironment.DEVELOP,
    nowMillis: Long = System.currentTimeMillis(),
): Boolean = withContext(Dispatchers.IO) {
    runCatching {
        val member = currentMember ?: return@runCatching false
        val lineSnapshots = products
            .asSequence()
            .mapNotNull { product ->
                val selectedUnits = selectedQuantities[product.id].orZero
                if (selectedUnits <= 0) {
                    return@mapNotNull null
                }
                val quantityAtOrder = if (product.pricingMode == ProductPricingMode.WEIGHT) {
                    selectedUnits.toDouble() * product.unitQty
                } else {
                    selectedUnits.toDouble()
                }
                val subtotal = quantityAtOrder * product.price
                MyOrderCheckoutLineSnapshot(
                    product = product,
                    unitsSelected = selectedUnits,
                    quantityAtOrder = quantityAtOrder,
                    subtotal = subtotal,
                    ecoBasketOption = selectedEcoBasketOptions[product.id]
                        ?.takeIf { option -> option == EcoBasketOptionPickup || option == EcoBasketOptionNoPickup },
                )
            }
            .toList()
        if (lineSnapshots.isEmpty()) {
            return@runCatching false
        }

        val path = ReguertaFirestorePath(environment = environment)
        val writeTargets = listOf(
            path.collectionPath(ReguertaFirestoreCollection.ORDERS) to
                path.collectionPath(ReguertaFirestoreCollection.ORDER_LINES),
            "${environment.wireValue}/collections/orders" to
                "${environment.wireValue}/collections/orderLines",
            "${environment.wireValue}/collections/orders" to
                "${environment.wireValue}/collections/orderlines",
        ).distinct()
        val orderId = "${member.id}_$weekKey"
        val nowTimestamp = Timestamp(Date(nowMillis))
        val weekNumber = weekKey.substringAfter("-W", missingDelimiterValue = "")
            .toIntOrNull()
            ?: LocalDate.now(ZoneId.systemDefault()).get(WeekFields.ISO.weekOfWeekBasedYear())

        val total = lineSnapshots.sumOf { line -> line.subtotal }
        val totalsByVendor = lineSnapshots
            .groupBy { line -> line.product.vendorId }
            .mapValues { (_, lines) -> lines.sumOf(MyOrderCheckoutLineSnapshot::subtotal) }

        writeTargets.any { (ordersPath, orderLinesPath) ->
            runCatching {
                val orderReference = firestore.document("$ordersPath/$orderId")
                val currentOrder = runCatching { Tasks.await(orderReference.get()) }.getOrNull()
                val createdAtTimestamp = currentOrder?.getTimestamp("createdAt") ?: nowTimestamp
                val producerStatus = currentOrder?.getString("producerStatus")
                    ?.trim()
                    ?.ifBlank { null }
                    ?: "unread"
                val deliveryDateTimestamp = currentOrder?.getTimestamp("deliveryDate") ?: nowTimestamp

                val batch = firestore.batch()
                batch.set(
                    orderReference,
                    mapOf(
                        "userId" to member.id,
                        "consumerDisplayName" to member.displayName,
                        "week" to weekNumber,
                        "weekKey" to weekKey,
                        "deliveryDate" to deliveryDateTimestamp,
                        "consumerStatus" to "confirmado",
                        "producerStatus" to producerStatus,
                        "total" to total,
                        "totalsByVendor" to totalsByVendor,
                        "isAutoGenerated" to false,
                        "createdAt" to createdAtTimestamp,
                        "updatedAt" to nowTimestamp,
                        "confirmedAt" to nowTimestamp,
                    ),
                    SetOptions.merge(),
                )

                val existingLinesSnapshot = runCatching {
                    Tasks.await(
                        firestore.collection(orderLinesPath)
                            .whereEqualTo("orderId", orderId)
                            .get(),
                    )
                }.getOrNull()
                existingLinesSnapshot?.documents?.forEach { lineDocument ->
                    batch.delete(lineDocument.reference)
                }

                lineSnapshots.forEach { line ->
                    val documentId = "${orderId}_${line.product.id}"
                    val orderLineReference = firestore.document("$orderLinesPath/$documentId")
                    batch.set(
                        orderLineReference,
                        mapOf(
                            "orderId" to orderId,
                            "userId" to member.id,
                            "productId" to line.product.id,
                            "vendorId" to line.product.vendorId,
                            "consumerDisplayName" to member.displayName,
                            "companyName" to line.product.companyName,
                            "productName" to line.product.name,
                            "productImageUrl" to line.product.productImageUrl,
                            "quantity" to line.quantityAtOrder,
                            "priceAtOrder" to line.product.price,
                            "subtotal" to line.subtotal,
                            "pricingModeAtOrder" to line.product.pricingMode.wireValue(),
                            "unitName" to line.product.unitName,
                            "unitAbbreviation" to line.product.unitAbbreviation,
                            "unitPlural" to line.product.unitPlural,
                            "unitQty" to line.product.unitQty,
                            "packContainerName" to line.product.packContainerName,
                            "packContainerAbbreviation" to line.product.packContainerAbbreviation,
                            "packContainerPlural" to line.product.packContainerPlural,
                            "packContainerQty" to line.product.packContainerQty,
                            "ecoBasketOptionAtOrder" to line.ecoBasketOption,
                            "week" to weekNumber,
                            "weekKey" to weekKey,
                            "createdAt" to nowTimestamp,
                            "updatedAt" to nowTimestamp,
                        ),
                        SetOptions.merge(),
                    )
                }

                Tasks.await(batch.commit())
                Tasks.await(orderReference.get(Source.SERVER)).exists()
            }.getOrDefault(false)
        }
    }.getOrDefault(false)
}

private fun ProductPricingMode.wireValue(): String =
    when (this) {
        ProductPricingMode.WEIGHT -> "weight"
        ProductPricingMode.FIXED -> "fixed"
    }

private val Int?.orZero: Int
    get() = this ?: 0
