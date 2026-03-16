import Foundation

enum SemanticVersionComparator {
    private static let pattern = "^\\d+(?:\\.\\d+)*$"

    static func compare(_ lhs: String, _ rhs: String) -> Int? {
        guard let leftParts = parse(lhs), let rightParts = parse(rhs) else {
            return nil
        }

        let maxCount = max(leftParts.count, rightParts.count)
        for index in 0..<maxCount {
            let left = index < leftParts.count ? leftParts[index] : 0
            let right = index < rightParts.count ? rightParts[index] : 0
            if left != right {
                return left < right ? -1 : 1
            }
        }

        return 0
    }

    private static func parse(_ raw: String) -> [Int]? {
        let value = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !value.isEmpty,
              value.range(of: pattern, options: .regularExpression) != nil
        else {
            return nil
        }

        return value.split(separator: ".").compactMap { Int($0) }
    }
}
