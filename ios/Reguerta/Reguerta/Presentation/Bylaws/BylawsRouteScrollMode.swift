import SwiftUI

nonisolated enum BylawsRouteScrollMode: Equatable {
    case fullPage
    case answerOnly

    static func resolve(
        hasAnswer: Bool,
        dynamicTypeSize: DynamicTypeSize,
        verticalSizeClass: UserInterfaceSizeClass?
    ) -> BylawsRouteScrollMode {
        guard hasAnswer,
              verticalSizeClass == .regular,
              dynamicTypeSize < .xxxLarge
        else {
            return .fullPage
        }
        return .answerOnly
    }
}
