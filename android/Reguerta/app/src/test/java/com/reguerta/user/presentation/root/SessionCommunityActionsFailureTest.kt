package com.reguerta.user.presentation.root

import com.reguerta.user.R
import com.reguerta.user.data.media.ImagePipelineManager
import com.reguerta.user.data.media.ImageUploadResult
import com.reguerta.user.domain.RepositoryErrorKind
import com.reguerta.user.domain.RepositoryException
import com.reguerta.user.domain.access.AuthPrincipal
import com.reguerta.user.domain.access.Member
import com.reguerta.user.domain.access.MemberPermissionMatrix
import com.reguerta.user.domain.access.MemberRole
import com.reguerta.user.domain.news.NewsArticle
import com.reguerta.user.domain.news.NewsRepository
import com.reguerta.user.domain.notifications.NotificationEvent
import com.reguerta.user.domain.notifications.NotificationAudience
import com.reguerta.user.domain.notifications.NotificationContentPolicy
import com.reguerta.user.domain.notifications.NotificationRepository
import com.reguerta.user.domain.notifications.PushNotificationPermissionProvider
import com.reguerta.user.domain.notifications.ShiftNotificationDetail
import com.reguerta.user.domain.notifications.ShiftNotificationDetailRepository
import com.reguerta.user.domain.profiles.SharedProfile
import com.reguerta.user.domain.profiles.SharedProfileRepository
import com.reguerta.user.domain.shifts.ShiftAssignment
import com.reguerta.user.domain.shifts.ShiftStatus
import com.reguerta.user.domain.shifts.ShiftType
import com.reguerta.user.presentation.auth.clearCommunitySessionStateIfInvalidated
import com.reguerta.user.presentation.auth.reconcileAuthorizedShiftState
import com.reguerta.user.presentation.auth.resolveAuthorizedSessionAccessTransition
import java.io.IOException
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class SessionCommunityActionsFailureTest {
    @Test
    fun `generic shift notification publishes only fresh detail for current session`() = runTest {
        val event = notificationEvent(id = "event-1").copy(
            type = "shift_updated",
            target = "users",
            userIds = listOf("member_1"),
            contentPolicy = NotificationContentPolicy.AUTHORIZED_FETCH_REQUIRED,
        )
        val state = MutableStateFlow(authorizedState().copy(notificationsFeed = listOf(event)))
        val detailRepository = RecordingShiftNotificationDetailRepository(notificationShiftDetail())
        val actions = actions(
            state = state,
            repository = ControlledSharedProfileRepository(emptyList(), rejectsReads = false),
            emitMessage = {},
            shiftNotificationDetailRepository = detailRepository,
        )

        actions.openNotificationDetail(event.id)
        advanceUntilIdle()

        assertEquals("member_1", detailRepository.requestedMemberId)
        assertEquals(notificationShiftDetail(), state.value.notificationShiftDetail)
        assertNull(state.value.loadingNotificationDetailEventId)
    }

    @Test
    fun `failed inbox refresh purges rich shift detail but preserves generic row`() = runTest {
        val event = notificationEvent(id = "event-1").copy(
            type = "shift_updated",
            target = "users",
            userIds = listOf("member_1"),
            contentPolicy = NotificationContentPolicy.AUTHORIZED_FETCH_REQUIRED,
        )
        val state = MutableStateFlow(authorizedState().copy(notificationsFeed = listOf(event)))
        val actions = actions(
            state = state,
            repository = ControlledSharedProfileRepository(emptyList(), rejectsReads = false),
            emitMessage = {},
            notificationRepository = QueuedNotificationRepository(
                notificationsResults = ArrayDeque(listOf(Result.success(listOf(event)))),
                readResults = ArrayDeque(listOf(Result.failure(IOException("offline")))),
            ),
            shiftNotificationDetailRepository =
                RecordingShiftNotificationDetailRepository(notificationShiftDetail()),
        )
        actions.openNotificationDetail(event.id)
        advanceUntilIdle()
        assertEquals(notificationShiftDetail(), state.value.notificationShiftDetail)

        actions.refreshNotifications()
        advanceUntilIdle()

        assertEquals(listOf(event), state.value.notificationsFeed)
        assertNull(state.value.notificationShiftDetail)
        assertNull(state.value.loadingNotificationDetailEventId)
    }

    @Test
    fun `opened push refreshes inbox before fetching authorized detail`() = runTest {
        val event = notificationEvent(id = "event-1").copy(
            type = "shift_updated",
            target = "users",
            userIds = listOf("member_1"),
            contentPolicy = NotificationContentPolicy.AUTHORIZED_FETCH_REQUIRED,
        )
        val state = MutableStateFlow(authorizedState())
        val detailRepository = RecordingShiftNotificationDetailRepository(notificationShiftDetail())
        val actions = actions(
            state = state,
            repository = ControlledSharedProfileRepository(emptyList(), rejectsReads = false),
            emitMessage = {},
            notificationRepository = QueuedNotificationRepository(
                notificationsResults = ArrayDeque(listOf(Result.success(listOf(event)))),
                readResults = ArrayDeque(listOf(Result.success(emptySet()))),
            ),
            shiftNotificationDetailRepository = detailRepository,
        )

        actions.prepareNotificationsRoute(openingEventId = event.id)
        advanceUntilIdle()

        assertEquals(listOf(event), state.value.notificationsFeed)
        assertEquals(notificationShiftDetail(), state.value.notificationShiftDetail)
        assertEquals("member_1", detailRepository.requestedMemberId)
    }

    @Test
    fun `late shift notification detail cannot cross a session replacement`() = runTest {
        val event = notificationEvent(id = "event-1").copy(
            type = "shift_updated",
            target = "users",
            userIds = listOf("member_1"),
            contentPolicy = NotificationContentPolicy.AUTHORIZED_FETCH_REQUIRED,
        )
        val initial = authorizedState().copy(notificationsFeed = listOf(event))
        val state = MutableStateFlow(initial)
        val detailRepository = SuspendedShiftNotificationDetailRepository()
        val actions = actions(
            state = state,
            repository = ControlledSharedProfileRepository(emptyList(), rejectsReads = false),
            emitMessage = {},
            shiftNotificationDetailRepository = detailRepository,
        )

        actions.openNotificationDetail(event.id)
        runCurrent()
        detailRepository.started.await()
        val replacement = authorizedState(member = member(id = "new_member"))
            .copy(sessionEpoch = initial.sessionEpoch + 1)
        state.value = replacement
        detailRepository.complete(notificationShiftDetail())
        advanceUntilIdle()

        assertEquals(replacement, state.value)
    }

    @Test
    fun `first news failure retries automatically before showing feedback`() = runTest {
        val replacement = newsArticle(id = "replacement", title = "Replacement")
        val state = MutableStateFlow(authorizedState().copy(sessionEnvironment = "develop"))
        val messages = mutableListOf<Int>()
        val repository = QueuedNewsRepository(
            ArrayDeque(
                listOf(
                    Result.failure(IOException("temporary")),
                    Result.success(listOf(replacement)),
                ),
            ),
        )
        val actions = actions(
            state = state,
            repository = ControlledSharedProfileRepository(emptyList(), rejectsReads = false),
            emitMessage = messages::add,
            newsRepository = repository,
            automaticLoadRetryDelayMillis = 10_000L,
        )

        actions.refreshNews()
        runCurrent()

        assertEquals(emptyList<Int>(), messages)
        assertTrue(state.value.newsFeed.isEmpty())

        advanceTimeBy(10_000L)
        advanceUntilIdle()

        assertEquals(listOf(replacement), state.value.newsFeed)
        assertEquals(emptyList<Int>(), messages)
    }

    @Test
    fun `failed news refresh preserves the last snapshot and allows a valid retry`() = runTest {
        val previous = newsArticle(id = "previous", title = "Previous")
        val replacement = newsArticle(id = "replacement", title = "Replacement")
        val state = MutableStateFlow(
            authorizedState().copy(
                sessionEnvironment = "develop",
                latestNews = listOf(previous),
                newsFeed = listOf(previous),
            ),
        )
        val messages = mutableListOf<Int>()
        val repository = QueuedNewsRepository(
            readResults = ArrayDeque(
                listOf(
                    Result.failure(
                        RepositoryException(
                            kind = RepositoryErrorKind.INVALID_DATA,
                            resource = "news/corrupt",
                        ),
                    ),
                    Result.success(listOf(replacement)),
                ),
            ),
        )
        val actions = actions(
            state = state,
            repository = ControlledSharedProfileRepository(emptyList(), rejectsReads = false),
            emitMessage = messages::add,
            newsRepository = repository,
        )

        actions.refreshNews()
        advanceUntilIdle()

        assertEquals(listOf(previous), state.value.latestNews)
        assertEquals(listOf(previous), state.value.newsFeed)
        assertFalse(state.value.isLoadingNews)
        assertEquals(listOf(R.string.feedback_unable_load_data), messages)

        actions.refreshNews()
        advanceUntilIdle()

        assertEquals(listOf(replacement), state.value.latestNews)
        assertEquals(listOf(replacement), state.value.newsFeed)
        assertFalse(state.value.isLoadingNews)
        assertEquals(listOf(R.string.feedback_unable_load_data), messages)
    }

    @Test
    fun `typed current news failures all preserve the last valid snapshot`() = runTest {
        RepositoryErrorKind.entries
            .filter { kind ->
                kind == RepositoryErrorKind.UNAVAILABLE ||
                    kind == RepositoryErrorKind.PERMISSION_DENIED ||
                    kind == RepositoryErrorKind.INVALID_DATA
            }
            .forEach { kind ->
                val previous = newsArticle(id = "previous", title = "Previous")
                val state = MutableStateFlow(
                    authorizedState().copy(
                        sessionEnvironment = "develop",
                        latestNews = listOf(previous),
                        newsFeed = listOf(previous),
                    ),
                )
                val messages = mutableListOf<Int>()
                val actions = actions(
                    state = state,
                    repository = ControlledSharedProfileRepository(emptyList(), rejectsReads = false),
                    emitMessage = messages::add,
                    newsRepository = QueuedNewsRepository(
                        ArrayDeque(
                            listOf(
                                Result.failure(
                                    RepositoryException(kind = kind, resource = "news/failure"),
                                ),
                            ),
                        ),
                    ),
                )

                actions.refreshNews()
                advanceUntilIdle()

                assertEquals("kind=$kind", listOf(previous), state.value.newsFeed)
                assertFalse("kind=$kind", state.value.isLoadingNews)
                assertEquals("kind=$kind", listOf(R.string.feedback_unable_load_data), messages)
            }
    }

    @Test
    fun `overlapping news refresh is latest wins and obsolete completion cannot clear its loader`() = runTest {
        val first = newsArticle(id = "first", title = "First")
        val second = newsArticle(id = "second", title = "Second")
        val repository = SuspendedNewsReadsRepository()
        val state = MutableStateFlow(authorizedState().copy(sessionEnvironment = "develop"))
        val actions = actions(
            state = state,
            repository = ControlledSharedProfileRepository(emptyList(), rejectsReads = false),
            emitMessage = {},
            newsRepository = repository,
        )

        actions.refreshNews()
        runCurrent()
        repository.started[0].await()
        actions.refreshNews()
        runCurrent()
        repository.started[1].await()

        repository.results[0].complete(listOf(first))
        runCurrent()
        assertTrue(state.value.isLoadingNews)
        assertTrue(state.value.newsFeed.isEmpty())

        repository.results[1].complete(listOf(second))
        advanceUntilIdle()
        assertFalse(state.value.isLoadingNews)
        assertEquals(listOf(second), state.value.newsFeed)
    }

    @Test
    fun `obsolete news cancellation cannot turn off the newer refresh loader`() = runTest {
        val replacement = newsArticle(id = "replacement", title = "Replacement")
        val repository = SuspendedNewsReadsRepository()
        val state = MutableStateFlow(authorizedState().copy(sessionEnvironment = "develop"))
        val messages = mutableListOf<Int>()
        val actions = actions(
            state = state,
            repository = ControlledSharedProfileRepository(emptyList(), rejectsReads = false),
            emitMessage = messages::add,
            newsRepository = repository,
        )

        actions.refreshNews()
        runCurrent()
        repository.started[0].await()
        actions.refreshNews()
        runCurrent()
        repository.started[1].await()

        repository.results[0].cancel(CancellationException("obsolete"))
        runCurrent()
        assertTrue(state.value.isLoadingNews)
        assertTrue(messages.isEmpty())

        repository.results[1].complete(listOf(replacement))
        advanceUntilIdle()
        assertFalse(state.value.isLoadingNews)
        assertEquals(listOf(replacement), state.value.newsFeed)
        assertTrue(messages.isEmpty())
    }

    @Test
    fun `stale news failure after environment and session change publishes no state or feedback`() = runTest {
        val repository = SuspendedNewsReadsRepository()
        val initial = authorizedState().copy(sessionEnvironment = "develop")
        val state = MutableStateFlow(initial)
        val messages = mutableListOf<Int>()
        val actions = actions(
            state = state,
            repository = ControlledSharedProfileRepository(emptyList(), rejectsReads = false),
            emitMessage = messages::add,
            newsRepository = repository,
        )

        actions.refreshNews()
        runCurrent()
        repository.started[0].await()
        val replacement = authorizedState(member(id = "member-2")).copy(
            sessionEpoch = initial.sessionEpoch + 1,
            sessionEnvironment = "production",
        )
        state.value = replacement
        repository.results[0].completeExceptionally(IOException("stale failure"))
        advanceUntilIdle()

        assertEquals(replacement, state.value)
        assertTrue(messages.isEmpty())
    }

    @Test
    fun `runtime environment switch fences completion even while ui environment is unchanged`() = runTest {
        val previous = newsArticle(id = "previous", title = "Previous")
        val replacement = newsArticle(id = "replacement", title = "Replacement")
        val repository = SuspendedNewsReadsRepository()
        var runtimeEnvironment: String? = "develop"
        val state = MutableStateFlow(
            authorizedState().copy(
                sessionEnvironment = "develop",
                latestNews = listOf(previous),
                newsFeed = listOf(previous),
            ),
        )
        val messages = mutableListOf<Int>()
        val actions = actions(
            state = state,
            repository = ControlledSharedProfileRepository(emptyList(), rejectsReads = false),
            emitMessage = messages::add,
            newsRepository = repository,
            runtimeEnvironmentProvider = { runtimeEnvironment },
        )

        actions.refreshNews()
        runCurrent()
        repository.started[0].await()
        runtimeEnvironment = "production"
        repository.results[0].complete(listOf(replacement))
        advanceUntilIdle()

        assertEquals("develop", state.value.sessionEnvironment)
        assertEquals(listOf(previous), state.value.latestNews)
        assertEquals(listOf(previous), state.value.newsFeed)
        assertTrue(state.value.isLoadingNews)
        assertTrue(messages.isEmpty())
    }

    @Test
    fun `cooperative news cancellation emits no feedback and finishes only its current loader`() = runTest {
        val state = MutableStateFlow(authorizedState().copy(sessionEnvironment = "develop"))
        val messages = mutableListOf<Int>()
        val actions = actions(
            state = state,
            repository = ControlledSharedProfileRepository(emptyList(), rejectsReads = false),
            emitMessage = messages::add,
            newsRepository = CancellingNewsRepository,
        )

        actions.refreshNews()
        advanceUntilIdle()

        assertFalse(state.value.isLoadingNews)
        assertTrue(messages.isEmpty())
    }

    @Test
    fun `news refresh completion cannot turn off an owned image upload`() = runTest {
        val admin = member(id = "admin-1", roles = setOf(MemberRole.MEMBER, MemberRole.ADMIN))
        val upload = SuspendedNewsUpload()
        val state = MutableStateFlow(
            authorizedState(admin).copy(
                sessionEnvironment = "develop",
                newsDraft = NewsDraft(title = "Draft", body = "Body"),
            ),
        )
        val messages = mutableListOf<Int>()
        val actions = actions(
            state = state,
            repository = ControlledSharedProfileRepository(emptyList(), rejectsReads = false),
            emitMessage = messages::add,
            newsRepository = QueuedNewsRepository(
                ArrayDeque(listOf(Result.success(emptyList()))),
            ),
        )

        actions.uploadNewsImage { _, _ -> upload.awaitResult() }
        runCurrent()
        upload.started.await()
        actions.refreshNews()
        runCurrent()

        assertTrue(state.value.isUploadingNewsImage)

        upload.complete("https://cdn.reguerta.test/news.jpg")
        advanceUntilIdle()
        assertFalse(state.value.isUploadingNewsImage)
        assertEquals("https://cdn.reguerta.test/news.jpg", state.value.newsDraft.urlImage)
        assertEquals(listOf(R.string.feedback_news_image_uploaded), messages)
    }

    @Test
    fun `news text draft change preserves in flight upload ownership and loader`() = runTest {
        val admin = member(id = "admin-1", roles = setOf(MemberRole.MEMBER, MemberRole.ADMIN))
        val upload = SuspendedNewsUpload()
        val state = MutableStateFlow(
            authorizedState(admin).copy(
                sessionEnvironment = "develop",
                newsDraft = NewsDraft(title = "Old", body = "Body"),
            ),
        )
        val messages = mutableListOf<Int>()
        val actions = actions(
            state = state,
            repository = ControlledSharedProfileRepository(emptyList(), rejectsReads = false),
            emitMessage = messages::add,
        )

        actions.uploadNewsImage { _, _ -> upload.awaitResult() }
        runCurrent()
        upload.started.await()
        val newerDraft = NewsDraft(title = "New", body = "New body")
        SessionFormActions(state, messages::add).onNewsDraftChanged(newerDraft)
        assertTrue(state.value.isUploadingNewsImage)
        upload.complete("https://cdn.reguerta.test/stale.jpg")
        advanceUntilIdle()

        assertEquals(
            newerDraft.copy(urlImage = "https://cdn.reguerta.test/stale.jpg"),
            state.value.newsDraft,
        )
        assertFalse(state.value.isUploadingNewsImage)
        assertEquals(listOf(R.string.feedback_news_image_uploaded), messages)
    }

    @Test
    fun `clearing news editor invalidates stale upload URL and feedback`() = runTest {
        val admin = member(id = "admin-1", roles = setOf(MemberRole.MEMBER, MemberRole.ADMIN))
        val upload = SuspendedNewsUpload()
        val state = MutableStateFlow(
            authorizedState(admin).copy(
                sessionEnvironment = "develop",
                newsDraft = NewsDraft(title = "Old", body = "Body"),
                editingNewsId = "news-1",
            ),
        )
        val messages = mutableListOf<Int>()
        val actions = actions(
            state = state,
            repository = ControlledSharedProfileRepository(emptyList(), rejectsReads = false),
            emitMessage = messages::add,
        )

        actions.uploadNewsImage { _, _ -> upload.awaitResult() }
        runCurrent()
        upload.started.await()
        SessionFormActions(state, messages::add).clearNewsEditor()
        upload.complete("https://cdn.reguerta.test/stale.jpg")
        advanceUntilIdle()

        assertEquals(NewsDraft(), state.value.newsDraft)
        assertNull(state.value.editingNewsId)
        assertFalse(state.value.isUploadingNewsImage)
        assertTrue(messages.isEmpty())
    }

    @Test
    fun `partial notification refresh failure preserves feed and read state atomically`() = runTest {
        val previous = notificationEvent(id = "previous")
        val replacement = notificationEvent(id = "replacement")
        val state = MutableStateFlow(
            authorizedState().copy(
                sessionEnvironment = "develop",
                notificationsFeed = listOf(previous),
                readNotificationIds = setOf(previous.id),
            ),
        )
        val messages = mutableListOf<Int>()
        val repository = QueuedNotificationRepository(
            notificationsResults = ArrayDeque(listOf(Result.success(listOf(replacement)))),
            readResults = ArrayDeque(listOf(Result.failure(IOException("permission denied")))),
        )
        val actions = actions(
            state = state,
            repository = ControlledSharedProfileRepository(emptyList(), rejectsReads = false),
            emitMessage = messages::add,
            notificationRepository = repository,
        )

        actions.refreshNotifications()
        advanceUntilIdle()

        assertEquals(listOf(previous), state.value.notificationsFeed)
        assertEquals(setOf(previous.id), state.value.readNotificationIds)
        assertFalse(state.value.isLoadingNotifications)
        assertEquals(listOf(R.string.feedback_unable_load_data), messages)
    }

    @Test
    fun `notification refresh filters revoked role and foreign users targets`() = runTest {
        val currentMember = member(id = "member-1", roles = setOf(MemberRole.MEMBER))
        val all = notificationEvent(id = "all")
        val revokedProducer = notificationEvent(
            id = "producer-only",
            target = "segment",
            segmentType = "role",
            targetRole = MemberRole.PRODUCER,
        )
        val currentUser = notificationEvent(
            id = "current-user",
            target = "users",
            userIds = listOf(currentMember.id),
        )
        val foreignUser = notificationEvent(
            id = "foreign-user",
            target = "users",
            userIds = listOf("member-2"),
        )
        val state = MutableStateFlow(
            authorizedState(currentMember).copy(sessionEnvironment = "develop"),
        )
        val repository = QueuedNotificationRepository(
            notificationsResults = ArrayDeque(
                listOf(Result.success(listOf(all, revokedProducer, currentUser, foreignUser))),
            ),
            readResults = ArrayDeque(listOf(Result.success(emptySet()))),
        )
        val actions = actions(
            state = state,
            repository = ControlledSharedProfileRepository(emptyList(), rejectsReads = false),
            emitMessage = {},
            notificationRepository = repository,
        )

        actions.refreshNotifications()
        advanceUntilIdle()

        assertEquals(listOf("all", "current-user"), state.value.notificationsFeed.map { it.id })
    }

    @Test
    fun `raw role boundary clears private feeds before failed replacement refresh and fences stale work`() = runTest {
        val previousMember = member(
            id = "admin-1",
            roles = setOf(MemberRole.MEMBER, MemberRole.ADMIN),
        )
        val replacementMember = previousMember.copy(roles = setOf(MemberRole.ADMIN))
        assertEquals(
            MemberPermissionMatrix.capabilitiesFor(previousMember),
            MemberPermissionMatrix.capabilitiesFor(replacementMember),
        )
        val previousNews = newsArticle(id = "previous-news", title = "Previous")
        val previousNotification = notificationEvent(
            id = "member-only",
            target = "segment",
            segmentType = "role",
            targetRole = MemberRole.MEMBER,
        )
        val initialState = authorizedState(previousMember).copy(
            sessionEnvironment = "develop",
            latestNews = listOf(previousNews),
            newsFeed = listOf(previousNews),
            newsDraft = NewsDraft(title = "Private draft", body = "Body"),
            newsEditorRevision = 4L,
            editingNewsId = previousNews.id,
            notificationsFeed = listOf(previousNotification),
            readNotificationIds = setOf(previousNotification.id),
            pendingNotificationAcknowledgements = listOf(previousNotification),
            pendingReadNotificationIds = setOf(previousNotification.id),
            notificationReadRevision = 4L,
            notificationDraft = NotificationDraft(title = "Private draft", body = "Body"),
            notificationEditorRevision = 4L,
        )
        val state = MutableStateFlow(initialState)
        val messages = mutableListOf<Int>()
        val newsRepository = SuspendedNewsReadsRepository()
        val notificationRepository = SuspendedNotificationReadsRepository()
        val actions = actions(
            state = state,
            repository = ControlledSharedProfileRepository(emptyList(), rejectsReads = false),
            emitMessage = messages::add,
            newsRepository = newsRepository,
            notificationRepository = notificationRepository,
        )

        actions.refreshNews()
        actions.refreshNotifications()
        runCurrent()
        newsRepository.started[0].await()
        notificationRepository.started[0].await()

        val previousMode = state.value.mode as SessionMode.Authorized
        val transition = resolveAuthorizedSessionAccessTransition(
            currentMode = previousMode,
            currentEnvironment = state.value.sessionEnvironment,
            principal = previousMode.principal,
            member = replacementMember,
            resolvedEnvironment = "develop",
        )
        state.value = state.value
            .reconcileAuthorizedShiftState(transition)
            .clearCommunitySessionStateIfInvalidated(transition)
            .copy(
                mode = previousMode.copy(
                    authenticatedMember = replacementMember,
                    member = replacementMember,
                    members = listOf(replacementMember),
                ),
            )
        val stateImmediatelyAfterBoundary = state.value

        actions.refreshNews()
        actions.refreshNotifications()
        runCurrent()
        newsRepository.started[1].await()
        notificationRepository.started[1].await()
        newsRepository.results[1].completeExceptionally(IOException("replacement news failed"))
        notificationRepository.results[1].completeExceptionally(
            IOException("replacement notifications failed"),
        )
        runCurrent()
        newsRepository.results[0].completeExceptionally(IOException("stale news failure"))
        notificationRepository.results[0].complete(listOf(previousNotification))
        advanceUntilIdle()

        assertTrue(transition.invalidatesSessionContext)
        assertEquals(initialState.sessionEpoch + 1, stateImmediatelyAfterBoundary.sessionEpoch)
        assertTrue(stateImmediatelyAfterBoundary.newsFeed.isEmpty())
        assertEquals(NewsDraft(), stateImmediatelyAfterBoundary.newsDraft)
        assertNull(stateImmediatelyAfterBoundary.editingNewsId)
        assertTrue(stateImmediatelyAfterBoundary.notificationsFeed.isEmpty())
        assertTrue(stateImmediatelyAfterBoundary.readNotificationIds.isEmpty())
        assertTrue(stateImmediatelyAfterBoundary.pendingNotificationAcknowledgements.isEmpty())
        assertTrue(stateImmediatelyAfterBoundary.pendingReadNotificationIds.isEmpty())
        assertEquals(NotificationDraft(), stateImmediatelyAfterBoundary.notificationDraft)
        assertTrue(state.value.newsFeed.isEmpty())
        assertTrue(state.value.notificationsFeed.isEmpty())
        assertFalse(state.value.isLoadingNews)
        assertFalse(state.value.isLoadingNotifications)
        assertEquals(
            listOf(
                R.string.feedback_unable_load_data,
                R.string.feedback_unable_load_data,
            ),
            messages,
        )
    }

    @Test
    fun `current notification cancellation stops loader without feedback`() = runTest {
        val state = MutableStateFlow(authorizedState().copy(sessionEnvironment = "develop"))
        val messages = mutableListOf<Int>()
        val actions = actions(
            state = state,
            repository = ControlledSharedProfileRepository(emptyList(), rejectsReads = false),
            emitMessage = messages::add,
            notificationRepository = CancellingNotificationRepository,
        )

        actions.refreshNotifications()
        advanceUntilIdle()

        assertFalse(state.value.isLoadingNotifications)
        assertTrue(messages.isEmpty())
    }

    @Test
    fun `obsolete notification cancellation cannot stop the newer loader`() = runTest {
        val replacement = notificationEvent(id = "replacement")
        val repository = SuspendedNotificationReadsRepository()
        val state = MutableStateFlow(authorizedState().copy(sessionEnvironment = "develop"))
        val messages = mutableListOf<Int>()
        val actions = actions(
            state = state,
            repository = ControlledSharedProfileRepository(emptyList(), rejectsReads = false),
            emitMessage = messages::add,
            notificationRepository = repository,
        )

        actions.refreshNotifications()
        runCurrent()
        repository.started[0].await()
        actions.refreshNotifications()
        runCurrent()
        repository.started[1].await()
        repository.results[0].cancel(CancellationException("obsolete"))
        runCurrent()

        assertTrue(state.value.isLoadingNotifications)
        assertTrue(messages.isEmpty())

        repository.results[1].complete(listOf(replacement))
        advanceUntilIdle()
        assertFalse(state.value.isLoadingNotifications)
        assertEquals(listOf(replacement), state.value.notificationsFeed)
        assertTrue(messages.isEmpty())
    }

    @Test
    fun `stale prepare notifications route publishes neither permission state nor feedback`() = runTest {
        val repository = SuspendedNotificationOperationsRepository()
        val initial = authorizedState().copy(sessionEnvironment = "develop")
        val state = MutableStateFlow(initial)
        val messages = mutableListOf<Int>()
        val actions = actions(
            state = state,
            repository = ControlledSharedProfileRepository(emptyList(), rejectsReads = false),
            emitMessage = messages::add,
            notificationRepository = repository,
        )

        actions.prepareNotificationsRoute()
        runCurrent()
        repository.readStarted.await()
        val replacement = authorizedState(member(id = "member-2")).copy(
            sessionEpoch = initial.sessionEpoch + 1,
            sessionEnvironment = "production",
            isPushNotificationPermissionActive = false,
            showPushNotificationPermissionDialog = false,
        )
        state.value = replacement
        repository.readResult.complete(setOf("notification-1"))
        advanceUntilIdle()

        assertEquals(replacement, state.value)
        assertTrue(messages.isEmpty())
    }

    @Test
    fun `stale mark read acknowledgement publishes neither read state nor feedback`() = runTest {
        val notification = notificationEvent(id = "notification-1")
        val repository = SuspendedNotificationOperationsRepository()
        val initial = authorizedState().copy(
            sessionEnvironment = "develop",
            notificationsFeed = listOf(notification),
        )
        val state = MutableStateFlow(initial)
        val messages = mutableListOf<Int>()
        val actions = actions(
            state = state,
            repository = ControlledSharedProfileRepository(emptyList(), rejectsReads = false),
            emitMessage = messages::add,
            notificationRepository = repository,
        )

        actions.markVisibleNotificationsReadOnExit()
        runCurrent()
        repository.markStarted.await()
        val replacement = authorizedState(member(id = "member-2")).copy(
            sessionEpoch = initial.sessionEpoch + 1,
            sessionEnvironment = "production",
        )
        state.value = replacement
        repository.markResult.complete(Unit)
        advanceUntilIdle()

        assertEquals(replacement, state.value)
        assertTrue(messages.isEmpty())
    }

    @Test
    fun `mark read ACK after refresh starts survives older remote read snapshot`() = runTest {
        val notification = notificationEvent(id = "notification-1")
        val repository = SuspendedNotificationOperationsRepository()
        val state = MutableStateFlow(
            authorizedState().copy(
                sessionEnvironment = "develop",
                notificationsFeed = listOf(notification),
            ),
        )
        val actions = actions(
            state = state,
            repository = ControlledSharedProfileRepository(emptyList(), rejectsReads = false),
            emitMessage = {},
            notificationRepository = repository,
        )

        actions.refreshNotifications()
        runCurrent()
        repository.readStarted.await()
        actions.markVisibleNotificationsReadOnExit()
        runCurrent()
        repository.markStarted.await()
        repository.markResult.complete(Unit)
        runCurrent()
        repository.readResult.complete(emptySet())
        advanceUntilIdle()

        assertEquals(setOf(notification.id), state.value.readNotificationIds)
        assertEquals(setOf(notification.id), state.value.pendingReadNotificationIds)
        assertEquals(1L, state.value.notificationReadRevision)
    }

    @Test
    fun `mark read ACK after refresh completion merges with refreshed read state`() = runTest {
        val notification = notificationEvent(id = "notification-1")
        val repository = SuspendedNotificationOperationsRepository()
        val state = MutableStateFlow(
            authorizedState().copy(
                sessionEnvironment = "develop",
                notificationsFeed = listOf(notification),
            ),
        )
        val actions = actions(
            state = state,
            repository = ControlledSharedProfileRepository(emptyList(), rejectsReads = false),
            emitMessage = {},
            notificationRepository = repository,
        )

        actions.markVisibleNotificationsReadOnExit()
        runCurrent()
        repository.markStarted.await()
        actions.refreshNotifications()
        runCurrent()
        repository.readStarted.await()
        repository.readResult.complete(emptySet())
        runCurrent()
        repository.markResult.complete(Unit)
        advanceUntilIdle()

        assertEquals(setOf(notification.id), state.value.readNotificationIds)
        assertEquals(setOf(notification.id), state.value.pendingReadNotificationIds)
        assertEquals(1L, state.value.notificationReadRevision)
    }

    @Test
    fun `confirmed news save completes locally and failing convergence is only a load failure`() = runTest {
        val admin = member(id = "admin-1", roles = setOf(MemberRole.MEMBER, MemberRole.ADMIN))
        val state = MutableStateFlow(
            authorizedState(admin).copy(
                sessionEnvironment = "develop",
                newsDraft = NewsDraft(title = "Saved", body = "Body"),
            ),
        )
        val messages = mutableListOf<Int>()
        var callbackCount = 0
        val repository = ConfirmedNewsRepository(rejectReads = true)
        val actions = actions(
            state = state,
            repository = ControlledSharedProfileRepository(emptyList(), rejectsReads = false),
            emitMessage = messages::add,
            newsRepository = repository,
        )

        actions.saveNews { callbackCount += 1 }
        advanceUntilIdle()

        assertEquals(1, repository.upsertCount)
        assertEquals(1, repository.readCount)
        assertEquals("saved-news", state.value.newsFeed.single().id)
        assertFalse(state.value.isSavingNews)
        assertEquals(1, callbackCount)
        assertEquals(listOf(R.string.feedback_unable_load_data), messages)
    }

    @Test
    fun `successful refresh started before news save cannot overwrite confirmed local ACK`() = runTest {
        val admin = member(id = "admin-1", roles = setOf(MemberRole.MEMBER, MemberRole.ADMIN))
        val repository = MutationDuringNewsRefreshRepository()
        val state = MutableStateFlow(
            authorizedState(admin).copy(
                sessionEnvironment = "develop",
                newsDraft = NewsDraft(title = "Saved", body = "Body"),
            ),
        )
        val actions = actions(
            state = state,
            repository = ControlledSharedProfileRepository(emptyList(), rejectsReads = false),
            emitMessage = {},
            newsRepository = repository,
        )

        actions.refreshNews()
        runCurrent()
        repository.readStarted[0].await()
        actions.saveNews()
        runCurrent()
        repository.readStarted[1].await()
        repository.readResults[0].complete(listOf(newsArticle(id = "old", title = "Old")))
        runCurrent()

        assertEquals(listOf("saved-news"), state.value.newsFeed.map { it.id })
        assertTrue(state.value.isLoadingNews)

        repository.readResults[1].completeExceptionally(IOException("convergence failed"))
        advanceUntilIdle()
        assertEquals(listOf("saved-news"), state.value.newsFeed.map { it.id })
        assertEquals(1, repository.upsertCount)
    }

    @Test
    fun `confirmed news delete replenishes latest locally when convergence refresh fails`() = runTest {
        val admin = member(id = "admin-1", roles = setOf(MemberRole.MEMBER, MemberRole.ADMIN))
        val existing = newsArticle(id = "news-to-delete", title = "Delete me")
            .copy(publishedAtMillis = 4L)
        val second = newsArticle(id = "news-2", title = "Second").copy(publishedAtMillis = 3L)
        val third = newsArticle(id = "news-3", title = "Third").copy(publishedAtMillis = 2L)
        val fourth = newsArticle(id = "news-4", title = "Fourth").copy(publishedAtMillis = 1L)
        val allNews = listOf(existing, second, third, fourth)
        val state = MutableStateFlow(
            authorizedState(admin).copy(
                sessionEnvironment = "develop",
                latestNews = allNews.take(3),
                newsFeed = allNews,
                newsDraft = NewsDraft(title = existing.title, body = existing.body),
                editingNewsId = existing.id,
            ),
        )
        val messages = mutableListOf<Int>()
        var callbackCount = 0
        val repository = ConfirmedNewsRepository(rejectReads = true)
        val actions = actions(
            state = state,
            repository = ControlledSharedProfileRepository(emptyList(), rejectsReads = false),
            emitMessage = messages::add,
            newsRepository = repository,
        )
        val forms = SessionFormActions(state, messages::add)

        forms.requestNewsDeletion(existing.id)
        actions.deleteNews(existing.id, state.value.newsDeletionRequestRevision) {
            callbackCount += 1
        }
        advanceUntilIdle()

        assertEquals(1, repository.deleteCount)
        assertEquals(1, repository.readCount)
        assertEquals(listOf(second, third, fourth), state.value.latestNews)
        assertEquals(listOf(second, third, fourth), state.value.newsFeed)
        assertEquals(NewsDraft(), state.value.newsDraft)
        assertNull(state.value.editingNewsId)
        assertEquals(1, callbackCount)
        assertEquals(
            listOf(
                R.string.feedback_news_deleted,
                R.string.feedback_unable_load_data,
            ),
            messages,
        )
    }

    @Test
    fun `successful refresh started before delete cannot restore confirmed deleted news`() = runTest {
        val admin = member(id = "admin-1", roles = setOf(MemberRole.MEMBER, MemberRole.ADMIN))
        val existing = newsArticle(id = "delete-me", title = "Delete")
        val repository = MutationDuringNewsRefreshRepository()
        val state = MutableStateFlow(
            authorizedState(admin).copy(
                sessionEnvironment = "develop",
                latestNews = listOf(existing),
                newsFeed = listOf(existing),
            ),
        )
        val actions = actions(
            state = state,
            repository = ControlledSharedProfileRepository(emptyList(), rejectsReads = false),
            emitMessage = {},
            newsRepository = repository,
        )
        val forms = SessionFormActions(state, emitMessage = {})

        actions.refreshNews()
        runCurrent()
        repository.readStarted[0].await()
        forms.requestNewsDeletion(existing.id)
        actions.deleteNews(existing.id, state.value.newsDeletionRequestRevision)
        runCurrent()
        repository.readStarted[1].await()
        repository.readResults[0].complete(listOf(existing))
        runCurrent()

        assertTrue(state.value.newsFeed.isEmpty())
        assertTrue(state.value.isLoadingNews)

        repository.readResults[1].completeExceptionally(IOException("convergence failed"))
        advanceUntilIdle()
        assertTrue(state.value.newsFeed.isEmpty())
        assertEquals(1, repository.deleteCount)
    }

    @Test
    fun `confirmed notification send completes locally and failing convergence does not invite duplicate send`() = runTest {
        val admin = member(id = "admin-1", roles = setOf(MemberRole.MEMBER, MemberRole.ADMIN))
        val state = MutableStateFlow(
            authorizedState(admin).copy(
                sessionEnvironment = "develop",
                notificationDraft = NotificationDraft(title = "Sent", body = "Body"),
            ),
        )
        val messages = mutableListOf<Int>()
        var callbackCount = 0
        val repository = ConfirmedNotificationRepository(rejectReads = true)
        val actions = actions(
            state = state,
            repository = ControlledSharedProfileRepository(emptyList(), rejectsReads = false),
            emitMessage = messages::add,
            notificationRepository = repository,
        )

        actions.sendNotification { callbackCount += 1 }
        advanceUntilIdle()

        assertEquals(1, repository.sendCount)
        assertEquals(1, repository.notificationReadCount)
        assertEquals("sent-notification", state.value.notificationsFeed.single().id)
        assertFalse(state.value.isSendingNotification)
        assertEquals(NotificationDraft(), state.value.notificationDraft)
        assertEquals(1, callbackCount)
        assertEquals(listOf(R.string.feedback_unable_load_data), messages)
    }

    @Test
    fun `successful refresh started before send cannot overwrite confirmed notification ACK`() = runTest {
        val admin = member(id = "admin-1", roles = setOf(MemberRole.MEMBER, MemberRole.ADMIN))
        val repository = MutationDuringNotificationRefreshRepository()
        val state = MutableStateFlow(
            authorizedState(admin).copy(
                sessionEnvironment = "develop",
                notificationDraft = NotificationDraft(title = "Sent", body = "Body"),
            ),
        )
        val actions = actions(
            state = state,
            repository = ControlledSharedProfileRepository(emptyList(), rejectsReads = false),
            emitMessage = {},
            notificationRepository = repository,
        )

        actions.refreshNotifications()
        runCurrent()
        repository.readStarted[0].await()
        actions.sendNotification()
        runCurrent()
        repository.readStarted[1].await()
        repository.readResults[0].complete(listOf(notificationEvent(id = "old")))
        runCurrent()

        assertEquals(listOf("sent-notification"), state.value.notificationsFeed.map { it.id })
        assertTrue(state.value.isLoadingNotifications)

        repository.readResults[1].completeExceptionally(IOException("convergence failed"))
        advanceUntilIdle()
        assertEquals(listOf("sent-notification"), state.value.notificationsFeed.map { it.id })
        assertEquals(1, repository.sendCount)
    }

    @Test
    fun `visible notification ACK survives successful pre fanout refresh until inbox observes it`() = runTest {
        val admin = member(id = "admin-1", roles = setOf(MemberRole.MEMBER, MemberRole.ADMIN))
        val repository = FanOutLagNotificationRepository(
            snapshots = ArrayDeque(
                listOf(
                    emptyList(),
                    listOf(notificationEvent(id = "sent-notification")),
                ),
            ),
        )
        val state = MutableStateFlow(
            authorizedState(admin).copy(
                sessionEnvironment = "develop",
                notificationDraft = NotificationDraft(
                    title = "Sent",
                    body = "Body",
                    audience = NotificationAudience.ALL,
                ),
            ),
        )
        val actions = actions(
            state = state,
            repository = ControlledSharedProfileRepository(emptyList(), rejectsReads = false),
            emitMessage = {},
            notificationRepository = repository,
        )

        actions.sendNotification()
        advanceUntilIdle()

        assertEquals(listOf("sent-notification"), state.value.notificationsFeed.map { it.id })
        assertEquals(
            listOf("sent-notification"),
            state.value.pendingNotificationAcknowledgements.map { it.id },
        )

        actions.refreshNotifications()
        advanceUntilIdle()

        assertEquals(listOf("sent-notification"), state.value.notificationsFeed.map { it.id })
        assertTrue(state.value.pendingNotificationAcknowledgements.isEmpty())
        assertEquals(1, repository.sendCount)
    }

    @Test
    fun `notification ACK is not published locally when target is not visible to sender`() = runTest {
        val admin = member(id = "admin-1", roles = setOf(MemberRole.MEMBER, MemberRole.ADMIN))
        val repository = FanOutLagNotificationRepository(
            snapshots = ArrayDeque(listOf(emptyList())),
        )
        val state = MutableStateFlow(
            authorizedState(admin).copy(
                sessionEnvironment = "develop",
                notificationDraft = NotificationDraft(
                    title = "Producer only",
                    body = "Body",
                    audience = NotificationAudience.PRODUCERS,
                ),
            ),
        )
        val actions = actions(
            state = state,
            repository = ControlledSharedProfileRepository(emptyList(), rejectsReads = false),
            emitMessage = {},
            notificationRepository = repository,
        )

        actions.sendNotification()
        advanceUntilIdle()

        assertTrue(state.value.notificationsFeed.isEmpty())
        assertTrue(state.value.pendingNotificationAcknowledgements.isEmpty())
        assertEquals(1, repository.sendCount)
    }

    @Test
    fun `save remains blocked while image upload owns the editor after a draft change`() = runTest {
        val admin = member(id = "admin-1", roles = setOf(MemberRole.MEMBER, MemberRole.ADMIN))
        val repository = SuspendedNewsMutationsRepository()
        val upload = SuspendedNewsUpload()
        val state = MutableStateFlow(
            authorizedState(admin).copy(
                sessionEnvironment = "develop",
                newsDraft = NewsDraft(title = "Initial", body = "Body"),
            ),
        )
        val actions = actions(
            state = state,
            repository = ControlledSharedProfileRepository(emptyList(), rejectsReads = false),
            emitMessage = {},
            newsRepository = repository,
        )
        val forms = SessionFormActions(state, emitMessage = {})

        actions.uploadNewsImage { _, _ -> upload.awaitResult() }
        runCurrent()
        upload.started.await()
        forms.onNewsDraftChanged(NewsDraft(title = "Edited", body = "Body"))
        val loaderAfterDraftChange = state.value.isUploadingNewsImage

        actions.saveNews()
        runCurrent()
        val writesWhileUploadIsPending = repository.upsertCount
        upload.complete("https://cdn.reguerta.test/uploaded.jpg")
        repository.completeSaveIfStarted(index = 0, id = "concurrent-save")
        advanceUntilIdle()

        actions.saveNews()
        runCurrent()
        repository.saveStarted[writesWhileUploadIsPending].await()
        repository.completeSaveIfStarted(
            index = writesWhileUploadIsPending,
            id = "save-after-upload",
        )
        advanceUntilIdle()

        assertTrue(loaderAfterDraftChange)
        assertEquals(0, writesWhileUploadIsPending)
        assertEquals(1, repository.upsertCount)
        assertFalse(state.value.isUploadingNewsImage)
        assertFalse(state.value.isSavingNews)
    }

    @Test
    fun `image upload remains blocked while save owns the news mutation`() = runTest {
        val admin = member(id = "admin-1", roles = setOf(MemberRole.MEMBER, MemberRole.ADMIN))
        val repository = SuspendedNewsMutationsRepository()
        val upload = SuspendedNewsUpload()
        val state = MutableStateFlow(
            authorizedState(admin).copy(
                sessionEnvironment = "develop",
                newsDraft = NewsDraft(title = "Initial", body = "Body"),
            ),
        )
        val actions = actions(
            state = state,
            repository = ControlledSharedProfileRepository(emptyList(), rejectsReads = false),
            emitMessage = {},
            newsRepository = repository,
        )

        actions.saveNews()
        runCurrent()
        repository.saveStarted[0].await()
        actions.uploadNewsImage { _, _ -> upload.awaitResult() }
        runCurrent()
        val uploadStartedWhileSaveIsPending = upload.started.isCompleted

        repository.completeSaveIfStarted(index = 0, id = "saved-news")
        advanceUntilIdle()
        actions.uploadNewsImage { _, _ -> upload.awaitResult() }
        runCurrent()
        upload.started.await()
        upload.complete("https://cdn.reguerta.test/after-save.jpg")
        advanceUntilIdle()

        assertFalse(uploadStartedWhileSaveIsPending)
        assertEquals("https://cdn.reguerta.test/after-save.jpg", state.value.newsDraft.urlImage)
        assertFalse(state.value.isSavingNews)
        assertFalse(state.value.isUploadingNewsImage)
    }

    @Test
    fun `stale news editor suppresses post ACK convergence feedback while preserving feed ACK`() = runTest {
        val admin = member(id = "admin-1", roles = setOf(MemberRole.MEMBER, MemberRole.ADMIN))
        val repository = SuspendedNewsMutationsRepository()
        val firstDraft = NewsDraft(title = "First", body = "First body")
        val reopenedDraft = NewsDraft(title = "Reopened", body = "Reopened body")
        val state = MutableStateFlow(
            authorizedState(admin).copy(
                sessionEnvironment = "develop",
                newsDraft = firstDraft,
            ),
        )
        val messages = mutableListOf<Int>()
        var callbackCount = 0
        val actions = actions(
            state = state,
            repository = ControlledSharedProfileRepository(emptyList(), rejectsReads = false),
            emitMessage = messages::add,
            newsRepository = repository,
        )
        val forms = SessionFormActions(state, messages::add)

        actions.saveNews { callbackCount += 1 }
        runCurrent()
        repository.saveStarted[0].await()
        forms.clearNewsEditor()
        forms.startCreatingNews()
        forms.onNewsDraftChanged(reopenedDraft)
        repository.failConvergenceReads()
        repository.completeSaveIfStarted(index = 0, id = "saved-first")
        advanceUntilIdle()

        assertEquals(listOf("saved-first"), state.value.newsFeed.map { it.id })
        assertEquals(reopenedDraft, state.value.newsDraft)
        assertEquals(0, callbackCount)
        assertTrue(messages.isEmpty())
    }

    @Test
    fun `stale notification editor suppresses post ACK convergence feedback while preserving feed ACK`() = runTest {
        val admin = member(id = "admin-1", roles = setOf(MemberRole.MEMBER, MemberRole.ADMIN))
        val repository = SuspendedNotificationSendsRepository()
        val firstDraft = NotificationDraft(title = "First", body = "First body")
        val reopenedDraft = NotificationDraft(title = "Reopened", body = "Reopened body")
        val state = MutableStateFlow(
            authorizedState(admin).copy(
                sessionEnvironment = "develop",
                notificationDraft = firstDraft,
            ),
        )
        val messages = mutableListOf<Int>()
        var callbackCount = 0
        val actions = actions(
            state = state,
            repository = ControlledSharedProfileRepository(emptyList(), rejectsReads = false),
            emitMessage = messages::add,
            notificationRepository = repository,
        )
        val forms = SessionFormActions(state, messages::add)

        actions.sendNotification { callbackCount += 1 }
        runCurrent()
        repository.sendStarted[0].await()
        forms.clearNotificationEditor()
        forms.startCreatingNotification()
        forms.onNotificationDraftChanged(reopenedDraft)
        repository.failConvergenceReads()
        repository.completeSendIfStarted(index = 0, id = "sent-first")
        advanceUntilIdle()

        assertEquals(listOf("sent-first"), state.value.notificationsFeed.map { it.id })
        assertEquals(reopenedDraft, state.value.notificationDraft)
        assertEquals(0, callbackCount)
        assertTrue(messages.isEmpty())
    }

    @Test
    fun `acknowledged news confirmation cannot clear a reopened editor`() {
        val admin = member(id = "admin-1", roles = setOf(MemberRole.MEMBER, MemberRole.ADMIN))
        val acknowledgedDraft = NewsDraft(title = "Acknowledged", body = "Saved body")
        val reopenedDraft = NewsDraft(title = "Reopened", body = "New body")
        val state = MutableStateFlow(
            authorizedState(admin).copy(
                newsDraft = acknowledgedDraft,
                newsEditorRevision = 4L,
                newsDraftRevision = 9L,
            ),
        )
        val forms = SessionFormActions(state, emitMessage = {})
        val confirmation = EditorConfirmationIdentity(
            editorGeneration = 4L,
            draftRevision = 9L,
        )

        forms.clearNewsEditor()
        forms.startCreatingNews()
        forms.onNewsDraftChanged(reopenedDraft)

        assertFalse(forms.clearNewsEditorIfCurrent(confirmation))
        assertEquals(reopenedDraft, state.value.newsDraft)
        val reopenedIdentity = EditorConfirmationIdentity(
            editorGeneration = state.value.newsEditorRevision,
            draftRevision = state.value.newsDraftRevision,
        )
        assertTrue(forms.clearNewsEditorIfCurrent(reopenedIdentity))
        assertEquals(NewsDraft(), state.value.newsDraft)
    }

    @Test
    fun `acknowledged notification confirmation cannot clear a reopened editor`() {
        val admin = member(id = "admin-1", roles = setOf(MemberRole.MEMBER, MemberRole.ADMIN))
        val acknowledgedDraft = NotificationDraft(title = "Acknowledged", body = "Saved body")
        val reopenedDraft = NotificationDraft(title = "Reopened", body = "New body")
        val state = MutableStateFlow(
            authorizedState(admin).copy(
                notificationDraft = acknowledgedDraft,
                notificationEditorRevision = 4L,
                notificationDraftRevision = 9L,
            ),
        )
        val forms = SessionFormActions(state, emitMessage = {})
        val confirmation = EditorConfirmationIdentity(
            editorGeneration = 4L,
            draftRevision = 9L,
        )

        forms.clearNotificationEditor()
        forms.startCreatingNotification()
        forms.onNotificationDraftChanged(reopenedDraft)

        assertFalse(forms.clearNotificationEditorIfCurrent(confirmation))
        assertEquals(reopenedDraft, state.value.notificationDraft)
        val reopenedIdentity = EditorConfirmationIdentity(
            editorGeneration = state.value.notificationEditorRevision,
            draftRevision = state.value.notificationDraftRevision,
        )
        assertTrue(forms.clearNotificationEditorIfCurrent(reopenedIdentity))
        assertEquals(NotificationDraft(), state.value.notificationDraft)
    }

    @Test
    fun `delete ACK from a closed and reopened same news request preserves ACK without stale feedback`() = runTest {
        val admin = member(id = "admin-1", roles = setOf(MemberRole.MEMBER, MemberRole.ADMIN))
        val existing = newsArticle(id = "same-news", title = "Delete")
        val repository = SuspendedNewsMutationsRepository(initialNews = listOf(existing))
        val state = MutableStateFlow(
            authorizedState(admin).copy(
                sessionEnvironment = "develop",
                latestNews = listOf(existing),
                newsFeed = listOf(existing),
                newsDraft = NewsDraft(title = existing.title, body = existing.body),
                editingNewsId = existing.id,
            ),
        )
        val messages = mutableListOf<Int>()
        var callbackCount = 0
        val actions = actions(
            state = state,
            repository = ControlledSharedProfileRepository(emptyList(), rejectsReads = false),
            emitMessage = messages::add,
            newsRepository = repository,
        )
        val forms = SessionFormActions(state, messages::add)

        forms.requestNewsDeletion(existing.id)
        val firstRequestRevision = state.value.newsDeletionRequestRevision
        actions.deleteNews(existing.id, firstRequestRevision) { callbackCount += 1 }
        runCurrent()
        repository.deleteStarted[0].await()
        forms.clearNewsDeletionRequest(firstRequestRevision)
        forms.requestNewsDeletion(existing.id)
        val reopenedRequestRevision = state.value.newsDeletionRequestRevision
        repository.failConvergenceReads()
        repository.completeDeleteIfStarted(index = 0, deleted = true)
        advanceUntilIdle()

        assertTrue(state.value.newsFeed.isEmpty())
        assertEquals(existing.id, state.value.pendingNewsDeletionId)
        assertEquals(reopenedRequestRevision, state.value.newsDeletionRequestRevision)
        assertEquals(0, callbackCount)
        assertTrue(messages.isEmpty())
    }

    @Test
    fun `delete failure from a closed and reopened same news request emits no stale feedback`() = runTest {
        val admin = member(id = "admin-1", roles = setOf(MemberRole.MEMBER, MemberRole.ADMIN))
        val existing = newsArticle(id = "same-news", title = "Delete")
        val repository = SuspendedNewsMutationsRepository(initialNews = listOf(existing))
        val state = MutableStateFlow(
            authorizedState(admin).copy(
                sessionEnvironment = "develop",
                newsFeed = listOf(existing),
                newsDraft = NewsDraft(title = existing.title, body = existing.body),
                editingNewsId = existing.id,
            ),
        )
        val messages = mutableListOf<Int>()
        val actions = actions(
            state = state,
            repository = ControlledSharedProfileRepository(emptyList(), rejectsReads = false),
            emitMessage = messages::add,
            newsRepository = repository,
        )
        val forms = SessionFormActions(state, messages::add)

        forms.requestNewsDeletion(existing.id)
        val firstRequestRevision = state.value.newsDeletionRequestRevision
        actions.deleteNews(existing.id, firstRequestRevision)
        runCurrent()
        repository.deleteStarted[0].await()
        forms.clearNewsDeletionRequest(firstRequestRevision)
        forms.requestNewsDeletion(existing.id)
        val reopenedRequestRevision = state.value.newsDeletionRequestRevision
        repository.completeDeleteIfStarted(index = 0, deleted = false)
        advanceUntilIdle()

        assertEquals(listOf(existing), state.value.newsFeed)
        assertEquals(existing.id, state.value.pendingNewsDeletionId)
        assertEquals(reopenedRequestRevision, state.value.newsDeletionRequestRevision)
        assertTrue(messages.isEmpty())
    }

    @Test
    fun `news save remains serialized and confirmed stale editor ACK preserves the newer draft`() = runTest {
        val admin = member(id = "admin-1", roles = setOf(MemberRole.MEMBER, MemberRole.ADMIN))
        val repository = SuspendedNewsMutationsRepository()
        val firstDraft = NewsDraft(title = "First", body = "First body", active = true)
        val secondDraft = NewsDraft(title = "Second", body = "Second body", active = true)
        val state = MutableStateFlow(
            authorizedState(admin).copy(
                sessionEnvironment = "develop",
                newsDraft = firstDraft,
            ),
        )
        val messages = mutableListOf<Int>()
        var firstCallbackCount = 0
        var secondCallbackCount = 0
        val actions = actions(
            state = state,
            repository = ControlledSharedProfileRepository(emptyList(), rejectsReads = false),
            emitMessage = messages::add,
            newsRepository = repository,
        )
        val forms = SessionFormActions(state, messages::add)

        actions.saveNews { firstCallbackCount += 1 }
        runCurrent()
        repository.saveStarted[0].await()

        forms.clearNewsEditor()
        forms.startCreatingNews()
        forms.onNewsDraftChanged(secondDraft)
        val loaderAfterReopeningWhileFirstIsPending = state.value.isSavingNews

        actions.saveNews { secondCallbackCount += 1 }
        runCurrent()
        val writesWhileFirstIsPending = repository.upsertCount

        repository.completeSaveIfStarted(index = 0, id = "saved-first")
        runCurrent()
        val stateAfterFirstAcknowledgement = state.value
        val firstCallbacksAfterFirstAcknowledgement = firstCallbackCount
        val secondCallbacksAfterFirstAcknowledgement = secondCallbackCount
        repository.completeSaveIfStarted(index = 1, id = "saved-second-concurrent")
        advanceUntilIdle()

        assertTrue(loaderAfterReopeningWhileFirstIsPending)
        assertEquals(1, writesWhileFirstIsPending)
        assertEquals(setOf("saved-first"), stateAfterFirstAcknowledgement.newsFeed.map { it.id }.toSet())
        assertEquals(secondDraft, stateAfterFirstAcknowledgement.newsDraft)
        assertNull(stateAfterFirstAcknowledgement.editingNewsId)
        assertFalse(stateAfterFirstAcknowledgement.isSavingNews)
        assertEquals(0, firstCallbacksAfterFirstAcknowledgement)
        assertEquals(0, secondCallbacksAfterFirstAcknowledgement)
        assertTrue(messages.isEmpty())

        actions.saveNews { secondCallbackCount += 1 }
        runCurrent()
        repository.saveStarted[1].await()
        assertTrue(state.value.isSavingNews)
        repository.completeSaveIfStarted(index = 1, id = "saved-second")
        advanceUntilIdle()

        assertEquals(2, repository.upsertCount)
        assertEquals(setOf("saved-first", "saved-second"), state.value.newsFeed.map { it.id }.toSet())
        assertEquals("saved-second", state.value.editingNewsId)
        assertEquals(secondDraft.title, state.value.newsDraft.title)
        assertFalse(state.value.isSavingNews)
        assertEquals(0, firstCallbackCount)
        assertEquals(1, secondCallbackCount)
        assertTrue(messages.isEmpty())
    }

    @Test
    fun `notification send remains serialized and confirmed stale editor ACK preserves the newer draft`() = runTest {
        val admin = member(id = "admin-1", roles = setOf(MemberRole.MEMBER, MemberRole.ADMIN))
        val repository = SuspendedNotificationSendsRepository()
        val firstDraft = NotificationDraft(title = "First", body = "First body")
        val secondDraft = NotificationDraft(title = "Second", body = "Second body")
        val state = MutableStateFlow(
            authorizedState(admin).copy(
                sessionEnvironment = "develop",
                notificationDraft = firstDraft,
            ),
        )
        val messages = mutableListOf<Int>()
        var firstCallbackCount = 0
        var secondCallbackCount = 0
        val actions = actions(
            state = state,
            repository = ControlledSharedProfileRepository(emptyList(), rejectsReads = false),
            emitMessage = messages::add,
            notificationRepository = repository,
        )
        val forms = SessionFormActions(state, messages::add)

        actions.sendNotification { firstCallbackCount += 1 }
        runCurrent()
        repository.sendStarted[0].await()

        forms.clearNotificationEditor()
        forms.startCreatingNotification()
        forms.onNotificationDraftChanged(secondDraft)
        val loaderAfterReopeningWhileFirstIsPending = state.value.isSendingNotification

        actions.sendNotification { secondCallbackCount += 1 }
        runCurrent()
        val sendsWhileFirstIsPending = repository.sendCount

        repository.completeSendIfStarted(index = 0, id = "sent-first")
        runCurrent()
        val stateAfterFirstAcknowledgement = state.value
        val firstCallbacksAfterFirstAcknowledgement = firstCallbackCount
        val secondCallbacksAfterFirstAcknowledgement = secondCallbackCount
        repository.completeSendIfStarted(index = 1, id = "sent-second-concurrent")
        advanceUntilIdle()

        assertTrue(loaderAfterReopeningWhileFirstIsPending)
        assertEquals(1, sendsWhileFirstIsPending)
        assertEquals(setOf("sent-first"), stateAfterFirstAcknowledgement.notificationsFeed.map { it.id }.toSet())
        assertEquals(secondDraft, stateAfterFirstAcknowledgement.notificationDraft)
        assertFalse(stateAfterFirstAcknowledgement.isSendingNotification)
        assertEquals(0, firstCallbacksAfterFirstAcknowledgement)
        assertEquals(0, secondCallbacksAfterFirstAcknowledgement)
        assertTrue(messages.isEmpty())

        actions.sendNotification { secondCallbackCount += 1 }
        runCurrent()
        repository.sendStarted[1].await()
        assertTrue(state.value.isSendingNotification)
        repository.completeSendIfStarted(index = 1, id = "sent-second")
        advanceUntilIdle()

        assertEquals(2, repository.sendCount)
        assertEquals(setOf("sent-first", "sent-second"), state.value.notificationsFeed.map { it.id }.toSet())
        assertEquals(NotificationDraft(), state.value.notificationDraft)
        assertFalse(state.value.isSendingNotification)
        assertEquals(0, firstCallbackCount)
        assertEquals(1, secondCallbackCount)
        assertTrue(messages.isEmpty())
    }

    @Test
    fun `obsolete news save failure preserves the reopened editor and releases mutation ownership`() = runTest {
        val admin = member(id = "admin-1", roles = setOf(MemberRole.MEMBER, MemberRole.ADMIN))
        val repository = SuspendedNewsMutationsRepository()
        val firstDraft = NewsDraft(title = "First", body = "First body", active = true)
        val reopenedDraft = NewsDraft(title = "Reopened", body = "Reopened body", active = true)
        val state = MutableStateFlow(
            authorizedState(admin).copy(
                sessionEnvironment = "develop",
                newsDraft = firstDraft,
            ),
        )
        val messages = mutableListOf<Int>()
        var obsoleteCallbackCount = 0
        var retryCallbackCount = 0
        val actions = actions(
            state = state,
            repository = ControlledSharedProfileRepository(emptyList(), rejectsReads = false),
            emitMessage = messages::add,
            newsRepository = repository,
        )
        val forms = SessionFormActions(state, messages::add)

        actions.saveNews { obsoleteCallbackCount += 1 }
        runCurrent()
        repository.saveStarted[0].await()

        forms.clearNewsEditor()
        forms.startCreatingNews()
        forms.onNewsDraftChanged(reopenedDraft)
        repository.failSaveIfStarted(index = 0)
        advanceUntilIdle()

        assertEquals(reopenedDraft, state.value.newsDraft)
        assertNull(state.value.editingNewsId)
        assertFalse(state.value.isSavingNews)
        assertEquals(0, obsoleteCallbackCount)
        assertTrue(messages.isEmpty())

        actions.saveNews { retryCallbackCount += 1 }
        runCurrent()
        repository.saveStarted[1].await()
        assertTrue(state.value.isSavingNews)
        repository.completeSaveIfStarted(index = 1, id = "saved-retry")
        advanceUntilIdle()

        assertEquals(2, repository.upsertCount)
        assertEquals(1, retryCallbackCount)
        assertEquals("saved-retry", state.value.editingNewsId)
        assertFalse(state.value.isSavingNews)
        assertTrue(messages.isEmpty())
    }

    @Test
    fun `obsolete notification failure preserves the reopened editor and releases mutation ownership`() = runTest {
        val admin = member(id = "admin-1", roles = setOf(MemberRole.MEMBER, MemberRole.ADMIN))
        val repository = SuspendedNotificationSendsRepository()
        val firstDraft = NotificationDraft(title = "First", body = "First body")
        val reopenedDraft = NotificationDraft(title = "Reopened", body = "Reopened body")
        val state = MutableStateFlow(
            authorizedState(admin).copy(
                sessionEnvironment = "develop",
                notificationDraft = firstDraft,
            ),
        )
        val messages = mutableListOf<Int>()
        var obsoleteCallbackCount = 0
        var retryCallbackCount = 0
        val actions = actions(
            state = state,
            repository = ControlledSharedProfileRepository(emptyList(), rejectsReads = false),
            emitMessage = messages::add,
            notificationRepository = repository,
        )
        val forms = SessionFormActions(state, messages::add)

        actions.sendNotification { obsoleteCallbackCount += 1 }
        runCurrent()
        repository.sendStarted[0].await()

        forms.clearNotificationEditor()
        forms.startCreatingNotification()
        forms.onNotificationDraftChanged(reopenedDraft)
        repository.failSendIfStarted(index = 0)
        advanceUntilIdle()

        assertEquals(reopenedDraft, state.value.notificationDraft)
        assertFalse(state.value.isSendingNotification)
        assertEquals(0, obsoleteCallbackCount)
        assertTrue(messages.isEmpty())

        actions.sendNotification { retryCallbackCount += 1 }
        runCurrent()
        repository.sendStarted[1].await()
        assertTrue(state.value.isSendingNotification)
        repository.completeSendIfStarted(index = 1, id = "sent-retry")
        advanceUntilIdle()

        assertEquals(2, repository.sendCount)
        assertEquals(1, retryCallbackCount)
        assertEquals(NotificationDraft(), state.value.notificationDraft)
        assertFalse(state.value.isSendingNotification)
        assertTrue(messages.isEmpty())
    }

    @Test
    fun `obsolete news mutation token cannot block or finish a write in the replacement context`() = runTest {
        val oldAdmin = member(id = "admin-old", roles = setOf(MemberRole.MEMBER, MemberRole.ADMIN))
        val newAdmin = member(id = "admin-new", roles = setOf(MemberRole.MEMBER, MemberRole.ADMIN))
        val repository = SuspendedNewsMutationsRepository()
        val oldDraft = NewsDraft(title = "Old", body = "Old body", active = true)
        val newDraft = NewsDraft(title = "New", body = "New body", active = true)
        val initialState = authorizedState(oldAdmin).copy(
            sessionEnvironment = "develop",
            newsDraft = oldDraft,
        )
        val state = MutableStateFlow(initialState)
        var oldCallbackCount = 0
        var newCallbackCount = 0
        val actions = actions(
            state = state,
            repository = ControlledSharedProfileRepository(emptyList(), rejectsReads = false),
            emitMessage = {},
            newsRepository = repository,
        )

        actions.saveNews { oldCallbackCount += 1 }
        runCurrent()
        repository.saveStarted[0].await()

        state.value = authorizedState(newAdmin).copy(
            sessionEpoch = initialState.sessionEpoch + 1,
            sessionEnvironment = "production",
            newsDraft = newDraft,
        )
        actions.saveNews { newCallbackCount += 1 }
        runCurrent()
        repository.saveStarted[1].await()
        assertTrue(state.value.isSavingNews)

        repository.completeSaveIfStarted(index = 0, id = "saved-old")
        runCurrent()
        val stateAfterObsoleteCompletion = state.value

        repository.completeSaveIfStarted(index = 1, id = "saved-new")
        advanceUntilIdle()

        assertEquals(newDraft, stateAfterObsoleteCompletion.newsDraft)
        assertTrue(stateAfterObsoleteCompletion.isSavingNews)
        assertTrue(stateAfterObsoleteCompletion.newsFeed.isEmpty())
        assertEquals(0, oldCallbackCount)
        assertEquals(1, newCallbackCount)
        assertFalse(state.value.isSavingNews)
        assertEquals("saved-new", state.value.editingNewsId)
    }

    @Test
    fun `obsolete notification mutation token cannot block or finish a send in the replacement context`() = runTest {
        val oldAdmin = member(id = "admin-old", roles = setOf(MemberRole.MEMBER, MemberRole.ADMIN))
        val newAdmin = member(id = "admin-new", roles = setOf(MemberRole.MEMBER, MemberRole.ADMIN))
        val repository = SuspendedNotificationSendsRepository()
        val oldDraft = NotificationDraft(title = "Old", body = "Old body")
        val newDraft = NotificationDraft(title = "New", body = "New body")
        val initialState = authorizedState(oldAdmin).copy(
            sessionEnvironment = "develop",
            notificationDraft = oldDraft,
        )
        val state = MutableStateFlow(initialState)
        var oldCallbackCount = 0
        var newCallbackCount = 0
        val actions = actions(
            state = state,
            repository = ControlledSharedProfileRepository(emptyList(), rejectsReads = false),
            emitMessage = {},
            notificationRepository = repository,
        )

        actions.sendNotification { oldCallbackCount += 1 }
        runCurrent()
        repository.sendStarted[0].await()

        state.value = authorizedState(newAdmin).copy(
            sessionEpoch = initialState.sessionEpoch + 1,
            sessionEnvironment = "production",
            notificationDraft = newDraft,
        )
        actions.sendNotification { newCallbackCount += 1 }
        runCurrent()
        repository.sendStarted[1].await()
        assertTrue(state.value.isSendingNotification)

        repository.completeSendIfStarted(index = 0, id = "sent-old")
        runCurrent()
        val stateAfterObsoleteCompletion = state.value

        repository.completeSendIfStarted(index = 1, id = "sent-new")
        advanceUntilIdle()

        assertEquals(newDraft, stateAfterObsoleteCompletion.notificationDraft)
        assertTrue(stateAfterObsoleteCompletion.isSendingNotification)
        assertTrue(stateAfterObsoleteCompletion.notificationsFeed.isEmpty())
        assertEquals(0, oldCallbackCount)
        assertEquals(1, newCallbackCount)
        assertFalse(state.value.isSendingNotification)
        assertEquals(NotificationDraft(), state.value.notificationDraft)
    }

    @Test
    fun `news delete confirmation is serialized to one ACK callback message and convergence`() = runTest {
        val admin = member(id = "admin-1", roles = setOf(MemberRole.MEMBER, MemberRole.ADMIN))
        val existing = newsArticle(id = "delete-me", title = "Delete")
        val repository = SuspendedNewsMutationsRepository(initialNews = listOf(existing))
        val state = MutableStateFlow(
            authorizedState(admin).copy(
                sessionEnvironment = "develop",
                latestNews = listOf(existing),
                newsFeed = listOf(existing),
            ),
        )
        val messages = mutableListOf<Int>()
        var callbackCount = 0
        val actions = actions(
            state = state,
            repository = ControlledSharedProfileRepository(emptyList(), rejectsReads = false),
            emitMessage = messages::add,
            newsRepository = repository,
        )
        val forms = SessionFormActions(state, messages::add)

        forms.requestNewsDeletion(existing.id)
        val requestRevision = state.value.newsDeletionRequestRevision
        actions.deleteNews(existing.id, requestRevision) { callbackCount += 1 }
        actions.deleteNews(existing.id, requestRevision) { callbackCount += 1 }
        runCurrent()
        repository.deleteStarted[0].await()
        val deletesWhileFirstIsPending = repository.deleteCount

        repository.completeDeleteIfStarted(index = 0, deleted = true)
        runCurrent()
        val callbackCountAfterFirstAcknowledgement = callbackCount
        val messagesAfterFirstAcknowledgement = messages.toList()
        val readsAfterFirstAcknowledgement = repository.readCount
        repository.completeDeleteIfStarted(index = 1, deleted = true)
        advanceUntilIdle()

        assertEquals(1, deletesWhileFirstIsPending)
        assertEquals(1, repository.deleteCount)
        assertEquals(1, callbackCountAfterFirstAcknowledgement)
        assertEquals(listOf(R.string.feedback_news_deleted), messagesAfterFirstAcknowledgement)
        assertEquals(1, readsAfterFirstAcknowledgement)
        assertTrue(state.value.newsFeed.isEmpty())
    }

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
        newsRepository: NewsRepository = EmptyNewsRepository,
        notificationRepository: NotificationRepository = EmptyNotificationRepository,
        shiftNotificationDetailRepository: ShiftNotificationDetailRepository = EmptyShiftNotificationDetailRepository,
        runtimeEnvironmentProvider: () -> String? = { state.value.sessionEnvironment },
        automaticLoadRetryDelayMillis: Long? = null,
    ) = SessionCommunityActions(
        uiState = state,
        scope = kotlinx.coroutines.CoroutineScope(currentCoroutineContext()),
        newsRepository = newsRepository,
        notificationRepository = notificationRepository,
        shiftNotificationDetailRepository = shiftNotificationDetailRepository,
        sharedProfileRepository = repository,
        imagePipelineManager = EmptyImagePipelineManager,
        nowMillisProvider = { 123L },
        emitMessage = emitMessage,
        emitEvent = {},
        pushNotificationPermissionProvider = PushNotificationPermissionProvider { true },
        runtimeEnvironmentProvider = runtimeEnvironmentProvider,
        automaticLoadRetryDelayMillis = automaticLoadRetryDelayMillis,
    )
}

