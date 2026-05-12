import FirebaseFirestore
import Foundation

struct SharedProfileFeatureDependencies {
    let sharedProfileRepository: any SharedProfileRepository
    let imagePipelineManager: any ImagePipelineManager
    let nowMillisProvider: @MainActor @Sendable () -> Int64

    static func live(
        db: Firestore,
        imagePipelineManager: any ImagePipelineManager,
        nowMillisProvider: @escaping @MainActor @Sendable () -> Int64
    ) -> SharedProfileFeatureDependencies {
        SharedProfileFeatureDependencies(
            sharedProfileRepository: ChainedSharedProfileRepository(
                primary: FirestoreSharedProfileRepository(db: db),
                fallback: InMemorySharedProfileRepository()
            ),
            imagePipelineManager: imagePipelineManager,
            nowMillisProvider: nowMillisProvider
        )
    }

    static func preview(
        sharedProfileRepository: any SharedProfileRepository = InMemorySharedProfileRepository(),
        imagePipelineManager: any ImagePipelineManager = NoOpImagePipelineManager(),
        nowMillisProvider: @escaping @MainActor @Sendable () -> Int64 = {
            Int64(Date().timeIntervalSince1970 * 1_000)
        }
    ) -> SharedProfileFeatureDependencies {
        SharedProfileFeatureDependencies(
            sharedProfileRepository: sharedProfileRepository,
            imagePipelineManager: imagePipelineManager,
            nowMillisProvider: nowMillisProvider
        )
    }
}
