package com.reguerta.user.presentation.access

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import com.reguerta.user.R
import com.reguerta.user.ui.components.auth.ReguertaFlatButton
import androidx.compose.ui.unit.dp

@Composable
internal fun HomePlaceholderRoute(
    title: String,
    subtitle: String,
    onBackHome: () -> Unit,
) {
    Card {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(
                text = title,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
            )
            Text(
                text = subtitle,
                style = MaterialTheme.typography.bodyMedium,
            )
            ReguertaFlatButton(
                label = stringResource(R.string.common_action_back),
                onClick = onBackHome,
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}
