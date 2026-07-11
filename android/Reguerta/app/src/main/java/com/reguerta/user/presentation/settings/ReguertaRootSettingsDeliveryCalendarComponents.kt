package com.reguerta.user.presentation.settings

import com.reguerta.user.presentation.shifts.effectiveDateMillis
import com.reguerta.user.presentation.shifts.toLocalizedDateOnly
import com.reguerta.user.presentation.shifts.toWeekKey
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ChevronLeft
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuAnchorType
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.reguerta.user.R
import com.reguerta.user.domain.access.Member
import com.reguerta.user.domain.calendar.DeliveryCalendarOverride
import com.reguerta.user.domain.calendar.DeliveryWeekday
import com.reguerta.user.domain.shifts.ShiftAssignment
import com.reguerta.user.ui.components.auth.ReguertaButton
import java.time.DayOfWeek
import java.time.Instant
import java.time.ZoneId
import java.time.format.TextStyle
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun DeliveryCalendarWeekPickerDialog(
    currentMember: Member,
    futureWeeks: List<ShiftAssignment>,
    overrides: List<DeliveryCalendarOverride>,
    defaultDeliveryDayOfWeek: DeliveryWeekday,
    isSaving: Boolean,
    onDismiss: () -> Unit,
    onSaveOverride: (String, DeliveryWeekday, String, onSuccess: () -> Unit) -> Unit,
) {
    val initialSelection = futureWeeks.firstOrNull()?.dateMillis?.toWeekKey().orEmpty()
    var selectedWeekKey by rememberSaveable(futureWeeks) { mutableStateOf(initialSelection) }
    var isMenuExpanded by rememberSaveable { mutableStateOf(false) }
    val selectedShift = futureWeeks.firstOrNull { it.dateMillis.toWeekKey() == selectedWeekKey }
    val selectedOverride = overrides.firstOrNull { it.weekKey == selectedWeekKey }
    val originalWeekday = selectedOverride?.deliveryDateMillis?.toDeliveryWeekday()
        ?: defaultDeliveryDayOfWeek
    var selectedWeekday by rememberSaveable(selectedWeekKey, originalWeekday) {
        mutableStateOf(originalWeekday)
    }

    ModalBottomSheet(
        onDismissRequest = { if (!isSaving) onDismiss() },
        dragHandle = null,
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(start = 24.dp, top = 12.dp, end = 24.dp, bottom = 24.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = stringResource(R.string.delivery_calendar_week_picker_title),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.weight(1f),
                )
                IconButton(
                    onClick = onDismiss,
                    enabled = !isSaving,
                ) {
                    Icon(
                        imageVector = Icons.Default.Close,
                        contentDescription = stringResource(R.string.common_action_close),
                    )
                }
            }
            Text(
                text = stringResource(
                    if (selectedOverride == null) {
                        R.string.delivery_calendar_week_picker_subtitle
                    } else {
                        R.string.delivery_calendar_week_picker_override_subtitle
                    },
                ),
                style = MaterialTheme.typography.bodyMedium,
            )
            ExposedDropdownMenuBox(
                expanded = isMenuExpanded,
                onExpandedChange = { isMenuExpanded = !isMenuExpanded },
            ) {
                OutlinedTextField(
                    value = selectedShift?.let {
                        "${it.dateMillis.toWeekKey()} · ${it.effectiveDateMillis(overrides).toLocalizedDateOnly()}"
                    }.orEmpty(),
                    onValueChange = {},
                    readOnly = true,
                    label = { Text(stringResource(R.string.delivery_calendar_week_picker_field_week)) },
                    trailingIcon = {
                        ExposedDropdownMenuDefaults.TrailingIcon(expanded = isMenuExpanded)
                    },
                    modifier = Modifier
                        .menuAnchor(ExposedDropdownMenuAnchorType.PrimaryNotEditable)
                        .fillMaxWidth(),
                )
                ExposedDropdownMenu(
                    expanded = isMenuExpanded,
                    onDismissRequest = { isMenuExpanded = false },
                ) {
                    futureWeeks.forEach { shift ->
                        val weekKey = shift.dateMillis.toWeekKey()
                        DropdownMenuItem(
                            text = {
                                Text("${weekKey} · ${shift.effectiveDateMillis(overrides).toLocalizedDateOnly()}")
                            },
                            onClick = {
                                selectedWeekKey = weekKey
                                isMenuExpanded = false
                            },
                        )
                    }
                }
            }
            DeliveryDayNavigationControl(
                selectedWeekday = selectedWeekday,
                isSaving = isSaving,
                onSelectedWeekdayChange = { selectedWeekday = it },
            )
            ReguertaButton(
                label = stringResource(R.string.delivery_calendar_editor_action_save_exception),
                onClick = {
                    onSaveOverride(selectedWeekKey, selectedWeekday, currentMember.id, onDismiss)
                },
                enabled = selectedWeekKey.isNotBlank() && selectedWeekday != originalWeekday && !isSaving,
                loading = isSaving,
                fullWidth = true,
            )
        }
    }
}

