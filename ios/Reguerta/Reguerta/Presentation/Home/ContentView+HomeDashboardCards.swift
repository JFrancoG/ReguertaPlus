import SwiftUI
import UIKit

struct NextShiftsCardView: View {
    let tokens: ReguertaDesignTokens
    let isLoading: Bool
    let nextDeliverySummary: String
    let nextMarketSummary: String
    let onViewAll: () -> Void

    private func localizedKey(_ key: String) -> LocalizedStringKey {
        LocalizedStringKey(key)
    }

    var body: some View {
        reguertaCard {
            VStack(alignment: .leading, spacing: tokens.spacing.sm) {
                Text(localizedKey(AccessL10nKey.shiftsNextTitle))
                    .font(tokens.typography.titleCard)
                Text(localizedKey(AccessL10nKey.shiftsNextSubtitle))
                    .font(tokens.typography.bodySecondary)
                    .foregroundStyle(tokens.colors.textSecondary)
                if isLoading {
                    Text(localizedKey(AccessL10nKey.shiftsLoading))
                        .font(tokens.typography.bodySecondary)
                } else {
                    summaryRow(titleKey: AccessL10nKey.shiftsNextDelivery, value: nextDeliverySummary)
                    summaryRow(titleKey: AccessL10nKey.shiftsNextMarket, value: nextMarketSummary)
                }
                reguertaButton(localizedKey(AccessL10nKey.shiftsViewAll), variant: .text, action: onViewAll)
            }
        }
    }

    private func summaryRow(titleKey: String, value: String) -> some View {
        HStack(alignment: .firstTextBaseline) {
            Text(localizedKey(titleKey))
                .font(tokens.typography.bodySecondary)
                .foregroundStyle(tokens.colors.textPrimary)
            Spacer(minLength: tokens.spacing.md)
            Text(value)
                .font(tokens.typography.label)
                .foregroundStyle(tokens.colors.textSecondary)
        }
    }
}

enum HomeLatestNewsImagePlacement: Equatable {
    case leading
    case trailing
}

struct HomeLatestNewsItemPresentation: Identifiable, Equatable {
    let id: String
    let title: String
    let body: String
    let metadataText: String?
    let statusText: String?
    let imageURL: URL?
    let imagePlacement: HomeLatestNewsImagePlacement?
    let bodyLineLimit: Int?
    let titleAccessibilityIdentifier: String
    let cardAccessibilityIdentifier: String

    init(
        id: String,
        title: String,
        body: String,
        metadataText: String? = nil,
        statusText: String? = nil,
        imageURL: URL?,
        imagePlacement: HomeLatestNewsImagePlacement?,
        bodyLineLimit: Int? = 3,
        titleAccessibilityIdentifier: String,
        cardAccessibilityIdentifier: String
    ) {
        self.id = id
        self.title = title
        self.body = body
        self.metadataText = metadataText
        self.statusText = statusText
        self.imageURL = imageURL
        self.imagePlacement = imagePlacement
        self.bodyLineLimit = bodyLineLimit
        self.titleAccessibilityIdentifier = titleAccessibilityIdentifier
        self.cardAccessibilityIdentifier = cardAccessibilityIdentifier
    }

    init(
        article: NewsArticle,
        index: Int,
        metadataText: String? = nil,
        statusText: String? = nil,
        bodyLineLimit: Int? = 3,
        titleAccessibilityIdentifierPrefix: String = "home.latestNews.article",
        cardAccessibilityIdentifierPrefix: String = "home.latestNews.articleCard"
    ) {
        let imageURL = article.homeLatestNewsImageURL
        self.init(
            id: article.id,
            title: article.title,
            body: article.body,
            metadataText: metadataText,
            statusText: statusText,
            imageURL: imageURL,
            imagePlacement: imageURL.map { _ in index.isMultiple(of: 2) ? .trailing : .leading },
            bodyLineLimit: bodyLineLimit,
            titleAccessibilityIdentifier: "\(titleAccessibilityIdentifierPrefix).\(article.id).title",
            cardAccessibilityIdentifier: "\(cardAccessibilityIdentifierPrefix).\(article.id)"
        )
    }
}

