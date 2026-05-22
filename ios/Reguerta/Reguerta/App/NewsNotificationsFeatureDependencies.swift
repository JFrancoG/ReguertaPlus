import FirebaseFirestore
import Foundation

struct NewsNotificationsFeatureDependencies {
    let newsRepository: any NewsRepository
    let notificationRepository: any NotificationRepository
    let pushNotificationPermissionProvider: any PushNotificationPermissionProvider
    let imagePipelineManager: any ImagePipelineManager
    let nowMillisProvider: @MainActor () -> Int64

    static func live(
        db: Firestore,
        imagePipelineManager: any ImagePipelineManager,
        notificationRepository: (any NotificationRepository)? = nil,
        pushNotificationPermissionProvider: (any PushNotificationPermissionProvider)? = nil,
        nowMillisProvider: @escaping @MainActor () -> Int64
    ) -> NewsNotificationsFeatureDependencies {
        NewsNotificationsFeatureDependencies(
            newsRepository: ChainedNewsRepository(
                primary: FirestoreNewsRepository(db: db),
                fallback: InMemoryNewsRepository()
            ),
            notificationRepository: notificationRepository ?? ChainedNotificationRepository(
                primary: FirestoreNotificationRepository(db: db),
                fallback: InMemoryNotificationRepository()
            ),
            pushNotificationPermissionProvider: pushNotificationPermissionProvider ?? IOSPushNotificationPermissionProvider(),
            imagePipelineManager: imagePipelineManager,
            nowMillisProvider: nowMillisProvider
        )
    }

    static func preview(
        newsRepository: InMemoryNewsRepository = InMemoryNewsRepository(),
        notificationRepository: InMemoryNotificationRepository = InMemoryNotificationRepository(),
        pushNotificationPermissionProvider: any PushNotificationPermissionProvider = FixedPushNotificationPermissionProvider(isActive: true),
        imagePipelineManager: any ImagePipelineManager = NoOpImagePipelineManager(),
        nowMillisProvider: @escaping @MainActor () -> Int64 = { 0 }
    ) -> NewsNotificationsFeatureDependencies {
        NewsNotificationsFeatureDependencies(
            newsRepository: newsRepository,
            notificationRepository: notificationRepository,
            pushNotificationPermissionProvider: pushNotificationPermissionProvider,
            imagePipelineManager: imagePipelineManager,
            nowMillisProvider: nowMillisProvider
        )
    }
}