private class RecordingShiftNotificationDetailRepository(
    private val detail: ShiftNotificationDetail,
) : ShiftNotificationDetailRepository {
    var requestedMemberId: String? = null

    override suspend fun getCurrentDetail(eventId: String, memberId: String): ShiftNotificationDetail {
        requestedMemberId = memberId
        return detail
    }
}

private class SuspendedShiftNotificationDetailRepository : ShiftNotificationDetailRepository {
    val started = CompletableDeferred<Unit>()
    private val result = CompletableDeferred<ShiftNotificationDetail>()

    override suspend fun getCurrentDetail(eventId: String, memberId: String): ShiftNotificationDetail {
        started.complete(Unit)
        return result.await()
    }

    fun complete(detail: ShiftNotificationDetail) {
        result.complete(detail)
    }
}

private object EmptyShiftNotificationDetailRepository : ShiftNotificationDetailRepository {
    override suspend fun getCurrentDetail(eventId: String, memberId: String): ShiftNotificationDetail =
        throw RepositoryException(RepositoryErrorKind.NOT_FOUND, "notifications.shiftDetail")
}

private fun notificationShiftDetail(): ShiftNotificationDetail = ShiftNotificationDetail(
    eventId = "event-1",
    assignmentRevision = 2,
    documentRevision = 3,
    shift = ShiftAssignment(
        id = "shift_delivery_20260902",
        type = ShiftType.DELIVERY,
        dateMillis = 1_788_307_200_000,
        assignedUserIds = listOf("member_1"),
        helperUserId = "member-2",
        status = ShiftStatus.PLANNED,
        source = "app",
        createdAtMillis = 1_788_307_200_000,
        updatedAtMillis = 1_788_307_300_000,
    ),
)

