package com.reguerta.user.presentation.access

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
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
