package com.reguerta.user.presentation.access

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Image
import androidx.compose.material3.Card
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.reguerta.user.R
import com.reguerta.user.domain.products.Product
import com.reguerta.user.domain.products.ProductStockMode
import java.util.Locale

private fun Double.toUiDecimal(): String =
    if (this % 1.0 == 0.0) {
        toInt().toString()
    } else {
        String.format(Locale.getDefault(), "%.2f", this)
    }

@Composable
internal fun ProducerCatalogVisibilityDialog(
    targetEnabled: Boolean,
    isUpdating: Boolean,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text(
                text = stringResource(
                    if (targetEnabled) {
                        R.string.products_visibility_enable_dialog_title
                    } else {
                        R.string.products_visibility_disable_dialog_title
                    },
                ),
            )
        },
        text = {
            Text(
                text = stringResource(
                    if (targetEnabled) {
                        R.string.products_visibility_enable_dialog_body
                    } else {
                        R.string.products_visibility_disable_dialog_body
                    },
                ),
            )
        },
        confirmButton = {
            TextButton(
                onClick = onConfirm,
                enabled = !isUpdating,
            ) {
                Text(
                    text = stringResource(R.string.common_action_confirm),
                    textAlign = TextAlign.Center,
                )
            }
        },
        dismissButton = {
            TextButton(
                onClick = onDismiss,
                enabled = !isUpdating,
            ) {
                Text(
                    text = stringResource(R.string.common_action_cancel),
                    textAlign = TextAlign.Center,
                )
            }
        },
    )
}

@Composable
internal fun ProductListItem(
    product: Product,
    onEdit: () -> Unit,
    onArchive: () -> Unit,
) {
    Card {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalArrangement = Arrangement.spacedBy(16.dp),
            verticalAlignment = Alignment.Top,
        ) {
            Box(
                modifier = Modifier
                    .size(96.dp)
                    .clip(RoundedCornerShape(20.dp))
                    .background(MaterialTheme.colorScheme.surfaceVariant),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    imageVector = Icons.Default.Image,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.size(32.dp),
                )
            }
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.Top,
                ) {
                    Column(
                        modifier = Modifier.weight(1f),
                        verticalArrangement = Arrangement.spacedBy(6.dp),
                    ) {
                        Text(
                            text = product.name,
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.SemiBold,
                        )
                        Text(
                            text = product.description.ifBlank { "Sin descripcion." },
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                    Row {
                        IconButton(onClick = onEdit) {
                            Icon(
                                imageVector = Icons.Default.Edit,
                                contentDescription = stringResource(R.string.products_edit_action),
                            )
                        }
                        if (!product.archived) {
                            IconButton(onClick = onArchive) {
                                Icon(
                                    imageVector = Icons.Default.Delete,
                                    contentDescription = stringResource(R.string.products_archive_action),
                                )
                            }
                        }
                    }
                }
                Text(
                    text = "${product.price.toUiDecimal()} €",
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.SemiBold,
                )
                Text(
                    text = when {
                        product.archived -> stringResource(R.string.products_status_archived)
                        product.stockMode == ProductStockMode.INFINITE -> stringResource(R.string.products_status_infinite_stock)
                        else -> stringResource(
                            R.string.products_status_finite_stock_format,
                            product.stockQty?.toUiDecimal().orEmpty().ifBlank { "0" },
                        )
                    },
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Text(
                    text = "${product.unitQty.toUiDecimal()} ${product.unitAbbreviation ?: product.unitName}",
                    style = MaterialTheme.typography.bodyMedium,
                )
                if (product.packContainerName != null) {
                    Text(
                        text = product.packContainerName,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
    }
}