private class QueuedNewsRepository(
    private val readResults: ArrayDeque<Result<List<NewsArticle>>>,
) : NewsRepository {
    override suspend fun getNewsFor(member: Member): List<NewsArticle> = readResults.removeFirst().getOrThrow()
    override suspend fun upsertNews(article: NewsArticle): NewsArticle = article
    override suspend fun deleteNews(newsId: String): Boolean = true
}

private class SuspendedNewsReadsRepository : NewsRepository {
    val started = List(2) { CompletableDeferred<Unit>() }
    val results = List(2) { CompletableDeferred<List<NewsArticle>>() }
    private var readCount = 0

    override suspend fun getNewsFor(member: Member): List<NewsArticle> {
        val index = readCount++
        started[index].complete(Unit)
        return results[index].await()
    }

    override suspend fun upsertNews(article: NewsArticle): NewsArticle = article
    override suspend fun deleteNews(newsId: String): Boolean = true
}

private object CancellingNewsRepository : NewsRepository {
    override suspend fun getNewsFor(member: Member): List<NewsArticle> = throw CancellationException("cancelled")
    override suspend fun upsertNews(article: NewsArticle): NewsArticle = article
    override suspend fun deleteNews(newsId: String): Boolean = true
}

private class ConfirmedNewsRepository(
    private val rejectReads: Boolean,
) : NewsRepository {
    var readCount = 0
    var upsertCount = 0
    var deleteCount = 0

    override suspend fun getNewsFor(member: Member): List<NewsArticle> {
        readCount += 1
        if (rejectReads) throw IOException("read failed after ACK")
        return emptyList()
    }

    override suspend fun upsertNews(article: NewsArticle): NewsArticle {
        upsertCount += 1
        return article.copy(id = "saved-news")
    }

    override suspend fun deleteNews(newsId: String): Boolean {
        deleteCount += 1
        return true
    }
}

