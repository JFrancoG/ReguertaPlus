package com.reguerta.user.presentation.shiftcoverage

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.reguerta.user.R
import com.reguerta.user.domain.shiftcoverage.ShiftCoverageCommand.Action
import com.reguerta.user.domain.shiftcoverage.ShiftCoverageFailure
import com.reguerta.user.domain.shiftcoverage.ShiftCoverageSnapshot
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle
import java.util.Locale
import kotlinx.coroutines.delay

@Composable
internal fun CoverageScreen(model: CoverageRehearsalViewModel) {
    val state by model.coverage.state.collectAsStateWithLifecycle()
    val caseId = model.selectedCaseId
    var tick by remember { mutableLongStateOf(0L) }
    LaunchedEffect(state.session) { model.selectedCaseId = null }
    LaunchedEffect(Unit) { while (true) { delay(1000); tick++ } }
    BackHandler(enabled = caseId != null && model.draft == null) { model.showOverview() }
    val selected = state.snapshot?.cases?.firstOrNull { it.caseId == caseId }
    val actions = remember(state, selected, tick) { selected?.let { model.coverage.actions(it) }.orEmpty() }
    Scaffold { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding).imePadding(),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            item {
                Text(stringResource(R.string.coverage_title), style = MaterialTheme.typography.headlineMedium)
                Text(stringResource(R.string.coverage_rehearsal), style = MaterialTheme.typography.titleMedium)
                Text(stringResource(R.string.coverage_local_note))
            }
            if (state.session == null) {
                item { CoverageLogin(model) }
            } else {
                item {
                    if (caseId != null) TextButton(onClick = model::showOverview) { Text(stringResource(R.string.coverage_dismiss)) }
                    Button(onClick = { model.present(Action.open) }, enabled = model.canOpen, modifier = Modifier.testTag("coverage.open")) {
                        Text(stringResource(R.string.coverage_action_open))
                    }
                    TextButton(onClick = model::refresh, enabled = !state.isBusy) { Text(stringResource(R.string.coverage_refresh)) }
                    TextButton(onClick = model::signOut, modifier = Modifier.testTag("coverage.signOut")) { Text(stringResource(R.string.coverage_sign_out)) }
                }
                item {
                    if (state.isBusy) CircularProgressIndicator()
                    state.failure?.let { Text(stringResource(coverageFailureLabel(it)), Modifier.testTag("coverage.failure")) }
                    if (state.pendingCommand != null) {
                        Text(stringResource(R.string.coverage_uncertain))
                        Button(onClick = model::retryPending, enabled = !state.isBusy, modifier = Modifier.testTag("coverage.retry")) {
                            Text(stringResource(R.string.coverage_retry))
                        }
                    }
                }
                if (caseId == null) {
                    item { Text(stringResource(R.string.coverage_notifications), style = MaterialTheme.typography.titleLarge) }
                    if (state.snapshot?.notifications?.isEmpty() == true) item { Text(stringResource(R.string.coverage_no_notifications)) }
                    items(state.snapshot?.notifications.orEmpty(), key = { it.eventId }) { notification ->
                        TextButton(onClick = { model.openNotification(notification.eventId) },
                            enabled = !state.isBusy && state.pendingCommand == null,
                            modifier = Modifier.testTag("coverage.notification.${notification.eventId}")) {
                            Column {
                                Text(stringResource(R.string.coverage_notification_title))
                                Text(coverageDate(notification.sentAtMillis))
                            }
                        }
                    }
                    item { Text(stringResource(R.string.coverage_cases), style = MaterialTheme.typography.titleLarge) }
                    if (state.snapshot?.cases?.isEmpty() == true) item { Text(stringResource(R.string.coverage_empty)) }
                    items(state.snapshot?.cases.orEmpty(), key = { it.caseId }) { item ->
                        Card(onClick = { model.selectedCaseId = item.caseId }, modifier = Modifier.fillMaxWidth().testTag("coverage.case.${item.caseId}")) {
                            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                Text(stringResource(coverageKindLabel(item.type)), style = MaterialTheme.typography.titleMedium)
                                Text(coverageShiftDate(item.scheduledAtMillis))
                                Text(model.coverage.memberName(item.absentUserId))
                                Text(stringResource(coverageStatusLabel(item.status)))
                            }
                        }
                    }
                    state.snapshot?.let { snapshot -> item { CoverageAccounting(snapshot) } }
                } else if (selected != null) {
                    item {
                        CoverageDetail(selected, model, state.snapshot?.policy?.drawAvailable == true)
                        actions.forEach { action ->
                            Button(onClick = { model.present(action, selected) }, modifier = Modifier.fillMaxWidth().testTag("coverage.action.${action.name}")) {
                                Text(stringResource(coverageActionLabel(action)))
                            }
                        }
                    }
                }
            }
        }
    }
    model.draft?.let { CoverageCommandDialog(it, model) }
}

