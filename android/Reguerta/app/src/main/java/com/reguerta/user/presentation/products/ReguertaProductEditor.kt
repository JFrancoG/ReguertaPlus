package com.reguerta.user.presentation.products

import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Image
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuAnchorType
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.VerticalDivider
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.reguerta.user.R
import com.reguerta.user.domain.products.CommonPurchaseType
import com.reguerta.user.domain.products.ProductContainerOption
import com.reguerta.user.domain.products.ProductMeasureOption
import com.reguerta.user.domain.products.ProductStockMode
import com.reguerta.user.presentation.root.ProductDraft
import com.reguerta.user.presentation.root.ReguertaImagePickerField
import com.reguerta.user.ui.components.auth.ReguertaButton
import com.reguerta.user.ui.components.auth.ReguertaButtonVariant
import com.reguerta.user.ui.components.auth.ReguertaInputField
import com.reguerta.user.ui.theme.ReguertaTheme
import kotlin.math.max

private const val ProductStockIncreaseStep = 10
private const val ProductStockDecreaseStep = -1

internal fun finiteStockQuantity(rawValue: String): Int =
    rawValue
        .trim()
        .replace(',', '.')
        .toDoubleOrNull()
        ?.coerceAtLeast(0.0)
        ?.toInt()
        ?: 0

internal fun adjustedFiniteStockQuantity(rawValue: String, delta: Int): String =
    max(0, finiteStockQuantity(rawValue) + delta).toString()

internal enum class ProductStockLevel {
    ERROR,
    WARNING,
    NORMAL,
}

internal fun productStockLevel(quantity: Int): ProductStockLevel =
    when (quantity) {
        0 -> ProductStockLevel.ERROR
        in 1..10 -> ProductStockLevel.WARNING
        else -> ProductStockLevel.NORMAL
    }

internal fun productEditorTitleRes(editingProductId: String?): Int =
    if (editingProductId.isNullOrBlank()) {
        R.string.products_editor_title_create
    } else {
        R.string.products_editor_title_edit
    }

internal fun isProductEditorOpen(editingProductId: String?): Boolean = editingProductId != null

internal val ProductDraft.isBulkProduct: Boolean
    get() = ProductContainerOption.matching(packContainerName) == ProductContainerOption.BULK

internal fun productContainerOptions(canSelectEcoBasket: Boolean): List<ProductContainerOption> =
    ProductContainerOption.entries.filter { option ->
        option != ProductContainerOption.ECO_BASKET || canSelectEcoBasket
    }

