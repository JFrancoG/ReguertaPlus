package com.reguerta.user.presentation.products

import android.net.Uri
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
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
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.reguerta.user.R
import com.reguerta.user.domain.access.Member
import com.reguerta.user.domain.access.isProducer
import com.reguerta.user.domain.products.Product
import com.reguerta.user.presentation.root.ProductDraft
import com.reguerta.user.ui.components.auth.ReguertaFloatingActionButton
import kotlinx.coroutines.delay

@Composable
fun ProductsRoute(
    currentMember: Member?,
    products: List<Product>,
    draft: ProductDraft,
    editingProductId: String?,
    isLoading: Boolean,
    isSaving: Boolean,
    isUploadingImage: Boolean,
    onRefresh: () -> Unit,
    onDraftChanged: (ProductDraft) -> Unit,
    onCreateProduct: () -> Unit,
    onEditProduct: (String) -> Unit,
    onPickImage: (Uri) -> Unit,
    onClearImage: () -> Unit,
    onCancelEditor: () -> Unit,
    onSaveProduct: (onSuccess: (String) -> Unit) -> Unit,
    onArchiveProduct: (String, onSuccess: () -> Unit) -> Unit,
) {
    val activeProducts = remember(products) { products.filterNot { it.archived } }
    val archivedProducts = remember(products) { products.filter { it.archived } }
    val isEditing = isProductEditorOpen(editingProductId)
    val canManageEcoBasket = currentMember?.isProducer == true && currentMember.producerParity != null
    val canManageCommonPurchase = currentMember?.let { member ->
        member.isCommonPurchaseManager && !member.isProducer
    } == true
    var highlightedProductId by rememberSaveable { mutableStateOf<String?>(null) }

    LaunchedEffect(highlightedProductId) {
        val productId = highlightedProductId ?: return@LaunchedEffect
        delay(1_600)
        if (highlightedProductId == productId) {
            highlightedProductId = null
        }
    }

    if (isEditing) {
        ProductEditorRoute(
            draft = draft,
            editingProductId = editingProductId,
            canManageEcoBasket = canManageEcoBasket,
            canManageCommonPurchase = canManageCommonPurchase,
            isSaving = isSaving,
            isUploadingImage = isUploadingImage,
            onDraftChanged = onDraftChanged,
            onPickImage = onPickImage,
            onClearImage = onClearImage,
            onSave = {
                onSaveProduct { savedProductId ->
                    highlightedProductId = savedProductId
                    onCancelEditor()
                }
            },
        )
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
