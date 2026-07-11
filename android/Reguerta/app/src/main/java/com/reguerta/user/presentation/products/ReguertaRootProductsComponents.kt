package com.reguerta.user.presentation.products

import com.reguerta.user.presentation.formatting.toEuroCurrencyText
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Image
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import com.reguerta.user.R
import com.reguerta.user.domain.products.Product
import com.reguerta.user.domain.products.ProductStockMode
import com.reguerta.user.ui.components.auth.ReguertaDeleteListActionButton
import com.reguerta.user.ui.components.auth.ReguertaEditListActionButton
import com.reguerta.user.ui.components.auth.ReguertaListItemCard
import java.util.Locale

private fun Double.toUiDecimal(): String =
    if (this % 1.0 == 0.0) {
        toInt().toString()
    } else {
        String.format(Locale.getDefault(), "%.2f", this)
    }

@Composable
internal fun ProductListItem(
    product: Product,
    isHighlighted: Boolean,
    onEdit: () -> Unit,
    onArchive: () -> Unit,
) {
    ReguertaListItemCard(isHighlighted = isHighlighted) {
        Column(
            modifier = Modifier.fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Box(modifier = Modifier.fillMaxWidth()) {
                ProductImage(
                    product = product,
                    modifier = Modifier.align(Alignment.TopStart),
                )
                Row(
                    modifier = Modifier.align(Alignment.TopEnd),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    ReguertaEditListActionButton(
                        contentDescription = stringResource(R.string.products_edit_action),
                        onClick = onEdit,
                    )
                    if (!product.archived) {
                        ReguertaDeleteListActionButton(
                            contentDescription = stringResource(R.string.products_archive_action),
                            onClick = onArchive,
                        )
                    }
                }
            }
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                Text(
                    text = product.name,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.onSurface,
                )
                Text(
                    text = product.description.ifBlank { stringResource(R.string.products_description_empty) },
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurface,
                )
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        text = product.price.toEuroCurrencyText(),
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold,
                        color = MaterialTheme.colorScheme.onSurface,
                    )
                    Spacer(modifier = Modifier.weight(1f))
                    Text(
                        text = when {
                            product.archived -> stringResource(R.string.products_status_archived)
                            product.stockMode == ProductStockMode.INFINITE -> stringResource(R.string.products_status_infinite_stock)
                            else -> stringResource(
                                R.string.products_status_finite_stock_format,
                                product.stockQty?.toUiDecimal().orEmpty().ifBlank { "0" },
                            )
                        },
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold,
                        color = MaterialTheme.colorScheme.onSurface,
                    )
                }
            }
        }
    }
}

@Composable
private fun ProductImage(
    product: Product,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier = modifier
            .size(72.dp)
            .clip(RoundedCornerShape(8.dp))
            .background(MaterialTheme.colorScheme.surfaceVariant),
        contentAlignment = Alignment.Center,
    ) {
        if (product.productImageUrl.isNullOrBlank()) {
            Icon(
                imageVector = Icons.Default.Image,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(28.dp),
            )
        } else {
            AsyncImage(
                model = product.productImageUrl,
                contentDescription = null,
                modifier = Modifier.fillMaxSize(),
                contentScale = ContentScale.Crop,
            )
        }
    }
}
