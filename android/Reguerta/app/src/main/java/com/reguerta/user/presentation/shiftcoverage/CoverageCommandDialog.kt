package com.reguerta.user.presentation.shiftcoverage

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.produceState
import androidx.compose.runtime.getValue
import kotlinx.coroutines.delay
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import com.reguerta.user.R
import com.reguerta.user.domain.shiftcoverage.ShiftCoverageCommand.Action

@Composable
internal fun CoverageCommandDialog(draft: CoverageCommandDraft, model: CoverageRehearsalViewModel) {
    val now by produceState(model.coverage.nowMillis) {
        while (true) { delay(1000); value = model.coverage.nowMillis }
    }
    Dialog(onDismissRequest = model::dismissDraft) {
        Surface {
            Column(Modifier.verticalScroll(rememberScrollState()).padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(stringResource(coverageActionLabel(draft.action)))
                Text(stringResource(if (draft.action == Action.complete) R.string.coverage_complete_note else R.string.coverage_confirm_note))
                if (draft.action == Action.open) {
                    Text(stringResource(R.string.coverage_shift))
                    draft.shifts.forEach { shift ->
                        TextButton(onClick = { draft.shiftId = shift.shiftId; draft.memberId = "" }) {
                            RadioButton(selected = draft.shiftId == shift.shiftId, onClick = null)
                            Text("${stringResource(coverageKindLabel(shift.type))} · ${coverageShiftDate(shift.scheduledAtMillis)}")
                        }
                    }
                }
                if (draft.needsMember) {
                    Text(stringResource(R.string.coverage_member))
                    draft.members.forEach { member ->
                        TextButton(onClick = { draft.memberId = member.memberId }, modifier = Modifier.testTag("coverage.member.${member.memberId}")) {
                            RadioButton(selected = draft.memberId == member.memberId, onClick = null)
                            Text(member.displayName)
                        }
                    }
                }
                if (draft.needsReason) {
                    OutlinedTextField(draft.reason, { draft.reason = it }, label = { Text(stringResource(R.string.coverage_reason)) },
                        modifier = Modifier.fillMaxWidth().testTag("coverage.reason"))
                }
                if (draft.needsDeadline) {
                    OutlinedTextField(draft.deadlineMinutes, { draft.deadlineMinutes = it }, label = { Text(stringResource(R.string.coverage_minutes)) },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), modifier = Modifier.fillMaxWidth(), singleLine = true)
                }
                Button(onClick = model::confirmDraft, enabled = model.canConfirmDraft(now), modifier = Modifier.testTag("coverage.confirm")) { Text(stringResource(R.string.coverage_confirm)) }
                TextButton(onClick = model::dismissDraft) { Text(stringResource(R.string.coverage_dismiss)) }
            }
        }
    }
}