extension NewsNotificationsFeatureViewModel {
    var homeLatestNewsItems: [HomeLatestNewsItemPresentation] {
        latestNews.enumerated().map { index, article in
            HomeLatestNewsItemPresentation(article: article, index: index)
        }
    }
}

private extension NewsArticle {
    var homeLatestNewsImageURL: URL? {
        guard
            let urlImage,
            urlImage.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false
        else {
            return nil
        }
        return URL(string: urlImage.trimmingCharacters(in: .whitespacesAndNewlines))
    }
}

struct LatestNewsCardView: View {
    let tokens: ReguertaDesignTokens
    let latestNews: [HomeLatestNewsItemPresentation]

    private func localizedKey(_ key: String) -> LocalizedStringKey {
        LocalizedStringKey(key)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: tokens.spacing.sm) {
            Text(localizedKey(AccessL10nKey.homeShellNewsTitle))
                .font(tokens.typography.titleSection)
                .frame(maxWidth: .infinity, alignment: .center)
            if latestNews.isEmpty {
                Text(localizedKey(AccessL10nKey.newsEmptyState))
                    .font(tokens.typography.bodySecondary)
                    .foregroundStyle(tokens.colors.textSecondary)
            } else {
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: tokens.spacing.sm) {
                        ForEach(latestNews) { item in
                            reguertaListItemCard {
                                HomeLatestNewsRowView(tokens: tokens, item: item)
                                    .padding(tokens.spacing.lg)
                            }
                            .accessibilityElement(children: .contain)
                            .accessibilityIdentifier(item.cardAccessibilityIdentifier)
                        }

                        Color.clear
                            .frame(height: tokens.spacing.xxl)
                            .accessibilityHidden(true)
                    }
                }
                .ignoresSafeArea(.container, edges: .bottom)
                .accessibilityIdentifier("home.latestNews.scroll")
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}

struct HomeLatestNewsRowView: View {
    let tokens: ReguertaDesignTokens
    let item: HomeLatestNewsItemPresentation

    var body: some View {
        Group {
            switch item.imagePlacement {
            case .leading:
                HStack(alignment: .top, spacing: tokens.spacing.md) {
                    if let imageURL = item.imageURL {
                        HomeLatestNewsImageView(tokens: tokens, imageURL: imageURL)
                    }
                    HomeLatestNewsTextView(tokens: tokens, item: item)
                }
            case .trailing:
                HStack(alignment: .top, spacing: tokens.spacing.md) {
                    HomeLatestNewsTextView(tokens: tokens, item: item)
                    if let imageURL = item.imageURL {
                        HomeLatestNewsImageView(tokens: tokens, imageURL: imageURL)
                    }
                }
            case nil:
                HomeLatestNewsTextView(tokens: tokens, item: item)
            }
        }
        .frame(maxWidth: .infinity, alignment: .topLeading)
    }
}

private struct HomeLatestNewsTextView: View {
    let tokens: ReguertaDesignTokens
    let item: HomeLatestNewsItemPresentation

    var body: some View {
        VStack(alignment: .leading, spacing: tokens.spacing.xs) {
            Text(item.title)
                .font(tokens.typography.titleCard)
                .foregroundStyle(tokens.colors.textPrimary)
                .accessibilityIdentifier(item.titleAccessibilityIdentifier)
            if let metadataText = item.metadataText {
                Text(metadataText)
                    .font(tokens.typography.label)
                    .foregroundStyle(tokens.colors.textSecondary)
            }
            if let statusText = item.statusText {
                Text(statusText)
                    .font(tokens.typography.label)
                    .foregroundStyle(tokens.colors.actionPrimary)
            }
            Text(item.body)
                .font(tokens.typography.bodySecondary)
                .foregroundStyle(tokens.colors.textSecondary)
                .lineLimit(item.bodyLineLimit)
        }
        .frame(maxWidth: .infinity, alignment: .topLeading)
    }
}

