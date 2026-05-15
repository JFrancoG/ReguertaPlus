import SwiftUI

struct ReguertaScreenScaffold<Content: View, BottomContent: View>: View {
    @Environment(\.reguertaTokens) private var tokens

    let contentWidth: CGFloat
    let headerViewModel: ReguertaScreenHeaderViewModel
    let headerHorizontalPadding: CGFloat
    let headerContentSpacing: CGFloat
    let showsBottomInset: Bool
    private let content: Content
    private let bottomContent: BottomContent

    init(
        contentWidth: CGFloat,
        headerViewModel: ReguertaScreenHeaderViewModel,
        headerHorizontalPadding: CGFloat = 0,
        headerContentSpacing: CGFloat,
        showsBottomInset: Bool = true,
        @ViewBuilder content: () -> Content,
        @ViewBuilder bottomContent: () -> BottomContent
    ) {
        self.contentWidth = contentWidth
        self.headerViewModel = headerViewModel
        self.headerHorizontalPadding = headerHorizontalPadding
        self.headerContentSpacing = headerContentSpacing
        self.showsBottomInset = showsBottomInset
        self.content = content()
        self.bottomContent = bottomContent()
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
            .frame(width: contentWidth, alignment: .topLeading)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
            .ignoresSafeArea(.container, edges: .bottom)
            .background(tokens.colors.surfacePrimary.ignoresSafeArea())
            .safeAreaInset(edge: .top, spacing: headerContentSpacing) {
                ReguertaScreenHeaderView(viewModel: headerViewModel)
                    .padding(.horizontal, headerHorizontalPadding)
                    .frame(width: contentWidth)
                    .frame(maxWidth: .infinity)
                    .background(tokens.colors.surfacePrimary)
            }
    }

    private var bottomInsetContent: some View {
        bottomContent
            .frame(width: contentWidth)
            .frame(maxWidth: .infinity)
            .background(tokens.colors.surfacePrimary)
    }
}

extension ReguertaScreenScaffold where BottomContent == EmptyView {
    init(
        contentWidth: CGFloat,
        headerViewModel: ReguertaScreenHeaderViewModel,
        headerHorizontalPadding: CGFloat = 0,
        headerContentSpacing: CGFloat,
        @ViewBuilder content: () -> Content
    ) {
        self.init(
            contentWidth: contentWidth,
            headerViewModel: headerViewModel,
            headerHorizontalPadding: headerHorizontalPadding,
            headerContentSpacing: headerContentSpacing,
            showsBottomInset: false,
            content: content,
            bottomContent: { EmptyView() }
        )
    }
}
