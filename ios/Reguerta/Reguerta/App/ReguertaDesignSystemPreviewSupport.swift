import SwiftData
import SwiftUI

struct ReguertaDesignSystemPreviewContext {
    let modelContainer: ModelContainer
}

struct ReguertaDesignSystemPreviewModifier: PreviewModifier {
    static func makeSharedContext() async throws -> ReguertaDesignSystemPreviewContext {
        let configuration = ModelConfiguration(isStoredInMemoryOnly: true)
        let container = try ModelContainer(
            for: ReguertaDesignSystemPreviewSeed.self,
            configurations: configuration
        )
        let context = container.mainContext
        if try context.fetchCount(FetchDescriptor<ReguertaDesignSystemPreviewSeed>()) == 0 {
            context.insert(ReguertaDesignSystemPreviewSeed(id: "semantic-color-contract"))
            try context.save()
        }
        return ReguertaDesignSystemPreviewContext(modelContainer: container)
    }

    func body(content: Content, context: ReguertaDesignSystemPreviewContext) -> some View {
        ReguertaTheme {
            content.modelContainer(context.modelContainer)
        }
    }
}

@Model
private final class ReguertaDesignSystemPreviewSeed {
    @Attribute(.unique) var id: String

    init(id: String) {
        self.id = id
    }
}
