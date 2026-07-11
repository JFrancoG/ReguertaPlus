package com.reguerta.user.presentation.settings

import com.reguerta.user.presentation.shifts.effectiveDateMillis
import com.reguerta.user.presentation.shifts.toLocalizedDateTime
import com.reguerta.user.presentation.shifts.toWeekKey
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.reguerta.user.R
import com.reguerta.user.domain.access.Member
import com.reguerta.user.domain.access.isProducer
import com.reguerta.user.domain.calendar.DeliveryCalendarOverride
import com.reguerta.user.domain.calendar.DeliveryWeekday
import com.reguerta.user.domain.shifts.ShiftAssignment
import com.reguerta.user.domain.shifts.ShiftPlanningRequestType
import com.reguerta.user.domain.shifts.ShiftType
import com.reguerta.user.ui.components.auth.ReguertaDialog
import com.reguerta.user.ui.components.auth.ReguertaDialogAction
import com.reguerta.user.ui.components.auth.ReguertaDialogType
import com.reguerta.user.ui.components.auth.ReguertaButton
import com.reguerta.user.ui.components.auth.ReguertaFlatButton
import com.reguerta.user.ui.theme.AppAppearance
import java.util.Locale

@Composable
fun SettingsRoute(
    appAppearance: AppAppearance,
    currentMember: Member?,
    authenticatedMember: Member?,
    members: List<Member>,
    shifts: List<ShiftAssignment>,
    deliveryCalendarOverrides: List<DeliveryCalendarOverride>,
    defaultDeliveryDayOfWeek: DeliveryWeekday?,
    isLoadingDeliveryCalendar: Boolean,
    isSavingDeliveryCalendar: Boolean,
    isSubmittingShiftPlanningRequest: Boolean,
    isUpdatingProducerCatalogVisibility: Boolean,
    isDevelopImpersonationEnabled: Boolean,
    nowOverrideMillis: Long?,
    onImpersonateMember: (String) -> Unit,
    onClearImpersonation: () -> Unit,
    onSetNowOverrideMillis: (Long?) -> Unit,
    onShiftNowByDays: (Int) -> Unit,
    onAppAppearanceChanged: (AppAppearance) -> Unit,
    onSetProducerCatalogVisibility: (Boolean, onSuccess: () -> Unit) -> Unit,
    onSaveDeliveryCalendarOverride: (String, DeliveryWeekday, String, onSuccess: () -> Unit) -> Unit,
    onSubmitShiftPlanningRequest: (ShiftPlanningRequestType, onSuccess: () -> Unit) -> Unit,
) {
    var isImpersonationExpanded by rememberSaveable { mutableStateOf(false) }
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 4.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        SettingsSectionTitle(stringResource(R.string.settings_scope_general))
        AppearanceSelector(
            selectedAppearance = appAppearance,
            onAppearanceSelected = onAppAppearanceChanged,
        )

        if (currentMember?.isProducer == true) {
            HorizontalDivider()
            SettingsSectionTitle(stringResource(R.string.settings_scope_producer))
            ProducerVacationModeSetting(
                isVacationModeEnabled = !currentMember.producerCatalogEnabled,
                isSaving = isUpdatingProducerCatalogVisibility,
                onVacationModeChanged = { enabled ->
                    onSetProducerCatalogVisibility(!enabled) {}
                },
            )
        }

        if (currentMember?.isAdmin == true) {
            HorizontalDivider()
            SettingsSectionTitle(stringResource(R.string.settings_scope_admin))
            AdminDeliveryCalendarSection(
                currentMember = currentMember,
                shifts = shifts,
                overrides = deliveryCalendarOverrides,
                defaultDeliveryDayOfWeek = defaultDeliveryDayOfWeek,
                nowMillis = nowOverrideMillis ?: System.currentTimeMillis(),
                isLoading = isLoadingDeliveryCalendar,
                isSaving = isSavingDeliveryCalendar,
                onSaveOverride = onSaveDeliveryCalendarOverride,
            )
            HorizontalDivider()
            AdminShiftPlanningSection(
                isSubmitting = isSubmittingShiftPlanningRequest,
                onSubmit = onSubmitShiftPlanningRequest,
            )
        }

        if (isDevelopImpersonationEnabled && currentMember != null && authenticatedMember != null) {
            HorizontalDivider()
            SettingsSectionTitle(stringResource(R.string.settings_scope_develop))
            Text(
                text = stringResource(R.string.settings_develop_impersonation_summary),
                style = MaterialTheme.typography.bodyMedium,
            )
            val isImpersonating = currentMember.id != authenticatedMember.id
            Text(
                text = stringResource(
                    R.string.settings_develop_real_account_format,
                    authenticatedMember.displayName,
                ),
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.Medium,
            )
            Text(
                text = if (isImpersonating) {
                    stringResource(R.string.settings_develop_viewing_as_format, currentMember.displayName)
                } else {
                    stringResource(R.string.settings_develop_using_own_profile)
                },
                style = MaterialTheme.typography.bodyMedium,
            )
            if (isImpersonating) {
                ReguertaFlatButton(
                    label = stringResource(R.string.settings_develop_back_to_real_profile),
                    onClick = onClearImpersonation,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
            HorizontalDivider()
            Text(
                text = stringResource(R.string.settings_develop_impersonation_title),
                style = MaterialTheme.typography.bodyLarge,
                fontWeight = FontWeight.SemiBold,
            )
            ReguertaFlatButton(
                label = if (isImpersonationExpanded) {
                    stringResource(R.string.settings_develop_hide_members)
                } else {
                    stringResource(R.string.settings_develop_choose_member)
                },
                onClick = { isImpersonationExpanded = !isImpersonationExpanded },
                modifier = Modifier.fillMaxWidth(),
            )
            if (isImpersonationExpanded) {
                members
                    .filter { it.isActive }
                    .sortedBy { it.displayName.lowercase(Locale.getDefault()) }
                    .forEach { member ->
                        val isSelected = member.id == currentMember.id
                        ReguertaFlatButton(
                            label = member.displayName,
                            onClick = {
                                onImpersonateMember(member.id)
                                isImpersonationExpanded = false
                            },
                            modifier = Modifier.fillMaxWidth(),
                            enabled = !isSelected,
                        )
                    }
            }
            HorizontalDivider()
            Text(
                text = stringResource(R.string.settings_develop_clock_title),
                style = MaterialTheme.typography.bodyLarge,
                fontWeight = FontWeight.SemiBold,
            )
            Text(
                text = nowOverrideMillis?.let {
                    stringResource(R.string.settings_develop_simulated_date_format, it.toLocalizedDateTime())
                } ?: stringResource(R.string.settings_develop_simulated_date_disabled),
                style = MaterialTheme.typography.bodyMedium,
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                ReguertaFlatButton(
                    label = stringResource(R.string.settings_develop_previous_day),
                    onClick = { onShiftNowByDays(-1) },
                    modifier = Modifier.weight(1f),
                )
                ReguertaFlatButton(
                    label = stringResource(R.string.settings_develop_next_day),
                    onClick = { onShiftNowByDays(1) },
                    modifier = Modifier.weight(1f),
                )
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                ReguertaFlatButton(
                    label = stringResource(R.string.settings_develop_now),
                    onClick = { onSetNowOverrideMillis(System.currentTimeMillis()) },
                    modifier = Modifier.weight(1f),
                )
                ReguertaFlatButton(
                    label = stringResource(R.string.settings_develop_reset),
                    onClick = { onSetNowOverrideMillis(null) },
                    modifier = Modifier.weight(1f),
                )
            }
        }
    }
}

@Composable
private fun SettingsSectionTitle(title: String) {
    Text(
        text = title,
        style = MaterialTheme.typography.bodyLarge,
        color = MaterialTheme.colorScheme.primary,
        fontWeight = FontWeight.SemiBold,
    )
}

@Composable
private fun AppearanceSelector(
    selectedAppearance: AppAppearance,
    onAppearanceSelected: (AppAppearance) -> Unit,
) {
    Column(
        modifier = Modifier.selectableGroup(),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Text(
            text = stringResource(R.string.settings_appearance_title),
            style = MaterialTheme.typography.bodyLarge,
            fontWeight = FontWeight.Medium,
        )
        Text(
            text = stringResource(R.string.settings_appearance_summary),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        AppAppearance.entries.forEach { appearance ->
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .selectable(
                        selected = selectedAppearance == appearance,
                        onClick = { onAppearanceSelected(appearance) },
                        role = Role.RadioButton,
                    )
                    .padding(vertical = 6.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                RadioButton(
                    selected = selectedAppearance == appearance,
                    onClick = null,
                )
                Text(
                    text = stringResource(appearance.labelResource),
                    style = MaterialTheme.typography.bodyMedium,
                )
            }
        }
    }
}

@Composable
private fun ProducerVacationModeSetting(
    isVacationModeEnabled: Boolean,
    isSaving: Boolean,
    onVacationModeChanged: (Boolean) -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .toggleable(
                value = isVacationModeEnabled,
                enabled = !isSaving,
                role = Role.Switch,
                onValueChange = onVacationModeChanged,
            )
            .padding(vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            Text(
                text = stringResource(R.string.settings_vacation_mode_title),
                style = MaterialTheme.typography.bodyLarge,
                fontWeight = FontWeight.Medium,
            )
            Text(
                text = stringResource(R.string.settings_vacation_mode_summary),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        Switch(
            checked = isVacationModeEnabled,
            onCheckedChange = null,
            enabled = !isSaving,
        )
    }
}

private val AppAppearance.labelResource: Int
    get() = when (this) {
        AppAppearance.SYSTEM -> R.string.settings_appearance_system
        AppAppearance.LIGHT -> R.string.settings_appearance_light
        AppAppearance.DARK -> R.string.settings_appearance_dark
    }

@Composable
private fun AdminDeliveryCalendarSection(
    currentMember: Member,
    shifts: List<ShiftAssignment>,
    overrides: List<DeliveryCalendarOverride>,
    defaultDeliveryDayOfWeek: DeliveryWeekday?,
    nowMillis: Long,
    isLoading: Boolean,
    isSaving: Boolean,
    onSaveOverride: (String, DeliveryWeekday, String, onSuccess: () -> Unit) -> Unit,
) {
    val futureWeeks = remember(shifts, overrides, nowMillis) {
        shifts.filter { it.type == ShiftType.DELIVERY && it.effectiveDateMillis(overrides) > nowMillis }
            .sortedBy { it.effectiveDateMillis(overrides) }
            .distinctBy { it.dateMillis.toWeekKey() }
    }
    var isPickerVisible by rememberSaveable { mutableStateOf(false) }
    Text(
        text = stringResource(R.string.settings_delivery_calendar_title),
        style = MaterialTheme.typography.bodyLarge,
        fontWeight = FontWeight.SemiBold,
    )
    if (isLoading) {
        Text(
            text = stringResource(R.string.settings_delivery_calendar_loading),
            style = MaterialTheme.typography.bodyMedium,
        )
    } else if (futureWeeks.isEmpty()) {
        Text(
            text = stringResource(R.string.settings_delivery_calendar_empty),
            style = MaterialTheme.typography.bodyMedium,
        )
    } else {
        Text(
            text = stringResource(R.string.settings_delivery_calendar_help),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.Center,
        ) {
            ReguertaButton(
                label = stringResource(R.string.settings_delivery_calendar_action_change_day),
                onClick = { isPickerVisible = true },
                fullWidth = false,
            )
        }
        if (isPickerVisible) {
            DeliveryCalendarWeekPickerDialog(
                currentMember = currentMember,
                futureWeeks = futureWeeks,
                overrides = overrides,
                defaultDeliveryDayOfWeek = defaultDeliveryDayOfWeek ?: DeliveryWeekday.WEDNESDAY,
                isSaving = isSaving,
                onDismiss = { isPickerVisible = false },
                onSaveOverride = onSaveOverride,
            )
        }
    }
}

@Composable
private fun AdminShiftPlanningSection(
    isSubmitting: Boolean,
    onSubmit: (ShiftPlanningRequestType, onSuccess: () -> Unit) -> Unit,
) {
    var pendingType by rememberSaveable { mutableStateOf<ShiftPlanningRequestType?>(null) }

    Text(
        text = stringResource(R.string.settings_shift_planning_title),
        style = MaterialTheme.typography.bodyLarge,
        fontWeight = FontWeight.SemiBold,
    )
    Text(
        text = stringResource(R.string.settings_shift_planning_subtitle),
        style = MaterialTheme.typography.bodyMedium,
    )
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally),
    ) {
        ReguertaButton(
            label = stringResource(R.string.settings_shift_planning_action_generate_delivery),
            onClick = { pendingType = ShiftPlanningRequestType.DELIVERY },
            modifier = Modifier.weight(1f),
            textStyle = MaterialTheme.typography.titleMedium,
            horizontalPadding = 8.dp,
            enabled = !isSubmitting,
        )
        ReguertaButton(
            label = stringResource(R.string.settings_shift_planning_action_generate_market),
            onClick = { pendingType = ShiftPlanningRequestType.MARKET },
            modifier = Modifier.weight(1f),
            textStyle = MaterialTheme.typography.titleMedium,
            horizontalPadding = 8.dp,
            enabled = !isSubmitting,
        )
    }
    if (isSubmitting) {
        Text(
            text = stringResource(R.string.settings_shift_planning_submitting),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }

    pendingType?.let { type ->
        val title = if (type == ShiftPlanningRequestType.DELIVERY) {
            stringResource(R.string.settings_shift_planning_alert_title_delivery)
        } else {
            stringResource(R.string.settings_shift_planning_alert_title_market)
        }
        ReguertaDialog(
            type = ReguertaDialogType.INFO,
            title = title,
            message = stringResource(R.string.settings_shift_planning_alert_message),
            primaryAction = ReguertaDialogAction(
                label = stringResource(R.string.common_action_confirm),
                onClick = {
                    onSubmit(type) {
                        pendingType = null
                    }
                },
            ),
            secondaryAction = ReguertaDialogAction(
                label = stringResource(R.string.common_action_cancel),
                onClick = { pendingType = null },
            ),
            onDismissRequest = { pendingType = null },
        )
    }
}