private class MutationDuringNewsRefreshRepository : NewsRepository {
    val readStarted = List(2) { CompletableDeferred<Unit>() }
    val readResults = List(2) { CompletableDeferred<List<NewsArticle>>() }
    var upsertCount = 0
    var deleteCount = 0
    private var readCount = 0

    override suspend fun getNewsFor(member: Member): List<NewsArticle> {
        val index = readCount++
        readStarted[index].complete(Unit)
        return readResults[index].await()
    }

    override suspend fun upsertNews(article: NewsArticle): NewsArticle {
        upsertCount += 1
        return article.copy(id = "saved-news")
    }

    override suspend fun deleteNews(newsId: String): Boolean {
        deleteCount += 1
        return true
    }
}

private class SuspendedNewsMutationsRepository(
    initialNews: List<NewsArticle> = emptyList(),
) : NewsRepository {
    val saveStarted = List(2) { CompletableDeferred<Unit>() }
    val deleteStarted = List(2) { CompletableDeferred<Unit>() }
    private val saveResults = List(2) { CompletableDeferred<NewsArticle>() }
    private val deleteResults = List(2) { CompletableDeferred<Boolean>() }
    private val submittedNews = mutableListOf<NewsArticle>()
    private val submittedDeleteIds = mutableListOf<String>()
    private val storedNews = initialNews.associateBy(NewsArticle::id).toMutableMap()
    private var rejectsReads = false
    var readCount = 0
        private set
    var upsertCount = 0
        private set
    var deleteCount = 0
        private set

    override suspend fun getNewsFor(member: Member): List<NewsArticle> {
        readCount += 1
        if (rejectsReads) throw IOException("convergence failed")
        return storedNews.values.toList()
    }

    override suspend fun upsertNews(article: NewsArticle): NewsArticle {
        val index = upsertCount++
        submittedNews += article
        saveStarted[index].complete(Unit)
        return saveResults[index].await().also { saved -> storedNews[saved.id] = saved }
    }

    override suspend fun deleteNews(newsId: String): Boolean {
        val index = deleteCount++
        submittedDeleteIds += newsId
        deleteStarted[index].complete(Unit)
        return deleteResults[index].await().also { deleted ->
            if (deleted) storedNews.remove(newsId)
        }
    }

    fun completeSaveIfStarted(index: Int, id: String) {
        if (upsertCount <= index) return
        saveResults[index].complete(submittedNews[index].copy(id = id))
    }

    fun failSaveIfStarted(index: Int) {
        if (upsertCount <= index) return
        saveResults[index].completeExceptionally(IOException("save failed"))
    }

    fun failConvergenceReads() {
        rejectsReads = true
    }

    fun completeDeleteIfStarted(index: Int, deleted: Boolean) {
        if (deleteCount <= index) return
        check(submittedDeleteIds[index].isNotBlank())
        deleteResults[index].complete(deleted)
    }
}

