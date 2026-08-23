import Foundation

/// Returns the producer parity for the current Madrid business week.
func currentISOWeekProducerParity(nowMillis: Int64 = Int64(Date().timeIntervalSince1970 * 1_000)) -> ProducerParity {
    producerParityForISOWeek(nowMillis: nowMillis)
}

/// Resolves producer parity from the canonical Madrid week, independent of the device time zone.
func producerParityForISOWeek(nowMillis: Int64) -> ProducerParity {
    let date = Date(timeIntervalSince1970: TimeInterval(nowMillis) / 1_000)
    let week = OrderBusinessCalendar.make().component(.weekOfYear, from: date)
    return week.isMultiple(of: 2) ? .even : .odd
}

extension Product {
    func matchesCurrentProducerWeek(membersById: [String: Member], currentWeekParity: ProducerParity) -> Bool {
        guard let producerParity = membersById[vendorId]?.producerParity else { return true }
        return producerParity == currentWeekParity
    }
}
