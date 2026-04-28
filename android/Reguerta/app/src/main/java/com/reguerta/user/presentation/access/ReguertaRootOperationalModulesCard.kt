package com.reguerta.user.presentation.access

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.reguerta.user.R

@Composable
internal fun OperationalModules(
    modulesEnabled: Boolean,
    canOpenProducts: Boolean,
    myOrderFreshnessState: MyOrderFreshnessUiState,
    onOpenMyOrder: () -> Unit,
    onRetryMyOrderFreshness: () -> Unit,
    onOpenProducts: () -> Unit,
    onOpenShifts: () -> Unit,
    onOpenBylaws: () -> Unit,
    disabledMessage: String? = null,
) {
    Card {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Text(stringResource(R.string.operational_modules_title))
            Button(
                onClick = onOpenMyOrder,
                enabled = modulesEnabled && myOrderFreshnessState == MyOrderFreshnessUiState.Ready,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text(stringResource(R.string.module_my_order))
            }
            Button(onClick = onOpenProducts, enabled = modulesEnabled && canOpenProducts, modifier = Modifier.fillMaxWidth()) {
                Text(stringResource(R.string.module_catalog))
            }
            Button(onClick = onOpenShifts, enabled = modulesEnabled, modifier = Modifier.fillMaxWidth()) {
                Text(stringResource(R.string.module_shifts))
            }
            Button(onClick = onOpenBylaws, enabled = modulesEnabled, modifier = Modifier.fillMaxWidth()) {
                Text(stringResource(R.string.home_shell_action_bylaws))
            }

            if (!modulesEnabled && disabledMessage != null) {
                Text(
                    text = disabledMessage,
                    style = MaterialTheme.typography.bodySmall,
                )
            }

            when (myOrderFreshnessState) {
                MyOrderFreshnessUiState.Checking -> {
                    Text(
                        text = stringResource(R.string.my_order_freshness_checking),
                        style = MaterialTheme.typography.bodySmall,
                    )
                }

                MyOrderFreshnessUiState.TimedOut,
                MyOrderFreshnessUiState.Unavailable,
                    -> {
                        Text(
                            text = stringResource(R.string.my_order_freshness_error_title),
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.SemiBold,
                        )
                        Text(
                            text = stringResource(R.string.my_order_freshness_error_message),
                            style = MaterialTheme.typography.bodySmall,
                        )
                        TextButton(onClick = onRetryMyOrderFreshness) {
                            Text(stringResource(R.string.my_order_freshness_retry))
                        }
                    }

                MyOrderFreshnessUiState.Idle,
                MyOrderFreshnessUiState.Ready,
                    -> Unit
            }
        }
    }
}
