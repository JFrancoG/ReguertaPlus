package com.reguerta.user.presentation.root

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
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
import com.reguerta.user.data.calendar.FirebaseDeliveryCalendarMutationClient
import com.reguerta.user.data.commitments.FirestoreSeasonalCommitmentRepository
import com.reguerta.user.data.devices.FirebaseAuthorizedDeviceRegistrar
import com.reguerta.user.data.devices.FirestoreDeviceRegistrationRepository
import com.reguerta.user.data.freshness.DataStoreCriticalDataFreshnessLocalRepository
import com.reguerta.user.data.freshness.FirestoreCriticalDataRefresher
import com.reguerta.user.data.freshness.FirestoreCriticalDataFreshnessRemoteRepository
import com.reguerta.user.data.firestore.ReguertaRuntimeEnvironment
import com.reguerta.user.data.firestore.RuntimeSessionEnvironmentRouter
import com.reguerta.user.data.media.FirebaseImagePipelineManager
import com.reguerta.user.data.news.FirestoreNewsRepository
import com.reguerta.user.data.notifications.AndroidPushNotificationPermissionProvider
import com.reguerta.user.data.notifications.FirestoreNotificationRepository
import com.reguerta.user.data.notifications.FirebaseShiftNotificationDetailRepository
import com.reguerta.user.data.profiles.FirestoreSharedProfileRepository
import com.reguerta.user.data.products.FirestoreProductRepository
import com.reguerta.user.data.shiftplanning.FirestoreShiftPlanningRequestRepository
import com.reguerta.user.data.shiftplanning.FirebaseShiftPlanningRequestContextClient
import com.reguerta.user.data.shifts.FirestoreShiftRepository
import com.reguerta.user.data.shiftswap.FirebaseShiftSwapTransitionClient
import com.reguerta.user.data.shiftswap.FirestoreShiftSwapRequestRepository
import com.reguerta.user.domain.access.ResolveAuthorizedSessionUseCase
import com.reguerta.user.domain.access.UpsertMemberByAdminUseCase
import com.reguerta.user.domain.bylaws.BylawsEvidenceRetriever
import com.reguerta.user.domain.freshness.ResolveCriticalDataFreshnessUseCase

class SessionViewModelFactory(
    context: Context,
) : ViewModelProvider.Factory {
    private val applicationContext = context.applicationContext

    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        if (!modelClass.isAssignableFrom(SessionViewModel::class.java)) {
            throw IllegalArgumentException("Unknown ViewModel class ${modelClass.name}")
        }

        DevelopmentTimeMachine.initialize(applicationContext)
        val firestore = FirebaseFirestore.getInstance()
        val auth = FirebaseAuth.getInstance()
        val firebaseApp = FirebaseApp.getInstance()
        val repository = FirestoreMemberRepository(firestore = firestore)
        val newsRepository = FirestoreNewsRepository(firestore = firestore)
        val notificationRepository = FirestoreNotificationRepository(firestore = firestore)
        val sharedProfileRepository = FirestoreSharedProfileRepository(firestore = firestore)
        val productRepository = FirestoreProductRepository(firestore = firestore)
        val seasonalCommitmentRepository = FirestoreSeasonalCommitmentRepository(firestore = firestore)
        val shiftRepository = FirestoreShiftRepository(firestore = firestore)
        val freshnessLocalRepository = DataStoreCriticalDataFreshnessLocalRepository(applicationContext)
        val deviceRegistrationRepository = FirestoreDeviceRegistrationRepository(firestore = firestore)
        val authorizedDeviceRegistrar = FirebaseAuthorizedDeviceRegistrar(
            context = applicationContext,
            repository = deviceRegistrationRepository,
        )
        val pushNotificationPermissionProvider = AndroidPushNotificationPermissionProvider(context = applicationContext)
        val sessionEnvironmentRouter = RuntimeSessionEnvironmentRouter()
        val authenticatedFunctionsClient = AuthenticatedFirebaseFunctionsClient.create(
            auth = auth,
            firebaseApp = firebaseApp,
        )
        val shiftPlanningRequestRepository = FirestoreShiftPlanningRequestRepository(
            firestore = firestore,
            contextClient = FirebaseShiftPlanningRequestContextClient(
                functionCaller = authenticatedFunctionsClient,
                requestedEnvironment = {
                    ReguertaRuntimeEnvironment.currentFirestoreEnvironment().wireValue
                },
            ),
        )
        val deliveryCalendarRepository = FirestoreDeliveryCalendarRepository(
            firestore = firestore,
            mutationClient = FirebaseDeliveryCalendarMutationClient(
                functionCaller = authenticatedFunctionsClient,
                requestedEnvironment = {
                    ReguertaRuntimeEnvironment.currentFirestoreEnvironment().wireValue
                },
            ),
        )
        val shiftNotificationDetailRepository = FirebaseShiftNotificationDetailRepository(
            functionCaller = authenticatedFunctionsClient,
            requestedEnvironment = {
                ReguertaRuntimeEnvironment.currentFirestoreEnvironment().wireValue
            },
        )
        val shiftSwapTransitionClient = FirebaseShiftSwapTransitionClient(
            functionCaller = authenticatedFunctionsClient,
            requestedEnvironment = {
                ReguertaRuntimeEnvironment.currentFirestoreEnvironment().wireValue
            },
        )
        val shiftSwapRequestRepository = FirestoreShiftSwapRequestRepository(
            firestore = firestore,
            transitionClient = shiftSwapTransitionClient,
        )
        val authorizedMemberResolver = FirebaseAuthorizedMemberResolver(
            functionCaller = authenticatedFunctionsClient,
            requestedEnvironment = {
                ReguertaRuntimeEnvironment.currentFirestoreEnvironment().wireValue
            },
        )
        val memberAdministrationRepository = FirebaseMemberAdministrationRepository(
            functionCaller = authenticatedFunctionsClient,
            requestedEnvironment = {
                ReguertaRuntimeEnvironment.currentFirestoreEnvironment().wireValue
            },
        )
        val bylawsKnowledgeSource = AssetBylawsKnowledgeSource(appContext = applicationContext)
        val bylawsEvidenceRetriever = BylawsEvidenceRetriever()
        val bylawsOnDeviceAssistant = createPlatformBylawsOnDeviceAssistant()
        val imagePipelineManager = FirebaseImagePipelineManager(
            context = applicationContext,
            storage = FirebaseStorage.getInstance(),
        )

        return SessionViewModel(
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
            shiftNotificationDetailRepository = shiftNotificationDetailRepository,
            resolveCriticalDataFreshness = ResolveCriticalDataFreshnessUseCase(
                remoteRepository = FirestoreCriticalDataFreshnessRemoteRepository(
                    firestore = firestore,
                ),
                localRepository = freshnessLocalRepository,
                refresher = FirestoreCriticalDataRefresher(firestore = firestore),
            ),
            criticalDataFreshnessLocalRepository = freshnessLocalRepository,
            sessionEnvironmentRouter = sessionEnvironmentRouter,
            bylawsKnowledgeSource = bylawsKnowledgeSource,
            bylawsEvidenceRetriever = bylawsEvidenceRetriever,
            bylawsOnDeviceAssistant = bylawsOnDeviceAssistant,
            nowMillisProvider = DevelopmentTimeMachine::nowMillis,
            runtimeEnvironmentProvider = {
                ReguertaRuntimeEnvironment.currentFirestoreEnvironment().wireValue
            },
            developImpersonationEnabled = false,
            initialNowOverrideMillis = DevelopmentTimeMachine.overrideNowMillis(),
        ) as T
    }
}
