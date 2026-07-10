package com.reguerta.user.presentation.products

import com.reguerta.user.presentation.root.ProductDraft
import com.reguerta.user.presentation.root.ReguertaImagePickerField

import android.net.Uri
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Image
import androidx.compose.material3.Card
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.ExposedDropdownMenuAnchorType
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.reguerta.user.R
import com.reguerta.user.domain.access.Member
import com.reguerta.user.domain.access.isProducer
import com.reguerta.user.domain.products.CommonPurchaseType
import com.reguerta.user.domain.products.Product
import com.reguerta.user.domain.products.ProductStockMode
import com.reguerta.user.ui.components.auth.ReguertaButton
import com.reguerta.user.ui.components.auth.ReguertaButtonVariant
import com.reguerta.user.ui.components.auth.ReguertaFloatingActionButton
import kotlinx.coroutines.delay

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProductsRoute(
    currentMember: Member?,
    products: List<Product>,
    draft: ProductDraft,
    editingProductId: String?,
    isLoading: Boolean,
    isSaving: Boolean,
    isUploadingImage: Boolean,
    isUpdatingProducerCatalogVisibility: Boolean,
    onRefresh: () -> Unit,
    onDraftChanged: (ProductDraft) -> Unit,
    onCreateProduct: () -> Unit,
    onEditProduct: (String) -> Unit,
    onPickImage: (Uri) -> Unit,
    onClearImage: () -> Unit,
    onCancelEditor: () -> Unit,
    onSaveProduct: (onSuccess: (String) -> Unit) -> Unit,
    onArchiveProduct: (String, onSuccess: () -> Unit) -> Unit,
    onSetProducerCatalogVisibility: (Boolean, onSuccess: () -> Unit) -> Unit,
) {
    val focusManager = LocalFocusManager.current
    val activeProducts = remember(products) { products.filterNot { it.archived } }
    val archivedProducts = remember(products) { products.filter { it.archived } }
    val isEditing = editingProductId != null
    val canManageEcoBasket = currentMember?.isProducer == true
    val canManageCommonPurchase = currentMember?.let { member ->
        member.isCommonPurchaseManager && !member.isProducer
    } == true
    var commonPurchaseExpanded by rememberSaveable { mutableStateOf(false) }
    var highlightedProductId by rememberSaveable { mutableStateOf<String?>(null) }

    LaunchedEffect(highlightedProductId) {
        val productId = highlightedProductId ?: return@LaunchedEffect
        delay(1_600)
        if (highlightedProductId == productId) {
            highlightedProductId = null
        }
    }

    if (isEditing) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState()),
        ) {
            Card {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Text(
                        text = stringResource(
                            if (editingProductId.isNullOrBlank()) {
                                R.string.products_editor_title_create
                            } else {
                                R.string.products_editor_title_edit
                            },
                        ),
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold,
                    )
                    ReguertaImagePickerField(
                        imageUrl = draft.productImageUrl,
                        isUploading = isUploadingImage,
                        onPickImage = onPickImage,
                        onClearImage = onClearImage,
                        placeholderIcon = Icons.Default.Image,
                        subtitle = stringResource(R.string.products_editor_subtitle),
                    )
                    OutlinedTextField(
                        value = draft.name,
                        onValueChange = { onDraftChanged(draft.copy(name = it)) },
                        modifier = Modifier.fillMaxWidth(),
                        label = { Text(stringResource(R.string.products_field_name)) },
                    )
                    OutlinedTextField(
                        value = draft.description,
                        onValueChange = { onDraftChanged(draft.copy(description = it)) },
                        modifier = Modifier.fillMaxWidth(),
                        label = { Text(stringResource(R.string.products_field_description)) },
                        minLines = 3,
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(
                            value = draft.unitQty,
                            onValueChange = { onDraftChanged(draft.copy(unitQty = it)) },
                            modifier = Modifier.weight(1f),
                            label = { Text(stringResource(R.string.products_field_unit_qty)) },
                        )
                        OutlinedTextField(
                            value = draft.packContainerQty,
                            onValueChange = { onDraftChanged(draft.copy(packContainerQty = it)) },
                            modifier = Modifier.weight(1f),
                            label = { Text(stringResource(R.string.products_field_pack_qty)) },
                        )
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(
                            value = draft.packContainerName,
                            onValueChange = { onDraftChanged(draft.copy(packContainerName = it)) },
                            modifier = Modifier.weight(1f),
                            label = { Text(stringResource(R.string.products_field_pack_name)) },
                        )
                        OutlinedTextField(
                            value = draft.unitName,
                            onValueChange = { onDraftChanged(draft.copy(unitName = it)) },
                            modifier = Modifier.weight(1f),
                            label = { Text(stringResource(R.string.products_field_unit_name)) },
                        )
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(
                            value = draft.packContainerPlural,
                            onValueChange = { onDraftChanged(draft.copy(packContainerPlural = it)) },
                            modifier = Modifier.weight(1f),
                            label = { Text(stringResource(R.string.products_field_pack_plural)) },
                        )
                        OutlinedTextField(
                            value = draft.unitPlural,
                            onValueChange = { onDraftChanged(draft.copy(unitPlural = it)) },
                            modifier = Modifier.weight(1f),
                            label = { Text(stringResource(R.string.products_field_unit_plural)) },
                        )
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(
                            value = draft.price,
                            onValueChange = { onDraftChanged(draft.copy(price = it)) },
                            modifier = Modifier.weight(1f),
                            label = { Text(stringResource(R.string.products_field_price)) },
                        )
                        OutlinedTextField(
                            value = draft.stockQty,
                            onValueChange = { onDraftChanged(draft.copy(stockQty = it)) },
                            modifier = Modifier.weight(1f),
                            label = { Text(stringResource(R.string.products_field_stock_qty)) },
                            enabled = draft.stockMode == ProductStockMode.FINITE,
                        )
                    }
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        text = stringResource(R.string.products_field_available),
                        modifier = Modifier.weight(1f),
                    )
                    Switch(
                        checked = draft.isAvailable,
                        onCheckedChange = { onDraftChanged(draft.copy(isAvailable = it)) },
                    )
                }
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        text = stringResource(R.string.products_field_infinite_stock),
                        modifier = Modifier.weight(1f),
                    )
                    Switch(
                        checked = draft.stockMode == ProductStockMode.INFINITE,
                        onCheckedChange = {
                            onDraftChanged(
                                draft.copy(
                                    stockMode = if (it) ProductStockMode.INFINITE else ProductStockMode.FINITE,
                                    stockQty = if (it) "" else draft.stockQty,
                                ),
                            )
                        },
                    )
                }
                if (canManageEcoBasket) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            text = stringResource(R.string.products_field_eco_basket),
                            modifier = Modifier.weight(1f),
                        )
                        Switch(
                            checked = draft.isEcoBasket,
                            onCheckedChange = { onDraftChanged(draft.copy(isEcoBasket = it)) },
                        )
                    }
                }
                if (canManageCommonPurchase) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            text = stringResource(R.string.products_field_common_purchase),
                            modifier = Modifier.weight(1f),
                        )
                        Switch(
                            checked = draft.isCommonPurchase,
                            onCheckedChange = {
                                onDraftChanged(
                                    draft.copy(
                                        isCommonPurchase = it,
                                        commonPurchaseType = if (it) {
                                            draft.commonPurchaseType ?: CommonPurchaseType.SPOT
                                        } else {
                                            null
                                        },
                                    ),
                                )
                            },
                        )
                    }
                    if (draft.isCommonPurchase) {
                        ExposedDropdownMenuBox(
                            expanded = commonPurchaseExpanded,
                            onExpandedChange = { commonPurchaseExpanded = !commonPurchaseExpanded },
                        ) {
                            OutlinedTextField(
                                value = stringResource(
                                    when (draft.commonPurchaseType ?: CommonPurchaseType.SPOT) {
                                        CommonPurchaseType.SEASONAL -> R.string.products_common_purchase_type_seasonal
                                        CommonPurchaseType.SPOT -> R.string.products_common_purchase_type_spot
                                    },
                                ),
                                onValueChange = {},
                                modifier = Modifier
                                    .menuAnchor(ExposedDropdownMenuAnchorType.PrimaryNotEditable)
                                    .fillMaxWidth(),
                                label = { Text(stringResource(R.string.products_field_common_purchase_type)) },
                                readOnly = true,
                                trailingIcon = {
                                    ExposedDropdownMenuDefaults.TrailingIcon(expanded = commonPurchaseExpanded)
                                },
                            )
                            ExposedDropdownMenu(
                                expanded = commonPurchaseExpanded,
                                onDismissRequest = { commonPurchaseExpanded = false },
                            ) {
                                DropdownMenuItem(
                                    text = { Text(stringResource(R.string.products_common_purchase_type_spot)) },
                                    onClick = {
                                        onDraftChanged(draft.copy(commonPurchaseType = CommonPurchaseType.SPOT))
                                        commonPurchaseExpanded = false
                                    },
                                )
                                DropdownMenuItem(
                                    text = { Text(stringResource(R.string.products_common_purchase_type_seasonal)) },
                                    onClick = {
                                        onDraftChanged(draft.copy(commonPurchaseType = CommonPurchaseType.SEASONAL))
                                        commonPurchaseExpanded = false
                                    },
                                )
                            }
                        }
                    }
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    ReguertaButton(
                        label = stringResource(
                            if (isSaving) R.string.products_save_action_saving else R.string.products_save_action
                        ),
                        variant = ReguertaButtonVariant.PRIMARY,
                        fullWidth = false,
                        loading = isSaving,
                        enabled = !isSaving && !isUploadingImage,
                        onClick = {
                            focusManager.clearFocus(force = true)
                            onSaveProduct { savedProductId ->
                                highlightedProductId = savedProductId
                                onCancelEditor()
                            }
                        },
                    )
                    ReguertaButton(
                        label = stringResource(R.string.common_action_back),
                        variant = ReguertaButtonVariant.SECONDARY,
                        fullWidth = false,
                        enabled = !isSaving,
                        onClick = {
                            focusManager.clearFocus(force = true)
                            onCancelEditor()
                        },
                    )
                }
            }
        }
        }
        return
    }

    Box(
        modifier = Modifier.fillMaxSize(),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            if (isLoading) {
                Card {
                    Text(
                        text = stringResource(R.string.products_loading),
                        modifier = Modifier.padding(16.dp),
                    )
                }
            } else {
                if (activeProducts.isEmpty()) {
                    Card {
                        Text(
                            text = stringResource(R.string.products_empty_state),
                            modifier = Modifier.padding(16.dp),
                        )
                    }
                } else {
                    activeProducts.forEach { product ->
                        ProductListItem(
                            product = product,
                            isHighlighted = highlightedProductId == product.id,
                            onEdit = { onEditProduct(product.id) },
                            onArchive = {
                                onArchiveProduct(product.id) {
                                    highlightedProductId = product.id
                                }
                            },
                        )
                    }
                }

                if (archivedProducts.isNotEmpty()) {
                    Text(
                        text = stringResource(R.string.products_archived_section_title),
                        style = MaterialTheme.typography.labelLarge,
                        color = MaterialTheme.colorScheme.primary,
                        fontWeight = FontWeight.SemiBold,
                    )
                    archivedProducts.forEach { product ->
                        ProductListItem(
                            product = product,
                            isHighlighted = highlightedProductId == product.id,
                            onEdit = { onEditProduct(product.id) },
                            onArchive = {},
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(128.dp))
        }

        ReguertaFloatingActionButton(
            label = stringResource(R.string.products_create_action),
            modifier = Modifier
                .align(Alignment.BottomCenter),
            onClick = onCreateProduct,
        )
    }

}
