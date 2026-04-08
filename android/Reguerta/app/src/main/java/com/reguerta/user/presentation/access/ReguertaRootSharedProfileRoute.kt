package com.reguerta.user.presentation.access

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.Card
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import com.reguerta.user.R
import com.reguerta.user.domain.access.Member
import com.reguerta.user.domain.profiles.SharedProfile
import com.reguerta.user.ui.components.auth.ReguertaFlatButton
import com.reguerta.user.ui.components.auth.ReguertaFullButton
@Composable
internal fun SharedProfileRoute(
    currentMember: Member?,
    members: List<Member>,
    profiles: List<SharedProfile>,
    draft: SharedProfileDraft,
    isLoading: Boolean,
    isSaving: Boolean,
    isDeleting: Boolean,
    onDraftChanged: (SharedProfileDraft) -> Unit,
    onRefresh: () -> Unit,
    onSave: (onSuccess: () -> Unit) -> Unit,
    onDelete: () -> Unit,
) {
    val member = currentMember ?: return
    var selectedProfileUserId by rememberSaveable { mutableStateOf<String?>(null) }
    var isEditingOwnProfile by rememberSaveable { mutableStateOf(false) }
    val sortedProfiles = profiles.sortedBy {
        members.firstOrNull { memberItem -> memberItem.id == it.userId }?.displayName ?: it.userId
    }
    val selectedProfile = sortedProfiles.firstOrNull { it.userId == selectedProfileUserId }
    val isOwnSelectedProfile = selectedProfile?.userId == member.id

    when {
        isEditingOwnProfile -> {
            Card {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Text(
                        text = if (profiles.any { it.userId == member.id }) {
                            stringResource(R.string.profile_shared_editor_title_edit)
                        } else {
                            stringResource(R.string.profile_shared_editor_title_create)
                        },
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold,
                    )
                    Text(
                        text = stringResource(R.string.profile_shared_editor_subtitle),
                        style = MaterialTheme.typography.bodyMedium,
                    )

                    OutlinedTextField(
                        value = draft.familyNames,
                        onValueChange = { onDraftChanged(draft.copy(familyNames = it)) },
                        modifier = Modifier.fillMaxWidth(),
                        label = { Text(stringResource(R.string.profile_shared_family_names_label)) },
                        singleLine = true,
                    )
                    OutlinedTextField(
                        value = draft.photoUrl,
                        onValueChange = { onDraftChanged(draft.copy(photoUrl = it)) },
                        modifier = Modifier.fillMaxWidth(),
                        label = { Text(stringResource(R.string.profile_shared_photo_url_label)) },
                        singleLine = true,
                    )
                    OutlinedTextField(
                        value = draft.about,
                        onValueChange = { onDraftChanged(draft.copy(about = it)) },
                        modifier = Modifier.fillMaxWidth(),
                        label = { Text(stringResource(R.string.profile_shared_about_label)) },
                        minLines = 5,
                    )

                    ReguertaFullButton(
                        label = stringResource(
                            if (isSaving) {
                                R.string.profile_shared_action_saving
                            } else if (profiles.any { it.userId == member.id }) {
                                R.string.profile_shared_action_save
                            } else {
                                R.string.profile_shared_action_create
                            },
                        ),
                        onClick = {
                            onSave {
                                isEditingOwnProfile = false
                                selectedProfileUserId = null
                            }
                        },
                        enabled = !isSaving,
                        loading = isSaving,
                        fullWidth = true,
                    )
                    ReguertaFlatButton(
                        label = stringResource(R.string.common_action_back),
                        onClick = { isEditingOwnProfile = false },
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
            }
        }

        selectedProfile != null -> {
            Card {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    SharedProfileCard(
                        profile = selectedProfile,
                        member = members.firstOrNull { it.id == selectedProfile.userId },
                    )

                    if (isOwnSelectedProfile) {
                        ReguertaFullButton(
                            label = stringResource(R.string.profile_shared_action_edit),
                            onClick = { isEditingOwnProfile = true },
                            fullWidth = true,
                        )
                        ReguertaFlatButton(
                            label = stringResource(
                                if (isDeleting) {
                                    R.string.profile_shared_action_deleting
                                } else {
                                    R.string.profile_shared_action_delete
                                },
                            ),
                            onClick = {
                                onDelete()
                                selectedProfileUserId = null
                            },
                            enabled = !isDeleting,
                            modifier = Modifier.fillMaxWidth(),
                        )
                    }

                    ReguertaFlatButton(
                        label = stringResource(R.string.common_action_back),
                        onClick = { selectedProfileUserId = null },
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
            }
        }

        else -> {
            Column(
                modifier = Modifier
                    .fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                Card {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        Text(
                            text = stringResource(R.string.profile_shared_hub_title),
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.SemiBold,
                        )
                        Text(
                            text = stringResource(R.string.profile_shared_hub_subtitle),
                            style = MaterialTheme.typography.bodyMedium,
                        )

                        ReguertaFullButton(
                            label = stringResource(
                                if (profiles.any { it.userId == member.id }) {
                                    R.string.profile_shared_action_view_my_profile
                                } else {
                                    R.string.profile_shared_action_create
                                },
                            ),
                            onClick = {
                                if (profiles.any { it.userId == member.id }) {
                                    selectedProfileUserId = member.id
                                } else {
                                    isEditingOwnProfile = true
                                }
                            },
                            fullWidth = true,
                        )
                    }
                }

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
                                    text = stringResource(R.string.profile_shared_community_title),
                                    style = MaterialTheme.typography.titleMedium,
                                    fontWeight = FontWeight.SemiBold,
                                )
                                Text(
                                    text = stringResource(R.string.profile_shared_community_subtitle),
                                    style = MaterialTheme.typography.bodySmall,
                                )
                            }
                            TextButton(onClick = onRefresh) {
                                Text(stringResource(R.string.notifications_refresh_action))
                            }
                        }

                        if (isLoading) {
                            Text(
                                text = stringResource(R.string.profile_shared_loading),
                                style = MaterialTheme.typography.bodyMedium,
                            )
                        } else if (sortedProfiles.isEmpty()) {
                            Text(
                                text = stringResource(R.string.profile_shared_empty),
                                style = MaterialTheme.typography.bodyMedium,
                            )
                        } else {
                            sortedProfiles.forEach { profile ->
                                SharedProfileListRow(
                                    profile = profile,
                                    member = members.firstOrNull { it.id == profile.userId },
                                    onClick = { selectedProfileUserId = profile.userId },
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun SharedProfileListRow(
    profile: SharedProfile,
    member: Member?,
    onClick: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .clickable(onClick = onClick)
            .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.25f))
            .padding(12.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            Text(
                text = member?.displayName ?: profile.userId,
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.SemiBold,
            )
            if (profile.familyNames.isNotBlank()) {
                Text(
                    text = profile.familyNames,
                    style = MaterialTheme.typography.bodySmall,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
        Icon(
            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
            contentDescription = null,
            modifier = Modifier.graphicsLayer { rotationZ = 180f },
        )
    }
}

@Composable
private fun SharedProfileCard(
    profile: SharedProfile,
    member: Member?,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.35f))
            .padding(12.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.Top,
    ) {
        if (!profile.photoUrl.isNullOrBlank()) {
            AsyncImage(
                model = profile.photoUrl,
                contentDescription = member?.displayName ?: profile.userId,
                modifier = Modifier
                    .size(72.dp)
                    .clip(CircleShape),
                contentScale = ContentScale.Crop,
            )
        } else {
            Box(
                modifier = Modifier
                    .size(72.dp)
                    .clip(CircleShape)
                    .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.12f)),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    imageVector = Icons.Filled.Person,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.primary,
                )
            }
        }

        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            Text(
                text = member?.displayName ?: profile.userId,
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.SemiBold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            if (profile.familyNames.isNotBlank()) {
                Text(
                    text = profile.familyNames,
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Medium,
                )
            }
            if (profile.about.isNotBlank()) {
                Text(
                    text = profile.about,
                    style = MaterialTheme.typography.bodySmall,
                )
            }
        }
    }
}
