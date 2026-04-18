package com.reguerta.user.presentation.access

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material3.Card
import androidx.compose.material3.Checkbox
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.reguerta.user.R
import com.reguerta.user.domain.access.Member
import com.reguerta.user.domain.access.MemberRole
import com.reguerta.user.domain.access.canManageMembers
import com.reguerta.user.ui.components.auth.ReguertaButton
import com.reguerta.user.ui.components.auth.ReguertaButtonVariant
import com.reguerta.user.ui.components.auth.ReguertaDialog
import com.reguerta.user.ui.components.auth.ReguertaDialogAction
import com.reguerta.user.ui.components.auth.ReguertaDialogType

@Composable
internal fun UsersRoute(
    currentMember: Member?,
    members: List<Member>,
    draft: MemberDraft,
    onDraftChanged: (MemberDraft) -> Unit,
    onSaveMemberDraft: (String?, onSuccess: () -> Unit) -> Unit,
    onRefreshMembers: () -> Unit,
    onToggleActive: (String) -> Unit,
) {
    val canManageMembers = currentMember?.canManageMembers == true
    val sortedMembers = remember(members) { members.sortedBy { it.displayName.lowercase() } }
    var isEditorOpen by rememberSaveable { mutableStateOf(false) }
    var editingMemberId by rememberSaveable { mutableStateOf<String?>(null) }
    var pendingToggleActiveMemberId by rememberSaveable { mutableStateOf<String?>(null) }

    if (isEditorOpen && canManageMembers) {
        UsersEditorCard(
            draft = draft,
            editingMember = sortedMembers.firstOrNull { it.id == editingMemberId },
            onDraftChanged = onDraftChanged,
            onSave = {
                onSaveMemberDraft(editingMemberId) {
                    isEditorOpen = false
                    editingMemberId = null
                }
            },
            onBack = {
                isEditorOpen = false
                editingMemberId = null
                onDraftChanged(MemberDraft())
            },
        )
    } else {
        Box(modifier = Modifier.fillMaxSize()) {
            Column(
                modifier = Modifier.fillMaxSize(),
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f)
                        .verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(16.dp),
                ) {
                    Card {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(16.dp),
                            verticalArrangement = Arrangement.spacedBy(10.dp),
                        ) {
                            Text(
                                text = stringResource(R.string.users_list_title),
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.SemiBold,
                            )
                            ReguertaButton(
                                label = stringResource(R.string.users_list_action_reload),
                                variant = ReguertaButtonVariant.TEXT,
                                fullWidth = false,
                                onClick = onRefreshMembers,
                            )
                        }
                    }

                    if (sortedMembers.isEmpty()) {
                        Card {
                            Text(
                                text = stringResource(R.string.users_list_empty_state),
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(16.dp),
                            )
                        }
                    } else {
                        sortedMembers.forEach { listedMember ->
                            UserListItem(
                                member = listedMember,
                                showAdminActions = canManageMembers,
                                onEdit = {
                                    editingMemberId = listedMember.id
                                    onDraftChanged(listedMember.toDraft())
                                    isEditorOpen = true
                                },
                                onToggleActive = {
                                    pendingToggleActiveMemberId = listedMember.id
                                },
                            )
                        }
                    }

                    if (canManageMembers) {
                        Spacer(modifier = Modifier.height(104.dp))
                    }
                }
            }

            if (canManageMembers) {
                ReguertaButton(
                    label = stringResource(R.string.users_create_action),
                    variant = ReguertaButtonVariant.PRIMARY,
                    modifier = Modifier
                        .fillMaxWidth()
                        .navigationBarsPadding()
                        .align(Alignment.BottomCenter),
                    onClick = {
                        editingMemberId = null
                        onDraftChanged(MemberDraft())
                        isEditorOpen = true
                    },
                )
            }
        }
    }

    pendingToggleActiveMemberId?.let { memberId ->
        val target = sortedMembers.firstOrNull { it.id == memberId }
        if (target != null) {
            val isDeactivateAction = target.isActive
            ReguertaDialog(
                type = if (isDeactivateAction) ReguertaDialogType.ERROR else ReguertaDialogType.INFO,
                title = stringResource(
                    if (isDeactivateAction) {
                        R.string.users_toggle_active_dialog_title_deactivate
                    } else {
                        R.string.users_toggle_active_dialog_title_activate
                    },
                ),
                message = stringResource(
                    if (isDeactivateAction) {
                        R.string.users_toggle_active_dialog_message_deactivate
                    } else {
                        R.string.users_toggle_active_dialog_message_activate
                    },
                    target.displayName,
                ),
                primaryAction = ReguertaDialogAction(
                    label = stringResource(R.string.common_action_accept),
                    onClick = {
                        onToggleActive(memberId)
                        pendingToggleActiveMemberId = null
                    },
                ),
                secondaryAction = ReguertaDialogAction(
                    label = stringResource(R.string.common_action_cancel),
                    onClick = {
                        pendingToggleActiveMemberId = null
                    },
                ),
                onDismissRequest = {
                    pendingToggleActiveMemberId = null
                },
            )
        } else {
            pendingToggleActiveMemberId = null
        }
    }
}

