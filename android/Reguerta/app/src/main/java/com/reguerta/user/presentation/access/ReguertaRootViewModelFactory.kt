package com.reguerta.user.presentation.access

import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.storage.FirebaseStorage
import com.reguerta.user.BuildConfig
import com.reguerta.user.data.access.ChainedMemberRepository
import com.reguerta.user.data.access.FirebaseAuthSessionProvider
import com.reguerta.user.data.access.FirestoreMemberRepository
import com.reguerta.user.data.access.InMemoryMemberRepository
import com.reguerta.user.data.calendar.ChainedDeliveryCalendarRepository
import com.reguerta.user.data.calendar.FirestoreDeliveryCalendarRepository
import com.reguerta.user.data.calendar.InMemoryDeliveryCalendarRepository
import com.reguerta.user.data.commitments.ChainedSeasonalCommitmentRepository
import com.reguerta.user.data.commitments.FirestoreSeasonalCommitmentRepository
import com.reguerta.user.data.commitments.InMemorySeasonalCommitmentRepository
import com.reguerta.user.data.devices.FirebaseAuthorizedDeviceRegistrar
import com.reguerta.user.data.devices.FirestoreDeviceRegistrationRepository
import com.reguerta.user.data.freshness.DataStoreCriticalDataFreshnessLocalRepository
import com.reguerta.user.data.freshness.FirestoreCriticalDataFreshnessRemoteRepository
import com.reguerta.user.data.firestore.FirestoreReviewerEnvironmentRouter
import com.reguerta.user.data.media.FirebaseImagePipelineManager
import com.reguerta.user.data.news.ChainedNewsRepository
import com.reguerta.user.data.news.FirestoreNewsRepository
import com.reguerta.user.data.news.InMemoryNewsRepository
import com.reguerta.user.data.notifications.ChainedNotificationRepository
import com.reguerta.user.data.notifications.FirestoreNotificationRepository
import com.reguerta.user.data.notifications.InMemoryNotificationRepository
import com.reguerta.user.data.profiles.ChainedSharedProfileRepository
import com.reguerta.user.data.profiles.FirestoreSharedProfileRepository
import com.reguerta.user.data.profiles.InMemorySharedProfileRepository
import com.reguerta.user.data.products.ChainedProductRepository
import com.reguerta.user.data.products.FirestoreProductRepository
import com.reguerta.user.data.products.InMemoryProductRepository
import com.reguerta.user.data.shiftplanning.ChainedShiftPlanningRequestRepository
import com.reguerta.user.data.shiftplanning.FirestoreShiftPlanningRequestRepository
import com.reguerta.user.data.shiftplanning.InMemoryShiftPlanningRequestRepository
import com.reguerta.user.data.shifts.ChainedShiftRepository
import com.reguerta.user.data.shifts.FirestoreShiftRepository
import com.reguerta.user.data.shifts.InMemoryShiftRepository
import com.reguerta.user.data.shiftswap.ChainedShiftSwapRequestRepository
import com.reguerta.user.data.shiftswap.FirestoreShiftSwapRequestRepository
import com.reguerta.user.data.shiftswap.InMemoryShiftSwapRequestRepository
import com.reguerta.user.domain.access.ResolveAuthorizedSessionUseCase
import com.reguerta.user.domain.access.UpsertMemberByAdminUseCase
import com.reguerta.user.domain.freshness.ResolveCriticalDataFreshnessUseCase

