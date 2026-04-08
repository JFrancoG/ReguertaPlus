package com.reguerta.user.presentation.access

import com.reguerta.user.R
import com.reguerta.user.domain.news.NewsArticle
import com.reguerta.user.domain.news.NewsRepository
import com.reguerta.user.domain.notifications.NotificationEvent
import com.reguerta.user.domain.notifications.NotificationRepository
import com.reguerta.user.domain.profiles.SharedProfile
import com.reguerta.user.domain.profiles.SharedProfileRepository
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

internal class SessionCommunityActions(
    private val uiState: MutableStateFlow<SessionUiState>,
    private val scope: CoroutineScope,
    private val newsRepository: NewsRepository,
    private val notificationRepository: NotificationRepository,
    private val sharedProfileRepository: SharedProfileRepository,
    private val nowMillisProvider: () -> Long,
    private val emitMessage: (Int) -> Unit,
) {
    fun refreshSharedProfiles() {
        val mode = uiState.value.mode as? SessionMode.Authorized ?: return
        scope.launch {
            uiState.update { it.copy(isLoadingSharedProfiles = true) }
            val profiles = sharedProfileRepository.getAllSharedProfiles()
            val ownProfile = profiles.firstOrNull { it.userId == mode.member.id }
            uiState.update {
                val currentMode = it.mode as? SessionMode.Authorized
                if (currentMode?.principal?.uid != mode.principal.uid) {
                    it
                } else {
                    it.copy(
                        sharedProfiles = profiles.filter { profile -> profile.hasVisibleContent },
                        sharedProfileDraft = ownProfile?.toDraft() ?: SharedProfileDraft(),
                        isLoadingSharedProfiles = false,
                    )
                }
            }
        }
    }

    fun saveSharedProfile(onSuccess: () -> Unit = {}) {
        val mode = uiState.value.mode as? SessionMode.Authorized ?: return
        val draft = uiState.value.sharedProfileDraft.normalized()
        if (!draft.hasVisibleContent) {
            emitMessage(R.string.feedback_shared_profile_content_required)
            return
        }

        scope.launch {
            uiState.update { it.copy(isSavingSharedProfile = true) }
            val saved = sharedProfileRepository.upsertSharedProfile(
                SharedProfile(
                    userId = mode.member.id,
                    familyNames = draft.familyNames,
                    photoUrl = draft.photoUrl.ifBlank { null },
                    about = draft.about,
                    updatedAtMillis = nowMillisProvider(),
                ),
            )
            val profiles = sharedProfileRepository.getAllSharedProfiles()
            uiState.update {
                it.copy(
                    sharedProfiles = profiles.filter { profile -> profile.hasVisibleContent },
                    sharedProfileDraft = saved.toDraft(),
                    isSavingSharedProfile = false,
                )
            }
            emitMessage(R.string.feedback_shared_profile_saved)
            onSuccess()
        }
    }

    fun deleteSharedProfile(onSuccess: () -> Unit = {}) {
        val mode = uiState.value.mode as? SessionMode.Authorized ?: return
        scope.launch {
            uiState.update { it.copy(isDeletingSharedProfile = true) }
            val deleted = sharedProfileRepository.deleteSharedProfile(mode.member.id)
            val profiles = sharedProfileRepository.getAllSharedProfiles()
            uiState.update {
                it.copy(
                    sharedProfiles = profiles.filter { profile -> profile.hasVisibleContent },
                    sharedProfileDraft = SharedProfileDraft(),
                    isDeletingSharedProfile = false,
                )
            }
            emitMessage(
                if (deleted) {
                    R.string.feedback_shared_profile_deleted
                } else {
                    R.string.feedback_shared_profile_delete_failed
                },
            )
            onSuccess()
        }
    }

    fun refreshNews() {
        val mode = uiState.value.mode as? SessionMode.Authorized ?: return
        scope.launch {
            uiState.update { it.copy(isLoadingNews = true) }
            val allNews = newsRepository.getAllNews()
            val visibleNews = if (mode.member.isAdmin) {
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
                    )
                }
            }
        }
    }

    fun refreshNotifications() {
        val mode = uiState.value.mode as? SessionMode.Authorized ?: return
        scope.launch {
            uiState.update { it.copy(isLoadingNotifications = true) }
            val allNotifications = notificationRepository.getAllNotifications()
            val visibleNotifications = allNotifications.filter { event -> event.isVisibleTo(mode.member) }
            uiState.update {
                val currentMode = it.mode as? SessionMode.Authorized
                if (currentMode?.principal?.uid != mode.principal.uid) {
                    it
                } else {
                    it.copy(
                        notificationsFeed = visibleNotifications,
                        isLoadingNotifications = false,
                    )
                }
            }
        }
    }

    fun saveNews(onSuccess: () -> Unit = {}) {
        val mode = uiState.value.mode as? SessionMode.Authorized ?: return
        if (!mode.member.isAdmin) {
            emitMessage(R.string.feedback_only_admin_publish_news)
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
                ),
            )
            val allNews = newsRepository.getAllNews()
            val visibleNews = allNews
            val latestActiveNews = allNews.filter { it.active }.take(3)
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
            emitMessage(
                if (existing == null) {
                    R.string.feedback_news_created
                } else {
                    R.string.feedback_news_updated
                },
            )
            onSuccess()
        }
    }

    fun deleteNews(
        newsId: String,
        onSuccess: () -> Unit = {},
    ) {
        val mode = uiState.value.mode as? SessionMode.Authorized ?: return
        if (!mode.member.isAdmin) {
            emitMessage(R.string.feedback_only_admin_delete_news)
            return
        }

        scope.launch {
            val deleted = newsRepository.deleteNews(newsId)
            if (!deleted) {
                emitMessage(R.string.feedback_news_delete_failed)
                return@launch
            }
            val allNews = newsRepository.getAllNews()
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
        if (!mode.member.isAdmin) {
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
            val allNotifications = notificationRepository.getAllNotifications()
            uiState.update {
                it.copy(
                    notificationsFeed = allNotifications.filter { event -> event.isVisibleTo(mode.member) },
                    notificationDraft = NotificationDraft(),
                    isSendingNotification = false,
                )
            }
            emitMessage(R.string.feedback_notification_sent)
            onSuccess()
        }
    }
}
