package com.reguerta.user.presentation.sharedprofile

import com.reguerta.user.presentation.root.ReguertaImagePickerField
import com.reguerta.user.presentation.root.SharedProfileDraft
import com.reguerta.user.presentation.root.normalized
import com.reguerta.user.presentation.root.toDraft

import android.net.Uri
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import com.reguerta.user.R
import com.reguerta.user.domain.access.Member
import com.reguerta.user.domain.profiles.SharedProfile
import com.reguerta.user.ui.components.auth.ReguertaDialog
import com.reguerta.user.ui.components.auth.ReguertaDialogAction
import com.reguerta.user.ui.components.auth.ReguertaDialogType
import com.reguerta.user.ui.components.auth.ReguertaFlatButton
import com.reguerta.user.ui.components.auth.ReguertaFloatingActionButton
import com.reguerta.user.ui.components.auth.ReguertaFullButton

@Composable
internal fun SharedProfileRoute(
    currentMember: Member?,
    members: List<Member>,
    profiles: List<SharedProfile>,
    draft: SharedProfileDraft,
    isLoading: Boolean,
    isSaving: Boolean,
    isUploadingImage: Boolean,
    isDeleting: Boolean,
    onDraftChanged: (SharedProfileDraft) -> Unit,
    onPickImage: (Uri) -> Unit,
    onClearImage: () -> Unit,
    onSave: (onSuccess: () -> Unit) -> Unit,
    onDelete: () -> Unit,
    onTitleChanged: (String?) -> Unit = {},
) {
    val member = currentMember ?: return
    var selectedProfileUserId by rememberSaveable { mutableStateOf<String?>(null) }
    var carouselStartProfileUserId by rememberSaveable { mutableStateOf<String?>(null) }
    var isEditingOwnProfile by rememberSaveable { mutableStateOf(false) }
    var isProfileSavedDialogVisible by rememberSaveable { mutableStateOf(false) }
    var isFamilyNamesFocused by remember { mutableStateOf(false) }
    var isAboutFocused by remember { mutableStateOf(false) }
    val sortedProfiles = profiles.sortedBy {
        members.firstOrNull { memberItem -> memberItem.id == it.userId }?.displayName ?: it.userId
    }
    val ownProfile = profiles.firstOrNull { it.userId == member.id }
    val normalizedDraft = draft.normalized()
    val savedDraft = ownProfile?.toDraft()?.normalized() ?: SharedProfileDraft()
    val hasProfileChanges = normalizedDraft != savedDraft
    val selectedProfile = sortedProfiles.firstOrNull { it.userId == selectedProfileUserId }
    val isOwnSelectedProfile = selectedProfile?.userId == member.id
    val isEditorInputFocused = isFamilyNamesFocused || isAboutFocused
    val editorTitle = stringResource(
        if (ownProfile != null) {
            R.string.profile_shared_editor_title_edit
        } else {
            R.string.profile_shared_editor_title_create
        },
    )
    val selectedProfileTitle = selectedProfile?.let { profile ->
        sharedProfileDisplayName(
            profile = profile,
            member = members.firstOrNull { it.id == profile.userId },
        )
    }

    LaunchedEffect(isEditingOwnProfile, selectedProfileTitle, editorTitle) {
        onTitleChanged(
            when {
                isEditingOwnProfile -> editorTitle
                selectedProfileTitle != null -> selectedProfileTitle
                else -> null
            },
        )
    }

    DisposableEffect(Unit) {
        onDispose { onTitleChanged(null) }
    }

    BackHandler(enabled = isEditingOwnProfile || selectedProfileUserId != null || carouselStartProfileUserId != null) {
        when {
            isEditingOwnProfile -> isEditingOwnProfile = false
            selectedProfileUserId != null -> selectedProfileUserId = null
            carouselStartProfileUserId != null -> carouselStartProfileUserId = null
        }
    }

    when {
        isEditingOwnProfile -> {
            Box(modifier = Modifier.fillMaxSize()) {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Text(
                        text = stringResource(R.string.profile_shared_family_names_label),
                        style = MaterialTheme.typography.labelLarge,
                        color = MaterialTheme.colorScheme.onBackground,
                    )
                    OutlinedTextField(
                        value = draft.familyNames,
                        onValueChange = { onDraftChanged(draft.copy(familyNames = it)) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .onFocusChanged { isFamilyNamesFocused = it.isFocused },
                        placeholder = { Text(stringResource(R.string.profile_shared_family_names_label)) },
                        singleLine = true,
                    )
                    ReguertaImagePickerField(
                        imageUrl = draft.photoUrl,
                        isUploading = isUploadingImage,
                        onPickImage = onPickImage,
                        onClearImage = onClearImage,
                        placeholderIcon = Icons.Default.Person,
                        usesIconControls = true,
                        overlaysControlsOnImage = true,
                        previewSize = 160,
                        previewContentScale = ContentScale.Fit,
                        controlSize = 36,
                    )
                    Text(
                        text = stringResource(R.string.profile_shared_about_label),
                        style = MaterialTheme.typography.labelLarge,
                        color = MaterialTheme.colorScheme.onBackground,
                    )
                    OutlinedTextField(
                        value = draft.about,
                        onValueChange = { onDraftChanged(draft.copy(about = it)) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .onFocusChanged { isAboutFocused = it.isFocused },
                        placeholder = { Text(stringResource(R.string.profile_shared_about_label)) },
                        minLines = 5,
                        maxLines = Int.MAX_VALUE,
                    )

                    Spacer(modifier = Modifier.height(128.dp))
                }

                if (!isEditorInputFocused) {
                    ReguertaFloatingActionButton(
                        label = stringResource(
                            if (isSaving) {
                                R.string.profile_shared_action_saving
                            } else if (ownProfile != null) {
                                R.string.profile_shared_action_save
                            } else {
                                R.string.profile_shared_action_create
                            },
                        ),
                        modifier = Modifier.align(Alignment.BottomCenter),
                        onClick = {
                            onSave {
                                isEditingOwnProfile = false
                                selectedProfileUserId = null
                                carouselStartProfileUserId = null
                                isProfileSavedDialogVisible = true
                            }
                        },
                        enabled = hasProfileChanges && !isSaving && !isUploadingImage,
                        loading = isSaving,
                    )
                }
            }
        }

        selectedProfile != null -> {
            SharedProfileDetailView(
                profile = selectedProfile,
                member = members.firstOrNull { it.id == selectedProfile.userId },
                isOwnProfile = isOwnSelectedProfile,
                isDeleting = isDeleting,
                onEdit = { isEditingOwnProfile = true },
                onDelete = {
                    onDelete()
                    selectedProfileUserId = null
                    carouselStartProfileUserId = null
                },
            )
        }

        carouselStartProfileUserId != null -> {
            SharedProfileCarouselView(
                profiles = sortedProfiles,
                members = members,
                startUserId = carouselStartProfileUserId,
                onProfileClick = { profileUserId -> selectedProfileUserId = profileUserId },
            )
        }

        else -> {
            Box(modifier = Modifier.fillMaxSize()) {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(24.dp),
                ) {
                    Text(
                        text = stringResource(R.string.profile_shared_hub_subtitle),
                        style = MaterialTheme.typography.bodyMedium,
                    )

                    Column(
                        modifier = Modifier
                            .fillMaxWidth(),
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
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
                                    onClick = { carouselStartProfileUserId = profile.userId },
                                )
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(128.dp))
                }

                ReguertaFloatingActionButton(
                    label = stringResource(R.string.profile_shared_action_view_my_profile),
                    modifier = Modifier.align(Alignment.BottomCenter),
                    onClick = {
                        selectedProfileUserId = null
                        carouselStartProfileUserId = null
                        isEditingOwnProfile = true
                    },
                )
            }
        }
    }

    if (isProfileSavedDialogVisible) {
        ReguertaDialog(
            type = ReguertaDialogType.INFO,
            title = stringResource(R.string.profile_shared_saved_dialog_title),
            message = stringResource(R.string.profile_shared_saved_dialog_message),
            primaryAction = ReguertaDialogAction(
                label = stringResource(R.string.common_action_accept),
                onClick = { isProfileSavedDialogVisible = false },
            ),
            onDismissRequest = { isProfileSavedDialogVisible = false },
        )
    }
}

