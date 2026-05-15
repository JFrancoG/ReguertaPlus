import SwiftUI

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
    let imageURL: URL?
    let imagePlacement: HomeLatestNewsImagePlacement?
    let titleAccessibilityIdentifier: String
}

extension NewsNotificationsFeatureViewModel {
    var homeLatestNewsItems: [HomeLatestNewsItemPresentation] {
        latestNews.enumerated().map { index, article in
            HomeLatestNewsItemPresentation(
                id: article.id,
                title: article.title,
                body: article.body,
                imageURL: article.homeLatestNewsImageURL,
                imagePlacement: article.homeLatestNewsImageURL.map { _ in
                    index.isMultiple(of: 2) ? .trailing : .leading
                },
                titleAccessibilityIdentifier: "home.latestNews.article.\(article.id).title"
            )
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
                List(latestNews) { item in
                    HomeLatestNewsRowView(tokens: tokens, item: item)
                        .listRowSeparator(.hidden)
                        .listRowInsets(EdgeInsets())
                        .listRowBackground(Color.clear)
                        .padding(.bottom, tokens.spacing.sm)
                }
                .listStyle(.plain)
                .scrollContentBackground(.hidden)
                .contentMargins(.top, 0, for: .scrollContent)
                .contentMargins(.horizontal, 0, for: .scrollContent)
                .contentMargins(.bottom, 0, for: .scrollContent)
                .ignoresSafeArea(.container, edges: .bottom)
                .accessibilityIdentifier("home.latestNews.scroll")
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}

private struct HomeLatestNewsRowView: View {
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
            Text(item.body)
                .font(tokens.typography.bodySecondary)
                .foregroundStyle(tokens.colors.textSecondary)
                .lineLimit(3)
        }
        .frame(maxWidth: .infinity, alignment: .topLeading)
    }
}

private struct HomeLatestNewsImageView: View {
    let tokens: ReguertaDesignTokens
    let imageURL: URL

    var body: some View {
        AsyncImage(url: imageURL) { phase in
            if let image = phase.image {
                image
                    .resizable()
                    .scaledToFit()
            } else {
                RoundedRectangle(cornerRadius: tokens.radius.sm)
                    .fill(tokens.colors.surfaceSecondary)
                    .overlay {
                        Image(systemName: "photo")
                            .font(.system(size: 24.resize))
                            .foregroundStyle(tokens.colors.textSecondary)
                    }
            }
        }
        .frame(width: 144.resize, height: 144.resize)
        .clipShape(RoundedRectangle(cornerRadius: tokens.radius.sm))
        .accessibilityHidden(true)
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
