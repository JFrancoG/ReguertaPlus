package com.reguerta.user.presentation.access

import android.annotation.SuppressLint
import android.content.Context
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.Checkbox
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.google.firebase.firestore.FirebaseFirestore
import com.reguerta.user.R
import com.reguerta.user.data.access.ChainedMemberRepository
import com.reguerta.user.data.access.FirestoreMemberRepository
import com.reguerta.user.data.access.InMemoryMemberRepository
import com.reguerta.user.domain.access.Member
import com.reguerta.user.domain.access.MemberRole
import com.reguerta.user.domain.access.ResolveAuthorizedSessionUseCase
import com.reguerta.user.domain.access.UnauthorizedReason
import com.reguerta.user.domain.access.UpsertMemberByAdminUseCase

@Composable
fun rememberSessionViewModel(): SessionViewModel {
    val repository = remember {
        val fallback = InMemoryMemberRepository()
        val primary = FirestoreMemberRepository(firestore = FirebaseFirestore.getInstance())
        ChainedMemberRepository(primary = primary, fallback = fallback)
    }
    return remember {
        SessionViewModel(
            repository = repository,
            resolveAuthorizedSession = ResolveAuthorizedSessionUseCase(memberRepository = repository),
            upsertMemberByAdmin = UpsertMemberByAdminUseCase(memberRepository = repository),
        )
    }
}

@Composable
@SuppressLint("LocalContextGetResourceValueCall")
fun ReguertaRoot(
    viewModel: SessionViewModel = rememberSessionViewModel(),
    modifier: Modifier = Modifier,
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val snackbarHostState = remember { SnackbarHostState() }
    val context = LocalContext.current

    LaunchedEffect(viewModel) {
        viewModel.uiEvents.collect { event ->
            if (event is SessionUiEvent.ShowMessage) {
                snackbarHostState.showSnackbar(context.getString(event.messageRes))
            }
        }
    }

    Scaffold(
        modifier = modifier.fillMaxSize(),
        snackbarHost = { SnackbarHost(hostState = snackbarHostState) },
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(innerPadding)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Text(
                text = stringResource(R.string.access_members_roles_title),
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
            )

            SignInCard(state = state, viewModel = viewModel)

            when (val mode = state.mode) {
                is SessionMode.SignedOut -> {
                    Text(
                        text = stringResource(R.string.access_signed_out_hint),
                        style = MaterialTheme.typography.bodyMedium,
                    )
                }

                is SessionMode.Unauthorized -> {
                    UnauthorizedCard(mode = mode)
                    OperationalModules(enabled = false)
                }

                is SessionMode.Authorized -> {
                    AuthorizedHome(
                        mode = mode,
                        draft = state.memberDraft,
                        onDraftChanged = viewModel::onMemberDraftChanged,
                        onToggleAdmin = viewModel::toggleAdmin,
                        onToggleActive = viewModel::toggleActive,
                        onCreateMember = viewModel::createAuthorizedMember,
                    )
                }
            }
        }
    }
}

@Composable
private fun SignInCard(state: SessionUiState, viewModel: SessionViewModel) {
    Card {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(stringResource(R.string.access_card_authentication))
            OutlinedTextField(
                value = state.emailInput,
                onValueChange = viewModel::onEmailChanged,
                modifier = Modifier.fillMaxWidth(),
                label = { Text(stringResource(R.string.common_input_email_label)) },
                singleLine = true,
            )
            OutlinedTextField(
                value = state.uidInput,
                onValueChange = viewModel::onUidChanged,
                modifier = Modifier.fillMaxWidth(),
                label = { Text(stringResource(R.string.access_input_auth_uid_label)) },
                singleLine = true,
            )
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Button(
                    onClick = viewModel::signIn,
                    enabled = !state.isAuthenticating,
                ) {
                    Text(
                        stringResource(
                            if (state.isAuthenticating) {
                                R.string.access_action_signing_in
                            } else {
                                R.string.access_action_sign_in
                            },
                        ),
                    )
                }
                Button(onClick = viewModel::signOut) {
                    Text(stringResource(R.string.access_action_sign_out))
                }
            }
        }
    }
}

@Composable
private fun UnauthorizedCard(mode: SessionMode.Unauthorized) {
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
            Text(stringResource(R.string.access_signed_in_email_format, mode.email))
            Text(stringResource(R.string.auth_info_member_restricted_mode))
            Text(
                stringResource(R.string.common_reason_format, stringResource(mode.reason.toMessageResId())),
                style = MaterialTheme.typography.bodySmall,
            )
        }
    }
}

@Composable
private fun AuthorizedHome(
    mode: SessionMode.Authorized,
    draft: MemberDraft,
    onDraftChanged: (MemberDraft) -> Unit,
    onToggleAdmin: (String) -> Unit,
    onToggleActive: (String) -> Unit,
    onCreateMember: () -> Unit,
) {
    Card {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            val context = LocalContext.current
            Text(
                stringResource(R.string.home_title),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
            )
            Text(stringResource(R.string.home_welcome_format, mode.member.displayName))
            Text(stringResource(R.string.common_roles_format, mode.member.roles.toPrettyRoles(context)))
            Text(
                stringResource(
                    R.string.common_status_format,
                    stringResource(if (mode.member.isActive) R.string.common_status_active else R.string.common_status_inactive),
                ),
            )
        }
    }

    OperationalModules(enabled = true)

    if (mode.member.isAdmin) {
        AdminMembersCard(
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
private fun OperationalModules(enabled: Boolean) {
    Card {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Text(stringResource(R.string.operational_modules_title))
            Button(onClick = {}, enabled = enabled, modifier = Modifier.fillMaxWidth()) {
                Text(stringResource(R.string.module_my_order))
            }
            Button(onClick = {}, enabled = enabled, modifier = Modifier.fillMaxWidth()) {
                Text(stringResource(R.string.module_catalog))
            }
            Button(onClick = {}, enabled = enabled, modifier = Modifier.fillMaxWidth()) {
                Text(stringResource(R.string.module_shifts))
            }
        }
    }
}

@Composable
private fun AdminMembersCard(
    members: List<Member>,
    draft: MemberDraft,
    onDraftChanged: (MemberDraft) -> Unit,
    onToggleAdmin: (String) -> Unit,
    onToggleActive: (String) -> Unit,
    onCreateMember: () -> Unit,
) {
    Card {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(
                stringResource(R.string.admin_manage_members_title),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
            )
            Text(stringResource(R.string.admin_manage_members_subtitle))

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
        UnauthorizedReason.USER_NOT_AUTHORIZED -> R.string.auth_error_member_unauthorized
    }