private struct HomeLatestNewsImageView: View {
    let tokens: ReguertaDesignTokens
    let imageURL: URL
    @State private var loadedImage: Image?

    private let loader = NewsImageDataLoader()

    var body: some View {
        RoundedRectangle(cornerRadius: tokens.radius.sm)
            .fill(tokens.colors.surfaceSecondary)
            .overlay {
                if let loadedImage {
                    loadedImage
                        .resizable()
                        .scaledToFill()
                } else {
                    Image(systemName: "photo")
                        .font(.system(size: 24.resize))
                        .foregroundStyle(tokens.colors.textSecondary)
                }
            }
            .frame(width: 144.resize, height: 144.resize)
            .compositingGroup()
            .clipShape(RoundedRectangle(cornerRadius: tokens.radius.sm))
            .accessibilityHidden(true)
            .task(id: imageURL) {
                loadedImage = nil
                guard
                    let data = try? await loader.load(from: imageURL),
                    !Task.isCancelled,
                    let image = UIImage(data: data)
                else {
                    return
                }
                loadedImage = Image(uiImage: image)
            }
    }
}

struct OperationalModulesCardView: View {
    let tokens: ReguertaDesignTokens
    let modulesEnabled: Bool
    let canOpenProducts: Bool
    let myOrderFreshnessState: MyOrderFreshnessState
    let disabledMessageKey: String?
    let onOpenMyOrder: () -> Void
    let onOpenProducts: () -> Void
    let onOpenShifts: () -> Void
    let onOpenBylaws: () -> Void
    let onRetryFreshness: () -> Void

    private func localizedKey(_ key: String) -> LocalizedStringKey {
        LocalizedStringKey(key)
    }

    var body: some View {
        reguertaCard {
            VStack(alignment: .leading, spacing: tokens.spacing.sm) {
                Text(localizedKey(AccessL10nKey.operationalModulesTitle))
                    .font(tokens.typography.titleCard)
                Button(action: onOpenMyOrder) {
                    Text(localizedKey(AccessL10nKey.myOrder))
                }
                .accessibilityIdentifier("home.module.myOrder")
                .disabled(!modulesEnabled || myOrderFreshnessState != .ready)
                Button(action: onOpenProducts) {
                    Text(localizedKey(AccessL10nKey.catalog))
                }
                .accessibilityIdentifier("home.module.catalog")
                .disabled(!modulesEnabled || !canOpenProducts)
                Button(action: onOpenShifts) {
                    Text(localizedKey(AccessL10nKey.shifts))
                }
                .accessibilityIdentifier("home.module.shifts")
                .disabled(!modulesEnabled)
                Button(action: onOpenBylaws) {
                    Text(localizedKey(AccessL10nKey.homeShellActionBylaws))
                }
                .accessibilityIdentifier("home.module.bylaws")
                .disabled(!modulesEnabled)

                if !modulesEnabled, let disabledMessageKey {
                    Text(localizedKey(disabledMessageKey))
                        .font(tokens.typography.label)
                        .foregroundStyle(tokens.colors.textSecondary)
                }

                switch myOrderFreshnessState {
                case .checking:
                    Text(localizedKey(AccessL10nKey.myOrderFreshnessChecking))
                        .font(tokens.typography.label)
                        .foregroundStyle(tokens.colors.textSecondary)
                case .timedOut, .unavailable:
                    Text(localizedKey(AccessL10nKey.myOrderFreshnessErrorTitle))
                        .font(tokens.typography.bodySecondary.weight(.semibold))
                    Text(localizedKey(AccessL10nKey.myOrderFreshnessErrorMessage))
                        .font(tokens.typography.label)
                        .foregroundStyle(tokens.colors.textSecondary)
                    Button(action: onRetryFreshness) {
                        Text(localizedKey(AccessL10nKey.myOrderFreshnessRetry))
                    }
                case .idle, .ready:
                    EmptyView()
                }
            }
        }
    }
}
