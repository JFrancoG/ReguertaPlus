#if DEBUG
import SwiftUI

@MainActor
struct AdaptiveOperationsRoutesPreview: View {
    let scenario: AdaptiveOperationsPreviewScenario
    let fixture: AdaptiveOperationsPreviewFixture

    @State private var isImpersonationExpanded: Bool
    @State private var selectedCalendarWeekKey: String
    @State private var selectedCalendarWeekday: DeliveryWeekday

    private var matrix: AdaptiveOperationsPreviewMatrix { scenario.matrix }

    var body: some View {
        route
            .padding(matrix.tokens.layout.compactHorizontalPadding)
            .frame(width: matrix.width, height: matrix.height, alignment: .topLeading)
            .background(matrix.tokens.colors.surfacePrimary)
            .reguertaPreviewTheme(tokens: matrix.tokens, motionPolicy: matrix.motionPolicy)
            .environment(\.locale, matrix.locale)
            .environment(\.dynamicTypeSize, matrix.dynamicTypeSize)
            .preferredColorScheme(matrix.colorScheme)
    }

    @ViewBuilder
    private var route: some View {
        switch scenario {
        case .homeDashboard,
             .homeFreshnessIdle,
             .homeFreshnessChecking,
             .homeFreshnessTimedOut,
             .homeFreshnessUnavailable:
            HomeDashboardRouteView(
                tokens: matrix.tokens,
                presentation: fixture.homeDashboardPresentation,
                newsViewModel: fixture.newsViewModel,
                loadNewsImageData: fixture.loadNewsImageData,
                onOpenMyOrder: {},
                onOpenReceivedOrders: {}
            )

        case .homeDrawer:
            HomeDrawerContentView(
                tokens: matrix.tokens,
                currentMember: fixture.currentMember,
                sharedProfile: fixture.sharedProfile,
                currentDestination: .settings,
                installedVersion: "5.0.0-preview",
                isDevelopBuild: true,
                onNavigate: { _ in },
                onCloseDrawer: {},
                onSignOut: {}
            )

        case .myOrderList, .myOrderCart:
            MyOrderRouteView(
                tokens: matrix.tokens,
                viewModel: fixture.myOrderViewModel,
                context: fixture.myOrderContext,
                cartOpenRequests: 0,
                onCartUnitsChange: { _ in },
                onReadOnlyModeChange: { _ in },
                onCheckoutSuccessAcknowledge: {}
            )

        case .myOrdersHistory:
            MyOrdersHistoryRouteView(
                tokens: matrix.tokens,
                viewModel: fixture.myOrdersHistoryViewModel,
                context: fixture.myOrdersHistoryContext,
                onTitleChanged: { _ in }
            )

        case .receivedOrders, .receivedOrdersWide, .receivedOrdersFailure:
            ReceivedOrdersRouteView(
                tokens: matrix.tokens,
                viewModel: fixture.receivedOrdersViewModel,
                context: fixture.receivedOrdersContext
            )

        case .receivedOrdersHistory:
            ReceivedOrdersHistoryRouteView(
                tokens: matrix.tokens,
                viewModel: fixture.receivedOrdersHistoryViewModel,
                context: fixture.receivedOrdersHistoryContext,
                onTitleChanged: { _ in }
            )

        case .shiftsPlanning:
            ShiftsRouteView(
                tokens: matrix.tokens,
                viewModel: fixture.shiftsViewModel,
                onStartSwapRequestForShift: { _ in }
            )

        case .settings:
            SettingsRouteView(
                tokens: matrix.tokens,
                session: fixture.session,
                shiftsViewModel: fixture.shiftsViewModel,
                productsViewModel: fixture.productsViewModel,
                isDevelopImpersonationEnabled: true,
                isImpersonationExpanded: $isImpersonationExpanded,
                nowOverrideMillis: fixture.nowMillis,
                onClearImpersonation: {},
                onImpersonate: { _ in },
                onSetNowOverrideMillis: { _ in },
                onShiftNowByDays: { _ in }
            )

        case .deliveryCalendarSheet:
            DeliveryCalendarWeekPickerSheet(
                futureWeeks: fixture.futureDeliveryShifts,
                overrides: fixture.deliveryCalendarOverrides,
                selectedWeekKey: $selectedCalendarWeekKey,
                selectedWeekday: $selectedCalendarWeekday,
                overrideEntry: fixture.deliveryCalendarOverrides.first {
                    $0.weekKey == selectedCalendarWeekKey
                },
                isSaving: false,
                hasDayChange: selectedCalendarWeekday != fixture.initialCalendarWeekday,
                onSave: {}
            )
        }
    }
}

