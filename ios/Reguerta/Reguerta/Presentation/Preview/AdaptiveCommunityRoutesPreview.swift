#if DEBUG
import Foundation
import SwiftUI

@MainActor
private struct AdaptiveCommunityRoutesPreview: View {
    let scenario: AdaptiveCommunityPreviewScenario
    let variant: AdaptiveCommunityPreviewVariant
    let fixture: AdaptiveCommunityPreviewFixture

    var body: some View {
        let tokens = variant.colorScheme == .dark
            ? ReguertaDesignTokens.dark
            : ReguertaDesignTokens.light

        ZStack(alignment: .bottom) {
            routeContent(tokens: tokens)
                .padding(tokens.spacing.lg)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)

            GlobalFeedbackRouteView(
                tokens: tokens,
                isVoiceOverEnabled: true,
                messageKey: fixture.environment.feedbackCenter.messageKey,
                dismissTitle: LocalizedStringKey(AccessL10nKey.dismissMessage)
            ) { _ in
                fixture.environment.feedbackCenter.clear()
            }
        }
        .background(tokens.colors.surfacePrimary)
        .reguertaPreviewTheme(
            tokens: tokens,
            motionPolicy: ReguertaMotionPolicy(reducesMotion: variant.reducesMotion)
        )
        .environment(\.locale, Locale(identifier: variant.localeIdentifier))
        .environment(\.dynamicTypeSize, variant.dynamicTypeSize)
        .preferredColorScheme(variant.colorScheme)
        .frame(width: variant.width, height: variant.height)
    }

    @ViewBuilder
    private func routeContent(tokens: ReguertaDesignTokens) -> some View {
        switch scenario.route {
        case .products:
            ProductsRouteView(
                tokens: tokens,
                viewModel: fixture.rootViewModel.productsViewModel
            )
        case .users:
            UsersRouteView(
                tokens: tokens,
                viewModel: fixture.rootViewModel.usersViewModel
            )
        case .sharedProfile:
            SharedProfileHubRoute(
                tokens: tokens,
                session: fixture.session,
                viewModel: fixture.rootViewModel.sharedProfileViewModel,
                displayName: fixture.displayName,
                onTitleChanged: { _ in },
                onProfileSaved: {}
            )
        case .newsList:
            NewsListRouteView(
                tokens: tokens,
                viewModel: fixture.rootViewModel.newsNotificationsViewModel,
                loadNewsImageData: { _ in throw AdaptivePreviewImageDataError.unavailable },
                newsMetaText: previewNewsMetadata,
                onCreateNews: {},
                onEditNews: {}
            )
        case .newsEditor:
            NewsEditorRouteView(
                tokens: tokens,
                viewModel: fixture.rootViewModel.newsNotificationsViewModel,
                onSaveSuccess: {}
            )
        case .notificationsList:
            NotificationsListRouteView(
                tokens: tokens,
                viewModel: fixture.rootViewModel.newsNotificationsViewModel,
                notificationDateText: previewNotificationDate
            )
        case .notificationEditor:
            NotificationEditorRouteView(
                tokens: tokens,
                viewModel: fixture.rootViewModel.newsNotificationsViewModel,
                onSendSuccess: {}
            )
        }
    }

    private func previewNewsMetadata(_ article: NewsArticle) -> String {
        l10n(AccessL10nKey.newsMetaFormat, article.publishedBy)
    }

    private func previewNotificationDate(_ notification: NotificationEvent) -> String {
        let date = Date(timeIntervalSince1970: TimeInterval(notification.sentAtMillis) / 1_000)
        return date.formatted(
            .dateTime
                .year()
                .month(.wide)
                .day()
                .locale(Locale(identifier: variant.localeIdentifier))
        )
    }
}

extension AdaptiveCommunityRoutesPreview {
    init(scenario: AdaptiveCommunityPreviewScenario) {
        self.scenario = scenario
        self.variant = scenario.matrix
        self.fixture = AdaptiveCommunityPreviewFixture.make(for: scenario)
    }
}

#Preview(
    "Products · loading · compact · ES light · Large",
    traits: .modifier(ReguertaDesignSystemPreviewModifier()),
    .fixedLayout(width: 320, height: 844)
) {
    AdaptiveCommunityRoutesPreview(scenario: .productsLoading)
}

#Preview(
    "Products · empty · 600 · EN dark · XXX · reduced · external Increased Contrast override",
    traits: .modifier(ReguertaDesignSystemPreviewModifier()),
    .fixedLayout(width: 600, height: 900)
) {
    AdaptiveCommunityRoutesPreview(scenario: .productsEmpty)
}

