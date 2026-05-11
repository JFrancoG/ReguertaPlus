import FirebaseFirestore
import Foundation

struct ProductsFeatureDependencies {
    let productRepository: any ProductRepository
    let memberRepository: any MemberRepository
    let seasonalCommitmentRepository: any SeasonalCommitmentRepository
    let imagePipelineManager: any ImagePipelineManager
    let nowMillisProvider: @MainActor () -> Int64

    static func live(
        db: Firestore,
        imagePipelineManager: any ImagePipelineManager,
        nowMillisProvider: @escaping @MainActor () -> Int64
    ) -> ProductsFeatureDependencies {
        ProductsFeatureDependencies(
            productRepository: ChainedProductRepository(
                primary: FirestoreProductRepository(db: db),
                fallback: InMemoryProductRepository()
            ),
            memberRepository: ChainedMemberRepository(
                primary: FirestoreMemberRepository(db: db),
                fallback: InMemoryMemberRepository()
            ),
            seasonalCommitmentRepository: ChainedSeasonalCommitmentRepository(
                primary: FirestoreSeasonalCommitmentRepository(db: db),
                fallback: InMemorySeasonalCommitmentRepository()
            ),
            imagePipelineManager: imagePipelineManager,
            nowMillisProvider: nowMillisProvider
        )
    }

    static func preview(
        productRepository: InMemoryProductRepository = InMemoryProductRepository(),
        memberRepository: InMemoryMemberRepository = InMemoryMemberRepository(),
        seasonalCommitmentRepository: InMemorySeasonalCommitmentRepository = InMemorySeasonalCommitmentRepository(),
        imagePipelineManager: any ImagePipelineManager = NoOpImagePipelineManager(),
        nowMillisProvider: @escaping @MainActor () -> Int64 = { 0 }
    ) -> ProductsFeatureDependencies {
        ProductsFeatureDependencies(
            productRepository: productRepository,
            memberRepository: memberRepository,
            seasonalCommitmentRepository: seasonalCommitmentRepository,
            imagePipelineManager: imagePipelineManager,
            nowMillisProvider: nowMillisProvider
        )
    }
}