@Composable
private fun SharedProfileCarouselView(
    profiles: List<SharedProfile>,
    members: List<Member>,
    startUserId: String?,
    onProfileClick: (String) -> Unit,
) {
    val startIndex = profiles.indexOfFirst { it.userId == startUserId }.coerceAtLeast(0)
    val listState = rememberLazyListState(initialFirstVisibleItemIndex = startIndex)
    val profileIdsKey = profiles.joinToString(separator = "|") { it.userId }

    LaunchedEffect(startUserId, profileIdsKey) {
        val targetIndex = profiles.indexOfFirst { it.userId == startUserId }
        if (targetIndex >= 0) {
            listState.animateScrollToItem(targetIndex)
        }
    }

    Column(
        modifier = Modifier.fillMaxSize(),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Text(
            text = stringResource(R.string.profile_shared_community_title),
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.SemiBold,
        )

        LazyRow(
            state = listState,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            modifier = Modifier.fillMaxWidth(),
        ) {
            items(
                items = profiles,
                key = { profile -> profile.userId },
            ) { profile ->
                SharedProfileCarouselCard(
                    profile = profile,
                    member = members.firstOrNull { it.id == profile.userId },
                    onClick = { onProfileClick(profile.userId) },
                )
            }
        }
    }
}

@Composable
private fun SharedProfileCarouselCard(
    profile: SharedProfile,
    member: Member?,
    onClick: () -> Unit,
) {
    val sharedName = sharedProfileDisplayName(profile, member)

    Column(
        modifier = Modifier
            .width(300.dp)
            .height(430.dp)
            .clip(RoundedCornerShape(8.dp))
            .clickable(onClick = onClick)
            .semantics(mergeDescendants = true) {}
            .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.15f))
            .padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text(
            text = sharedName,
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.SemiBold,
            textAlign = TextAlign.Center,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.fillMaxWidth(),
        )

        SharedProfileAvatar(
            profile = profile,
            contentDescription = null,
            size = 184,
            shape = RoundedCornerShape(8.dp),
        )

        if (profile.about.isNotBlank()) {
            Text(
                text = profile.about,
                style = MaterialTheme.typography.bodyMedium,
                maxLines = 5,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}

@Composable
private fun SharedProfileListRow(
    profile: SharedProfile,
    member: Member?,
    onClick: () -> Unit,
) {
    val sharedName = sharedProfileDisplayName(profile, member)

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .clickable(onClick = onClick)
            .semantics(mergeDescendants = true) {}
            .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.15f))
            .padding(12.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        SharedProfileAvatar(
            profile = profile,
            contentDescription = null,
            size = 64,
            shape = RoundedCornerShape(8.dp),
        )
        Text(
            text = sharedName,
            style = MaterialTheme.typography.titleSmall,
            fontWeight = FontWeight.SemiBold,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f),
        )
    }
}