private class QueuedNotificationRepository(
    private val notificationsResults: ArrayDeque<Result<List<NotificationEvent>>>,
    private val readResults: ArrayDeque<Result<Set<String>>>,
) : NotificationRepository {
    override suspend fun getNotificationsFor(member: Member): List<NotificationEvent> =
        notificationsResults.removeFirst().getOrThrow()

    override suspend fun getReadNotificationIds(memberId: String): Set<String> =
        readResults.removeFirst().getOrThrow()

    override suspend fun markNotificationsRead(
        memberId: String,
        notificationIds: Set<String>,
        readAtMillis: Long,
    ) = Unit

    override suspend fun sendNotification(event: NotificationEvent): NotificationEvent = event
}

private class ConfirmedNotificationRepository(
    private val rejectReads: Boolean,
) : NotificationRepository {
    var notificationReadCount = 0
    var sendCount = 0

    override suspend fun getNotificationsFor(member: Member): List<NotificationEvent> {
        notificationReadCount += 1
        if (rejectReads) throw IOException("read failed after ACK")
        return emptyList()
    }

    override suspend fun getReadNotificationIds(memberId: String): Set<String> = emptySet()

    override suspend fun markNotificationsRead(
        memberId: String,
        notificationIds: Set<String>,
        readAtMillis: Long,
    ) = Unit

    override suspend fun sendNotification(event: NotificationEvent): NotificationEvent {
        sendCount += 1
        return event.copy(id = "sent-notification")
    }
}

