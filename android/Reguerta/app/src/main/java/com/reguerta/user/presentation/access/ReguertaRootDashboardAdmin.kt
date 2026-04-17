package com.reguerta.user.presentation.access

import android.content.Context
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ExpandLess
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.Checkbox
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.reguerta.user.R
import com.reguerta.user.domain.access.Member
import com.reguerta.user.domain.access.MemberRole
import com.reguerta.user.domain.access.UnauthorizedReason
import com.reguerta.user.domain.access.canManageProductCatalog

@Composable
internal fun UnauthorizedCard(
    mode: SessionMode.Unauthorized,
    onSignOut: () -> Unit,
) {
    Card {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text(
                stringResource(R.string.auth_error_member_unauthorized),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
            )
            Text(
                stringResource(R.string.auth_info_member_unauthorized_explanation),
                style = MaterialTheme.typography.bodyMedium,
            )
            Text(stringResource(R.string.access_signed_in_email_format, mode.email))
            Text(stringResource(R.string.auth_info_member_restricted_mode))
            Text(
                stringResource(R.string.auth_info_member_contact_admin),
                style = MaterialTheme.typography.bodySmall,
            )
            Text(
                stringResource(R.string.common_reason_format, stringResource(mode.reason.toMessageResId())),
                style = MaterialTheme.typography.bodySmall,
            )
            Button(
                onClick = onSignOut,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text(stringResource(R.string.access_action_sign_out))
            }
        }
    }
}

@Composable
internal fun AuthorizedHome(
    mode: SessionMode.Authorized,
    myOrderFreshnessState: MyOrderFreshnessUiState,
    draft: MemberDraft,
    onDraftChanged: (MemberDraft) -> Unit,
    onToggleAdmin: (String) -> Unit,
    onToggleActive: (String) -> Unit,
    onCreateMember: () -> Unit,
    onRetryMyOrderFreshness: () -> Unit,
    onOpenMyOrder: () -> Unit,
    onOpenProducts: () -> Unit,
    onOpenShifts: () -> Unit,
) {
    OperationalModules(
        modulesEnabled = true,
        canOpenProducts = mode.member.canManageProductCatalog,
        myOrderFreshnessState = myOrderFreshnessState,
        onOpenMyOrder = onOpenMyOrder,
        onRetryMyOrderFreshness = onRetryMyOrderFreshness,
        onOpenProducts = onOpenProducts,
        onOpenShifts = onOpenShifts,
    )

    if (mode.member.isAdmin) {
        AdminToolsCard(
            members = mode.members,
            draft = draft,
            onDraftChanged = onDraftChanged,
            onToggleAdmin = onToggleAdmin,
            onToggleActive = onToggleActive,
            onCreateMember = onCreateMember,
        )
    }
}

@Composable
private fun AdminToolsCard(
    members: List<Member>,
    draft: MemberDraft,
    onDraftChanged: (MemberDraft) -> Unit,
    onToggleAdmin: (String) -> Unit,
    onToggleActive: (String) -> Unit,
    onCreateMember: () -> Unit,
) {
    var expanded by rememberSaveable { mutableStateOf(false) }

    Card {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(
                    modifier = Modifier.weight(1f),
                    verticalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    Text(
                        stringResource(R.string.admin_manage_members_title),
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold,
                    )
                    Text(
                        stringResource(R.string.admin_manage_members_subtitle),
                        style = MaterialTheme.typography.bodySmall,
                    )
                }
                IconButton(onClick = { expanded = !expanded }) {
                    Icon(
                        imageVector = if (expanded) Icons.Filled.ExpandLess else Icons.Filled.ExpandMore,
                        contentDescription = null,
                    )
                }
            }

            if (expanded) {
                members.forEach { member ->
                    MemberRow(member = member, onToggleAdmin = onToggleAdmin, onToggleActive = onToggleActive)
                }

                Spacer(modifier = Modifier.height(8.dp))
                Text(stringResource(R.string.admin_create_pre_authorized_member), fontWeight = FontWeight.Medium)

                OutlinedTextField(
                    value = draft.displayName,
                    onValueChange = { onDraftChanged(draft.copy(displayName = it)) },
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text(stringResource(R.string.admin_input_display_name_label)) },
                    singleLine = true,
                )
                OutlinedTextField(
                    value = draft.email,
                    onValueChange = { onDraftChanged(draft.copy(email = it)) },
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text(stringResource(R.string.common_input_email_label)) },
                    singleLine = true,
                )

                RoleCheckboxRow(
                    checked = draft.isMember,
                    label = stringResource(R.string.role_member),
                    onCheckedChange = { onDraftChanged(draft.copy(isMember = it)) },
                )
                RoleCheckboxRow(
                    checked = draft.isProducer,
                    label = stringResource(R.string.role_producer),
                    onCheckedChange = { onDraftChanged(draft.copy(isProducer = it)) },
                )
                RoleCheckboxRow(
                    checked = draft.isAdmin,
                    label = stringResource(R.string.role_admin),
                    onCheckedChange = { onDraftChanged(draft.copy(isAdmin = it)) },
                )
                RoleCheckboxRow(
                    checked = draft.isActive,
                    label = stringResource(R.string.role_active),
                    onCheckedChange = { onDraftChanged(draft.copy(isActive = it)) },
                )

                Button(onClick = onCreateMember, modifier = Modifier.fillMaxWidth()) {
                    Text(stringResource(R.string.admin_action_create_member))
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
private fun MemberRow(
    member: Member,
    onToggleAdmin: (String) -> Unit,
    onToggleActive: (String) -> Unit,
) {
    val context = LocalContext.current
    Card {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Text(member.displayName, fontWeight = FontWeight.Medium)
            Text(member.normalizedEmail)
            Text(stringResource(R.string.common_roles_format, member.roles.toPrettyRoles(context)))
            Text(
                stringResource(
                    R.string.member_auth_linked_format,
                    stringResource(if (member.authUid == null) R.string.common_no else R.string.common_yes),
                ),
            )
            Text(
                stringResource(
                    R.string.common_status_format,
                    stringResource(if (member.isActive) R.string.common_status_active else R.string.common_status_inactive),
                ),
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = { onToggleAdmin(member.id) }) {
                    Text(
                        stringResource(
                            if (member.isAdmin) {
                                R.string.admin_action_revoke_admin
                            } else {
                                R.string.admin_action_grant_admin
                            },
                        ),
                    )
                }
                Button(onClick = { onToggleActive(member.id) }) {
                    Text(
                        stringResource(
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

private fun Set<MemberRole>.toPrettyRoles(context: Context): String =
    this.joinToString(separator = ", ") { role ->
        when (role) {
            MemberRole.MEMBER -> context.getString(R.string.role_value_member)
            MemberRole.PRODUCER -> context.getString(R.string.role_value_producer)
            MemberRole.ADMIN -> context.getString(R.string.role_value_admin)
        }
    }

private fun UnauthorizedReason.toMessageResId(): Int =
    when (this) {
        UnauthorizedReason.USER_NOT_FOUND_IN_AUTHORIZED_USERS,
        UnauthorizedReason.USER_ACCESS_RESTRICTED,
            -> R.string.auth_error_member_unauthorized
    }