@Composable
private fun CoverageLogin(model: CoverageRehearsalViewModel) {
    Column(Modifier.widthIn(max = 640.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        OutlinedTextField(model.email, { model.email = it }, modifier = Modifier.fillMaxWidth().testTag("coverage.email"),
            label = { Text(stringResource(R.string.coverage_email)) }, singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email))
        OutlinedTextField(model.password, { model.password = it }, modifier = Modifier.fillMaxWidth().testTag("coverage.password"),
            label = { Text(stringResource(R.string.coverage_password)) }, singleLine = true,
            visualTransformation = PasswordVisualTransformation(), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password))
        Button(onClick = model::signIn, enabled = model.canSignIn, modifier = Modifier.testTag("coverage.signIn")) { Text(stringResource(R.string.coverage_sign_in)) }
        if (model.isSigningIn) Text(stringResource(R.string.coverage_loading))
        if (model.loginFailed) Text(stringResource(R.string.coverage_login_failed))
        val state by model.coverage.state.collectAsStateWithLifecycle()
        state.failure?.let { Text(stringResource(coverageFailureLabel(it))) }
    }
}

@Composable
private fun CoverageDetail(item: ShiftCoverageSnapshot.Case, model: CoverageRehearsalViewModel, drawAvailable: Boolean) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(stringResource(coverageKindLabel(item.type)), style = MaterialTheme.typography.titleLarge)
        Text(coverageShiftDate(item.scheduledAtMillis))
        Text(stringResource(coverageStatusLabel(item.status)), Modifier.testTag("coverage.status"))
        Text("${stringResource(R.string.coverage_absent)}: ${model.coverage.memberName(item.absentUserId)}")
        item.acceptedUserId?.let { Text("${stringResource(R.string.coverage_replacement)}: ${model.coverage.memberName(it)}") }
        item.selectionPhase?.let { Text(stringResource(coveragePhaseLabel(it))) }
        if (!item.writable) Text(stringResource(R.string.coverage_read_only))
        item.offer?.takeIf { item.status == ShiftCoverageSnapshot.Status.offered }?.let {
            Text(model.coverage.memberName(it.userId))
            Text("${stringResource(R.string.coverage_offer_deadline)}: ${coverageDate(it.expiresAtMillis)}")
        }
        item.volunteerClosesAtMillis?.let { Text("${stringResource(R.string.coverage_volunteer_deadline)}: ${coverageDate(it)}") }
        item.administration?.let { Text("${stringResource(R.string.coverage_reason)}: ${it.reason}") }
        if (item.selectionPhase == ShiftCoverageSnapshot.Phase.drawRequired && !drawAvailable) {
            Text(stringResource(R.string.coverage_draw_unavailable))
        }
    }
}

@Composable
private fun CoverageAccounting(snapshot: ShiftCoverageSnapshot) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(stringResource(R.string.coverage_accounting), style = MaterialTheme.typography.titleLarge)
        if (snapshot.credits.isEmpty()) Text(stringResource(R.string.coverage_no_credits))
        snapshot.credits.forEach { credit ->
            Text(stringResource(coverageKindLabel(credit.type)))
            Text(stringResource(if (credit.state == ShiftCoverageSnapshot.CreditState.pending) R.string.coverage_credit_pending else R.string.coverage_credit_consumed))
        }
        snapshot.reserves.forEach { reserve ->
            Text(stringResource(coverageKindLabel(reserve.type)))
            Text(stringResource(if (reserve.active) R.string.coverage_reserve_active else R.string.coverage_reserve_inactive))
        }
    }
}

internal fun coverageDate(millis: Long): String = DateTimeFormatter.ofLocalizedDateTime(FormatStyle.MEDIUM, FormatStyle.SHORT)
    .withLocale(Locale.getDefault()).withZone(ZoneId.of("Europe/Madrid")).format(Instant.ofEpochMilli(millis))

internal fun coverageFailureLabel(failure: ShiftCoverageFailure): Int = when (failure) {
    ShiftCoverageFailure.SessionChanged -> R.string.coverage_access_lost
    is ShiftCoverageFailure.Rejected -> if (failure.status in listOf(401, 403)) R.string.coverage_access_lost else R.string.coverage_conflict
    ShiftCoverageFailure.LocalOnly -> R.string.coverage_local_note
    ShiftCoverageFailure.InvalidResponse, ShiftCoverageFailure.Unavailable -> R.string.coverage_unavailable
}

internal fun coverageShiftDate(millis: Long): String = DateTimeFormatter.ofLocalizedDate(FormatStyle.MEDIUM)
    .withLocale(Locale.getDefault()).withZone(ZoneId.of("Europe/Madrid")).format(Instant.ofEpochMilli(millis))
