package com.reguerta.user.presentation.root

import com.reguerta.user.R
import com.reguerta.user.data.media.ImagePipelineManager
import com.reguerta.user.domain.access.AuthPrincipal
import com.reguerta.user.domain.access.Member
import com.reguerta.user.domain.access.MemberRole
import com.reguerta.user.domain.news.NewsArticle
import com.reguerta.user.domain.news.NewsRepository
import com.reguerta.user.domain.notifications.NotificationEvent
import com.reguerta.user.domain.notifications.NotificationRepository
import com.reguerta.user.domain.notifications.PushNotificationPermissionProvider
import com.reguerta.user.domain.profiles.SharedProfile
import com.reguerta.user.domain.profiles.SharedProfileRepository
import java.io.IOException
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class SessionCommunityActionsFailureTest {
    @Test
    fun `failed profile refresh preserves the last snapshot and draft`() = runTest {
        val profile = profile(familyNames = "Familia existente")
        val pendingDraft = SharedProfileDraft(familyNames = "Edición pendiente")
        val state = MutableStateFlow(
            authorizedState().copy(
                sharedProfiles = listOf(profile),
                sharedProfileDraft = pendingDraft,
            ),
        )
        val messages = mutableListOf<Int>()
        val actions = actions(
            state = state,
            repository = ControlledSharedProfileRepository(listOf(profile), rejectsReads = true),
            emitMessage = messages::add,
        )

        actions.refreshSharedProfiles()
        advanceUntilIdle()

        assertEquals(listOf(profile), state.value.sharedProfiles)
        assertEquals(pendingDraft, state.value.sharedProfileDraft)
        assertEquals(false, state.value.isLoadingSharedProfiles)
        assertEquals(R.string.feedback_unable_load_data, messages.last())
    }

    @Test
    fun `confirmed profile save updates local state without a read back`() = runTest {
        val repository = ControlledSharedProfileRepository(emptyList(), rejectsReads = true)
        val state = MutableStateFlow(
            authorizedState().copy(
                sharedProfileDraft = SharedProfileDraft(
                    familyNames = "Familia",
                    about = "Perfil confirmado",
                ),
            ),
        )
        var callbackCount = 0
        val actions = actions(state, repository, emitMessage = {})

        actions.saveSharedProfile { callbackCount += 1 }
        advanceUntilIdle()

        assertEquals("Perfil confirmado", state.value.sharedProfiles.single().about)
        assertEquals("Perfil confirmado", state.value.sharedProfileDraft.about)
        assertEquals(0, repository.readCount)
        assertEquals(false, state.value.isSavingSharedProfile)
        assertEquals(1, callbackCount)
    }

    @Test
    fun `confirmed profile delete removes local state without a read back`() = runTest {
        val profile = profile(familyNames = "Familia")
        val repository = ControlledSharedProfileRepository(listOf(profile), rejectsReads = true)
        val state = MutableStateFlow(
            authorizedState().copy(
                sharedProfiles = listOf(profile),
                sharedProfileDraft = profile.toDraft(),
            ),
        )
        val messages = mutableListOf<Int>()
        val actions = actions(state, repository, emitMessage = messages::add)

        actions.deleteSharedProfile()
        advanceUntilIdle()

        assertEquals(emptyList<SharedProfile>(), state.value.sharedProfiles)
        assertEquals(SharedProfileDraft(), state.value.sharedProfileDraft)
        assertEquals(0, repository.readCount)
        assertEquals(false, state.value.isDeletingSharedProfile)
        assertEquals(R.string.feedback_shared_profile_deleted, messages.last())
    }

    @Test
    fun `stale profile save from a previous session publishes nothing`() = runTest {
        val repository = SuspendedSharedProfileRepository()
        val initial = authorizedState().copy(
            sharedProfileDraft = SharedProfileDraft(familyNames = "Sesión anterior"),
        )
        val state = MutableStateFlow(initial)
        val messages = mutableListOf<Int>()
        var callbackCount = 0
        val actions = actions(state, repository, emitMessage = messages::add)

        actions.saveSharedProfile { callbackCount += 1 }
        runCurrent()
        repository.writeStarted.await()
        val replacement = authorizedState(member = member(id = "new_member"))
            .copy(sessionEpoch = initial.sessionEpoch + 1)
        state.value = replacement
        repository.completeWrite()
        advanceUntilIdle()

        assertEquals(replacement, state.value)
        assertEquals(emptyList<Int>(), messages)
        assertEquals(0, callbackCount)
    }

    @Test
    fun `confirmed profile save preserves a newer draft revision`() = runTest {
        val repository = SuspendedSharedProfileRepository()
        val state = MutableStateFlow(
            authorizedState().copy(
                sharedProfileDraft = SharedProfileDraft(familyNames = "Versión enviada"),
                sharedProfileEditorRevision = 1L,
            ),
        )
        var callbackCount = 0
        val actions = actions(state, repository, emitMessage = {})

        actions.saveSharedProfile { callbackCount += 1 }
        runCurrent()
        repository.writeStarted.await()
        val newerDraft = SharedProfileDraft(familyNames = "Versión nueva")
        state.value = state.value.copy(
            sharedProfileDraft = newerDraft,
            sharedProfileEditorRevision = 2L,
        )
        repository.completeWrite()
        advanceUntilIdle()

        assertEquals("Versión enviada", state.value.sharedProfiles.single().familyNames)
        assertEquals(newerDraft, state.value.sharedProfileDraft)
        assertEquals(false, state.value.isSavingSharedProfile)
        assertEquals(0, callbackCount)
    }

    private suspend fun actions(
        state: MutableStateFlow<SessionUiState>,
        repository: SharedProfileRepository,
        emitMessage: (Int) -> Unit,
    ) = SessionCommunityActions(
        uiState = state,
        scope = kotlinx.coroutines.CoroutineScope(currentCoroutineContext()),
        newsRepository = EmptyNewsRepository,
        notificationRepository = EmptyNotificationRepository,
        sharedProfileRepository = repository,
        imagePipelineManager = EmptyImagePipelineManager,
        nowMillisProvider = { 123L },
        emitMessage = emitMessage,
        emitEvent = {},
        pushNotificationPermissionProvider = PushNotificationPermissionProvider { true },
    )
}

