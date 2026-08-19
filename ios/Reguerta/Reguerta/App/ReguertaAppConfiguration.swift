enum ReguertaAppScenario: Equatable {
    case live
    case preview
    case uiTesting
}

enum ReguertaProductDataConfiguration: Equatable {
    case live
    case mock
}

enum ReguertaFreshnessDataConfiguration: Equatable {
    case live
    case mock
}

enum ReguertaPushNotificationConfiguration: Equatable {
    case enabled
    case disabled
}

struct ReguertaAppConfiguration: Equatable {
    let scenario: ReguertaAppScenario
    private let requestsMockProductData: Bool
    let skipsSplash: Bool
    let initialNowOverrideMillis: Int64?

    var productData: ReguertaProductDataConfiguration {
        scenario == .live && !requestsMockProductData ? .live : .mock
    }

    var freshnessData: ReguertaFreshnessDataConfiguration {
        scenario == .live ? .live : .mock
    }

    var pushNotifications: ReguertaPushNotificationConfiguration {
        scenario == .live ? .enabled : .disabled
    }
}

extension ReguertaAppConfiguration {
    /// Decodes the supported launch controls once so downstream composition receives typed policy.
    ///
    /// The development-time override flag must be followed immediately by a value representable as `Int64`; malformed
    /// input violates the launch contract and terminates composition before any scenario graph is created.
    init(arguments: [String]) {
        let argumentSet = Set(arguments)
        let usesMockAuthentication = argumentSet.contains("-useMockAuth")

        self.init(
            scenario: usesMockAuthentication ? .uiTesting : .live,
            requestsMockProductData: argumentSet.contains("-useMockProductData"),
            skipsSplash: argumentSet.contains("-skipSplash"),
            initialNowOverrideMillis: Self.decodeInitialNowOverrideMillis(arguments)
        )
    }

    static var preview: ReguertaAppConfiguration {
        ReguertaAppConfiguration(
            scenario: .preview,
            requestsMockProductData: true,
            skipsSplash: false,
            initialNowOverrideMillis: nil
        )
    }

    static var uiTesting: ReguertaAppConfiguration {
        ReguertaAppConfiguration(
            scenario: .uiTesting,
            requestsMockProductData: true,
            skipsSplash: false,
            initialNowOverrideMillis: nil
        )
    }

    private static func decodeInitialNowOverrideMillis(_ arguments: [String]) -> Int64? {
        let key = "-reguerta_dev_time_machine.override_now_millis"
        guard let keyIndex = arguments.firstIndex(of: key) else { return nil }
        let valueIndex = arguments.index(after: keyIndex)
        guard arguments.indices.contains(valueIndex), let value = Int64(arguments[valueIndex]) else {
            preconditionFailure("\(key) requires one Int64 value")
        }
        return value
    }

    /// Invokes exactly one complete graph factory for the selected scenario.
    ///
    /// A factory is never used as a fallback for another scenario.
    @MainActor
    func compose<Value>(
        live: () -> Value,
        preview: () -> Value,
        uiTesting: () -> Value
    ) -> Value {
        switch scenario {
        case .live:
            live()
        case .preview:
            preview()
        case .uiTesting:
            uiTesting()
        }
    }
}