private class FanOutLagNotificationRepository(
    private val snapshots: ArrayDeque<List<NotificationEvent>>,
) : NotificationRepository {
    var sendCount = 0

    override suspend fun getNotificationsFor(member: Member): List<NotificationEvent> =
        snapshots.removeFirst()

    override suspend fun getReadNotificationIds(memberId: String): Set<String> = emptySet()

    override suspend fun markNotificationsRead(
        memberId: String,
        notificationIds: Set<String>,
        readAtMillis: Long,
    ) = Unit

    override suspend fun sendNotification(event: NotificationEvent): NotificationEvent {
        sendCount += 1
        return event.copy(id = "sent-notification")
    }
}

private class MutationDuringNotificationRefreshRepository : NotificationRepository {
    val readStarted = List(2) { CompletableDeferred<Unit>() }
    val readResults = List(2) { CompletableDeferred<List<NotificationEvent>>() }
    var sendCount = 0
    private var readCount = 0

    override suspend fun getNotificationsFor(member: Member): List<NotificationEvent> {
        val index = readCount++
        readStarted[index].complete(Unit)
        return readResults[index].await()
    }

    override suspend fun getReadNotificationIds(memberId: String): Set<String> = emptySet()

    override suspend fun markNotificationsRead(
        memberId: String,
        notificationIds: Set<String>,
        readAtMillis: Long,
    ) = Unit