extension AdaptiveOperationsRoutesPreview {
    init(
        scenario: AdaptiveOperationsPreviewScenario,
        fixture injectedFixture: AdaptiveOperationsPreviewFixture? = nil
    ) {
        let fixture = injectedFixture ?? AdaptiveOperationsPreviewFixture(scenario: scenario)
        self.scenario = scenario
        self.fixture = fixture
        self._isImpersonationExpanded = State(initialValue: scenario == .settings)
        self._selectedCalendarWeekKey = State(initialValue: fixture.initialCalendarWeekKey)
        self._selectedCalendarWeekday = State(initialValue: fixture.initialCalendarWeekday)
    }
}

enum AdaptiveOperationsPreviewScenario: String, CaseIterable, Hashable {
    case homeDashboard
    case homeFreshnessIdle
    case homeFreshnessChecking
    case homeFreshnessTimedOut
    case homeFreshnessUnavailable
    case homeDrawer
    case myOrderList
    case myOrderCart
    case myOrdersHistory
    case receivedOrders
    case receivedOrdersWide
    case receivedOrdersFailure
    case receivedOrdersHistory
    case shiftsPlanning
    case settings
    case deliveryCalendarSheet

    var matrix: AdaptiveOperationsPreviewMatrix {
        switch self {
        case .homeDashboard:
            AdaptiveOperationsPreviewMatrix(
                width: 320,
                height: 760,
                dynamicTypeSize: .large,
                locale: Locale(identifier: "es_ES"),
                colorScheme: .light,
                requiresIncreasedContrastOverride: false,
                reducesMotion: false
            )
        case .homeFreshnessIdle:
            AdaptiveOperationsPreviewMatrix(
                width: 600,
                height: 820,
                dynamicTypeSize: .xxxLarge,
                locale: Locale(identifier: "en_US"),
                colorScheme: .dark,
                requiresIncreasedContrastOverride: false,
                reducesMotion: false
            )
        case .homeFreshnessChecking:
            AdaptiveOperationsPreviewMatrix(
                width: 320,
                height: 760,
                dynamicTypeSize: .accessibility5,
                locale: Locale(identifier: "es_ES"),
                colorScheme: .light,
                requiresIncreasedContrastOverride: true,
                reducesMotion: true
            )
        case .homeFreshnessTimedOut:
            AdaptiveOperationsPreviewMatrix(
                width: 320,
                height: 760,
                dynamicTypeSize: .large,
                locale: Locale(identifier: "en_US"),
                colorScheme: .dark,
                requiresIncreasedContrastOverride: false,
                reducesMotion: true
            )
        case .homeFreshnessUnavailable:
            AdaptiveOperationsPreviewMatrix(
                width: 1_024,
                height: 900,
                dynamicTypeSize: .xxxLarge,
                locale: Locale(identifier: "es_ES"),
                colorScheme: .light,
                requiresIncreasedContrastOverride: true,
                reducesMotion: false
            )
        case .homeDrawer:
            AdaptiveOperationsPreviewMatrix(
                width: 1_024,
                height: 900,
                dynamicTypeSize: .xxxLarge,
                locale: Locale(identifier: "en_US"),
                colorScheme: .dark,
                requiresIncreasedContrastOverride: false,
                reducesMotion: false
            )
        case .myOrderList:
            AdaptiveOperationsPreviewMatrix(
                width: 600,
                height: 820,
                dynamicTypeSize: .large,
                locale: Locale(identifier: "es_ES"),
                colorScheme: .light,
                requiresIncreasedContrastOverride: false,
                reducesMotion: false
            )
        case .myOrderCart:
            AdaptiveOperationsPreviewMatrix(
                width: 320,
                height: 760,
                dynamicTypeSize: .accessibility5,
                locale: Locale(identifier: "en_US"),
                colorScheme: .dark,
                requiresIncreasedContrastOverride: false,
                reducesMotion: true
            )
        case .myOrdersHistory:
            AdaptiveOperationsPreviewMatrix(
                width: 1_024,
                height: 900,
                dynamicTypeSize: .xxxLarge,
                locale: Locale(identifier: "es_ES"),
                colorScheme: .light,
                requiresIncreasedContrastOverride: false,
                reducesMotion: false
            )
        case .receivedOrders:
            AdaptiveOperationsPreviewMatrix(
                width: 320,
                height: 760,
                dynamicTypeSize: .large,
                locale: Locale(identifier: "en_US"),
                colorScheme: .dark,
                requiresIncreasedContrastOverride: true,
                reducesMotion: false
            )
        case .receivedOrdersWide:
            AdaptiveOperationsPreviewMatrix(
                width: 600,
                height: 820,
                dynamicTypeSize: .xxxLarge,
                locale: Locale(identifier: "es_ES"),
                colorScheme: .light,
                requiresIncreasedContrastOverride: false,
                reducesMotion: false
            )
        case .receivedOrdersFailure:
            AdaptiveOperationsPreviewMatrix(
                width: 320,
                height: 760,
                dynamicTypeSize: .accessibility5,
                locale: Locale(identifier: "es_ES"),
                colorScheme: .light,
                requiresIncreasedContrastOverride: true,
                reducesMotion: true
            )
        case .receivedOrdersHistory:
            AdaptiveOperationsPreviewMatrix(
                width: 600,
                height: 820,
                dynamicTypeSize: .accessibility5,
                locale: Locale(identifier: "es_ES"),
                colorScheme: .light,
                requiresIncreasedContrastOverride: false,
                reducesMotion: true
            )
        case .shiftsPlanning:
            AdaptiveOperationsPreviewMatrix(
                width: 320,
                height: 760,
                dynamicTypeSize: .accessibility5,
                locale: Locale(identifier: "en_US"),
                colorScheme: .dark,
                requiresIncreasedContrastOverride: true,
                reducesMotion: true
            )
        case .settings:
            AdaptiveOperationsPreviewMatrix(
                width: 600,
                height: 820,
                dynamicTypeSize: .xxxLarge,
                locale: Locale(identifier: "es_ES"),
                colorScheme: .light,
                requiresIncreasedContrastOverride: false,
                reducesMotion: false
            )
        case .deliveryCalendarSheet:
            AdaptiveOperationsPreviewMatrix(
                width: 320,
                height: 760,
                dynamicTypeSize: .accessibility5,
                locale: Locale(identifier: "en_US"),
                colorScheme: .dark,
                requiresIncreasedContrastOverride: true,
                reducesMotion: true
            )
        }
    }
}

