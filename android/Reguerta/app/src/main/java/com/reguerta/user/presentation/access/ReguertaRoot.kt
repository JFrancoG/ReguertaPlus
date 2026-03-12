package com.reguerta.user.presentation.access

import androidx.compose.foundation.layout.Arrangement
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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.google.firebase.firestore.FirebaseFirestore
import com.reguerta.user.data.access.ChainedMemberRepository
import com.reguerta.user.data.access.FirestoreMemberRepository
import com.reguerta.user.data.access.InMemoryMemberRepository
import com.reguerta.user.domain.access.Member
import com.reguerta.user.domain.access.MemberRole
import com.reguerta.user.domain.access.ResolveAuthorizedSessionUseCase
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
fun ReguertaRoot(
    viewModel: SessionViewModel = rememberSessionViewModel(),
    modifier: Modifier = Modifier,
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(viewModel) {
        viewModel.uiEvents.collect { event ->
            if (event is SessionUiEvent.ShowMessage) {
                snackbarHostState.showSnackbar(event.message)
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
                text = "Members and Roles",
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
            )

            SignInCard(state = state, viewModel = viewModel)

            when (val mode = state.mode) {
                is SessionMode.SignedOut -> {
                    Text(
                        text = "Sign in with a pre-authorized member email to unlock operational modules.",
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
            Text("Authentication")
            OutlinedTextField(
                value = state.emailInput,
                onValueChange = viewModel::onEmailChanged,
                modifier = Modifier.fillMaxWidth(),
                label = { Text("Email") },
                singleLine = true,
            )
            OutlinedTextField(
                value = state.uidInput,
                onValueChange = viewModel::onUidChanged,
                modifier = Modifier.fillMaxWidth(),
                label = { Text("Auth UID") },
                singleLine = true,
            )
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Button(
                    onClick = viewModel::signIn,
                    enabled = !state.isAuthenticating,
                ) {
                    Text(if (state.isAuthenticating) "Signing in..." else "Sign in")
                }
                Button(onClick = viewModel::signOut) {
                    Text("Sign out")
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
            Text("Unauthorized user", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
            Text("Signed in email: ${mode.email}")
            Text("Operational modules remain disabled until an admin pre-authorizes this email.")
            Text("Reason: ${mode.message}", style = MaterialTheme.typography.bodySmall)
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
            Text("Home", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
            Text("Welcome ${mode.member.displayName}")
            Text("Roles: ${mode.member.roles.toPrettyRoles()}")
            Text("Status: ${if (mode.member.isActive) "Active" else "Inactive"}")
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
            Text("Operational modules")
            Button(onClick = {}, enabled = enabled, modifier = Modifier.fillMaxWidth()) {
                Text("My order")
            }
            Button(onClick = {}, enabled = enabled, modifier = Modifier.fillMaxWidth()) {
                Text("Catalog")
            }
            Button(onClick = {}, enabled = enabled, modifier = Modifier.fillMaxWidth()) {
                Text("Shifts")
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
            Text("Admin | Manage members", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
            Text("Create / edit / deactivate members and roles")

            members.forEach { member ->
                MemberRow(member = member, onToggleAdmin = onToggleAdmin, onToggleActive = onToggleActive)
            }

            Spacer(modifier = Modifier.height(8.dp))
            Text("Create pre-authorized member", fontWeight = FontWeight.Medium)

            OutlinedTextField(
                value = draft.displayName,
                onValueChange = { onDraftChanged(draft.copy(displayName = it)) },
                modifier = Modifier.fillMaxWidth(),
                label = { Text("Display name") },
                singleLine = true,
            )
            OutlinedTextField(
                value = draft.email,
                onValueChange = { onDraftChanged(draft.copy(email = it)) },
                modifier = Modifier.fillMaxWidth(),
                label = { Text("Email") },
                singleLine = true,
            )

            RoleCheckboxRow(
                checked = draft.isMember,
                label = "Member",
                onCheckedChange = { onDraftChanged(draft.copy(isMember = it)) },
            )
            RoleCheckboxRow(
                checked = draft.isProducer,
                label = "Producer",
                onCheckedChange = { onDraftChanged(draft.copy(isProducer = it)) },
            )
            RoleCheckboxRow(
                checked = draft.isAdmin,
                label = "Admin",
                onCheckedChange = { onDraftChanged(draft.copy(isAdmin = it)) },
            )
            RoleCheckboxRow(
                checked = draft.isActive,
                label = "Active",
                onCheckedChange = { onDraftChanged(draft.copy(isActive = it)) },
            )

            Button(onClick = onCreateMember, modifier = Modifier.fillMaxWidth()) {
                Text("Create member")
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
    Card {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Text(member.displayName, fontWeight = FontWeight.Medium)
            Text(member.normalizedEmail)
            Text("Roles: ${member.roles.toPrettyRoles()}")
            Text("Auth linked: ${if (member.authUid == null) "No" else "Yes"}")
            Text("Status: ${if (member.isActive) "Active" else "Inactive"}")
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = { onToggleAdmin(member.id) }) {
                    Text(if (member.isAdmin) "Revoke admin" else "Grant admin")
                }
                Button(onClick = { onToggleActive(member.id) }) {
                    Text(if (member.isActive) "Deactivate" else "Activate")
                }
            }
        }
    }
}

private fun Set<MemberRole>.toPrettyRoles(): String =
    this.joinToString(separator = ", ") { role ->
        when (role) {
            MemberRole.MEMBER -> "member"
            MemberRole.PRODUCER -> "producer"
            MemberRole.ADMIN -> "admin"
        }
    }