    override suspend fun sendNotification(event: NotificationEvent): NotificationEvent {
        sendCount += 1
        return event.copy(id = "sent-notification")
    }
}

private class SuspendedNotificationSendsRepository : NotificationRepository {
    val sendStarted = List(2) { CompletableDeferred<Unit>() }
    private val sendResults = List(2) { CompletableDeferred<NotificationEvent>() }
    private val submittedEvents = mutableListOf<NotificationEvent>()
    private val storedEvents = linkedMapOf<String, NotificationEvent>()
    private var rejectsReads = false
    var sendCount = 0
        private set

    override suspend fun getNotificationsFor(member: Member): List<NotificationEvent> {
        if (rejectsReads) throw IOException("convergence failed")
        return storedEvents.values.toList()
    }

    override suspend fun getReadNotificationIds(memberId: String): Set<String> = emptySet()

    override suspend fun markNotificationsRead(
        memberId: String,
        notificationIds: Set<String>,
        readAtMillis: Long,
    ) = Unit

    override suspend fun sendNotification(event: NotificationEvent): NotificationEvent {
        val index = sendCount++
        submittedEvents += event
        sendStarted[index].complete(Unit)
        return sendResults[index].await().also { sent -> storedEvents[sent.id] = sent }
    }

    fun completeSendIfStarted(index: Int, id: String) {
        if (sendCount <= index) return
        sendResults[index].complete(submittedEvents[index].copy(id = id))
    }

