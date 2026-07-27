package com.reguerta.user.presentation.root

import android.net.Uri
import com.reguerta.user.R
import com.reguerta.user.data.media.ImagePipelineManager
import com.reguerta.user.data.media.ImageUploadNamespace
import com.reguerta.user.domain.news.NewsArticle
import com.reguerta.user.domain.news.NewsRepository
import com.reguerta.user.domain.notifications.NotificationEvent
import com.reguerta.user.domain.notifications.NotificationRepository
import com.reguerta.user.domain.notifications.PushNotificationPermissionProvider
import com.reguerta.user.domain.profiles.SharedProfile
import com.reguerta.user.domain.profiles.SharedProfileRepository
import com.reguerta.user.domain.access.canPublishNews
import com.reguerta.user.domain.access.canSendAdminNotifications
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

internal class SessionCommunityActions(
    private val uiState: MutableStateFlow<SessionUiState>,
    private val scope: CoroutineScope,
    private val newsRepository: NewsRepository,
    private val notificationRepository: NotificationRepository,
    private val sharedProfileRepository: SharedProfileRepository,
    private val imagePipelineManager: ImagePipelineManager,
    private val nowMillisProvider: () -> Long,
    private val emitMessage: (Int) -> Unit,
    private val emitEvent: (SessionUiEvent) -> Unit,
    private val pushNotificationPermissionProvider: PushNotificationPermissionProvider,
) {
    private var nextProfileMutationToken = 0L
    private var activeProfileMutation: ActiveProfileMutation? = null
    private var nextProfileUploadToken = 0L
    private var activeProfileUpload: ActiveProfileUpload? = null

    fun refreshSharedProfiles() {
        val initialState = uiState.value
        val mode = initialState.mode as? SessionMode.Authorized ?: return
        val context = ProfileSessionContext.from(initialState, mode)
        val editorRevision = initialState.sharedProfileEditorRevision
        val profilesRevision = initialState.sharedProfilesRevision
        scope.launch {
            if (!updateProfileStateIfCurrent(context) { it.copy(isLoadingSharedProfiles = true) }) return@launch
            try {
                val profiles = sharedProfileRepository.getAllSharedProfiles()
                currentCoroutineContext().ensureActive()
                updateProfileStateIfCurrent(context) { state ->
                    val canApplyProfiles = state.sharedProfilesRevision == profilesRevision
                    val canApplyDraft = canApplyProfiles &&
                        state.sharedProfileEditorRevision == editorRevision
                    val ownProfile = profiles.firstOrNull { it.userId == mode.member.id }
                    state.copy(
                        sharedProfiles = if (canApplyProfiles) {
                            profiles.filter(SharedProfile::hasVisibleContent)
                        } else {
                            state.sharedProfiles
                        },
                        sharedProfileDraft = if (canApplyDraft) {
                            ownProfile?.toDraft() ?: SharedProfileDraft()
                        } else {
                            state.sharedProfileDraft
                        },
                        sharedProfileEditorRevision = if (canApplyDraft) {
                            state.sharedProfileEditorRevision + 1
                        } else {
                            state.sharedProfileEditorRevision
                        },
                        isLoadingSharedProfiles = false,
                    )
                }
            } catch (cancellation: CancellationException) {
                updateProfileStateIfCurrent(context) { it.copy(isLoadingSharedProfiles = false) }
                throw cancellation
            } catch (_: Exception) {
                if (updateProfileStateIfCurrent(context) { it.copy(isLoadingSharedProfiles = false) }) {
                    emitMessage(R.string.feedback_unable_load_data)
                }
            }
        }
    }

    fun saveSharedProfile(onSuccess: () -> Unit = {}) {
        val initialState = uiState.value
        val mode = initialState.mode as? SessionMode.Authorized ?: return
        val context = ProfileSessionContext.from(initialState, mode)
        if (initialState.isUploadingSharedProfileImage ||
            initialState.isSavingSharedProfile ||
            initialState.isDeletingSharedProfile
        ) return
        val draft = initialState.sharedProfileDraft.normalized()
        if (!draft.hasVisibleContent) {
            emitMessage(R.string.feedback_shared_profile_content_required)
            return
        }
        val editorRevision = initialState.sharedProfileEditorRevision

        scope.launch {
            val token = beginProfileMutation(context, isDelete = false) ?: return@launch
            val saved = try {
                sharedProfileRepository.upsertSharedProfile(
                    SharedProfile(
                        userId = mode.member.id,
                        familyNames = draft.familyNames,
                        photoUrl = draft.photoUrl.ifBlank { null },
                        about = draft.about,
                        updatedAtMillis = nowMillisProvider(),
                    ),
                )
                    .also { currentCoroutineContext().ensureActive() }
            } catch (cancellation: CancellationException) {
                finishProfileMutation(context, token)
                throw cancellation
            } catch (_: Exception) {
                if (isCurrentProfileEditor(context, editorRevision)) {
                    emitMessage(R.string.feedback_unable_save_changes)
                }
                finishProfileMutation(context, token)
                return@launch
            }
            if (!isCurrentProfileMutation(context, token)) return@launch
            val editorIsCurrent = isCurrentProfileEditor(context, editorRevision)
            updateProfileStateIfCurrent(context) { state ->
                val updatedProfiles = buildList {
                    addAll(state.sharedProfiles.filterNot { it.userId == saved.userId })
                    if (saved.hasVisibleContent) add(saved)
                }.sortedByDescending(SharedProfile::updatedAtMillis)
                state.copy(
                    sharedProfiles = updatedProfiles,
                    sharedProfileDraft = if (editorIsCurrent) saved.toDraft() else state.sharedProfileDraft,
                    sharedProfileEditorRevision = if (editorIsCurrent) {
                        state.sharedProfileEditorRevision + 1
                    } else {
                        state.sharedProfileEditorRevision
                    },
                    sharedProfilesRevision = state.sharedProfilesRevision + 1,
                )
            }
            finishProfileMutation(context, token)
            if (editorIsCurrent) onSuccess()
        }
    }

    fun deleteSharedProfile(onSuccess: () -> Unit = {}) {
        val initialState = uiState.value
        val mode = initialState.mode as? SessionMode.Authorized ?: return
        val context = ProfileSessionContext.from(initialState, mode)
        if (initialState.isUploadingSharedProfileImage ||
            initialState.isSavingSharedProfile ||
            initialState.isDeletingSharedProfile
        ) return
        val editorRevision = initialState.sharedProfileEditorRevision
        scope.launch {
            val token = beginProfileMutation(context, isDelete = true) ?: return@launch
            val deleted = try {
                sharedProfileRepository.deleteSharedProfile(mode.member.id)
                    .also { currentCoroutineContext().ensureActive() }
            } catch (cancellation: CancellationException) {
                finishProfileMutation(context, token)
                throw cancellation
            } catch (_: Exception) {
                if (isCurrentProfileMutation(context, token)) {
                    emitMessage(R.string.feedback_shared_profile_delete_failed)
                }
                finishProfileMutation(context, token)
                return@launch
            }
            if (!deleted || !isCurrentProfileMutation(context, token)) {
                if (!deleted && isCurrentProfileMutation(context, token)) {
                    emitMessage(R.string.feedback_shared_profile_delete_failed)
                }
                finishProfileMutation(context, token)
                return@launch
            }
            val editorIsCurrent = isCurrentProfileEditor(context, editorRevision)
            updateProfileStateIfCurrent(context) { state ->
                state.copy(
                    sharedProfiles = state.sharedProfiles.filterNot { it.userId == mode.member.id },
                    sharedProfileDraft = if (editorIsCurrent) SharedProfileDraft() else state.sharedProfileDraft,
                    sharedProfileEditorRevision = if (editorIsCurrent) {
                        state.sharedProfileEditorRevision + 1
                    } else {
                        state.sharedProfileEditorRevision
                    },
                    sharedProfilesRevision = state.sharedProfilesRevision + 1,
                )
            }
            emitMessage(R.string.feedback_shared_profile_deleted)
            finishProfileMutation(context, token)
            onSuccess()
        }
    }

    fun refreshNews() {
        val mode = uiState.value.mode as? SessionMode.Authorized ?: return
        scope.launch {
            uiState.update { it.copy(isLoadingNews = true) }
            val allNews = newsRepository.getNewsFor(mode.member)
            val visibleNews = if (mode.member.canPublishNews) {
                allNews
            } else {
                allNews.filter { article -> article.active }
            }
            val latestActiveNews = allNews.filter { it.active }.take(3)
            uiState.update {
                val currentMode = it.mode as? SessionMode.Authorized
                if (currentMode?.principal?.uid != mode.principal.uid) {
                    it
                } else {
                    it.copy(
                        latestNews = latestActiveNews,
                        newsFeed = visibleNews,
                        isLoadingNews = false,
                        isUploadingNewsImage = false,
                    )
                }
            }
        }
    }

    fun refreshNotifications() {
        val mode = uiState.value.mode as? SessionMode.Authorized ?: return
        scope.launch {
            uiState.update { it.copy(isLoadingNotifications = true) }
            val allNotifications = notificationRepository.getNotificationsFor(mode.member)
            val readNotificationIds = notificationRepository.getReadNotificationIds(mode.member.id)
            uiState.update {
                val currentMode = it.mode as? SessionMode.Authorized
                if (currentMode?.principal?.uid != mode.principal.uid) {
                    it
                } else {
                    it.copy(
                        notificationsFeed = allNotifications,
                        readNotificationIds = readNotificationIds,
                        isLoadingNotifications = false,
                    )
                }
            }
        }
    }

    fun prepareNotificationsRoute() {
        val mode = uiState.value.mode as? SessionMode.Authorized ?: return
        scope.launch {
            uiState.update {
                it.copy(
                    isLoadingNotifications = true,
                    showPushNotificationPermissionDialog = false,
                )
            }
            val allNotifications = notificationRepository.getNotificationsFor(mode.member)
            val readNotificationIds = notificationRepository.getReadNotificationIds(mode.member.id)
            val isPermissionActive = pushNotificationPermissionProvider.isPushNotificationPermissionActive()
            uiState.update {
                val currentMode = it.mode as? SessionMode.Authorized
                if (currentMode?.principal?.uid != mode.principal.uid) {
                    it
                } else {
                    it.copy(
                        notificationsFeed = allNotifications,
                        readNotificationIds = readNotificationIds,
                        isLoadingNotifications = false,
                        isPushNotificationPermissionActive = isPermissionActive,
                        showPushNotificationPermissionDialog = !isPermissionActive,
                    )
                }
            }
        }
    }

    fun markVisibleNotificationsReadOnExit() {
        val mode = uiState.value.mode as? SessionMode.Authorized ?: return
        val unreadIds = uiState.value.notificationsFeed
            .map { it.id }
            .filter { it !in uiState.value.readNotificationIds }
            .toSet()
        if (unreadIds.isEmpty()) return

        scope.launch {
            notificationRepository.markNotificationsRead(
                memberId = mode.member.id,
                notificationIds = unreadIds,
                readAtMillis = nowMillisProvider(),
            )
            uiState.update {
                val currentMode = it.mode as? SessionMode.Authorized
                if (currentMode?.principal?.uid != mode.principal.uid) {
                    it
                } else {
                    it.copy(readNotificationIds = it.readNotificationIds + unreadIds)
                }
            }
        }
    }

    fun dismissPushNotificationPermissionDialog() {
        uiState.update { it.copy(showPushNotificationPermissionDialog = false) }
    }

    fun openPushNotificationSettings() {
        uiState.update { it.copy(showPushNotificationPermissionDialog = false) }
        emitEvent(SessionUiEvent.OpenPushNotificationSettings)
    }

    fun saveNews(onSuccess: (NewsSaveResult) -> Unit = {}) {
        val mode = uiState.value.mode as? SessionMode.Authorized ?: return
        if (!mode.member.canPublishNews) {
            emitMessage(R.string.feedback_only_admin_publish_news)
            return
        }
        if (uiState.value.isUploadingNewsImage) {
            return
        }

        val draft = uiState.value.newsDraft
        if (draft.title.trim().isBlank() || draft.body.trim().isBlank()) {
            emitMessage(R.string.feedback_news_title_body_required)
            return
        }

        scope.launch {
            uiState.update { it.copy(isSavingNews = true) }
            val nowMillis = nowMillisProvider()
            val existing = uiState.value.newsFeed.firstOrNull { it.id == uiState.value.editingNewsId }
            val saved = newsRepository.upsertNews(
                NewsArticle(
                    id = uiState.value.editingNewsId.orEmpty(),
                    title = draft.title.trim(),
                    body = draft.body.trim(),
                    active = draft.active,
                    publishedBy = existing?.publishedBy ?: mode.member.displayName,
                    publishedAtMillis = existing?.publishedAtMillis ?: nowMillis,
                    urlImage = draft.urlImage.trim().ifBlank { null },
                    publishedByUserId = mode.member.id,
                ),
            )
            val allNews = newsRepository.getNewsFor(mode.member)
            val visibleNews = allNews
            val latestActiveNews = allNews.filter { it.active }.take(3)
            val isNew = existing == null
            uiState.update {
                it.copy(
                    latestNews = latestActiveNews,
                    newsFeed = visibleNews,
                    newsDraft = NewsDraft(
                        title = saved.title,
                        body = saved.body,
                        urlImage = saved.urlImage.orEmpty(),
                        active = saved.active,
                    ),
                    editingNewsId = saved.id,
                    isSavingNews = false,
                )
            }
            onSuccess(NewsSaveResult(newsId = saved.id, isNew = isNew))
        }
    }

    fun uploadNewsImageFromUri(sourceUri: Uri) {
        val mode = uiState.value.mode as? SessionMode.Authorized ?: return
        if (!mode.member.canPublishNews) {
            emitMessage(R.string.feedback_only_admin_publish_news)
            return
        }
        scope.launch {
            uiState.update { it.copy(isUploadingNewsImage = true) }
            val currentState = uiState.value
            val uploaded = imagePipelineManager.processAndUpload(
                sourceUri = sourceUri,
                ownerId = mode.member.id,
                namespace = ImageUploadNamespace.NEWS,
                entityId = currentState.editingNewsId,
                nameHint = currentState.newsDraft.title,
            )
            if (uploaded == null) {
                uiState.update { it.copy(isUploadingNewsImage = false) }
                emitMessage(R.string.feedback_news_image_upload_failed)
                return@launch
            }
            uiState.update {
                it.copy(
                    newsDraft = it.newsDraft.copy(urlImage = uploaded.downloadUrl),
                    isUploadingNewsImage = false,
                )
            }
            emitMessage(R.string.feedback_news_image_uploaded)
        }
    }

    fun clearNewsImage() {
        uiState.update {
            it.copy(
                newsDraft = it.newsDraft.copy(urlImage = ""),
            )
        }
    }

    fun uploadSharedProfileImageFromUri(sourceUri: Uri) {
        val initialState = uiState.value
        val mode = initialState.mode as? SessionMode.Authorized ?: return
        val context = ProfileSessionContext.from(initialState, mode)
        if (initialState.isUploadingSharedProfileImage ||
            initialState.isSavingSharedProfile ||
            initialState.isDeletingSharedProfile
        ) return
        val editorRevision = initialState.sharedProfileEditorRevision
        scope.launch {
            val token = beginProfileUpload(context) ?: return@launch
            val uploaded = try {
                imagePipelineManager.processAndUpload(
                    sourceUri = sourceUri,
                    ownerId = mode.member.id,
                    namespace = ImageUploadNamespace.SHARED_PROFILES,
                    entityId = mode.member.id,
                    nameHint = mode.member.displayName,
                ).also { currentCoroutineContext().ensureActive() }
            } catch (cancellation: CancellationException) {
                finishProfileUpload(context, token)
                throw cancellation
            } catch (_: Exception) {
                if (isCurrentProfileEditor(context, editorRevision)) {
                    emitMessage(R.string.feedback_shared_profile_image_upload_failed)
                }
                finishProfileUpload(context, token)
                return@launch
            }
            if (uploaded == null || !isCurrentProfileUpload(context, token, editorRevision)) {
                if (uploaded == null && isCurrentProfileEditor(context, editorRevision)) {
                    emitMessage(R.string.feedback_shared_profile_image_upload_failed)
                }
                finishProfileUpload(context, token)
                return@launch
            }
            updateProfileStateIfCurrent(context) {
                it.copy(
                    sharedProfileDraft = it.sharedProfileDraft.copy(photoUrl = uploaded.downloadUrl),
                    sharedProfileEditorRevision = it.sharedProfileEditorRevision + 1,
                )
            }
            finishProfileUpload(context, token)
            emitMessage(R.string.feedback_shared_profile_image_uploaded)
        }
    }

    fun clearSharedProfileImage() {
        uiState.update {
            it.copy(
                sharedProfileDraft = it.sharedProfileDraft.copy(photoUrl = ""),
                sharedProfileEditorRevision = it.sharedProfileEditorRevision + 1,
            )
        }
    }

    fun deleteNews(
        newsId: String,
        onSuccess: () -> Unit = {},
    ) {
        val mode = uiState.value.mode as? SessionMode.Authorized ?: return
        if (!mode.member.canPublishNews) {
            emitMessage(R.string.feedback_only_admin_delete_news)
            return
        }

        scope.launch {
            val deleted = newsRepository.deleteNews(newsId)
            if (!deleted) {
                emitMessage(R.string.feedback_news_delete_failed)
                return@launch
            }
            val allNews = newsRepository.getNewsFor(mode.member)
            uiState.update {
                it.copy(
                    latestNews = allNews.filter { article -> article.active }.take(3),
                    newsFeed = allNews,
                    newsDraft = if (it.editingNewsId == newsId) NewsDraft() else it.newsDraft,
                    editingNewsId = if (it.editingNewsId == newsId) null else it.editingNewsId,
                )
            }
            emitMessage(R.string.feedback_news_deleted)
            onSuccess()
        }
    }

    fun sendNotification(onSuccess: () -> Unit = {}) {
        val mode = uiState.value.mode as? SessionMode.Authorized ?: return
        if (!mode.member.canSendAdminNotifications) {
            emitMessage(R.string.feedback_only_admin_send_notification)
            return
        }

        val draft = uiState.value.notificationDraft
        if (draft.title.trim().isBlank() || draft.body.trim().isBlank()) {
            emitMessage(R.string.feedback_notification_title_body_required)
            return
        }

        scope.launch {
            uiState.update { it.copy(isSendingNotification = true) }
            notificationRepository.sendNotification(
                NotificationEvent(
                    id = "",
                    title = draft.title.trim(),
                    body = draft.body.trim(),
                    type = "admin_broadcast",
                    target = draft.audience.toTarget(),
                    userIds = emptyList(),
                    segmentType = draft.audience.toSegmentType(),
                    targetRole = draft.audience.toTargetRole(),
                    createdBy = mode.member.id,
                    sentAtMillis = nowMillisProvider(),
                    weekKey = null,
                ),
            )
            val allNotifications = notificationRepository.getNotificationsFor(mode.member)
            val readNotificationIds = notificationRepository.getReadNotificationIds(mode.member.id)
            uiState.update {
                it.copy(
                    notificationsFeed = allNotifications,
                    readNotificationIds = readNotificationIds,
                    notificationDraft = NotificationDraft(),
                    isSendingNotification = false,
                )
            }
            onSuccess()
        }
    }

    private fun isCurrentProfileSession(
        context: ProfileSessionContext,
        state: SessionUiState = uiState.value,
    ): Boolean {
        val currentMode = state.mode as? SessionMode.Authorized ?: return false
        return state.sessionEpoch == context.epoch &&
            currentMode.principal.uid == context.principalUid &&
            currentMode.member.id == context.memberId
    }

    private fun isCurrentProfileEditor(
        context: ProfileSessionContext,
        editorRevision: Long,
        state: SessionUiState = uiState.value,
    ): Boolean = isCurrentProfileSession(context, state) &&
        state.sharedProfileEditorRevision == editorRevision

    private fun updateProfileStateIfCurrent(
        context: ProfileSessionContext,
        transform: (SessionUiState) -> SessionUiState,
    ): Boolean {
        if (!isCurrentProfileSession(context)) return false
        var didUpdate = false
        uiState.update { state ->
            if (isCurrentProfileSession(context, state)) {
                didUpdate = true
                transform(state)
            } else {
                state
            }
        }
        return didUpdate
    }

    private fun beginProfileMutation(context: ProfileSessionContext, isDelete: Boolean): Long? {
        if (!isCurrentProfileSession(context)) return null
        val activeMutation = activeProfileMutation
        if (activeMutation?.context == context ||
            (activeMutation == null &&
                (uiState.value.isSavingSharedProfile || uiState.value.isDeletingSharedProfile))
        ) return null
        if (uiState.value.isUploadingSharedProfileImage) return null

        nextProfileMutationToken += 1
        val token = nextProfileMutationToken
        activeProfileMutation = ActiveProfileMutation(context, token)
        val updated = updateProfileStateIfCurrent(context) {
            if (isDelete) {
                it.copy(isDeletingSharedProfile = true)
            } else {
                it.copy(isSavingSharedProfile = true)
            }
        }
        if (!updated) {
            activeProfileMutation = null
            return null
        }
        return token
    }

    private fun isCurrentProfileMutation(context: ProfileSessionContext, token: Long): Boolean =
        activeProfileMutation == ActiveProfileMutation(context, token) && isCurrentProfileSession(context)

    private fun finishProfileMutation(context: ProfileSessionContext, token: Long) {
        if (activeProfileMutation != ActiveProfileMutation(context, token)) return
        activeProfileMutation = null
        updateProfileStateIfCurrent(context) {
            it.copy(
                isSavingSharedProfile = false,
                isDeletingSharedProfile = false,
            )
        }
    }

    private fun beginProfileUpload(context: ProfileSessionContext): Long? {
        if (!isCurrentProfileSession(context)) return null
        val activeUpload = activeProfileUpload
        if (activeUpload?.context == context ||
            (activeUpload == null && uiState.value.isUploadingSharedProfileImage)
        ) return null
        if (uiState.value.isSavingSharedProfile || uiState.value.isDeletingSharedProfile) return null

        nextProfileUploadToken += 1
        val token = nextProfileUploadToken
        activeProfileUpload = ActiveProfileUpload(context, token)
        if (!updateProfileStateIfCurrent(context) { it.copy(isUploadingSharedProfileImage = true) }) {
            activeProfileUpload = null
            return null
        }
        return token
    }

    private fun isCurrentProfileUpload(
        context: ProfileSessionContext,
        token: Long,
        editorRevision: Long,
    ): Boolean = activeProfileUpload == ActiveProfileUpload(context, token) &&
        isCurrentProfileEditor(context, editorRevision)

    private fun finishProfileUpload(context: ProfileSessionContext, token: Long) {
        if (activeProfileUpload != ActiveProfileUpload(context, token)) return
        activeProfileUpload = null
        updateProfileStateIfCurrent(context) { it.copy(isUploadingSharedProfileImage = false) }
    }
}

private data class ProfileSessionContext(
    val epoch: Long,
    val principalUid: String,
    val memberId: String,
) {
    companion object {
        fun from(state: SessionUiState, mode: SessionMode.Authorized) = ProfileSessionContext(
            epoch = state.sessionEpoch,
            principalUid = mode.principal.uid,
            memberId = mode.member.id,
        )
    }
}

private data class ActiveProfileMutation(
    val context: ProfileSessionContext,
    val token: Long,
)

private data class ActiveProfileUpload(
    val context: ProfileSessionContext,
    val token: Long,
)
