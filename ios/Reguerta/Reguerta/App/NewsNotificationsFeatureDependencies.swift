import FirebaseFirestore
import Foundation

struct NewsNotificationsFeatureDependencies {
    let newsRepository: any NewsRepository
    let notificationRepository: any NotificationRepository
    let imagePipelineManager: any ImagePipelineManager
    let nowMillisProvider: @MainActor () -> Int64

    static func live(
        db: Firestore,
        imagePipelineManager: any ImagePipelineManager,
        notificationRepository: (any NotificationRepository)? = nil,
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
            imagePipelineManager: imagePipelineManager,
            nowMillisProvider: nowMillisProvider
        )
    }

    static func preview(
        newsRepository: InMemoryNewsRepository = InMemoryNewsRepository(),
        notificationRepository: InMemoryNotificationRepository = InMemoryNotificationRepository(),
        imagePipelineManager: any ImagePipelineManager = NoOpImagePipelineManager(),
        nowMillisProvider: @escaping @MainActor () -> Int64 = { 0 }
    ) -> NewsNotificationsFeatureDependencies {
        NewsNotificationsFeatureDependencies(
            newsRepository: newsRepository,
            notificationRepository: notificationRepository,
            imagePipelineManager: imagePipelineManager,
            nowMillisProvider: nowMillisProvider
        )
    }
}
