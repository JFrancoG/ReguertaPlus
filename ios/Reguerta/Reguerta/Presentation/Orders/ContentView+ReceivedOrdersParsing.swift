import SwiftUI

struct ProducerStatusVisualStyle {
    let container: Color
    let border: Color
}

extension ProducerOrderStatus {
    var visualStyle: ProducerStatusVisualStyle {
        switch self {
        case .unread:
            return ProducerStatusVisualStyle(
                container: Color(.systemGray6).opacity(0.82),
                border: Color(.systemGray4)
            )
        case .read:
            return ProducerStatusVisualStyle(
                container: Color(.systemGray6).opacity(0.82),
                border: Color(.systemGray4)
            )
        case .prepared:
            return ProducerStatusVisualStyle(
                container: Color(red: 1.0, green: 0.95, blue: 0.84),
                border: Color(red: 0.84, green: 0.66, blue: 0.31)
            )
        case .delivered:
            return ProducerStatusVisualStyle(
                container: Color(red: 0.90, green: 0.97, blue: 0.90),
                border: Color(red: 0.46, green: 0.64, blue: 0.44)
            )
        }
    }
}
