package com.reguerta.user.presentation.access

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
import androidx.compose.material.icons.filled.Image
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.ShoppingCart
import androidx.compose.material3.AlertDialog
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
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import com.reguerta.user.R
import com.reguerta.user.domain.access.Member
import com.reguerta.user.domain.access.MemberRole
import com.reguerta.user.domain.products.Product
import com.reguerta.user.domain.products.ProductStockMode
import java.text.Normalizer
import java.util.Locale
import kotlin.math.floor
import kotlin.math.max

private const val CommonPurchasesGroupId = "__my_order_reguerta_common_purchases__"
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

    data object EcoBasketPriceMismatch : MyOrderCheckoutDialogState

    data class ReadyToSubmit(
        val total: Double,
        val noPickupEcoBaskets: Int,
    ) : MyOrderCheckoutDialogState
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
internal fun MyOrderRoute(
    modifier: Modifier = Modifier,
    currentMember: Member?,
    members: List<Member>,
    products: List<Product>,
    isLoading: Boolean,
    onRefresh: () -> Unit,
) {
    var searchQuery by rememberSaveable { mutableStateOf("") }
    var selectedQuantities by rememberSaveable { mutableStateOf<Map<String, Int>>(emptyMap()) }
    var selectedEcoBasketOptions by rememberSaveable { mutableStateOf<Map<String, String>>(emptyMap()) }
    var isCartVisible by rememberSaveable { mutableStateOf(false) }
    var checkoutDialogState by remember { mutableStateOf<MyOrderCheckoutDialogState?>(null) }

    val normalizedQuery = remember(searchQuery) { searchQuery.searchNormalized() }
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
    val selectedProducts = remember(products, selectedQuantities) {
        products.filter { product -> selectedQuantities[product.id].orZero > 0 }
    }
    val selectedUnits = remember(selectedQuantities) {
        selectedQuantities.values.sum()
    }
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
    LaunchedEffect(products) {
        val productsById = products.associateBy(Product::id)
        val sanitizedQuantities = selectedQuantities.mapNotNull { (productId, qty) ->
            val product = productsById[productId] ?: return@mapNotNull null
            val finiteLimit = finiteStockLimit(product)
            val allowedQty = finiteLimit?.let { qty.coerceAtMost(it) } ?: qty
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

    val increaseProduct: (Product) -> Unit = { product ->
        val currentQty = selectedQuantities[product.id].orZero
        if (canIncrease(product = product, currentQuantity = currentQty)) {
            selectedQuantities = selectedQuantities + (product.id to (currentQty + 1))
            if (product.isEcoBasket && selectedEcoBasketOptions[product.id] == null) {
                selectedEcoBasketOptions = selectedEcoBasketOptions + (product.id to EcoBasketOptionPickup)
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
                            onClick = { isCartVisible = false },
                            shape = RoundedCornerShape(12.dp),
                        ) {
                            Icon(
                                imageVector = Icons.Default.ShoppingCart,
                                contentDescription = null,
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(text = stringResource(R.string.my_order_continue_shopping_action))
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
                                        ecoBasketOption = selectedEcoBasketOptions[product.id],
                                        onIncrease = { increaseProduct(product) },
                                        onDecrease = { decreaseProduct(product) },
                                        onEcoBasketOptionChange = { selectedOption ->
                                            selectedEcoBasketOptions = selectedEcoBasketOptions + (product.id to selectedOption)
                                        },
                                    )
                                }
                            }
                        }
                    }

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
                                    selectedQuantities = selectedQuantities,
                                    selectedEcoBasketOptions = selectedEcoBasketOptions,
                                )
                                checkoutDialogState = when {
                                    validationResult.hasEcoBasketPriceMismatch -> {
                                        MyOrderCheckoutDialogState.EcoBasketPriceMismatch
                                    }

                                    validationResult.missingCommitmentProductNames.isNotEmpty() -> {
                                        MyOrderCheckoutDialogState.MissingCommitments(
                                            validationResult.missingCommitmentProductNames,
                                        )
                                    }

                                    else -> {
                                        MyOrderCheckoutDialogState.ReadyToSubmit(
                                            total = cartTotal,
                                            noPickupEcoBaskets = noPickupEcoBasketUnits,
                                        )
                                    }
                                }
                            },
                            enabled = selectedUnits > 0,
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 16.dp, vertical = 12.dp),
                            shape = RoundedCornerShape(28.dp),
                        ) {
                            Text(
                                text = stringResource(R.string.my_order_finalize_action),
                                fontWeight = FontWeight.SemiBold,
                            )
                        }
                    }
                }
            }
        }
    }

    checkoutDialogState?.let { dialogState ->
        when (dialogState) {
            is MyOrderCheckoutDialogState.MissingCommitments -> {
                AlertDialog(
                    onDismissRequest = { checkoutDialogState = null },
                    title = { Text(text = stringResource(R.string.my_order_checkout_error_title)) },
                    text = {
                        Text(
                            text = stringResource(
                                R.string.my_order_checkout_error_message,
                                dialogState.productNames.joinToString(separator = ", "),
                            ),
                        )
                    },
                    confirmButton = {
                        TextButton(onClick = { checkoutDialogState = null }) {
                            Text(text = stringResource(R.string.common_action_accept))
                        }
                    },
                )
            }

            is MyOrderCheckoutDialogState.ReadyToSubmit -> {
                AlertDialog(
                    onDismissRequest = { checkoutDialogState = null },
                    title = { Text(text = stringResource(R.string.my_order_checkout_success_title)) },
                    text = {
                        Text(
                            text = if (dialogState.noPickupEcoBaskets > 0) {
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
                        )
                    },
                    confirmButton = {
                        TextButton(onClick = { checkoutDialogState = null }) {
                            Text(text = stringResource(R.string.common_action_accept))
                        }
                    },
                )
            }

            is MyOrderCheckoutDialogState.EcoBasketPriceMismatch -> {
                AlertDialog(
                    onDismissRequest = { checkoutDialogState = null },
                    title = { Text(text = stringResource(R.string.my_order_checkout_eco_price_error_title)) },
                    text = { Text(text = stringResource(R.string.my_order_checkout_eco_price_error_message)) },
                    confirmButton = {
                        TextButton(onClick = { checkoutDialogState = null }) {
                            Text(text = stringResource(R.string.common_action_accept))
                        }
                    },
                )
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
    onIncrease: () -> Unit,
    onDecrease: () -> Unit,
) {
    val canIncrease = canIncrease(product = product, currentQuantity = quantity)

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
                        canIncrease = canIncrease,
                        onIncrease = onIncrease,
                        onDecrease = onDecrease,
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
) {
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
    ecoBasketOption: String?,
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
                canIncrease = canIncrease(product = product, currentQuantity = quantity),
                onIncrease = onIncrease,
                onDecrease = onDecrease,
            )
            if (product.isEcoBasket && quantity > 0) {
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

private fun canIncrease(product: Product, currentQuantity: Int): Boolean {
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

private val Int?.orZero: Int
    get() = this ?: 0
