import FirebaseFirestore
import Foundation

struct NewsNotificationsFeatureDependencies {
    let newsRepository: any NewsRepository
    let notificationRepository: any NotificationRepository
    let shiftNotificationDetailRepository: any ShiftNotificationDetailRepository
    let pushNotificationPermissionProvider: any PushNotificationPermissionProvider
    let imagePipelineManager: any ImagePipelineManager
    let nowMillisProvider: @MainActor () -> Int64
    let environmentProvider: @MainActor () -> SessionEnvironment

    @MainActor static func live(
        db: Firestore,
        environmentProvider: any SessionEnvironmentSnapshotProviding,
        functionsClient: AuthenticatedFirebaseFunctionsClient,
        imagePipelineManager: any ImagePipelineManager,
        notificationRepository: (any NotificationRepository)? = nil,
        pushNotificationPermissionProvider: (any PushNotificationPermissionProvider)? = nil,
        nowMillisProvider: @escaping @MainActor () -> Int64
    ) -> NewsNotificationsFeatureDependencies {
        NewsNotificationsFeatureDependencies(
            newsRepository: FirestoreNewsRepository(firebaseAppName: db.app.name),
            notificationRepository: notificationRepository ??
                FirestoreNotificationRepository(firebaseAppName: db.app.name),
            shiftNotificationDetailRepository: FirebaseShiftNotificationDetailRepository(
                functionsClient: functionsClient
            ),
            pushNotificationPermissionProvider: pushNotificationPermissionProvider ??
                IOSPushNotificationPermissionProvider(),
            imagePipelineManager: imagePipelineManager,
            nowMillisProvider: nowMillisProvider,
            environmentProvider: { environmentProvider.snapshot().environment }
        )
    }

    static func preview(
        newsRepository: InMemoryNewsRepository = InMemoryNewsRepository(),
        notificationRepository: InMemoryNotificationRepository = InMemoryNotificationRepository(),
        shiftNotificationDetailRepository: any ShiftNotificationDetailRepository =
            UnavailableShiftNotificationDetailRepository(),
        pushNotificationPermissionProvider: any PushNotificationPermissionProvider =
            FixedPushNotificationPermissionProvider(isActive: true),
        imagePipelineManager: any ImagePipelineManager = NoOpImagePipelineManager(),
        nowMillisProvider: @escaping @MainActor () -> Int64 = { 0 },
        environmentProvider: @escaping @MainActor () -> SessionEnvironment = { .develop }
    ) -> NewsNotificationsFeatureDependencies {
        NewsNotificationsFeatureDependencies(
            newsRepository: newsRepository,
            notificationRepository: notificationRepository,
            shiftNotificationDetailRepository: shiftNotificationDetailRepository,
            pushNotificationPermissionProvider: pushNotificationPermissionProvider,
            imagePipelineManager: imagePipelineManager,
            nowMillisProvider: nowMillisProvider,
            environmentProvider: environmentProvider
        )
    }
}
