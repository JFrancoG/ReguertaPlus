package com.reguerta.user.presentation.products

import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.reguerta.user.R
import com.reguerta.user.domain.products.ProductStockMode
import com.reguerta.user.presentation.root.ProductDraft
import com.reguerta.user.ui.theme.ReguertaTheme
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class ProductEditorBulkUiTest {
    @get:Rule
    val composeRule = createComposeRule()

    @Test
    fun bulkEditorShowsWeightLimitsWithoutEcoToggleOrQuantitySelectors() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        composeRule.setContent {
            ReguertaTheme {
                ProductEditorRoute(
                    draft = ProductDraft(
                        name = "Patatas",
                        description = "A granel",
                        price = "2",
                        unitName = "kilo",
                        unitAbbreviation = "kg",
                        unitPlural = "kilos",
                        unitQty = "0.5",
                        packContainerName = "A granel",
                        packContainerAbbreviation = "A granel",
                        packContainerPlural = "A granel",
                        packContainerQty = "",
                        weightStep = "0.5",
                        minWeight = "0.5",
                        maxWeight = "3",
                        stockMode = ProductStockMode.INFINITE,
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

        composeRule.onNodeWithText(context.getString(R.string.products_field_min_weight), ignoreCase = true).fetchSemanticsNode()
        composeRule.onNodeWithText(context.getString(R.string.products_field_max_weight), ignoreCase = true).fetchSemanticsNode()
        composeRule.onNodeWithText(context.getString(R.string.products_field_weight_step), ignoreCase = true).fetchSemanticsNode()
        composeRule.onAllNodesWithText(context.getString(R.string.products_field_eco_basket), ignoreCase = true).assertCountEquals(0)
        composeRule.onAllNodesWithText(context.getString(R.string.products_field_pack_qty), ignoreCase = true).assertCountEquals(0)
        composeRule.onAllNodesWithText(context.getString(R.string.products_field_unit_qty), ignoreCase = true).assertCountEquals(0)

        composeRule.onAllNodesWithText("A granel")[1].performClick()
        composeRule.onNodeWithText("Caja").fetchSemanticsNode()
    }
}