@Composable
private fun SharedProfileDetailView(
    profile: SharedProfile,
    member: Member?,
    isOwnProfile: Boolean,
    isDeleting: Boolean,
    onEdit: () -> Unit,
    onDelete: () -> Unit,
) {
    val sharedName = sharedProfileDisplayName(profile, member)
    var imageInfo by remember(profile.photoUrl) { mutableStateOf<SharedProfileImageInfo?>(null) }
    val hasPhoto = !profile.photoUrl.isNullOrBlank()
    val usesPortraitLayout = hasPhoto && imageInfo?.isPortrait == true

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        if (hasPhoto && usesPortraitLayout) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(16.dp),
                verticalAlignment = Alignment.Top,
            ) {
                SharedProfileDetailPhoto(
                    profile = profile,
                    contentDescription = sharedName,
                    modifier = Modifier
                        .width(132.dp)
                        .aspectRatio(imageInfo?.aspectRatio ?: 0.7f),
                    onImageInfo = { imageInfo = it },
                )
                SharedProfileDetailText(
                    profile = profile,
                    member = member,
                    modifier = Modifier.weight(1f),
                )
            }
        } else {
            if (hasPhoto) {
                SharedProfileDetailPhoto(
                    profile = profile,
                    contentDescription = sharedName,
                    modifier = Modifier
                        .fillMaxWidth()
                        .aspectRatio(imageInfo?.aspectRatio ?: 1.6f),
                    onImageInfo = { imageInfo = it },
                )
            }
            SharedProfileDetailText(
                profile = profile,
                member = member,
                modifier = Modifier.fillMaxWidth(),
            )
        }

        if (isOwnProfile) {
            ReguertaFullButton(
                label = stringResource(R.string.profile_shared_action_edit),
                onClick = onEdit,
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
                onClick = onDelete,
                enabled = !isDeleting,
                modifier = Modifier.fillMaxWidth(),
            )
        }

        Spacer(modifier = Modifier.height(32.dp))
    }
}

@Composable
private fun SharedProfileDetailPhoto(
    profile: SharedProfile,
    contentDescription: String?,
    modifier: Modifier,
    onImageInfo: (SharedProfileImageInfo) -> Unit,
) {
    AsyncImage(
        model = profile.photoUrl,
        contentDescription = contentDescription,
        modifier = modifier.clip(RoundedCornerShape(8.dp)),
        contentScale = ContentScale.Fit,
        onSuccess = { state ->
            val image = state.result.image
            if (image.width > 0 && image.height > 0) {
                onImageInfo(
                    SharedProfileImageInfo(
                        aspectRatio = image.width.toFloat() / image.height.toFloat(),
                    ),
                )
            }
        },
    )
}

@Composable
private fun SharedProfileDetailText(
    profile: SharedProfile,
    member: Member?,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier,
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        if (profile.familyNames.isNotBlank()) {
            Text(
                text = profile.familyNames,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
            )
        } else {
            Text(
                text = member?.displayName ?: profile.userId,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
            )
        }
        if (profile.about.isNotBlank()) {
            Text(
                text = profile.about,
                style = MaterialTheme.typography.bodyMedium,
            )
        }
    }
}

@Composable
private fun SharedProfileAvatar(
    profile: SharedProfile,
    contentDescription: String?,
    size: Int,
    shape: Shape = CircleShape,
) {
    if (!profile.photoUrl.isNullOrBlank()) {
        AsyncImage(
            model = profile.photoUrl,
            contentDescription = contentDescription,
            modifier = Modifier
                .size(size.dp)
                .clip(shape)
                .background(MaterialTheme.colorScheme.surfaceVariant),
            contentScale = ContentScale.Fit,
        )
    } else {
        Box(
            modifier = Modifier
                .size(size.dp)
                .clip(shape)
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
}

private data class SharedProfileImageInfo(
    val aspectRatio: Float,
) {
    val isPortrait: Boolean
        get() = aspectRatio < 1f
}

private fun sharedProfileDisplayName(
    profile: SharedProfile,
    member: Member?,
): String = profile.familyNames.takeIf { it.isNotBlank() } ?: member?.displayName ?: profile.userId