private class ControlledSharedProfileRepository(
    items: List<SharedProfile>,
    private val rejectsReads: Boolean,
) : SharedProfileRepository {
    private val items = items.associateBy(SharedProfile::userId).toMutableMap()
    var readCount = 0
        private set

    override suspend fun getAllSharedProfiles(): List<SharedProfile> {
        readCount += 1
        if (rejectsReads) throw IOException("read rejected")
        return items.values.toList()
    }

    override suspend fun getSharedProfile(userId: String): SharedProfile? {
        readCount += 1
        if (rejectsReads) throw IOException("read rejected")
        return items[userId]
    }

    override suspend fun upsertSharedProfile(profile: SharedProfile): SharedProfile {
        items[profile.userId] = profile
        return profile
    }

    override suspend fun deleteSharedProfile(userId: String): Boolean = items.remove(userId) != null
}

private class SuspendedSharedProfileRepository : SharedProfileRepository {
    val writeStarted = CompletableDeferred<Unit>()
    private val writeResult = CompletableDeferred<SharedProfile>()
    private var submitted: SharedProfile? = null

    override suspend fun getAllSharedProfiles(): List<SharedProfile> = emptyList()

    override suspend fun getSharedProfile(userId: String): SharedProfile? = null

    override suspend fun upsertSharedProfile(profile: SharedProfile): SharedProfile {
        submitted = profile
        writeStarted.complete(Unit)
        return writeResult.await()
    }

    override suspend fun deleteSharedProfile(userId: String): Boolean = true

    fun completeWrite() {
        writeResult.complete(checkNotNull(submitted))
    }
}

private object EmptyNewsRepository : NewsRepository {
    override suspend fun getNewsFor(member: Member): List<NewsArticle> = emptyList()
    override suspend fun upsertNews(article: NewsArticle): NewsArticle = article
    override suspend fun deleteNews(newsId: String): Boolean = false
}

private object EmptyNotificationRepository : NotificationRepository {
    override suspend fun getNotificationsFor(member: Member): List<NotificationEvent> = emptyList()
    override suspend fun getReadNotificationIds(memberId: String): Set<String> = emptySet()
    override suspend fun markNotificationsRead(memberId: String, notificationIds: Set<String>, readAtMillis: Long) = Unit
    override suspend fun sendNotification(event: NotificationEvent): NotificationEvent = event
}

private object EmptyImagePipelineManager : ImagePipelineManager {
    override suspend fun processAndUpload(
        sourceUri: android.net.Uri,
        ownerId: String,
        namespace: com.reguerta.user.data.media.ImageUploadNamespace,
        entityId: String?,
        nameHint: String?,
    ) = null
}

private fun authorizedState(member: Member = member()): SessionUiState = SessionUiState(
    sessionEpoch = 1L,
    mode = SessionMode.Authorized(
        principal = AuthPrincipal(uid = checkNotNull(member.authUid), email = member.normalizedEmail),
        authenticatedMember = member,
        member = member,
        members = listOf(member),
    ),
)

private fun member(id: String = "member_1") = Member(
    id = id,
    displayName = "Member",
    normalizedEmail = "$id@reguerta.test",
    authUid = "auth_$id",
    roles = setOf(MemberRole.MEMBER),
    isActive = true,
    producerCatalogEnabled = true,
)

private fun profile(
    familyNames: String,
    userId: String = "member_1",
) = SharedProfile(
    userId = userId,
    familyNames = familyNames,
    photoUrl = null,
    about = "Perfil",
    updatedAtMillis = 1L,
)
