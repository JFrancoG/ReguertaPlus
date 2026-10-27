package com.reguerta.user.presentation.shiftcoverage

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.reguerta.user.R
import kotlinx.coroutines.delay

@Composable
internal fun CoverageAdministrationDialog(draft: CoverageAdministrationDraft, model: CoverageRehearsalViewModel) {
    val now by produceState(model.coverage.nowMillis) {
        while (true) { delay(1000); value = model.coverage.nowMillis }
    }
    Dialog(onDismissRequest = model::dismissAdministrationDraft, properties = DialogProperties(decorFitsSystemWindows = false)) {
        Surface(Modifier.safeDrawingPadding().imePadding()) {
            Column(Modifier.verticalScroll(rememberScrollState()).padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(stringResource(when {
                    draft.spacing != null -> R.string.coverage_admin_spacing_authorize
                    draft.permanentDeparture -> R.string.coverage_admin_departure
                    else -> R.string.coverage_admin_reconcile
                }))
                draft.member?.let { CoverageAdministrationMemberSummary(it) }
                draft.spacing?.let { CoverageAdministrationSpacingSummary(it) }
                Text(stringResource(when {
                    draft.spacing != null -> R.string.coverage_admin_spacing_confirmation
                    draft.permanentDeparture -> R.string.coverage_admin_departure_warning
                    else -> R.string.coverage_admin_reconcile_confirmation
                }))
                if (draft.needsReason) {
                    OutlinedTextField(draft.reason, { draft.reason = it }, label = { Text(stringResource(R.string.coverage_reason)) },
                        modifier = Modifier.fillMaxWidth().testTag("coverage.admin.reason"))
                }
                Button(onClick = model::confirmAdministrationDraft, enabled = model.canConfirmAdministrationDraft(now),
                    modifier = Modifier.testTag("coverage.admin.confirm")) { Text(stringResource(R.string.coverage_confirm)) }
                TextButton(onClick = model::dismissAdministrationDraft, modifier = Modifier.testTag("coverage.admin.dismiss")) {
                    Text(stringResource(R.string.coverage_dismiss))
                }
            }
        }
    }
}