struct AdaptiveOperationsPreviewMatrix {
    let width: CGFloat
    let height: CGFloat
    let dynamicTypeSize: DynamicTypeSize
    let locale: Locale
    let colorScheme: ColorScheme
    /// Requires the preview renderer's Increased Contrast variant; SwiftUI exposes the value read-only.
    let requiresIncreasedContrastOverride: Bool
    let reducesMotion: Bool

    @MainActor
    var tokens: ReguertaDesignTokens {
        colorScheme == .dark ? .dark : .light
    }

    var motionPolicy: ReguertaMotionPolicy {
        ReguertaMotionPolicy(reducesMotion: reducesMotion)
    }
}

#Preview(
    "Operations · Home dashboard · compact ES light",
    traits: .modifier(ReguertaDesignSystemPreviewModifier()),
    .fixedLayout(width: 320, height: 760)
) {
    AdaptiveOperationsRoutesPreview(scenario: .homeDashboard)
}

#Preview(
    "Operations · Home freshness idle · 600 EN dark XXX",
    traits: .modifier(ReguertaDesignSystemPreviewModifier()),
    .fixedLayout(width: 600, height: 820)
) {
    AdaptiveOperationsRoutesPreview(scenario: .homeFreshnessIdle)
}

#Preview(
    "Operations · Home freshness checking · compact ES AX5 reduced · external Increased Contrast override",
    traits: .modifier(ReguertaDesignSystemPreviewModifier()),
    .fixedLayout(width: 320, height: 760)
) {
    AdaptiveOperationsRoutesPreview(scenario: .homeFreshnessChecking)
}