@Composable
private fun DeliveryDayNavigationControl(
    selectedWeekday: DeliveryWeekday,
    isSaving: Boolean,
    onSelectedWeekdayChange: (DeliveryWeekday) -> Unit,
) {
    val canGoPrevious = selectedWeekday != DeliveryWeekday.MONDAY && !isSaving
    val canGoNext = selectedWeekday != DeliveryWeekday.SUNDAY && !isSaving

    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        DeliveryDayNavigationButton(
            imageVector = Icons.Filled.ChevronLeft,
            enabled = canGoPrevious,
            contentDescription = stringResource(R.string.delivery_calendar_editor_action_previous),
            onClick = {
                DeliveryWeekday.entries
                    .getOrNull(selectedWeekday.ordinal - 1)
                    ?.let(onSelectedWeekdayChange)
            },
        )
        Surface(
            modifier = Modifier.weight(1f),
            shape = RoundedCornerShape(50),
            color = MaterialTheme.colorScheme.surfaceVariant,
            tonalElevation = 8.dp,
            shadowElevation = 3.dp,
            border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.80f)),
        ) {
            Box(
                modifier = Modifier.defaultMinSize(minHeight = 46.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = selectedWeekday.toLocalizedLabel(),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.primary,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.padding(horizontal = 12.dp),
                )
            }
        }
        DeliveryDayNavigationButton(
            imageVector = Icons.Filled.ChevronRight,
            enabled = canGoNext,
            contentDescription = stringResource(R.string.delivery_calendar_editor_action_next),
            onClick = {
                DeliveryWeekday.entries
                    .getOrNull(selectedWeekday.ordinal + 1)
                    ?.let(onSelectedWeekdayChange)
            },
        )
    }
}

@Composable
private fun DeliveryDayNavigationButton(
    imageVector: androidx.compose.ui.graphics.vector.ImageVector,
    enabled: Boolean,
    contentDescription: String,
    onClick: () -> Unit,
) {
    Surface(
        shape = CircleShape,
        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = if (enabled) 1f else 0.45f),
        tonalElevation = if (enabled) 8.dp else 0.dp,
        shadowElevation = if (enabled) 3.dp else 0.dp,
        border = BorderStroke(
            1.dp,
            MaterialTheme.colorScheme.outline.copy(alpha = if (enabled) 0.80f else 0.35f),
        ),
    ) {
        IconButton(
            onClick = onClick,
            enabled = enabled,
            modifier = Modifier.size(46.dp),
        ) {
            Icon(
                imageVector = imageVector,
                contentDescription = contentDescription,
                tint = if (enabled) {
                    MaterialTheme.colorScheme.primary
                } else {
                    MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.48f)
                },
            )
        }
    }
}

private fun Long.toDeliveryWeekday(): DeliveryWeekday =
    when (Instant.ofEpochMilli(this).atZone(ZoneId.systemDefault()).toLocalDate().dayOfWeek) {
        DayOfWeek.MONDAY -> DeliveryWeekday.MONDAY
        DayOfWeek.TUESDAY -> DeliveryWeekday.TUESDAY
        DayOfWeek.WEDNESDAY -> DeliveryWeekday.WEDNESDAY
        DayOfWeek.THURSDAY -> DeliveryWeekday.THURSDAY
        DayOfWeek.FRIDAY -> DeliveryWeekday.FRIDAY
        DayOfWeek.SATURDAY -> DeliveryWeekday.SATURDAY
        DayOfWeek.SUNDAY -> DeliveryWeekday.SUNDAY
    }

internal fun DeliveryWeekday.toLocalizedLabel(): String {
    val locale = Locale.getDefault()
    val dayOfWeek = when (this) {
        DeliveryWeekday.MONDAY -> DayOfWeek.MONDAY
        DeliveryWeekday.TUESDAY -> DayOfWeek.TUESDAY
        DeliveryWeekday.WEDNESDAY -> DayOfWeek.WEDNESDAY
        DeliveryWeekday.THURSDAY -> DayOfWeek.THURSDAY
        DeliveryWeekday.FRIDAY -> DayOfWeek.FRIDAY
        DeliveryWeekday.SATURDAY -> DayOfWeek.SATURDAY
        DeliveryWeekday.SUNDAY -> DayOfWeek.SUNDAY
    }
    return dayOfWeek.getDisplayName(TextStyle.FULL, locale).toTitleCase(locale)
}

private fun String.toTitleCase(locale: Locale): String =
    replaceFirstChar { if (it.isLowerCase()) it.titlecase(locale) else it.toString() }
