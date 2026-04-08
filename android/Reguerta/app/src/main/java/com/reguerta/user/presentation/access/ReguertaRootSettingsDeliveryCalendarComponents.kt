package com.reguerta.user.presentation.access

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuAnchorType
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.reguerta.user.domain.access.Member
import com.reguerta.user.domain.calendar.DeliveryCalendarOverride
import com.reguerta.user.domain.calendar.DeliveryWeekday
import com.reguerta.user.domain.shifts.ShiftAssignment
import com.reguerta.user.ui.components.auth.ReguertaButton
import com.reguerta.user.ui.components.auth.ReguertaFlatButton
import java.time.DayOfWeek
import java.time.Instant
import java.time.ZoneId
import java.time.format.TextStyle
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun DeliveryCalendarWeekPickerDialog(
    futureWeeks: List<ShiftAssignment>,
    overrides: List<DeliveryCalendarOverride>,
    onDismiss: () -> Unit,
    onSelectWeek: (String) -> Unit,
) {
    val initialSelection = futureWeeks.firstOrNull()?.dateMillis?.toWeekKey().orEmpty()
    var selectedWeekKey by rememberSaveable(futureWeeks) { mutableStateOf(initialSelection) }
    var isMenuExpanded by rememberSaveable { mutableStateOf(false) }
    val selectedShift = futureWeeks.firstOrNull { it.dateMillis.toWeekKey() == selectedWeekKey }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 24.dp, vertical = 12.dp)
                .navigationBarsPadding()
                .imePadding(),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Text(
                text = "Elegir semana",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
            )
            Text(
                text = "Selecciona un dia de reparto futuro con encargado.",
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
                    label = { Text("Semana de reparto") },
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
            selectedShift?.let { shift ->
                Card {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(6.dp),
                    ) {
                        Text(
                            text = shift.dateMillis.toWeekKey(),
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.SemiBold,
                        )
                        Text(
                            text = shift.effectiveDateMillis(overrides).toLocalizedDateOnly(),
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.End,
            ) {
                TextButton(onClick = onDismiss) {
                    Text("Cerrar")
                }
                Button(
                    onClick = { onSelectWeek(selectedWeekKey) },
                    enabled = selectedWeekKey.isNotBlank(),
                ) {
                    Text("Elegir")
                }
            }
        }
    }
}

@Composable
internal fun DeliveryCalendarOverrideDialog(
    currentMember: Member,
    selectedShift: ShiftAssignment,
    override: DeliveryCalendarOverride?,
    defaultDeliveryDayOfWeek: DeliveryWeekday,
    isSaving: Boolean,
    onDismiss: () -> Unit,
    onSaveOverride: (String, DeliveryWeekday, String, onSuccess: () -> Unit) -> Unit,
    onDeleteOverride: (String, onSuccess: () -> Unit) -> Unit,
) {
    val weekKey = selectedShift.dateMillis.toWeekKey()
    var selectedWeekday by rememberSaveable(weekKey, override?.deliveryDateMillis) {
        mutableStateOf(override?.deliveryDateMillis?.toDeliveryWeekday() ?: defaultDeliveryDayOfWeek)
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text(
                text = "Cambiar dia de reparto",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
            )
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(
                    text = weekKey,
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = FontWeight.SemiBold,
                )
                Text(
                    text = (override?.deliveryDateMillis ?: selectedShift.dateMillis).toLocalizedDateOnly(),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Card {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(12.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        Text(
                            text = if (override != null) {
                                "Excepcion activa: ${override.deliveryDateMillis.toLocalizedDateOnly()}"
                            } else {
                                "Sin excepcion. Aplica el dia por defecto."
                            },
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            ReguertaFlatButton(
                                label = "Anterior",
                                onClick = { selectedWeekday = selectedWeekday.previous() },
                                enabled = !isSaving,
                            )
                            Text(
                                text = selectedWeekday.toLocalizedLabel(),
                                style = MaterialTheme.typography.bodyMedium,
                                fontWeight = FontWeight.Medium,
                                modifier = Modifier.align(Alignment.CenterVertically),
                            )
                            ReguertaFlatButton(
                                label = "Siguiente",
                                onClick = { selectedWeekday = selectedWeekday.next() },
                                enabled = !isSaving,
                            )
                        }
                        ReguertaButton(
                            label = "Guardar excepcion",
                            onClick = {
                                onSaveOverride(weekKey, selectedWeekday, currentMember.id, onDismiss)
                            },
                            enabled = !isSaving,
                            loading = isSaving,
                            fullWidth = true,
                        )
                        if (override != null) {
                            ReguertaFlatButton(
                                label = "Quitar excepcion",
                                onClick = { onDeleteOverride(weekKey, onDismiss) },
                                modifier = Modifier.fillMaxWidth(),
                                enabled = !isSaving,
                            )
                        }
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) {
                Text("Cerrar")
            }
        },
    )
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

private fun DeliveryWeekday.previous(): DeliveryWeekday =
    DeliveryWeekday.entries[(ordinal + DeliveryWeekday.entries.size - 1) % DeliveryWeekday.entries.size]

private fun DeliveryWeekday.next(): DeliveryWeekday =
    DeliveryWeekday.entries[(ordinal + 1) % DeliveryWeekday.entries.size]
