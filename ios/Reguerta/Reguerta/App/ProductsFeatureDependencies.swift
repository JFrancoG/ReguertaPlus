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
        if ProcessInfo.processInfo.arguments.contains("-useMockProductData") {
            return ProductsFeatureDependencies(
                productRepository: InMemoryProductRepository(items: mockProductData),
                memberRepository: InMemoryMemberRepository(),
                seasonalCommitmentRepository: InMemorySeasonalCommitmentRepository(),
                imagePipelineManager: imagePipelineManager,
                nowMillisProvider: nowMillisProvider
            )
        }

        return ProductsFeatureDependencies(
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

    private static let mockProductData: [Product] = [
        Product(
            id: "mock_tomatoes",
            vendorId: "member_producer_001",
            companyName: "Riscos Altos",
            name: "Tomatoes",
            description: "Mock ordering product for UI tests.",
            productImageUrl: nil,
            price: 2.50,
            pricingMode: .fixed,
            unitName: "unit",
            unitAbbreviation: "ud",
            unitPlural: "units",
            unitQty: 1,
            packContainerName: nil,
            packContainerAbbreviation: nil,
            packContainerPlural: nil,
            packContainerQty: nil,
            isAvailable: true,
            stockMode: .infinite,
            stockQty: nil,
            isEcoBasket: false,
            isCommonPurchase: false,
            commonPurchaseType: nil,
            archived: false,
            createdAtMillis: 1_000,
            updatedAtMillis: 1_000
        )
    ]
}
