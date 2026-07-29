package com.reguerta.user.presentation.root

import android.net.Uri
import com.reguerta.user.R
import com.reguerta.user.data.media.ImagePipelineManager
import com.reguerta.user.data.media.ImageUploadNamespace
import com.reguerta.user.data.media.ImageUploadResult
import com.reguerta.user.domain.news.NewsArticle
import com.reguerta.user.domain.news.NewsRepository
import com.reguerta.user.domain.notifications.NotificationEvent
import com.reguerta.user.domain.notifications.NotificationRepository
import com.reguerta.user.domain.notifications.PushNotificationPermissionProvider
import com.reguerta.user.domain.profiles.SharedProfile
import com.reguerta.user.domain.profiles.SharedProfileRepository
import com.reguerta.user.domain.access.AccessCapability
import com.reguerta.user.domain.access.MemberPermissionMatrix
import com.reguerta.user.domain.access.MemberRole
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
    private val runtimeEnvironmentProvider: () -> String?,
) {
    private var nextProfileMutationToken = 0L
    private var activeProfileMutation: ActiveProfileMutation? = null
    private var nextProfileUploadToken = 0L
    private var activeProfileUpload: ActiveProfileUpload? = null
    private var nextNewsRefreshToken = 0L
    private var activeNewsRefresh: ActiveCommunityOperation? = null
    private var nextNotificationsRefreshToken = 0L
    private var activeNotificationsRefresh: ActiveCommunityOperation? = null
    private var nextNewsMutationToken = 0L
    private var activeNewsMutation: ActiveNewsMutation? = null
    private var nextNotificationMutationToken = 0L
    private var activeNotificationMutation: ActiveNotificationMutation? = null
    private var nextNewsUploadToken = 0L
    private var activeNewsUpload: ActiveNewsUpload? = null

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
        refreshNews(shouldEmitFailureFeedback = { true })
    }

    private fun refreshNews(
        shouldEmitFailureFeedback: (SessionUiState) -> Boolean,
    ) {
        val initialState = uiState.value
        val mode = initialState.mode as? SessionMode.Authorized ?: return
        val context = CommunitySessionContext.from(initialState, mode)
        val token = beginNewsRefresh(context) ?: return
        scope.launch {
            if (!isCurrentCommunitySession(context)) return@launch
            try {
                val allNews = newsRepository.getNewsFor(mode.member)
                currentCoroutineContext().ensureActive()
                val visibleNews = if (mode.member.canPublishNews) {
                    allNews
                } else {
                    allNews.filter { article -> article.active }
                }
                val latestActiveNews = allNews.filter(NewsArticle::active).take(3)
                completeNewsRefresh(context, token) {
                    it.copy(
                        latestNews = latestActiveNews,
                        newsFeed = visibleNews,
                        isLoadingNews = false,
                    )
                }
            } catch (cancellation: CancellationException) {
                finishNewsRefresh(context, token)
                throw cancellation
            } catch (_: Exception) {
                if (finishNewsRefresh(context, token) && shouldEmitFailureFeedback(uiState.value)) {
                    emitMessage(R.string.feedback_unable_load_data)
                }
            }
        }
    }

    fun refreshNotifications() {
        refreshNotifications(
            prepareRoute = false,
            shouldEmitFailureFeedback = { true },
        )
    }

    fun prepareNotificationsRoute() {
        refreshNotifications(
            prepareRoute = true,
            shouldEmitFailureFeedback = { true },
        )
    }

    private fun refreshNotifications(
        prepareRoute: Boolean,
        shouldEmitFailureFeedback: (SessionUiState) -> Boolean,
    ) {
        val initialState = uiState.value
        val mode = initialState.mode as? SessionMode.Authorized ?: return
        val context = CommunitySessionContext.from(initialState, mode)
        val readRevision = initialState.notificationReadRevision
        val token = beginNotificationsRefresh(context, prepareRoute) ?: return
        scope.launch {
            if (!isCurrentCommunitySession(context)) return@launch
            try {
                val allNotifications = notificationRepository.getNotificationsFor(mode.member)
                currentCoroutineContext().ensureActive()
                if (!isCurrentCommunitySession(context)) return@launch
                val readNotificationIds = notificationRepository.getReadNotificationIds(mode.member.id)
                currentCoroutineContext().ensureActive()
                if (!isCurrentCommunitySession(context)) return@launch
                val isPermissionActive = if (prepareRoute) {
                    pushNotificationPermissionProvider.isPushNotificationPermissionActive()
                } else {
                    null
                }
                currentCoroutineContext().ensureActive()
                completeNotificationsRefresh(context, token) { state ->
                    val visibleNotifications = allNotifications.filter { event ->
                        event.isVisibleTo(mode.member)
                    }
                    val remoteNotificationIds = allNotifications.mapTo(mutableSetOf()) { it.id }
                    val pendingNotifications = state.pendingNotificationAcknowledgements
                        .filter { event ->
                            event.id !in remoteNotificationIds && event.isVisibleTo(mode.member)
                        }
                    val pendingReadIds = state.pendingReadNotificationIds - readNotificationIds
                    val effectiveReadIds = buildSet {
                        addAll(readNotificationIds)
                        addAll(pendingReadIds)
                        if (state.notificationReadRevision != readRevision) {
                            addAll(state.readNotificationIds)
                        }
                    }
                    state.copy(
                        notificationsFeed = buildList {
                            addAll(visibleNotifications)
                            addAll(pendingNotifications)
                        }.distinctBy(NotificationEvent::id)
                            .sortedByDescending(NotificationEvent::sentAtMillis),
                        readNotificationIds = effectiveReadIds,
                        pendingNotificationAcknowledgements = pendingNotifications,
                        pendingReadNotificationIds = pendingReadIds,
                        isLoadingNotifications = false,
                        isPushNotificationPermissionActive = isPermissionActive
                            ?: state.isPushNotificationPermissionActive,
                        showPushNotificationPermissionDialog = isPermissionActive?.not()
                            ?: state.showPushNotificationPermissionDialog,
                    )
                }
            } catch (cancellation: CancellationException) {
                finishNotificationsRefresh(context, token)
                throw cancellation
            } catch (_: Exception) {
                if (
                    finishNotificationsRefresh(context, token) &&
                    shouldEmitFailureFeedback(uiState.value)
                ) {
                    emitMessage(R.string.feedback_unable_load_data)
                }
            }
        }
    }

    fun markVisibleNotificationsReadOnExit() {
        val initialState = uiState.value
        val mode = initialState.mode as? SessionMode.Authorized ?: return
        val context = CommunitySessionContext.from(initialState, mode)
        if (!isCurrentCommunitySession(context)) return
        val unreadIds = initialState.notificationsFeed
            .filter { event -> event.isVisibleTo(mode.member) }
            .map { it.id }
            .filter { it !in initialState.readNotificationIds }
            .toSet()
        if (unreadIds.isEmpty()) return

        scope.launch {
            if (!isCurrentCommunitySession(context)) return@launch
            try {
                notificationRepository.markNotificationsRead(
                    memberId = mode.member.id,
                    notificationIds = unreadIds,
                    readAtMillis = nowMillisProvider(),
                )
                currentCoroutineContext().ensureActive()
                updateCommunityStateIfCurrent(context) {
                    it.copy(
                        readNotificationIds = it.readNotificationIds + unreadIds,
                        pendingReadNotificationIds = it.pendingReadNotificationIds + unreadIds,
                        notificationReadRevision = it.notificationReadRevision + 1,
                    )
                }
            } catch (cancellation: CancellationException) {
                throw cancellation
            } catch (_: Exception) {
                if (isCurrentCommunitySession(context)) {
                    emitMessage(R.string.feedback_unable_save_changes)
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
        val initialState = uiState.value
        val mode = initialState.mode as? SessionMode.Authorized ?: return
        val context = CommunitySessionContext.from(initialState, mode)
        if (!isCurrentCommunitySession(context)) return
        if (!mode.member.canPublishNews) {
            emitMessage(R.string.feedback_only_admin_publish_news)
            return
        }
        if (initialState.isUploadingNewsImage ||
            initialState.isSavingNews ||
            initialState.isDeletingNews
        ) {
            return
        }

        val draft = initialState.newsDraft
        if (draft.title.trim().isBlank() || draft.body.trim().isBlank()) {
            emitMessage(R.string.feedback_news_title_body_required)
            return
        }
        val existing = initialState.newsFeed.firstOrNull { it.id == initialState.editingNewsId }
        val editorOwnership = NewsEditorOwnership(
            editingNewsId = initialState.editingNewsId,
            editorGeneration = initialState.newsEditorRevision,
            draftRevision = initialState.newsDraftRevision,
        )
        val operation = beginNewsMutation(
            context = context,
            kind = NewsMutationKind.SAVE,
            editorOwnership = editorOwnership,
        ) ?: return

        scope.launch {
            if (!isCurrentNewsMutation(operation)) return@launch
            val nowMillis = nowMillisProvider()
            val saved = try {
                newsRepository.upsertNews(
                    NewsArticle(
                        id = initialState.editingNewsId.orEmpty(),
                        title = draft.title.trim(),
                        body = draft.body.trim(),
                        active = draft.active,
                        publishedBy = existing?.publishedBy ?: mode.member.displayName,
                        publishedAtMillis = existing?.publishedAtMillis ?: nowMillis,
                        urlImage = draft.urlImage.trim().ifBlank { null },
                        publishedByUserId = mode.member.id,
                    ),
                ).also { currentCoroutineContext().ensureActive() }
            } catch (cancellation: CancellationException) {
                finishNewsMutation(operation)
                throw cancellation
            } catch (_: Exception) {
                val shouldEmitFeedback = isCurrentNewsMutationEditor(operation)
                finishNewsMutation(operation)
                if (shouldEmitFeedback) {
                    emitMessage(R.string.feedback_unable_save_changes)
                }
                return@launch
            }
            val isNew = existing == null
            if (!isCurrentNewsMutation(operation)) return@launch
            if (!invalidateNewsRefresh(context)) return@launch
            var editorWasCurrent = false
            var postAcknowledgementOwnership: NewsEditorOwnership? = null
            val applied = completeNewsMutation(operation) { state ->
                editorWasCurrent = editorOwnership.matches(state)
                val allNews = buildList {
                    addAll(state.newsFeed.filterNot { article -> article.id == saved.id })
                    add(saved)
                }.sortedByDescending(NewsArticle::publishedAtMillis)
                state.copy(
                    latestNews = allNews.filter(NewsArticle::active).take(3),
                    newsFeed = if (mode.member.canPublishNews) {
                        allNews
                    } else {
                        allNews.filter(NewsArticle::active)
                    },
                    newsDraft = if (editorWasCurrent) {
                        NewsDraft(
                            title = saved.title,
                            body = saved.body,
                            urlImage = saved.urlImage.orEmpty(),
                            active = saved.active,
                        )
                    } else {
                        state.newsDraft
                    },
                    editingNewsId = if (editorWasCurrent) saved.id else state.editingNewsId,
                    newsDraftRevision = if (editorWasCurrent) {
                        state.newsDraftRevision + 1
                    } else {
                        state.newsDraftRevision
                    },
                    newsImageRevision = if (editorWasCurrent) {
                        state.newsImageRevision + 1
                    } else {
                        state.newsImageRevision
                    },
                ).also { updatedState ->
                    if (editorWasCurrent) {
                        postAcknowledgementOwnership = NewsEditorOwnership(
                            editingNewsId = saved.id,
                            editorGeneration = updatedState.newsEditorRevision,
                            draftRevision = updatedState.newsDraftRevision,
                        )
                    }
                }
            }
            if (!applied) return@launch
            if (editorWasCurrent) {
                val confirmationIdentity = checkNotNull(postAcknowledgementOwnership)
                    .toConfirmationIdentity()
                onSuccess(
                    NewsSaveResult(
                        newsId = saved.id,
                        isNew = isNew,
                        confirmationIdentity = confirmationIdentity,
                    ),
                )
            }
            refreshNews { state ->
                postAcknowledgementOwnership?.matches(state) == true &&
                    isCurrentCommunitySession(context, state)
            }
        }
    }

    fun uploadNewsImageFromUri(sourceUri: Uri) {
        uploadNewsImage { initialState, mode ->
            imagePipelineManager.processAndUpload(
                sourceUri = sourceUri,
                ownerId = mode.member.id,
                namespace = ImageUploadNamespace.NEWS,
                entityId = initialState.editingNewsId,
                nameHint = initialState.newsDraft.title,
            )
        }
    }

    internal fun uploadNewsImage(
        processAndUpload: suspend (SessionUiState, SessionMode.Authorized) -> ImageUploadResult?,
    ) {
        val initialState = uiState.value
        val mode = initialState.mode as? SessionMode.Authorized ?: return
        val context = CommunitySessionContext.from(initialState, mode)
        val imageOwnership = NewsImageOwnership(
            editingNewsId = initialState.editingNewsId,
            editorGeneration = initialState.newsEditorRevision,
            imageRevision = initialState.newsImageRevision,
        )
        if (!isCurrentCommunitySession(context)) return
        if (!mode.member.canPublishNews) {
            emitMessage(R.string.feedback_only_admin_publish_news)
            return
        }
        if (initialState.isSavingNews || initialState.isDeletingNews) return
        val operation = beginNewsUpload(
            context = context,
            imageOwnership = imageOwnership,
        ) ?: return
        scope.launch {
            try {
                if (!isCurrentNewsUpload(operation)) {
                    return@launch
                }
                val uploaded = processAndUpload(initialState, mode)
                    .also { currentCoroutineContext().ensureActive() }
                if (uploaded == null) {
                    if (isCurrentNewsUpload(operation)) {
                        emitMessage(R.string.feedback_news_image_upload_failed)
                    }
                    return@launch
                }
                val applied = updateNewsImageIfCurrent(
                    context = context,
                    imageOwnership = imageOwnership,
                ) { state ->
                    state.copy(
                        newsDraft = state.newsDraft.copy(urlImage = uploaded.downloadUrl),
                        newsDraftRevision = state.newsDraftRevision + 1,
                        newsImageRevision = state.newsImageRevision + 1,
                        isUploadingNewsImage = false,
                    )
                }
                if (!applied) return@launch
                emitMessage(R.string.feedback_news_image_uploaded)
            } catch (cancellation: CancellationException) {
                throw cancellation
            } catch (_: Exception) {
                if (isCurrentNewsUpload(operation)) {
                    emitMessage(R.string.feedback_news_image_upload_failed)
                }
            } finally {
                finishNewsUpload(operation)
            }
        }
    }

    fun clearNewsImage() {
        uiState.update {
            it.copy(
                newsDraft = it.newsDraft.copy(urlImage = ""),
                newsDraftRevision = it.newsDraftRevision + 1,
                newsImageRevision = it.newsImageRevision + 1,
                isUploadingNewsImage = false,
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
        requestRevision: Long,
        onSuccess: () -> Unit = {},
    ) {
        val initialState = uiState.value
        val mode = initialState.mode as? SessionMode.Authorized ?: return
        val context = CommunitySessionContext.from(initialState, mode)
        if (!isCurrentCommunitySession(context)) return
        if (!mode.member.canPublishNews) {
            emitMessage(R.string.feedback_only_admin_delete_news)
            return
        }
        val deletionOwnership = NewsDeletionOwnership(
            newsId = newsId,
            requestRevision = requestRevision,
        )
        if (!deletionOwnership.matchesRequest(initialState)) return
        val operation = beginNewsMutation(
            context = context,
            kind = NewsMutationKind.DELETE,
            deletionOwnership = deletionOwnership,
        ) ?: return

        scope.launch {
            if (!isCurrentNewsMutation(operation)) return@launch
            val deleted = try {
                newsRepository.deleteNews(newsId).also { currentCoroutineContext().ensureActive() }
            } catch (cancellation: CancellationException) {
                finishNewsMutation(operation)
                throw cancellation
            } catch (_: Exception) {
                val shouldEmitFeedback = isCurrentNewsDeletionRequest(operation)
                finishNewsMutation(operation)
                if (shouldEmitFeedback) {
                    emitMessage(R.string.feedback_news_delete_failed)
                }
                return@launch
            }
            if (!deleted) {
                val shouldEmitFeedback = isCurrentNewsDeletionRequest(operation)
                finishNewsMutation(operation)
                if (shouldEmitFeedback) {
                    emitMessage(R.string.feedback_news_delete_failed)
                }
                return@launch
            }
            if (!isCurrentNewsMutation(operation)) return@launch
            if (!invalidateNewsRefresh(context)) return@launch
            var requestWasCurrent = false
            val applied = completeNewsMutation(operation) { state ->
                requestWasCurrent = deletionOwnership.matchesRequest(state)
                val deletedArticleWasBeingEdited = state.editingNewsId == newsId
                val remainingNews = state.newsFeed.filterNot { article -> article.id == newsId }
                state.copy(
                    latestNews = remainingNews.filter(NewsArticle::active).take(3),
                    newsFeed = remainingNews,
                    newsDraft = if (deletedArticleWasBeingEdited) NewsDraft() else state.newsDraft,
                    editingNewsId = if (deletedArticleWasBeingEdited) null else state.editingNewsId,
                    newsEditorRevision = if (deletedArticleWasBeingEdited) {
                        state.newsEditorRevision + 1
                    } else {
                        state.newsEditorRevision
                    },
                    newsDraftRevision = if (deletedArticleWasBeingEdited) {
                        state.newsDraftRevision + 1
                    } else {
                        state.newsDraftRevision
                    },
                    newsImageRevision = if (deletedArticleWasBeingEdited) {
                        state.newsImageRevision + 1
                    } else {
                        state.newsImageRevision
                    },
                    isUploadingNewsImage = if (deletedArticleWasBeingEdited) {
                        false
                    } else {
                        state.isUploadingNewsImage
                    },
                    pendingNewsDeletionId = if (requestWasCurrent) {
                        null
                    } else {
                        state.pendingNewsDeletionId
                    },
                )
            }
            if (!applied) return@launch
            if (requestWasCurrent) {
                emitMessage(R.string.feedback_news_deleted)
                onSuccess()
            }
            refreshNews { state ->
                deletionOwnership.matchesGeneration(state) &&
                    isCurrentCommunitySession(context, state)
            }
        }
    }

    fun sendNotification(onSuccess: (NotificationSendResult) -> Unit = {}) {
        val initialState = uiState.value
        val mode = initialState.mode as? SessionMode.Authorized ?: return
        val context = CommunitySessionContext.from(initialState, mode)
        if (!isCurrentCommunitySession(context)) return
        if (!mode.member.canSendAdminNotifications) {
            emitMessage(R.string.feedback_only_admin_send_notification)
            return
        }

        if (initialState.isSendingNotification) return
        val draft = initialState.notificationDraft
        if (draft.title.trim().isBlank() || draft.body.trim().isBlank()) {
            emitMessage(R.string.feedback_notification_title_body_required)
            return
        }
        val editorOwnership = NotificationEditorOwnership(
            editorGeneration = initialState.notificationEditorRevision,
            draftRevision = initialState.notificationDraftRevision,
        )
        val operation = beginNotificationMutation(
            context = context,
            editorOwnership = editorOwnership,
        ) ?: return

        scope.launch {
            if (!isCurrentNotificationMutation(operation)) return@launch
            val sent = try {
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
                ).also { currentCoroutineContext().ensureActive() }
            } catch (cancellation: CancellationException) {
                finishNotificationMutation(operation)
                throw cancellation
            } catch (_: Exception) {
                val shouldEmitFeedback = isCurrentNotificationMutationEditor(operation)
                finishNotificationMutation(operation)
                if (shouldEmitFeedback) {
                    emitMessage(R.string.feedback_unable_save_changes)
                }
                return@launch
            }
            if (!isCurrentNotificationMutation(operation)) return@launch
            if (!invalidateNotificationsRefresh(context)) return@launch
            var editorWasCurrent = false
            var postAcknowledgementOwnership: NotificationEditorOwnership? = null
            val applied = completeNotificationMutation(operation) { state ->
                editorWasCurrent = editorOwnership.matches(state)
                val isVisible = sent.isVisibleTo(mode.member)
                val notifications = if (isVisible) {
                    buildList {
                        addAll(state.notificationsFeed.filterNot { event -> event.id == sent.id })
                        add(sent)
                    }.sortedByDescending(NotificationEvent::sentAtMillis)
                } else {
                    state.notificationsFeed
                }
                val pendingAcknowledgements = if (isVisible) {
                    buildList {
                        addAll(
                            state.pendingNotificationAcknowledgements.filterNot { event ->
                                event.id == sent.id
                            },
                        )
                        add(sent)
                    }.sortedByDescending(NotificationEvent::sentAtMillis)
                } else {
                    state.pendingNotificationAcknowledgements
                }
                state.copy(
                    notificationsFeed = notifications,
                    pendingNotificationAcknowledgements = pendingAcknowledgements,
                    notificationDraft = if (editorWasCurrent) {
                        NotificationDraft()
                    } else {
                        state.notificationDraft
                    },
                    notificationDraftRevision = if (editorWasCurrent) {
                        state.notificationDraftRevision + 1
                    } else {
                        state.notificationDraftRevision
                    },
                ).also { updatedState ->
                    if (editorWasCurrent) {
                        postAcknowledgementOwnership = NotificationEditorOwnership(
                            editorGeneration = updatedState.notificationEditorRevision,
                            draftRevision = updatedState.notificationDraftRevision,
                        )
                    }
                }
            }
            if (!applied) return@launch
            if (editorWasCurrent) {
                onSuccess(
                    NotificationSendResult(
                        confirmationIdentity = checkNotNull(postAcknowledgementOwnership)
                            .toConfirmationIdentity(),
                    ),
                )
            }
            refreshNotifications(
                prepareRoute = false,
                shouldEmitFailureFeedback = { state ->
                    postAcknowledgementOwnership?.matches(state) == true &&
                        isCurrentCommunitySession(context, state)
                },
            )
        }
    }

    private fun beginNewsMutation(
        context: CommunitySessionContext,
        kind: NewsMutationKind,
        editorOwnership: NewsEditorOwnership? = null,
        deletionOwnership: NewsDeletionOwnership? = null,
    ): ActiveNewsMutation? {
        if (!isCurrentCommunitySession(context)) return null
        val ownsCurrentState = when (kind) {
            NewsMutationKind.SAVE -> editorOwnership?.matches(uiState.value) == true
            NewsMutationKind.DELETE -> deletionOwnership?.matchesRequest(uiState.value) == true
        }
        if (!ownsCurrentState) return null
        val activeMutation = activeNewsMutation
        if (activeMutation?.context == context ||
            (activeMutation == null &&
                (uiState.value.isSavingNews || uiState.value.isDeletingNews)) ||
            uiState.value.isUploadingNewsImage ||
            activeNewsUpload?.context == context
        ) return null

        nextNewsMutationToken += 1
        val operation = ActiveNewsMutation(
            context = context,
            token = nextNewsMutationToken,
            kind = kind,
            editorOwnership = editorOwnership,
            deletionOwnership = deletionOwnership,
        )
        activeNewsMutation = operation
        val began = when (kind) {
            NewsMutationKind.SAVE -> updateNewsEditorIfCurrent(
                context = context,
                editorOwnership = checkNotNull(editorOwnership),
            ) { it.copy(isSavingNews = true) }

            NewsMutationKind.DELETE -> updateNewsDeletionRequestIfCurrent(
                context = context,
                deletionOwnership = checkNotNull(deletionOwnership),
            ) {
                it.copy(isDeletingNews = true)
            }
        }
        if (!began) {
            if (activeNewsMutation == operation) activeNewsMutation = null
            return null
        }
        return operation
    }

    private fun isCurrentNewsMutation(operation: ActiveNewsMutation): Boolean =
        activeNewsMutation == operation && isCurrentCommunitySession(operation.context)

    private fun isCurrentNewsMutationEditor(operation: ActiveNewsMutation): Boolean =
        isCurrentNewsMutation(operation) && operation.editorOwnership?.matches(uiState.value) == true

    private fun isCurrentNewsDeletionRequest(operation: ActiveNewsMutation): Boolean =
        isCurrentNewsMutation(operation) &&
            operation.deletionOwnership?.matchesRequest(uiState.value) == true

    private fun completeNewsMutation(
        operation: ActiveNewsMutation,
        transform: (SessionUiState) -> SessionUiState,
    ): Boolean {
        if (!isCurrentNewsMutation(operation)) return false
        activeNewsMutation = null
        return updateCommunityStateIfCurrent(operation.context) { state ->
            transform(state).copy(
                isSavingNews = false,
                isDeletingNews = false,
            )
        }
    }

    private fun finishNewsMutation(operation: ActiveNewsMutation): Boolean {
        if (activeNewsMutation != operation) return false
        activeNewsMutation = null
        return updateCommunityStateIfCurrent(operation.context) {
            it.copy(
                isSavingNews = false,
                isDeletingNews = false,
            )
        }
    }

    private fun beginNotificationMutation(
        context: CommunitySessionContext,
        editorOwnership: NotificationEditorOwnership,
    ): ActiveNotificationMutation? {
        if (!isCurrentNotificationEditor(context, editorOwnership)) return null
        val activeMutation = activeNotificationMutation
        if (activeMutation?.context == context ||
            (activeMutation == null && uiState.value.isSendingNotification)
        ) return null

        nextNotificationMutationToken += 1
        val operation = ActiveNotificationMutation(
            context = context,
            token = nextNotificationMutationToken,
            editorOwnership = editorOwnership,
        )
        activeNotificationMutation = operation
        if (!updateNotificationEditorIfCurrent(context, editorOwnership) {
                it.copy(isSendingNotification = true)
            }
        ) {
            if (activeNotificationMutation == operation) activeNotificationMutation = null
            return null
        }
        return operation
    }

    private fun isCurrentNotificationMutation(operation: ActiveNotificationMutation): Boolean =
        activeNotificationMutation == operation && isCurrentCommunitySession(operation.context)

    private fun isCurrentNotificationMutationEditor(operation: ActiveNotificationMutation): Boolean =
        isCurrentNotificationMutation(operation) && operation.editorOwnership.matches(uiState.value)

    private fun completeNotificationMutation(
        operation: ActiveNotificationMutation,
        transform: (SessionUiState) -> SessionUiState,
    ): Boolean {
        if (!isCurrentNotificationMutation(operation)) return false
        activeNotificationMutation = null
        return updateCommunityStateIfCurrent(operation.context) { state ->
            transform(state).copy(isSendingNotification = false)
        }
    }

    private fun finishNotificationMutation(operation: ActiveNotificationMutation): Boolean {
        if (activeNotificationMutation != operation) return false
        activeNotificationMutation = null
        return updateCommunityStateIfCurrent(operation.context) {
            it.copy(isSendingNotification = false)
        }
    }

    private fun beginNewsRefresh(context: CommunitySessionContext): Long? {
        if (!isCurrentCommunitySession(context)) return null
        nextNewsRefreshToken += 1
        val operation = ActiveCommunityOperation(context, nextNewsRefreshToken)
        activeNewsRefresh = operation
        if (!updateCommunityStateIfCurrent(context) { it.copy(isLoadingNews = true) }) {
            if (activeNewsRefresh == operation) activeNewsRefresh = null
            return null
        }
        return operation.token
    }

    private fun completeNewsRefresh(
        context: CommunitySessionContext,
        token: Long,
        transform: (SessionUiState) -> SessionUiState,
    ): Boolean {
        val operation = ActiveCommunityOperation(context, token)
        if (activeNewsRefresh != operation || !isCurrentCommunitySession(context)) return false
        activeNewsRefresh = null
        return updateCommunityStateIfCurrent(context, transform)
    }

    private fun finishNewsRefresh(context: CommunitySessionContext, token: Long): Boolean {
        val operation = ActiveCommunityOperation(context, token)
        if (activeNewsRefresh != operation) return false
        activeNewsRefresh = null
        return updateCommunityStateIfCurrent(context) { it.copy(isLoadingNews = false) }
    }

    private fun beginNotificationsRefresh(
        context: CommunitySessionContext,
        prepareRoute: Boolean,
    ): Long? {
        if (!isCurrentCommunitySession(context)) return null
        nextNotificationsRefreshToken += 1
        val operation = ActiveCommunityOperation(context, nextNotificationsRefreshToken)
        activeNotificationsRefresh = operation
        if (!updateCommunityStateIfCurrent(context) {
                it.copy(
                    isLoadingNotifications = true,
                    showPushNotificationPermissionDialog = if (prepareRoute) {
                        false
                    } else {
                        it.showPushNotificationPermissionDialog
                    },
                )
            }
        ) {
            if (activeNotificationsRefresh == operation) activeNotificationsRefresh = null
            return null
        }
        return operation.token
    }

    private fun completeNotificationsRefresh(
        context: CommunitySessionContext,
        token: Long,
        transform: (SessionUiState) -> SessionUiState,
    ): Boolean {
        val operation = ActiveCommunityOperation(context, token)
        if (activeNotificationsRefresh != operation || !isCurrentCommunitySession(context)) return false
        activeNotificationsRefresh = null
        return updateCommunityStateIfCurrent(context, transform)
    }

    private fun finishNotificationsRefresh(context: CommunitySessionContext, token: Long): Boolean {
        val operation = ActiveCommunityOperation(context, token)
        if (activeNotificationsRefresh != operation) return false
        activeNotificationsRefresh = null
        return updateCommunityStateIfCurrent(context) { it.copy(isLoadingNotifications = false) }
    }

    private fun invalidateNewsRefresh(context: CommunitySessionContext): Boolean {
        if (!isCurrentCommunitySession(context)) return false
        if (activeNewsRefresh?.context == context) activeNewsRefresh = null
        return true
    }

    private fun invalidateNotificationsRefresh(context: CommunitySessionContext): Boolean {
        if (!isCurrentCommunitySession(context)) return false
        if (activeNotificationsRefresh?.context == context) activeNotificationsRefresh = null
        return true
    }

    private fun beginNewsUpload(
        context: CommunitySessionContext,
        imageOwnership: NewsImageOwnership,
    ): ActiveNewsUpload? {
        if (!isCurrentNewsImage(context, imageOwnership)) return null
        if (uiState.value.isUploadingNewsImage ||
            uiState.value.isSavingNews ||
            uiState.value.isDeletingNews ||
            activeNewsMutation?.context == context ||
            activeNewsUpload?.context == context
        ) return null
        nextNewsUploadToken += 1
        val operation = ActiveNewsUpload(
            context = context,
            token = nextNewsUploadToken,
            imageOwnership = imageOwnership,
        )
        activeNewsUpload = operation
        val began = updateNewsImageIfCurrent(context, imageOwnership) {
            it.copy(isUploadingNewsImage = true)
        }
        if (!began) {
            if (activeNewsUpload == operation) activeNewsUpload = null
            return null
        }
        return operation
    }

    private fun isCurrentNewsUpload(operation: ActiveNewsUpload): Boolean =
        activeNewsUpload == operation &&
            isCurrentNewsImage(operation.context, operation.imageOwnership)

    private fun finishNewsUpload(operation: ActiveNewsUpload) {
        if (activeNewsUpload != operation) return
        activeNewsUpload = null
        updateNewsImageIfCurrent(operation.context, operation.imageOwnership) {
            it.copy(isUploadingNewsImage = false)
        }
    }

    private fun isCurrentNewsImage(
        context: CommunitySessionContext,
        imageOwnership: NewsImageOwnership,
        state: SessionUiState = uiState.value,
    ): Boolean = isCurrentCommunitySession(context, state) && imageOwnership.matches(state)

    private fun updateNewsImageIfCurrent(
        context: CommunitySessionContext,
        imageOwnership: NewsImageOwnership,
        transform: (SessionUiState) -> SessionUiState,
    ): Boolean {
        if (!isCurrentNewsImage(context, imageOwnership)) return false
        var didUpdate = false
        uiState.update { state ->
            if (isCurrentNewsImage(context, imageOwnership, state)) {
                didUpdate = true
                transform(state)
            } else {
                state
            }
        }
        return didUpdate
    }

    private fun isCurrentNewsEditor(
        context: CommunitySessionContext,
        editorOwnership: NewsEditorOwnership,
        state: SessionUiState = uiState.value,
    ): Boolean = isCurrentCommunitySession(context, state) && editorOwnership.matches(state)

    private fun updateNewsEditorIfCurrent(
        context: CommunitySessionContext,
        editorOwnership: NewsEditorOwnership,
        transform: (SessionUiState) -> SessionUiState,
    ): Boolean {
        if (!isCurrentNewsEditor(context, editorOwnership)) return false
        var didUpdate = false
        uiState.update { state ->
            if (isCurrentNewsEditor(context, editorOwnership, state)) {
                didUpdate = true
                transform(state)
            } else {
                state
            }
        }
        return didUpdate
    }

    private fun updateNewsDeletionRequestIfCurrent(
        context: CommunitySessionContext,
        deletionOwnership: NewsDeletionOwnership,
        transform: (SessionUiState) -> SessionUiState,
    ): Boolean {
        if (!isCurrentCommunitySession(context) ||
            !deletionOwnership.matchesRequest(uiState.value)
        ) return false
        var didUpdate = false
        uiState.update { state ->
            if (
                isCurrentCommunitySession(context, state) &&
                deletionOwnership.matchesRequest(state)
            ) {
                didUpdate = true
                transform(state)
            } else {
                state
            }
        }
        return didUpdate
    }

    private fun isCurrentNotificationEditor(
        context: CommunitySessionContext,
        editorOwnership: NotificationEditorOwnership,
        state: SessionUiState = uiState.value,
    ): Boolean = isCurrentCommunitySession(context, state) && editorOwnership.matches(state)

    private fun updateNotificationEditorIfCurrent(
        context: CommunitySessionContext,
        editorOwnership: NotificationEditorOwnership,
        transform: (SessionUiState) -> SessionUiState,
    ): Boolean {
        if (!isCurrentNotificationEditor(context, editorOwnership)) return false
        var didUpdate = false
        uiState.update { state ->
            if (isCurrentNotificationEditor(context, editorOwnership, state)) {
                didUpdate = true
                transform(state)
            } else {
                state
            }
        }
        return didUpdate
    }

    private fun isCurrentCommunitySession(
        context: CommunitySessionContext,
        state: SessionUiState = uiState.value,
    ): Boolean {
        val currentMode = state.mode as? SessionMode.Authorized ?: return false
        return runtimeEnvironmentProvider() == context.environment &&
            CommunitySessionContext.from(state, currentMode) == context
    }

    private fun updateCommunityStateIfCurrent(
        context: CommunitySessionContext,
        transform: (SessionUiState) -> SessionUiState,
    ): Boolean {
        if (!isCurrentCommunitySession(context)) return false
        var didUpdate = false
        uiState.update { state ->
            if (isCurrentCommunitySession(context, state)) {
                didUpdate = true
                transform(state)
            } else {
                state
            }
        }
        return didUpdate
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

private data class CommunitySessionContext(
    val epoch: Long,
    val environment: String?,
    val principalUid: String,
    val authenticatedMemberId: String,
    val memberId: String,
    val capabilities: Set<AccessCapability>,
    val roles: Set<MemberRole>,
) {
    companion object {
        fun from(state: SessionUiState, mode: SessionMode.Authorized) = CommunitySessionContext(
            epoch = state.sessionEpoch,
            environment = state.sessionEnvironment,
            principalUid = mode.principal.uid,
            authenticatedMemberId = mode.authenticatedMember.id,
            memberId = mode.member.id,
            capabilities = MemberPermissionMatrix.capabilitiesFor(mode.member).toSet(),
            roles = mode.member.roles.toSet(),
        )
    }
}

private data class ActiveCommunityOperation(
    val context: CommunitySessionContext,
    val token: Long,
)

private enum class NewsMutationKind {
    SAVE,
    DELETE,
}

private data class ActiveNewsMutation(
    val context: CommunitySessionContext,
    val token: Long,
    val kind: NewsMutationKind,
    val editorOwnership: NewsEditorOwnership?,
    val deletionOwnership: NewsDeletionOwnership?,
)

private data class ActiveNotificationMutation(
    val context: CommunitySessionContext,
    val token: Long,
    val editorOwnership: NotificationEditorOwnership,
)

private data class ActiveNewsUpload(
    val context: CommunitySessionContext,
    val token: Long,
    val imageOwnership: NewsImageOwnership,
)

private data class NewsEditorOwnership(
    val editingNewsId: String?,
    val editorGeneration: Long,
    val draftRevision: Long,
) {
    fun matches(state: SessionUiState): Boolean = state.editingNewsId == editingNewsId &&
        state.newsEditorRevision == editorGeneration &&
        state.newsDraftRevision == draftRevision

    fun toConfirmationIdentity() = EditorConfirmationIdentity(
        editorGeneration = editorGeneration,
        draftRevision = draftRevision,
    )
}

private data class NewsImageOwnership(
    val editingNewsId: String?,
    val editorGeneration: Long,
    val imageRevision: Long,
) {
    fun matches(state: SessionUiState): Boolean = state.editingNewsId == editingNewsId &&
        state.newsEditorRevision == editorGeneration &&
        state.newsImageRevision == imageRevision
}

private data class NotificationEditorOwnership(
    val editorGeneration: Long,
    val draftRevision: Long,
) {
    fun matches(state: SessionUiState): Boolean =
        state.notificationEditorRevision == editorGeneration &&
            state.notificationDraftRevision == draftRevision

    fun toConfirmationIdentity() = EditorConfirmationIdentity(
        editorGeneration = editorGeneration,
        draftRevision = draftRevision,
    )
}

private data class NewsDeletionOwnership(
    val newsId: String,
    val requestRevision: Long,
) {
    fun matchesRequest(state: SessionUiState): Boolean =
        state.pendingNewsDeletionId == newsId &&
            state.newsDeletionRequestRevision == requestRevision

    fun matchesGeneration(state: SessionUiState): Boolean =
        state.newsDeletionRequestRevision == requestRevision
}

private data class ActiveProfileMutation(
    val context: ProfileSessionContext,
    val token: Long,
)

private data class ActiveProfileUpload(
    val context: ProfileSessionContext,
    val token: Long,
)
