package com.reguerta.user.presentation.root

import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext
import com.google.firebase.FirebaseApp
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.storage.FirebaseStorage
import com.reguerta.user.data.access.AuthenticatedFirebaseFunctionsClient
import com.reguerta.user.data.access.FirebaseAuthorizedMemberResolver
import com.reguerta.user.data.access.FirebaseAuthSessionProvider
import com.reguerta.user.data.access.FirebaseMemberAdministrationRepository
import com.reguerta.user.data.access.FirestoreMemberRepository
import com.reguerta.user.data.bylaws.AssetBylawsKnowledgeSource
import com.reguerta.user.data.bylaws.createPlatformBylawsOnDeviceAssistant
import com.reguerta.user.data.calendar.FirestoreDeliveryCalendarRepository
import com.reguerta.user.data.commitments.FirestoreSeasonalCommitmentRepository
import com.reguerta.user.data.devices.FirebaseAuthorizedDeviceRegistrar
import com.reguerta.user.data.devices.FirestoreDeviceRegistrationRepository
import com.reguerta.user.data.freshness.DataStoreCriticalDataFreshnessLocalRepository
import com.reguerta.user.data.freshness.FirestoreCriticalDataFreshnessRemoteRepository
import com.reguerta.user.data.firestore.ReguertaRuntimeEnvironment
import com.reguerta.user.data.firestore.RuntimeSessionEnvironmentRouter
import com.reguerta.user.data.media.FirebaseImagePipelineManager
import com.reguerta.user.data.news.FirestoreNewsRepository
import com.reguerta.user.data.notifications.AndroidPushNotificationPermissionProvider
import com.reguerta.user.data.notifications.FirestoreNotificationRepository
import com.reguerta.user.data.profiles.FirestoreSharedProfileRepository
import com.reguerta.user.data.products.FirestoreProductRepository
import com.reguerta.user.data.shiftplanning.FirestoreShiftPlanningRequestRepository
import com.reguerta.user.data.shifts.FirestoreShiftRepository
import com.reguerta.user.data.shiftswap.FirebaseShiftSwapTransitionClient
import com.reguerta.user.data.shiftswap.FirestoreShiftSwapRequestRepository
import com.reguerta.user.domain.access.ResolveAuthorizedSessionUseCase
import com.reguerta.user.domain.access.UpsertMemberByAdminUseCase
import com.reguerta.user.domain.bylaws.BylawsEvidenceRetriever
import com.reguerta.user.domain.freshness.ResolveCriticalDataFreshnessUseCase

@Composable
fun rememberSessionViewModel(): SessionViewModel {
    val context = LocalContext.current
    DevelopmentTimeMachine.initialize(context.applicationContext)
    val firestore = remember { FirebaseFirestore.getInstance() }
    val auth = remember { FirebaseAuth.getInstance() }
    val firebaseApp = remember { FirebaseApp.getInstance() }
    val repository = remember {
        FirestoreMemberRepository(firestore = firestore)
    }
    val newsRepository = remember {
        FirestoreNewsRepository(firestore = firestore)
    }
    val notificationRepository = remember {
        FirestoreNotificationRepository(firestore = firestore)
    }
    val sharedProfileRepository = remember {
        FirestoreSharedProfileRepository(firestore = firestore)
    }
    val productRepository = remember {
        FirestoreProductRepository(firestore = firestore)
    }
    val seasonalCommitmentRepository = remember {
        FirestoreSeasonalCommitmentRepository(firestore = firestore)
    }
    val shiftRepository = remember {
        FirestoreShiftRepository(firestore = firestore)
    }
    val deliveryCalendarRepository = remember {
        FirestoreDeliveryCalendarRepository(firestore = firestore)
    }
    val shiftPlanningRequestRepository = remember {
        FirestoreShiftPlanningRequestRepository(firestore = firestore)
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
    val pushNotificationPermissionProvider = remember(context.applicationContext) {
        AndroidPushNotificationPermissionProvider(context = context.applicationContext)
    }
    val sessionEnvironmentRouter = remember {
        RuntimeSessionEnvironmentRouter()
    }
    val authenticatedFunctionsClient = remember(auth, firebaseApp) {
        AuthenticatedFirebaseFunctionsClient.create(auth = auth, firebaseApp = firebaseApp)
    }
    val shiftSwapTransitionClient = remember(authenticatedFunctionsClient) {
        FirebaseShiftSwapTransitionClient(
            functionCaller = authenticatedFunctionsClient,
            requestedEnvironment = {
                ReguertaRuntimeEnvironment.currentFirestoreEnvironment().wireValue
            },
        )
    }
    val shiftSwapRequestRepository = remember(firestore, shiftSwapTransitionClient) {
        FirestoreShiftSwapRequestRepository(
            firestore = firestore,
            transitionClient = shiftSwapTransitionClient,
        )
    }
    val authorizedMemberResolver = remember(authenticatedFunctionsClient, sessionEnvironmentRouter) {
        FirebaseAuthorizedMemberResolver(
            functionCaller = authenticatedFunctionsClient,
            requestedEnvironment = {
                ReguertaRuntimeEnvironment.currentFirestoreEnvironment().wireValue
            },
            environmentRouter = sessionEnvironmentRouter,
        )
    }
    val memberAdministrationRepository = remember(authenticatedFunctionsClient) {
        FirebaseMemberAdministrationRepository(
            functionCaller = authenticatedFunctionsClient,
            requestedEnvironment = {
                ReguertaRuntimeEnvironment.currentFirestoreEnvironment().wireValue
            },
        )
    }
    val bylawsKnowledgeSource = remember(context.applicationContext) {
        AssetBylawsKnowledgeSource(appContext = context.applicationContext)
    }
    val bylawsEvidenceRetriever = remember { BylawsEvidenceRetriever() }
    val bylawsOnDeviceAssistant = remember {
        createPlatformBylawsOnDeviceAssistant()
    }
    DisposableEffect(bylawsOnDeviceAssistant) {
        onDispose { bylawsOnDeviceAssistant.close() }
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
            authSessionProvider = FirebaseAuthSessionProvider(auth = auth),
            resolveAuthorizedSession = ResolveAuthorizedSessionUseCase(
                memberRepository = repository,
                authorizedMemberResolver = authorizedMemberResolver,
            ),
            upsertMemberByAdmin = UpsertMemberByAdminUseCase(
                administrationRepository = memberAdministrationRepository,
            ),
            authorizedDeviceRegistrar = authorizedDeviceRegistrar,
            pushNotificationPermissionProvider = pushNotificationPermissionProvider,
            resolveCriticalDataFreshness = ResolveCriticalDataFreshnessUseCase(
                remoteRepository = FirestoreCriticalDataFreshnessRemoteRepository(
                    firestore = firestore,
                ),
                localRepository = freshnessLocalRepository,
            ),
            criticalDataFreshnessLocalRepository = freshnessLocalRepository,
            sessionEnvironmentRouter = sessionEnvironmentRouter,
            bylawsKnowledgeSource = bylawsKnowledgeSource,
            bylawsEvidenceRetriever = bylawsEvidenceRetriever,
            bylawsOnDeviceAssistant = bylawsOnDeviceAssistant,
            nowMillisProvider = DevelopmentTimeMachine::nowMillis,
            developImpersonationEnabled = false,
            initialNowOverrideMillis = DevelopmentTimeMachine.overrideNowMillis(),
        )
    }
}
