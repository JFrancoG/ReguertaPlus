import Foundation

enum SemanticVersionComparator {
    private static let pattern = "^\\d+(?:\\.\\d+)*$"

    /// Compares numeric, dot-separated application versions.
    ///
    /// Surrounding whitespace is ignored and missing trailing components are treated as zero,
    /// so `1.2` and `1.2.0` compare as equal. Labels, empty components, negative values, and
    /// components that overflow `Int` are rejected.
    ///
    /// - Parameters:
    ///   - lhs: The version on the left side of the comparison.
    ///   - rhs: The version on the right side of the comparison.
    /// - Returns: `-1` when `lhs` is older, `0` when equal, `1` when newer, or `nil` when either
    ///   value is not a supported numeric version.
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

        var components: [Int] = []
        for component in value.split(separator: ".") {
            guard let parsed = Int(component) else {
                return nil
            }
            components.append(parsed)
        }
        return components
    }
}