    fun failSendIfStarted(index: Int) {
        if (sendCount <= index) return
        sendResults[index].completeExceptionally(IOException("send failed"))
    }

    fun failConvergenceReads() {
        rejectsReads = true
    }
}

private class SuspendedNotificationReadsRepository : NotificationRepository {
    val started = List(2) { CompletableDeferred<Unit>() }
    val results = List(2) { CompletableDeferred<List<NotificationEvent>>() }
    private var readCount = 0

    override suspend fun getNotificationsFor(member: Member): List<NotificationEvent> {
        val index = readCount++
        started[index].complete(Unit)
        return results[index].await()
    }

    override suspend fun getReadNotificationIds(memberId: String): Set<String> = emptySet()

    override suspend fun markNotificationsRead(
        memberId: String,
        notificationIds: Set<String>,
        readAtMillis: Long,
    ) = Unit

    override suspend fun sendNotification(event: NotificationEvent): NotificationEvent = event
}

private object CancellingNotificationRepository : NotificationRepository {
    override suspend fun getNotificationsFor(member: Member): List<NotificationEvent> =
        throw CancellationException("cancelled")

    override suspend fun getReadNotificationIds(memberId: String): Set<String> = emptySet()

    override suspend fun markNotificationsRead(
        memberId: String,
        notificationIds: Set<String>,
        readAtMillis: Long,
    ) = Unit

    override suspend fun sendNotification(event: NotificationEvent): NotificationEvent = event
}

private class SuspendedNotificationOperationsRepository : NotificationRepository {
    val readStarted = CompletableDeferred<Unit>()
    val readResult = CompletableDeferred<Set<String>>()
    val markStarted = CompletableDeferred<Unit>()
    val markResult = CompletableDeferred<Unit>()

    override suspend fun getNotificationsFor(member: Member): List<NotificationEvent> =
        listOf(notificationEvent(id = "notification-1"))

    override suspend fun getReadNotificationIds(memberId: String): Set<String> {
        readStarted.complete(Unit)
        return readResult.await()
    }

    override suspend fun markNotificationsRead(
        memberId: String,
        notificationIds: Set<String>,
        readAtMillis: Long,
    ) {
        markStarted.complete(Unit)
        markResult.await()
    }

    override suspend fun sendNotification(event: NotificationEvent): NotificationEvent = event
}

private class SuspendedNewsUpload {
    val started = CompletableDeferred<Unit>()
    private val result = CompletableDeferred<ImageUploadResult?>()

    suspend fun awaitResult(): ImageUploadResult? {
        started.complete(Unit)
        return result.await()
    }

    fun complete(downloadUrl: String) {
        result.complete(
            ImageUploadResult(
                downloadUrl = downloadUrl,
                widthPx = 800,
                heightPx = 600,
                byteSize = 1_024,
                mimeType = "image/jpeg",
            ),
        )
    }
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

private fun member(
    id: String = "member_1",
    roles: Set<MemberRole> = setOf(MemberRole.MEMBER),
) = Member(
    id = id,
    displayName = "Member",
    normalizedEmail = "$id@reguerta.test",
    authUid = "auth_$id",
    roles = roles,
    isActive = true,
    producerCatalogEnabled = true,
)

private fun newsArticle(
    id: String,
    title: String,
) = NewsArticle(
    id = id,
    title = title,
    body = "Body",
    active = true,
    publishedBy = "Publisher",
    publishedAtMillis = 123L,
    urlImage = null,
)

private fun notificationEvent(
    id: String,
    target: String = "all",
    userIds: List<String> = emptyList(),
    segmentType: String? = null,
    targetRole: MemberRole? = null,
) = NotificationEvent(
    id = id,
    title = "Title",
    body = "Body",
    type = "admin_broadcast",
    target = target,
    userIds = userIds,
    segmentType = segmentType,
    targetRole = targetRole,
    createdBy = "admin-1",
    sentAtMillis = 123L,
    weekKey = null,
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