internal fun ProductDraft.selectContainer(option: ProductContainerOption): ProductDraft {
    val wasBulk = isBulkProduct
    val selected = copy(
        packContainerName = option.singular,
        packContainerPlural = option.plural,
        packContainerAbbreviation = option.abbreviation,
        isEcoBasket = option == ProductContainerOption.ECO_BASKET,
    )
    return if (option == ProductContainerOption.BULK) {
        selected.copy(
            packContainerQty = "",
            unitName = "kilo",
            unitPlural = "kilos",
            unitAbbreviation = "kg",
            unitQty = selected.weightStep.ifBlank { "0.5" },
            isEcoBasket = false,
        )
    } else {
        selected.copy(
            packContainerQty = selected.packContainerQty.ifBlank { "1" },
            unitQty = if (wasBulk || selected.unitQty.isBlank()) "1" else selected.unitQty,
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun ProductEditorRoute(
    draft: ProductDraft,
    editingProductId: String?,
    canManageEcoBasket: Boolean,
    canManageCommonPurchase: Boolean,
    isSaving: Boolean,
    isUploadingImage: Boolean,
    onDraftChanged: (ProductDraft) -> Unit,
    onPickImage: (Uri) -> Unit,
    onClearImage: () -> Unit,
    onSave: () -> Unit,
) {
    val focusManager = LocalFocusManager.current
    var commonPurchaseExpanded by rememberSaveable { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(bottom = 24.dp),
        verticalArrangement = Arrangement.spacedBy(20.dp),
    ) {
        ProductEditorHero(
            draft = draft,
            isUploadingImage = isUploadingImage,
            onDraftChanged = onDraftChanged,
            onPickImage = onPickImage,
            onClearImage = onClearImage,
        )

        ReguertaInputField(
            label = stringResource(R.string.products_field_name),
            value = draft.name,
            onValueChange = { onDraftChanged(draft.copy(name = it)) },
            showClearAction = true,
        )
        ReguertaInputField(
            label = stringResource(R.string.products_field_description),
            value = draft.description,
            onValueChange = { onDraftChanged(draft.copy(description = it)) },
            showClearAction = true,
        )

        ProductEditorSalesFields(
            draft = draft,
            canSelectEcoBasket = canManageEcoBasket,
            onDraftChanged = onDraftChanged,
        )

        if (canManageCommonPurchase) {
            ProductEditorToggle(
                label = stringResource(R.string.products_field_common_purchase),
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
                        CommonPurchaseType.entries.forEach { type ->
                            DropdownMenuItem(
                                text = {
                                    Text(
                                        stringResource(
                                            when (type) {
                                                CommonPurchaseType.SEASONAL -> R.string.products_common_purchase_type_seasonal
                                                CommonPurchaseType.SPOT -> R.string.products_common_purchase_type_spot
                                            },
                                        ),
                                    )
                                },
                                onClick = {
                                    onDraftChanged(draft.copy(commonPurchaseType = type))
                                    commonPurchaseExpanded = false
                                },
                            )
                        }
                    }
                }
            }
        }

        ReguertaButton(
            label = stringResource(
                when {
                    isSaving -> R.string.products_save_action_saving
                    editingProductId.isNullOrBlank() -> R.string.products_editor_title_create
                    else -> R.string.products_save_action
                },
            ),
            variant = ReguertaButtonVariant.PRIMARY,
            loading = isSaving,
            enabled = !isSaving && !isUploadingImage,
            onClick = {
                focusManager.clearFocus(force = true)
                onSave()
            },
        )
    }
}

@Composable
private fun ProductEditorHero(
    draft: ProductDraft,
    isUploadingImage: Boolean,
    onDraftChanged: (ProductDraft) -> Unit,
    onPickImage: (Uri) -> Unit,
    onClearImage: () -> Unit,
) {
    BoxWithConstraints(modifier = Modifier.fillMaxWidth()) {
        val isCompact = maxWidth < 340.dp
        val imagePicker: @Composable () -> Unit = {
            ReguertaImagePickerField(
                imageUrl = draft.productImageUrl,
                isUploading = isUploadingImage,
                onPickImage = onPickImage,
                onClearImage = onClearImage,
                placeholderIcon = Icons.Default.Image,
                previewSize = if (isCompact) 160 else 136,
                selectsImageOnPreviewTap = true,
                showsImageControls = false,
            )
        }
        val stockControls: @Composable () -> Unit = {
            ProductStockControls(
                draft = draft,
                onDraftChanged = onDraftChanged,
            )
        }

        if (isCompact) {
            Column(
                modifier = Modifier.fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                imagePicker()
                stockControls()
            }
        } else {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(16.dp),
                verticalAlignment = Alignment.Top,
            ) {
                imagePicker()
                Column(modifier = Modifier.weight(1f)) {
                    stockControls()
                }
            }
        }
    }
}

@Composable
private fun ProductStockControls(
    draft: ProductDraft,
    onDraftChanged: (ProductDraft) -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxWidth(),
    ) {
        ProductEditorToggle(
            label = stringResource(R.string.products_field_available),
            checked = draft.isAvailable,
            onCheckedChange = { onDraftChanged(draft.copy(isAvailable = it)) },
        )
        Spacer(modifier = Modifier.height(10.dp))
        if (draft.stockMode == ProductStockMode.FINITE) {
            ProductStockStepper(
                quantity = finiteStockQuantity(draft.stockQty),
                onDecrease = {
                    onDraftChanged(
                        draft.copy(
                            stockQty = adjustedFiniteStockQuantity(draft.stockQty, ProductStockDecreaseStep),
                        ),
                    )
                },
                onIncrease = {
                    onDraftChanged(
                        draft.copy(
                            stockQty = adjustedFiniteStockQuantity(draft.stockQty, ProductStockIncreaseStep),
                        ),
                    )
                },
            )
            Spacer(modifier = Modifier.height(4.dp))
        }
        ProductEditorToggle(
            label = stringResource(R.string.products_field_infinite_stock),
            checked = draft.stockMode == ProductStockMode.INFINITE,
            onCheckedChange = { isUnlimited ->
                onDraftChanged(
                    draft.copy(
                        stockMode = if (isUnlimited) ProductStockMode.INFINITE else ProductStockMode.FINITE,
                        stockQty = if (isUnlimited) "" else draft.stockQty.ifBlank { "0" },
                    ),
                )
            },
        )
    }
}

