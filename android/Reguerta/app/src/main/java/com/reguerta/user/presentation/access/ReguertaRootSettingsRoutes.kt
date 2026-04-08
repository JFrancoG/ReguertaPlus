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
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
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
import com.reguerta.user.domain.shifts.ShiftPlanningRequestType
import com.reguerta.user.domain.shifts.ShiftType
import com.reguerta.user.ui.components.auth.ReguertaButton
import com.reguerta.user.ui.components.auth.ReguertaDialog
import com.reguerta.user.ui.components.auth.ReguertaDialogAction
import com.reguerta.user.ui.components.auth.ReguertaDialogType
import com.reguerta.user.ui.components.auth.ReguertaFlatButton
import java.time.DayOfWeek
import java.time.Instant
import java.time.ZoneId
import java.time.format.TextStyle
import java.util.Locale

@Composable
fun SettingsRoute(
    currentMember: Member?,
    authenticatedMember: Member?,
    members: List<Member>,
    shifts: List<ShiftAssignment>,
    deliveryCalendarOverrides: List<DeliveryCalendarOverride>,
    defaultDeliveryDayOfWeek: DeliveryWeekday?,
    isLoadingDeliveryCalendar: Boolean,
    isSavingDeliveryCalendar: Boolean,
    isSubmittingShiftPlanningRequest: Boolean,
    isDevelopImpersonationEnabled: Boolean,
    onImpersonateMember: (String) -> Unit,
    onClearImpersonation: () -> Unit,
    onRefreshDeliveryCalendar: () -> Unit,
    onSaveDeliveryCalendarOverride: (String, DeliveryWeekday, String, onSuccess: () -> Unit) -> Unit,
    onDeleteDeliveryCalendarOverride: (String, onSuccess: () -> Unit) -> Unit,
    onSubmitShiftPlanningRequest: (ShiftPlanningRequestType, onSuccess: () -> Unit) -> Unit,
) {
    var isImpersonationExpanded by rememberSaveable { mutableStateOf(false) }
    Card {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(
                text = "Ajustes",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
            )
            Text(
                text = "La impersonacion solo aparece en develop para probar flujos con otros socios sin salir de tu sesion real.",
                style = MaterialTheme.typography.bodyMedium,
            )
            if (isDevelopImpersonationEnabled && currentMember != null && authenticatedMember != null) {
                val isImpersonating = currentMember.id != authenticatedMember.id
                Text(
                    text = "Cuenta real: ${authenticatedMember.displayName}",
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Medium,
                )
                Text(
                    text = if (isImpersonating) {
                        "Viendo la app como: ${currentMember.displayName}"
                    } else {
                        "Ahora mismo estas usando tu propio perfil."
                    },
                    style = MaterialTheme.typography.bodyMedium,
                )
                if (isImpersonating) {
                    ReguertaFlatButton(
                        label = "Volver a mi perfil real",
                        onClick = onClearImpersonation,
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
                HorizontalDivider()
                Text(
                    text = "Impersonacion develop",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold,
                )
                ReguertaFlatButton(
                    label = if (isImpersonationExpanded) {
                        "Ocultar socios"
                    } else {
                        "Elegir socio"
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
            }
            if (currentMember?.isAdmin == true) {
                HorizontalDivider()
                AdminDeliveryCalendarSection(
                    currentMember = currentMember,
                    shifts = shifts,
                    overrides = deliveryCalendarOverrides,
                    defaultDeliveryDayOfWeek = defaultDeliveryDayOfWeek,
                    isLoading = isLoadingDeliveryCalendar,
                    isSaving = isSavingDeliveryCalendar,
                    onRefresh = onRefreshDeliveryCalendar,
                    onSaveOverride = onSaveDeliveryCalendarOverride,
                    onDeleteOverride = onDeleteDeliveryCalendarOverride,
                )
                HorizontalDivider()
                AdminShiftPlanningSection(
                    isSubmitting = isSubmittingShiftPlanningRequest,
                    onSubmit = onSubmitShiftPlanningRequest,
                )
            }
        }
    }
}

@Composable
private fun AdminDeliveryCalendarSection(
    currentMember: Member,
    shifts: List<ShiftAssignment>,
    overrides: List<DeliveryCalendarOverride>,
    defaultDeliveryDayOfWeek: DeliveryWeekday?,
    isLoading: Boolean,
    isSaving: Boolean,
    onRefresh: () -> Unit,
    onSaveOverride: (String, DeliveryWeekday, String, onSuccess: () -> Unit) -> Unit,
    onDeleteOverride: (String, onSuccess: () -> Unit) -> Unit,
) {
    val futureWeeks = remember(shifts, overrides) {
        shifts.filter { it.type == ShiftType.DELIVERY && it.effectiveDateMillis(overrides) > System.currentTimeMillis() }
            .sortedBy { it.effectiveDateMillis(overrides) }
            .distinctBy { it.dateMillis.toWeekKey() }
    }
    var isPickerVisible by rememberSaveable { mutableStateOf(false) }
    var selectedWeekKey by rememberSaveable { mutableStateOf<String?>(null) }
    Text(
        text = "Calendario de reparto",
        style = MaterialTheme.typography.titleSmall,
        fontWeight = FontWeight.SemiBold,
    )
    Text(
        text = "Gestiona excepciones por semana. Si quitas una excepcion, esa semana vuelve al dia por defecto del calendario.",
        style = MaterialTheme.typography.bodyMedium,
    )
    Text(
        text = "Dia por defecto: ${defaultDeliveryDayOfWeek?.toLocalizedLabel() ?: "sin configurar"}",
        style = MaterialTheme.typography.bodyMedium,
        fontWeight = FontWeight.Medium,
    )
    if (isLoading) {
        Text(
            text = "Cargando calendario...",
            style = MaterialTheme.typography.bodyMedium,
        )
    } else if (futureWeeks.isEmpty()) {
        Text(
            text = "No hay semanas de reparto futuras en los turnos cargados.",
            style = MaterialTheme.typography.bodyMedium,
        )
    } else {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(onClick = { isPickerVisible = true }) {
                Text("Cambiar dia de reparto")
            }
            TextButton(onClick = onRefresh) {
                Text("Recargar")
            }
        }
        Text(
            text = "Primero eliges la semana a cambiar y despues editas solo esa excepcion.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        if (isPickerVisible) {
            DeliveryCalendarWeekPickerDialog(
                futureWeeks = futureWeeks,
                overrides = overrides,
                onDismiss = { isPickerVisible = false },
                onSelectWeek = { weekKey ->
                    selectedWeekKey = weekKey
                    isPickerVisible = false
                },
            )
        }
        selectedWeekKey?.let { weekKey ->
            val selectedShift = futureWeeks.firstOrNull { it.dateMillis.toWeekKey() == weekKey }
            if (selectedShift != null) {
                DeliveryCalendarOverrideDialog(
                    currentMember = currentMember,
                    selectedShift = selectedShift,
                    override = overrides.firstOrNull { it.weekKey == weekKey },
                    defaultDeliveryDayOfWeek = defaultDeliveryDayOfWeek ?: DeliveryWeekday.WEDNESDAY,
                    isSaving = isSaving,
                    onDismiss = { selectedWeekKey = null },
                    onSaveOverride = onSaveOverride,
                    onDeleteOverride = onDeleteOverride,
                )
            } else {
                selectedWeekKey = null
            }
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
        text = "Planificacion de turnos",
        style = MaterialTheme.typography.titleSmall,
        fontWeight = FontWeight.SemiBold,
    )
    Text(
        text = "Genera una temporada nueva con socios activos, escribe la hoja nueva y manda una notificacion a los socios asignados.",
        style = MaterialTheme.typography.bodyMedium,
    )
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Button(
            onClick = { pendingType = ShiftPlanningRequestType.DELIVERY },
            enabled = !isSubmitting,
        ) {
            Text("Generar reparto")
        }
        Button(
            onClick = { pendingType = ShiftPlanningRequestType.MARKET },
            enabled = !isSubmitting,
        ) {
            Text("Generar mercado")
        }
    }
    if (isSubmitting) {
        Text(
            text = "Enviando solicitud de planificacion...",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }

    pendingType?.let { type ->
        val readableType = if (type == ShiftPlanningRequestType.DELIVERY) {
            "reparto"
        } else {
            "mercado"
        }
        ReguertaDialog(
            type = ReguertaDialogType.INFO,
            title = "Generar turnos de $readableType",
            message = "Se creara una planificacion nueva con socios activos, se escribira en la sheet de la temporada siguiente y se notificara a los socios asignados. Si vuelves a lanzarlo, se regenerara esa temporada.",
            primaryAction = ReguertaDialogAction(
                label = "Confirmar",
                onClick = {
                    onSubmit(type) {
                        pendingType = null
                    }
                },
            ),
            secondaryAction = ReguertaDialogAction(
                label = "Cancelar",
                onClick = { pendingType = null },
            ),
            onDismissRequest = { pendingType = null },
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DeliveryCalendarWeekPickerDialog(
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
private fun DeliveryCalendarOverrideDialog(
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
        java.time.DayOfWeek.MONDAY -> DeliveryWeekday.MONDAY
        java.time.DayOfWeek.TUESDAY -> DeliveryWeekday.TUESDAY
        java.time.DayOfWeek.WEDNESDAY -> DeliveryWeekday.WEDNESDAY
        java.time.DayOfWeek.THURSDAY -> DeliveryWeekday.THURSDAY
        java.time.DayOfWeek.FRIDAY -> DeliveryWeekday.FRIDAY
        java.time.DayOfWeek.SATURDAY -> DeliveryWeekday.SATURDAY
        java.time.DayOfWeek.SUNDAY -> DeliveryWeekday.SUNDAY
    }

private fun DeliveryWeekday.toLocalizedLabel(): String {
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
