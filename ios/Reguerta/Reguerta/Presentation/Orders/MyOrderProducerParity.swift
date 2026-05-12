import Foundation

func currentISOWeekProducerParity(
    nowMillis: Int64 = Int64(Date().timeIntervalSince1970 * 1_000)
) -> ProducerParity {
    producerParityForISOWeek(nowMillis: nowMillis)
}

func producerParityForISOWeek(nowMillis: Int64) -> ProducerParity {
    let date = Date(timeIntervalSince1970: TimeInterval(nowMillis) / 1_000)
    var calendar = Calendar(identifier: .iso8601)
    calendar.timeZone = .current
    let week = calendar.component(.weekOfYear, from: date)
    return week.isMultiple(of: 2) ? .even : .odd
}

extension Product {
    func matchesCurrentProducerWeek(
        membersById: [String: Member],
        currentWeekParity: ProducerParity
    ) -> Bool {
        guard let producerParity = membersById[vendorId]?.producerParity else {
            return true
        }
        return producerParity == currentWeekParity
    }
}