#Preview(
    "Operations · Home freshness timed out · compact EN dark reduced",
    traits: .modifier(ReguertaDesignSystemPreviewModifier()),
    .fixedLayout(width: 320, height: 760)
) {
    AdaptiveOperationsRoutesPreview(scenario: .homeFreshnessTimedOut)
}

#Preview(
    "Operations · Home freshness unavailable · iPad ES XXX · external Increased Contrast override",
    traits: .modifier(ReguertaDesignSystemPreviewModifier()),
    .fixedLayout(width: 1_024, height: 900)
) {
    AdaptiveOperationsRoutesPreview(scenario: .homeFreshnessUnavailable)
}

#Preview(
    "Operations · Home drawer · iPad EN dark",
    traits: .modifier(ReguertaDesignSystemPreviewModifier()),
    .fixedLayout(width: 1_024, height: 900)
) {
    AdaptiveOperationsRoutesPreview(scenario: .homeDrawer)
}

#Preview(
    "Operations · My order · 600 Large",
    traits: .modifier(ReguertaDesignSystemPreviewModifier()),
    .fixedLayout(width: 600, height: 820)
) {
    AdaptiveOperationsRoutesPreview(scenario: .myOrderList)
}

#Preview(
    "Operations · Cart · compact EN AX5 Reduce Motion",
    traits: .modifier(ReguertaDesignSystemPreviewModifier()),
    .fixedLayout(width: 320, height: 760)
) {
    AdaptiveOperationsRoutesPreview(scenario: .myOrderCart)
}

#Preview(
    "Operations · My history · iPad ES XXX",
    traits: .modifier(ReguertaDesignSystemPreviewModifier()),
    .fixedLayout(width: 1_024, height: 900)
) {
    AdaptiveOperationsRoutesPreview(scenario: .myOrdersHistory)
}

#Preview(
    "Operations · Received orders · compact EN · external Increased Contrast override",
    traits: .modifier(ReguertaDesignSystemPreviewModifier()),
    .fixedLayout(width: 320, height: 760)
) {
    AdaptiveOperationsRoutesPreview(scenario: .receivedOrders)
}

#Preview(
    "Operations · Received orders · 600 ES XXX",
    traits: .modifier(ReguertaDesignSystemPreviewModifier()),
    .fixedLayout(width: 600, height: 820)
) {
    AdaptiveOperationsRoutesPreview(scenario: .receivedOrdersWide)
}

#Preview(
    "Operations · Received orders failure · compact ES AX5 reduced · external Increased Contrast override",
    traits: .modifier(ReguertaDesignSystemPreviewModifier()),
    .fixedLayout(width: 320, height: 760)
) {
    AdaptiveOperationsRoutesPreview(scenario: .receivedOrdersFailure)
}

#Preview(
    "Operations · Received history · 600 ES AX5",
    traits: .modifier(ReguertaDesignSystemPreviewModifier()),
    .fixedLayout(width: 600, height: 820)
) {
    AdaptiveOperationsRoutesPreview(scenario: .receivedOrdersHistory)
}

#Preview(
    "Operations · Shifts · compact EN AX5 · external Increased Contrast override",
    traits: .modifier(ReguertaDesignSystemPreviewModifier()),
    .fixedLayout(width: 320, height: 760)
) {
    AdaptiveOperationsRoutesPreview(scenario: .shiftsPlanning)
}

#Preview(
    "Operations · Settings planning · 600 ES XXX",
    traits: .modifier(ReguertaDesignSystemPreviewModifier()),
    .fixedLayout(width: 600, height: 820)
) {
    AdaptiveOperationsRoutesPreview(scenario: .settings)
}

#Preview(
    "Operations · Calendar sheet · compact EN AX5 · external Increased Contrast override",
    traits: .modifier(ReguertaDesignSystemPreviewModifier()),
    .fixedLayout(width: 320, height: 760)
) {
    AdaptiveOperationsRoutesPreview(scenario: .deliveryCalendarSheet)
}
#endif