@Composable
fun rememberSessionViewModel(): SessionViewModel {
    val context = LocalContext.current
    DevelopmentTimeMachine.initialize(context.applicationContext)
    val firestore = remember { FirebaseFirestore.getInstance() }
    val repository = remember {
        val fallback = InMemoryMemberRepository()
        val primary = FirestoreMemberRepository(firestore = firestore)
        ChainedMemberRepository(primary = primary, fallback = fallback)
    }
    val newsRepository = remember {
        val fallback = InMemoryNewsRepository()
        val primary = FirestoreNewsRepository(firestore = firestore)
        ChainedNewsRepository(primary = primary, fallback = fallback)
    }
    val notificationRepository = remember {
        val fallback = InMemoryNotificationRepository()
        val primary = FirestoreNotificationRepository(firestore = firestore)
        ChainedNotificationRepository(primary = primary, fallback = fallback)
    }
    val sharedProfileRepository = remember {
        val fallback = InMemorySharedProfileRepository()
        val primary = FirestoreSharedProfileRepository(firestore = firestore)
        ChainedSharedProfileRepository(primary = primary, fallback = fallback)
    }
    val productRepository = remember {
        val fallback = InMemoryProductRepository()
        val primary = FirestoreProductRepository(firestore = firestore)
        ChainedProductRepository(primary = primary, fallback = fallback)
    }
    val seasonalCommitmentRepository = remember {
        val fallback = InMemorySeasonalCommitmentRepository()
        val primary = FirestoreSeasonalCommitmentRepository(firestore = firestore)
        ChainedSeasonalCommitmentRepository(primary = primary, fallback = fallback)
    }
    val shiftRepository = remember {
        val fallback = InMemoryShiftRepository()
        val primary = FirestoreShiftRepository(firestore = firestore)
        ChainedShiftRepository(primary = primary, fallback = fallback)
    }
    val deliveryCalendarRepository = remember {
        val fallback = InMemoryDeliveryCalendarRepository()
        val primary = FirestoreDeliveryCalendarRepository(firestore = firestore)
        ChainedDeliveryCalendarRepository(primary = primary, fallback = fallback)
    }
    val shiftPlanningRequestRepository = remember {
        val fallback = InMemoryShiftPlanningRequestRepository()
        val primary = FirestoreShiftPlanningRequestRepository(firestore = firestore)
        ChainedShiftPlanningRequestRepository(primary = primary, fallback = fallback)
    }
    val shiftSwapRequestRepository = remember {
        val fallback = InMemoryShiftSwapRequestRepository()
        val primary = FirestoreShiftSwapRequestRepository(firestore = firestore)
        ChainedShiftSwapRequestRepository(primary = primary, fallback = fallback)
    }
    val freshnessLocalRepository = remember(context) {
        DataStoreCriticalDataFreshnessLocalRepository(context.applicationContext)
    }
    val deviceRegistrationRepository = remember {
        FirestoreDeviceRegistrationRepository(firestore = firestore)
    }
    val authorizedDeviceRegistrar = remember(context.applicationContext) {
        FirebaseAuthorizedDeviceRegistrar(
            context = context.applicationContext,
            repository = deviceRegistrationRepository,
        )
    }
    val reviewerEnvironmentRouter = remember(firestore) {
        FirestoreReviewerEnvironmentRouter(firestore = firestore)
    }
    val imagePipelineManager = remember(context.applicationContext) {
        FirebaseImagePipelineManager(
            context = context.applicationContext,
            storage = FirebaseStorage.getInstance(),
        )
    }
    return remember {
        SessionViewModel(
            repository = repository,
            newsRepository = newsRepository,
            notificationRepository = notificationRepository,
            productRepository = productRepository,
            seasonalCommitmentRepository = seasonalCommitmentRepository,
            imagePipelineManager = imagePipelineManager,
            sharedProfileRepository = sharedProfileRepository,
            shiftRepository = shiftRepository,
            deliveryCalendarRepository = deliveryCalendarRepository,
            shiftPlanningRequestRepository = shiftPlanningRequestRepository,
            shiftSwapRequestRepository = shiftSwapRequestRepository,
            authSessionProvider = FirebaseAuthSessionProvider(auth = FirebaseAuth.getInstance()),
            resolveAuthorizedSession = ResolveAuthorizedSessionUseCase(memberRepository = repository),
            upsertMemberByAdmin = UpsertMemberByAdminUseCase(memberRepository = repository),
            authorizedDeviceRegistrar = authorizedDeviceRegistrar,
            resolveCriticalDataFreshness = ResolveCriticalDataFreshnessUseCase(
                remoteRepository = FirestoreCriticalDataFreshnessRemoteRepository(
                    firestore = firestore,
                ),
                localRepository = freshnessLocalRepository,
            ),
            criticalDataFreshnessLocalRepository = freshnessLocalRepository,
            reviewerEnvironmentRouter = reviewerEnvironmentRouter,
            nowMillisProvider = DevelopmentTimeMachine::nowMillis,
            developImpersonationEnabled = BuildConfig.DEBUG,
            initialNowOverrideMillis = DevelopmentTimeMachine.overrideNowMillis(),
        )
    }
}
