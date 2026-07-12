package com.reguerta.user.presentation.users

import com.reguerta.user.presentation.root.MemberDraft

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.reguerta.user.R
import com.reguerta.user.domain.access.Member
import com.reguerta.user.domain.access.MemberRole
import com.reguerta.user.domain.access.canManageMembers
import com.reguerta.user.ui.components.auth.ReguertaButton
import com.reguerta.user.ui.components.auth.ReguertaButtonVariant
import com.reguerta.user.ui.components.auth.ReguertaDeleteListActionButton
import com.reguerta.user.ui.components.auth.ReguertaDialog
import com.reguerta.user.ui.components.auth.ReguertaDialogAction
import com.reguerta.user.ui.components.auth.ReguertaDialogType
import com.reguerta.user.ui.components.auth.ReguertaEditListActionButton
import com.reguerta.user.ui.components.auth.ReguertaFloatingActionButton
import com.reguerta.user.ui.components.auth.ReguertaInputField
import com.reguerta.user.ui.components.auth.ReguertaListItemCard
import kotlinx.coroutines.delay

internal fun usersEditorTitleRes(isEditorOpen: Boolean, editingMemberId: String?): Int =
    when {
        !isEditorOpen -> R.string.users_list_title
        editingMemberId == null -> R.string.users_editor_title_create
        else -> R.string.users_editor_title_edit
    }

internal fun MemberDraft.withProducerSelection(isSelected: Boolean): MemberDraft =
    if (isSelected) {
        copy(isProducer = true)
    } else {
        copy(
            isProducer = false,
            isCommonPurchaseManager = false,
            companyName = "",
        )
    }

internal fun MemberDraft.withCommonPurchaseManagerSelection(
    isSelected: Boolean,
    commonPurchasesCompanyName: String,
): MemberDraft =
    if (isSelected) {
        copy(
            isCommonPurchaseManager = true,
            isProducer = true,
            companyName = commonPurchasesCompanyName,
        )
    } else {
        copy(isCommonPurchaseManager = false)
    }