@Composable
private fun UsersEditorCard(
    draft: MemberDraft,
    editingMember: Member?,
    onDraftChanged: (MemberDraft) -> Unit,
    onSave: () -> Unit,
    onBack: () -> Unit,
) {
    Card {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(
                text = stringResource(
                    if (editingMember == null) {
                        R.string.users_editor_title_create
                    } else {
                        R.string.users_editor_title_edit
                    },
                ),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
            )

            if (editingMember == null) {
                OutlinedTextField(
                    value = draft.email,
                    onValueChange = { onDraftChanged(draft.copy(email = it)) },
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text(stringResource(R.string.common_input_email_label)) },
                    singleLine = true,
                )
            } else {
                Text(
                    text = editingMember.normalizedEmail,
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Medium,
                )
            }

            OutlinedTextField(
                value = draft.displayName,
                onValueChange = { onDraftChanged(draft.copy(displayName = it)) },
                modifier = Modifier.fillMaxWidth(),
                label = { Text(stringResource(R.string.admin_input_display_name_label)) },
                singleLine = true,
            )

            OutlinedTextField(
                value = draft.phoneNumber,
                onValueChange = { onDraftChanged(draft.copy(phoneNumber = it)) },
                modifier = Modifier.fillMaxWidth(),
                label = { Text(stringResource(R.string.users_editor_phone_label)) },
                singleLine = true,
            )

            CommonPurchaseManagerSwitchRow(
                checked = draft.isCommonPurchaseManager,
                label = stringResource(R.string.users_editor_common_purchase_manager_label),
                onCheckedChange = { onDraftChanged(draft.copy(isCommonPurchaseManager = it)) },
            )

            RoleCheckboxRow(
                checked = draft.isProducer,
                label = stringResource(R.string.role_producer),
                onCheckedChange = {
                    onDraftChanged(
                        draft.copy(
                            isProducer = it,
                            companyName = if (it) draft.companyName else "",
                        ),
                    )
                },
            )

            if (draft.isProducer) {
                OutlinedTextField(
                    value = draft.companyName,
                    onValueChange = { onDraftChanged(draft.copy(companyName = it)) },
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text(stringResource(R.string.users_editor_company_name_label)) },
                    singleLine = true,
                )
            }

            RoleCheckboxRow(
                checked = draft.isAdmin,
                label = stringResource(R.string.role_admin),
                onCheckedChange = { onDraftChanged(draft.copy(isAdmin = it)) },
            )

            ReguertaButton(
                label = stringResource(
                    if (editingMember == null) {
                        R.string.users_editor_save_action_create
                    } else {
                        R.string.users_editor_save_action_update
                    },
                ),
                variant = ReguertaButtonVariant.PRIMARY,
                onClick = onSave,
            )
            ReguertaButton(
                label = stringResource(R.string.common_action_back),
                variant = ReguertaButtonVariant.SECONDARY,
                onClick = onBack,
            )
        }
    }
}

@Composable
private fun UserListItem(
    member: Member,
    showAdminActions: Boolean,
    onEdit: () -> Unit,
    onToggleActive: () -> Unit,
) {
    Card {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text(
                text = member.displayName,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
            )
            Text(
                text = member.normalizedEmail,
                style = MaterialTheme.typography.bodyMedium,
            )

            if (member.roles.contains(MemberRole.PRODUCER)) {
                val companyName = member.companyName?.takeIf { it.isNotBlank() }
                    ?: stringResource(R.string.users_card_company_name_missing)
                val producerLine = stringResource(R.string.users_card_producer_company_format, companyName)
                Text(
                    text = producerLine,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            if (member.roles.contains(MemberRole.ADMIN)) {
                Text(
                    text = stringResource(R.string.users_card_admin_label),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            if (showAdminActions) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    IconButton(onClick = onEdit) {
                        Icon(
                            imageVector = Icons.Default.Edit,
                            contentDescription = stringResource(R.string.users_card_action_edit),
                        )
                    }
                    IconButton(onClick = onToggleActive) {
                        Icon(
                            imageVector = Icons.Default.Delete,
                            contentDescription = stringResource(
                                if (member.isActive) {
                                    R.string.admin_action_deactivate
                                } else {
                                    R.string.admin_action_activate
                                },
                            ),
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun RoleCheckboxRow(
    checked: Boolean,
    label: String,
    onCheckedChange: (Boolean) -> Unit,
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Checkbox(checked = checked, onCheckedChange = onCheckedChange)
        Text(label)
    }
}

@Composable
private fun CommonPurchaseManagerSwitchRow(
    checked: Boolean,
    label: String,
    onCheckedChange: (Boolean) -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text(
            text = label,
            modifier = Modifier.weight(1f),
        )
        Switch(
            checked = checked,
            onCheckedChange = onCheckedChange,
        )
    }
}

private fun Member.toDraft(): MemberDraft {
    return MemberDraft(
        displayName = displayName,
        email = normalizedEmail,
        companyName = companyName.orEmpty(),
        phoneNumber = phoneNumber.orEmpty(),
        isMember = roles.contains(MemberRole.MEMBER),
        isProducer = roles.contains(MemberRole.PRODUCER),
        isAdmin = roles.contains(MemberRole.ADMIN),
        isCommonPurchaseManager = isCommonPurchaseManager,
        isActive = isActive,
    )
}