#Preview(
    "Products · content · iPad · ES light · AX5 · external Increased Contrast override",
    traits: .modifier(ReguertaDesignSystemPreviewModifier()),
    .fixedLayout(width: 820, height: 1_180)
) {
    AdaptiveCommunityRoutesPreview(scenario: .productsContent)
}

#Preview(
    "Products · failure · compact · EN dark · AX5 · reduced · external Increased Contrast override",
    traits: .modifier(ReguertaDesignSystemPreviewModifier()),
    .fixedLayout(width: 320, height: 844)
) {
    AdaptiveCommunityRoutesPreview(scenario: .productsFailure)
}

#Preview(
    "Product editor · compact · EN dark · AX5 · reduced",
    traits: .modifier(ReguertaDesignSystemPreviewModifier()),
    .fixedLayout(width: 320, height: 844)
) {
    AdaptiveCommunityRoutesPreview(scenario: .productEditor)
}

#Preview(
    "Users · content · 600 · ES light · Large · external Increased Contrast override",
    traits: .modifier(ReguertaDesignSystemPreviewModifier()),
    .fixedLayout(width: 600, height: 900)
) {
    AdaptiveCommunityRoutesPreview(scenario: .usersContent)
}

#Preview(
    "User editor · iPad · EN dark · XXX · reduced",
    traits: .modifier(ReguertaDesignSystemPreviewModifier()),
    .fixedLayout(width: 820, height: 1_180)
) {
    AdaptiveCommunityRoutesPreview(scenario: .userEditor)
}

#Preview(
    "User action · compact · ES light · AX5 · reduced · external Increased Contrast override",
    traits: .modifier(ReguertaDesignSystemPreviewModifier()),
    .fixedLayout(width: 320, height: 844)
) {
    AdaptiveCommunityRoutesPreview(scenario: .userAction)
}

#Preview(
    "Shared profile · loading · 600 · EN dark · Large · reduced",
    traits: .modifier(ReguertaDesignSystemPreviewModifier()),
    .fixedLayout(width: 600, height: 900)
) {
    AdaptiveCommunityRoutesPreview(scenario: .sharedProfileLoading)
}

#Preview(
    "Shared profile · content · iPad · ES light · XXX · external Increased Contrast override",
    traits: .modifier(ReguertaDesignSystemPreviewModifier()),
    .fixedLayout(width: 820, height: 1_180)
) {
    AdaptiveCommunityRoutesPreview(scenario: .sharedProfileContent)
}

#Preview(
    "News · loading · compact · EN dark · AX5 · reduced",
    traits: .modifier(ReguertaDesignSystemPreviewModifier()),
    .fixedLayout(width: 320, height: 844)
) {
    AdaptiveCommunityRoutesPreview(scenario: .newsLoading)
}

#Preview(
    "News · content · 600 · ES light · Large · external Increased Contrast override",
    traits: .modifier(ReguertaDesignSystemPreviewModifier()),
    .fixedLayout(width: 600, height: 900)
) {
    AdaptiveCommunityRoutesPreview(scenario: .newsContent)
}

#Preview(
    "News editor · iPad · EN dark · XXX · reduced",
    traits: .modifier(ReguertaDesignSystemPreviewModifier()),
    .fixedLayout(width: 820, height: 1_180)
) {
    AdaptiveCommunityRoutesPreview(scenario: .newsEditor)
}

#Preview(
    "Notifications · empty · compact · ES light · Large · external Increased Contrast override",
    traits: .modifier(ReguertaDesignSystemPreviewModifier()),
    .fixedLayout(width: 320, height: 844)
) {
    AdaptiveCommunityRoutesPreview(scenario: .notificationsEmpty)
}

#Preview(
    "Notifications · content · 600 · EN dark · AX5 · reduced",
    traits: .modifier(ReguertaDesignSystemPreviewModifier()),
    .fixedLayout(width: 600, height: 900)
) {
    AdaptiveCommunityRoutesPreview(scenario: .notificationsContent)
}

#Preview(
    "Notification editor · iPad · ES light · XXX · external Increased Contrast override",
    traits: .modifier(ReguertaDesignSystemPreviewModifier()),
    .fixedLayout(width: 820, height: 1_180)
) {
    AdaptiveCommunityRoutesPreview(scenario: .notificationEditor)
}

#Preview(
    "Community error · compact · EN dark · AX5 · reduced · external Increased Contrast override",
    traits: .modifier(ReguertaDesignSystemPreviewModifier()),
    .fixedLayout(width: 320, height: 844)
) {
    AdaptiveCommunityRoutesPreview(scenario: .routeError)
}
#endif
