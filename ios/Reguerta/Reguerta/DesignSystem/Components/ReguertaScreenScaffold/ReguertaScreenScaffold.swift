import SwiftUI

enum ReguertaScreenScaffoldLayout {
    static func maximumContentWidth(requestedWidth: CGFloat, readableMaximumWidth: CGFloat) -> CGFloat {
        min(requestedWidth, readableMaximumWidth)
    }
}

struct ReguertaScreenScaffold<Content: View, BottomContent: View>: View {
    @Environment(\.reguertaTokens) private var tokens

    let contentWidth: CGFloat
    let headerConfiguration: ReguertaScreenHeaderConfiguration
    let headerHorizontalPadding: CGFloat
    let headerContentSpacing: CGFloat
    let showsBottomInset: Bool
    private let content: Content
    private let bottomContent: BottomContent

    private var maximumContentWidth: CGFloat {
        ReguertaScreenScaffoldLayout.maximumContentWidth(
            requestedWidth: contentWidth,
            readableMaximumWidth: tokens.layout.readableContentMaximumWidth
        )
    }

    @ViewBuilder
    var body: some View {
        if showsBottomInset {
            scaffoldContent
                .safeAreaInset(edge: .bottom, spacing: 0) {
                    bottomInsetContent
                }
        } else {
            scaffoldContent
        }
    }

    private var scaffoldContent: some View {
        content
            .frame(maxWidth: maximumContentWidth, alignment: .topLeading)
            .padding(.horizontal, tokens.layout.compactHorizontalPadding)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
            .background(tokens.colors.surfacePrimary.ignoresSafeArea())
            .safeAreaInset(edge: .top, spacing: headerContentSpacing) {
                ReguertaScreenHeaderView(configuration: headerConfiguration)
                    .padding(.horizontal, headerHorizontalPadding)
                    .frame(maxWidth: maximumContentWidth)
                    .padding(.horizontal, tokens.layout.compactHorizontalPadding)
                    .frame(maxWidth: .infinity)
                    .background(tokens.colors.surfacePrimary)
            }
    }

    private var bottomInsetContent: some View {
        bottomContent
            .frame(maxWidth: maximumContentWidth)
            .padding(.horizontal, tokens.layout.compactHorizontalPadding)
            .frame(maxWidth: .infinity)
            .background(tokens.colors.surfacePrimary)
    }
}

extension ReguertaScreenScaffold {
    init(
        contentWidth: CGFloat,
        headerConfiguration: ReguertaScreenHeaderConfiguration,
        headerHorizontalPadding: CGFloat = 0,
        headerContentSpacing: CGFloat,
        showsBottomInset: Bool = true,
        @ViewBuilder content: () -> Content,
        @ViewBuilder bottomContent: () -> BottomContent
    ) {
        self.contentWidth = contentWidth
        self.headerConfiguration = headerConfiguration
        self.headerHorizontalPadding = headerHorizontalPadding
        self.headerContentSpacing = headerContentSpacing
        self.showsBottomInset = showsBottomInset
        self.content = content()
        self.bottomContent = bottomContent()
    }
}

extension ReguertaScreenScaffold where BottomContent == EmptyView {
    init(
        contentWidth: CGFloat,
        headerConfiguration: ReguertaScreenHeaderConfiguration,
        headerHorizontalPadding: CGFloat = 0,
        headerContentSpacing: CGFloat,
        @ViewBuilder content: () -> Content
    ) {
        self.init(
            contentWidth: contentWidth,
            headerConfiguration: headerConfiguration,
            headerHorizontalPadding: headerHorizontalPadding,
            headerContentSpacing: headerContentSpacing,
            showsBottomInset: false,
            content: content,
            bottomContent: { EmptyView() }
        )
    }
}

#Preview(
    "Compact scaffold",
    traits: .modifier(ReguertaDesignSystemPreviewModifier(fixture: .scaffoldCompact)),
    .fixedLayout(width: 320, height: 640)
) {
    ReguertaScreenScaffold(
        contentWidth: 720,
        headerConfiguration: ReguertaScreenHeaderConfiguration(
            title: .verbatim("Long localized route title that can wrap"),
            leadingAction: ReguertaHeaderAction(
                systemImageName: "chevron.left",
                accessibilityLabel: .localized(AccessL10nKey.commonBack),
                action: {}
            )
        ),
        headerHorizontalPadding: 16,
        headerContentSpacing: 12
    ) {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text(verbatim: "Container-aware content")
                    .font(.headline)
                Text(
                    verbatim: "The scaffold contracts with compact windows and caps readable width on regular windows."
                )
                    .font(.body)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(16)
        }
    } bottomContent: {
        reguertaButton("common.action.accept", accessibilityIdentifier: "preview.scaffold.accept") {}
            .padding(16)
    }
}

#Preview(
    "Scaffold XXX",
    traits: .modifier(ReguertaDesignSystemPreviewModifier(fixture: .scaffoldXXX)),
    .fixedLayout(width: 600, height: 820)
) {
    ReguertaScreenScaffold(
        contentWidth: 600,
        headerConfiguration: ReguertaScreenHeaderConfiguration(
            title: .verbatim("Community delivery calendar"),
            leadingAction: ReguertaHeaderAction(
                systemImageName: "chevron.left",
                accessibilityLabel: .localized(AccessL10nKey.commonBack),
                action: {}
            )
        ),
        headerHorizontalPadding: 24,
        headerContentSpacing: 16
    ) {
        Text(verbatim: "Split-window content")
            .font(.body)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .padding(24)
    } bottomContent: {
        reguertaButton("common.action.accept") {}
            .padding(24)
    }
}

#Preview(
    "Scaffold AX5 · external Increased Contrast override",
    traits: .modifier(ReguertaDesignSystemPreviewModifier(fixture: .scaffoldAccessibility)),
    .fixedLayout(width: 320, height: 720)
) {
    ReguertaScreenScaffold(
        contentWidth: 320,
        headerConfiguration: ReguertaScreenHeaderConfiguration(
            title: .verbatim("Long localized route title for an accessibility content size"),
            leadingAction: ReguertaHeaderAction(
                systemImageName: "chevron.left",
                accessibilityLabel: .localized(AccessL10nKey.commonBack),
                action: {}
            )
        ),
        headerHorizontalPadding: 16,
        headerContentSpacing: 12
    ) {
        ScrollView {
            Text(verbatim: "Content remains scrollable without a manually reserved bottom region.")
                .font(.body)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(16)
        }
    }
}

#Preview(
    "Readable width",
    traits: .modifier(ReguertaDesignSystemPreviewModifier(fixture: .scaffoldReadableWidth)),
    .fixedLayout(width: 1_024, height: 768)
) {
    ReguertaScreenScaffold(
        contentWidth: 1_024,
        headerConfiguration: ReguertaScreenHeaderConfiguration(
            title: .verbatim("Readable content width"),
            leadingAction: ReguertaHeaderAction(
                systemImageName: "chevron.left",
                accessibilityLabel: .localized(AccessL10nKey.commonBack),
                action: {}
            )
        ),
        headerHorizontalPadding: 24,
        headerContentSpacing: 16
    ) {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text(verbatim: "Regular-window fixture")
                    .font(.headline)
                Text(verbatim: "The content remains centered and capped at the readable maximum width.")
                    .font(.body)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(24)
        }
    }
}