@Composable
internal fun UsersRoute(
    currentMember: Member?,
    members: List<Member>,
    draft: MemberDraft,
    isEditorOpen: Boolean,
    editingMemberId: String?,
    onDraftChanged: (MemberDraft) -> Unit,
    onEditorStateChanged: (isOpen: Boolean, editingMemberId: String?) -> Unit,
    onSaveMemberDraft: (String?, onSuccess: (String) -> Unit) -> Unit,
    onRefreshMembers: () -> Unit,
    onToggleActive: (String) -> Unit,
) {
    val canManageMembers = currentMember?.canManageMembers == true
    val sortedMembers = remember(members) { members.sortedBy { it.displayName.lowercase() } }
    val commonPurchasesCompanyName = stringResource(R.string.users_editor_common_purchase_company_name)
    var pendingToggleActiveMemberId by rememberSaveable { mutableStateOf<String?>(null) }
    var highlightedMemberId by rememberSaveable { mutableStateOf<String?>(null) }

    LaunchedEffect(highlightedMemberId) {
        val memberId = highlightedMemberId ?: return@LaunchedEffect
        delay(1_600)
        if (highlightedMemberId == memberId) {
            highlightedMemberId = null
        }
    }

    if (isEditorOpen && canManageMembers) {
        UsersEditorForm(
            draft = draft,
            editingMember = sortedMembers.firstOrNull { it.id == editingMemberId },
            onDraftChanged = onDraftChanged,
            onSave = {
                onSaveMemberDraft(editingMemberId) { savedMemberId ->
                    highlightedMemberId = savedMemberId
                    onEditorStateChanged(false, null)
                }
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
                                isHighlighted = highlightedMemberId == listedMember.id,
                                onEdit = {
                                    val editingDraft = listedMember.toDraft().let { memberDraft ->
                                        if (memberDraft.isCommonPurchaseManager) {
                                            memberDraft.withCommonPurchaseManagerSelection(
                                                isSelected = true,
                                                commonPurchasesCompanyName = commonPurchasesCompanyName,
                                            )
                                        } else {
                                            memberDraft
                                        }
                                    }
                                    onDraftChanged(editingDraft)
                                    onEditorStateChanged(true, listedMember.id)
                                },
                                onToggleActive = {
                                    pendingToggleActiveMemberId = listedMember.id
                                },
                            )
                        }
                    }

                    if (canManageMembers) {
                        Spacer(modifier = Modifier.height(128.dp))
                    }
                }
            }

            if (canManageMembers) {
                ReguertaFloatingActionButton(
                    label = stringResource(R.string.users_create_action),
                    modifier = Modifier
                        .align(Alignment.BottomCenter),
                    onClick = {
                        onDraftChanged(MemberDraft())
                        onEditorStateChanged(true, null)
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
                        highlightedMemberId = memberId
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
private fun UsersEditorForm(
    draft: MemberDraft,
    editingMember: Member?,
    onDraftChanged: (MemberDraft) -> Unit,
    onSave: () -> Unit,
) {
    val focusManager = LocalFocusManager.current
    val commonPurchasesCompanyName = stringResource(R.string.users_editor_common_purchase_company_name)

    Column(modifier = Modifier.fillMaxSize()) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .weight(1f)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(20.dp),
        ) {
            ReguertaInputField(
                label = stringResource(R.string.common_input_email_label),
                value = draft.email,
                onValueChange = { onDraftChanged(draft.copy(email = it)) },
                readOnly = editingMember != null,
                keyboardType = KeyboardType.Email,
                showClearAction = editingMember == null,
            )

            ReguertaInputField(
                label = stringResource(R.string.admin_input_display_name_label),
                value = draft.displayName,
                onValueChange = { onDraftChanged(draft.copy(displayName = it)) },
                showClearAction = true,
            )

            ReguertaInputField(
                label = stringResource(R.string.users_editor_phone_label),
                value = draft.phoneNumber,
                onValueChange = { onDraftChanged(draft.copy(phoneNumber = it)) },
                keyboardType = KeyboardType.Phone,
                showClearAction = true,
            )

            if (draft.isProducer) {
                ReguertaInputField(
                    label = stringResource(R.string.users_editor_company_name_label),
                    value = draft.companyName,
                    onValueChange = { onDraftChanged(draft.copy(companyName = it)) },
                    readOnly = draft.isCommonPurchaseManager,
                    showClearAction = !draft.isCommonPurchaseManager,
                )
            }

            RoleSwitchRow(
                checked = draft.isCommonPurchaseManager,
                label = stringResource(R.string.users_editor_common_purchase_manager_label),
                onCheckedChange = {
                    onDraftChanged(
                        draft.withCommonPurchaseManagerSelection(
                            isSelected = it,
                            commonPurchasesCompanyName = commonPurchasesCompanyName,
                        ),
                    )
                },
            )

            RoleSwitchRow(
                checked = draft.isProducer,
                label = stringResource(R.string.role_producer),
                onCheckedChange = { onDraftChanged(draft.withProducerSelection(it)) },
            )

            RoleSwitchRow(
                checked = draft.isAdmin,
                label = stringResource(R.string.role_admin),
                onCheckedChange = { onDraftChanged(draft.copy(isAdmin = it)) },
            )
        }

        ReguertaButton(
            label = stringResource(
                if (editingMember == null) {
                    R.string.users_editor_save_action_create
                } else {
                    R.string.users_editor_save_action_update
                },
            ),
            modifier = Modifier.padding(top = 20.dp, bottom = 32.dp),
            variant = ReguertaButtonVariant.PRIMARY,
            onClick = {
                focusManager.clearFocus(force = true)
                onSave()
            },
        )
    }
}

@Composable
private fun UserListItem(
    member: Member,
    showAdminActions: Boolean,
    isHighlighted: Boolean,
    onEdit: () -> Unit,
    onToggleActive: () -> Unit,
) {
    ReguertaListItemCard(isHighlighted = isHighlighted) {
        Column(
            modifier = Modifier.fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Text(
                text = member.displayName,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onSurface,
            )
            Text(
                text = member.normalizedEmail,
                style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Normal),
                color = MaterialTheme.colorScheme.onSurface,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )

            if (member.roles.contains(MemberRole.PRODUCER)) {
                val companyName = member.companyName?.takeIf { it.isNotBlank() }
                    ?: stringResource(R.string.users_card_company_name_missing)
                val producerLine = stringResource(R.string.users_card_producer_company_format, companyName)
                Text(
                    text = producerLine,
                    style = MaterialTheme.typography.titleMedium.copy(
                        fontWeight = FontWeight.Normal,
                        fontStyle = FontStyle.Italic,
                    ),
                    color = MaterialTheme.colorScheme.onSurface,
                )
            }

            if (member.roles.contains(MemberRole.ADMIN)) {
                Text(
                    text = stringResource(R.string.users_card_admin_label),
                    style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Normal),
                    color = MaterialTheme.colorScheme.onSurface,
                )
            }

            if (showAdminActions) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    ReguertaEditListActionButton(
                        contentDescription = stringResource(R.string.users_card_action_edit),
                        onClick = onEdit,
                    )
                    Spacer(modifier = Modifier.size(8.dp))
                    ReguertaDeleteListActionButton(
                        contentDescription = stringResource(
                            if (member.isActive) {
                                R.string.admin_action_deactivate
                            } else {
                                R.string.admin_action_activate
                            },
                        ),
                        onClick = onToggleActive,
                    )
                }
            }
        }
    }
}

@Composable
private fun RoleSwitchRow(
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