@Composable
private fun ProductStockStepper(
    quantity: Int,
    onDecrease: () -> Unit,
    onIncrease: () -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = "${stringResource(R.string.products_field_stock)}: $quantity",
            modifier = Modifier.weight(1f),
            style = MaterialTheme.typography.titleLarge.copy(fontSize = 18.sp),
            fontWeight = FontWeight.SemiBold,
            color = when (productStockLevel(quantity)) {
                ProductStockLevel.ERROR -> MaterialTheme.colorScheme.error
                ProductStockLevel.WARNING -> MaterialTheme.colorScheme.tertiary
                ProductStockLevel.NORMAL -> MaterialTheme.colorScheme.onSurface
            },
        )
        Row(
            modifier = Modifier
                .height(36.dp)
                .clip(RoundedCornerShape(percent = 50))
                .background(MaterialTheme.colorScheme.primaryContainer),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            ProductStockStepButton(
                icon = Icons.Default.Remove,
                contentDescription = stringResource(R.string.products_stock_decrease_action),
                enabled = quantity > 0,
                onClick = onDecrease,
            )
            VerticalDivider(
                modifier = Modifier.size(width = 1.dp, height = 24.dp),
                color = MaterialTheme.colorScheme.outline.copy(alpha = 0.45f),
            )
            ProductStockStepButton(
                icon = Icons.Default.Add,
                contentDescription = stringResource(R.string.products_stock_increase_action),
                enabled = true,
                onClick = onIncrease,
            )
        }
    }
}

@Composable
private fun ProductStockStepButton(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    contentDescription: String,
    enabled: Boolean,
    onClick: () -> Unit,
) {
    IconButton(
        onClick = onClick,
        enabled = enabled,
        modifier = Modifier
            .size(width = 48.dp, height = 36.dp),
    ) {
        Icon(
            imageVector = icon,
            contentDescription = contentDescription,
            tint = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = if (enabled) 1f else 0.35f),
        )
    }
}

@Composable
private fun ProductEditorSalesFields(
    draft: ProductDraft,
    canSelectEcoBasket: Boolean,
    onDraftChanged: (ProductDraft) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        if (draft.isBulkProduct) {
            ProductEditorDropdown(
                label = stringResource(R.string.products_field_pack_name),
                selectedText = draft.packContainerName,
                options = productContainerOptions(canSelectEcoBasket),
                optionLabel = ProductContainerOption::singular,
                onSelected = { onDraftChanged(draft.selectContainer(it)) },
            )
            ProductEditorWeightFields(draft = draft, onDraftChanged = onDraftChanged)
        } else {
            ProductEditorFieldPair(
                first = {
                    ReguertaInputField(
                        label = stringResource(R.string.products_field_pack_qty),
                        value = draft.packContainerQty,
                        onValueChange = { onDraftChanged(draft.copy(packContainerQty = it)) },
                        keyboardType = KeyboardType.Decimal,
                    )
                },
                second = {
                    ProductEditorDropdown(
                        label = stringResource(R.string.products_field_pack_name),
                        selectedText = draft.packContainerName,
                        options = productContainerOptions(canSelectEcoBasket),
                        optionLabel = ProductContainerOption::singular,
                        onSelected = { onDraftChanged(draft.selectContainer(it)) },
                    )
                },
            )
            ProductEditorFieldPair(
                first = {
                    ReguertaInputField(
                        label = stringResource(R.string.products_field_unit_qty),
                        value = draft.unitQty,
                        onValueChange = { onDraftChanged(draft.copy(unitQty = it)) },
                        keyboardType = KeyboardType.Decimal,
                    )
                },
                second = {
                    ProductEditorDropdown(
                        label = stringResource(R.string.products_field_unit_name),
                        selectedText = draft.unitName,
                        options = ProductMeasureOption.entries,
                        optionLabel = ProductMeasureOption::singular,
                        onSelected = { option ->
                            onDraftChanged(
                                draft.copy(
                                    unitName = option.singular,
                                    unitPlural = option.plural,
                                    unitAbbreviation = option.abbreviation,
                                    unitQty = draft.unitQty.ifBlank { "1" },
                                ),
                            )
                        },
                    )
                },
            )
        }
        ReguertaInputField(
            label = stringResource(R.string.products_field_price),
            value = draft.price,
            onValueChange = { onDraftChanged(draft.copy(price = it)) },
            keyboardType = KeyboardType.Decimal,
            showClearAction = true,
        )
    }
}

@Composable
private fun ProductEditorWeightFields(
    draft: ProductDraft,
    onDraftChanged: (ProductDraft) -> Unit,
) {
    BoxWithConstraints(modifier = Modifier.fillMaxWidth()) {
        val fields: List<@Composable () -> Unit> = listOf(
            {
                ReguertaInputField(
                    label = stringResource(R.string.products_field_min_weight),
                    value = draft.minWeight,
                    onValueChange = { onDraftChanged(draft.copy(minWeight = it)) },
                    keyboardType = KeyboardType.Decimal,
                )
            },
            {
                ReguertaInputField(
                    label = stringResource(R.string.products_field_max_weight),
                    value = draft.maxWeight,
                    onValueChange = { onDraftChanged(draft.copy(maxWeight = it)) },
                    keyboardType = KeyboardType.Decimal,
                )
            },
            {
                ReguertaInputField(
                    label = stringResource(R.string.products_field_weight_step),
                    value = draft.weightStep,
                    onValueChange = {
                        onDraftChanged(draft.copy(weightStep = it, unitQty = it))
                    },
                    keyboardType = KeyboardType.Decimal,
                )
            },
        )
        if (maxWidth < 340.dp) {
            Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                fields.forEach { it() }
            }
        } else {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                fields.forEach { field ->
                    Column(modifier = Modifier.weight(1f)) { field() }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun <T> ProductEditorDropdown(
    label: String,
    selectedText: String,
    options: List<T>,
    optionLabel: (T) -> String,
    onSelected: (T) -> Unit,
) {
    var expanded by rememberSaveable { mutableStateOf(false) }

    ExposedDropdownMenuBox(
        expanded = expanded,
        onExpandedChange = { expanded = !expanded },
    ) {
        ReguertaInputField(
            label = label,
            value = selectedText,
            onValueChange = {},
            modifier = Modifier
                .menuAnchor(ExposedDropdownMenuAnchorType.PrimaryNotEditable)
                .fillMaxWidth(),
            readOnly = true,
            trailing = {
                ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded)
            },
        )
        ExposedDropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false },
        ) {
            options.forEach { option ->
                DropdownMenuItem(
                    text = { Text(optionLabel(option)) },
                    onClick = {
                        onSelected(option)
                        expanded = false
                    },
                )
            }
        }
    }
}

@Composable
private fun ProductEditorFieldPair(
    first: @Composable () -> Unit,
    second: @Composable () -> Unit,
) {
    BoxWithConstraints(modifier = Modifier.fillMaxWidth()) {
        if (maxWidth < 340.dp) {
            Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                first()
                second()
            }
        } else {
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Column(modifier = Modifier.weight(1f)) { first() }
                Column(modifier = Modifier.weight(2f)) { second() }
            }
        }
    }
}

@Composable
private fun ProductEditorToggle(
    label: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = label,
            modifier = Modifier.weight(1f),
            style = MaterialTheme.typography.bodyMedium,
        )
        Switch(
            checked = checked,
            onCheckedChange = onCheckedChange,
        )
    }
}

@Preview(name = "Product editor - compact", widthDp = 320, heightDp = 900, showBackground = true)
@Composable
private fun ProductEditorCompactPreview() {
    ProductEditorPreview()
}

@Preview(name = "Product editor - phone", widthDp = 390, heightDp = 1_000, showBackground = true)
@Composable
private fun ProductEditorPhonePreview() {
    ProductEditorPreview()
}

@Preview(name = "Product editor - tablet", widthDp = 700, heightDp = 1_000, showBackground = true)
@Composable
private fun ProductEditorTabletPreview() {
    ProductEditorPreview()
}

@Composable
private fun ProductEditorPreview() {
    ReguertaTheme {
        ProductEditorRoute(
            draft = ProductDraft(
                name = "Tomates cherry",
                description = "Tomate dulce de temporada",
                price = "3,50",
                packContainerName = "A granel",
                packContainerAbbreviation = "A granel",
                packContainerPlural = "A granel",
                packContainerQty = "",
                unitName = "kilo",
                unitAbbreviation = "kg",
                unitPlural = "kilos",
                unitQty = "0,5",
                minWeight = "0,5",
                maxWeight = "3",
                weightStep = "0,5",
                stockMode = ProductStockMode.FINITE,
                stockQty = "20",
            ),
            editingProductId = "",
            canManageEcoBasket = true,
            canManageCommonPurchase = false,
            isSaving = false,
            isUploadingImage = false,
            onDraftChanged = {},
            onPickImage = {},
            onClearImage = {},
            onSave = {},
        )
    }
}
