import SwiftUI

struct ProductEditorFieldPairLayout: Layout {
    let horizontalSpacing: CGFloat
    let verticalSpacing: CGFloat

    private let stackedWidthThreshold: CGFloat = 280

    func sizeThatFits(
        proposal: ProposedViewSize,
        subviews: Subviews,
        cache: inout ()
    ) -> CGSize {
        guard subviews.count == 2 else { return .zero }
        let width = resolvedWidth(proposal: proposal, subviews: subviews)
        let sizes = measuredSizes(width: width, subviews: subviews)
        let height = if usesStackedLayout(width: width) {
            sizes.first.height + verticalSpacing + sizes.second.height
        } else {
            max(sizes.first.height, sizes.second.height)
        }
        return CGSize(width: width, height: height)
    }

    func placeSubviews(
        in bounds: CGRect,
        proposal: ProposedViewSize,
        subviews: Subviews,
        cache: inout ()
    ) {
        guard subviews.count == 2 else { return }
        if usesStackedLayout(width: bounds.width) {
            placeStackedSubviews(in: bounds, subviews: subviews)
            return
        }
        placeHorizontalSubviews(in: bounds, subviews: subviews)
    }

    private func placeStackedSubviews(in bounds: CGRect, subviews: Subviews) {
        let firstSize = subviews[0].sizeThatFits(ProposedViewSize(width: bounds.width, height: nil))
        subviews[0].place(
            at: bounds.origin,
            anchor: .topLeading,
            proposal: ProposedViewSize(width: bounds.width, height: firstSize.height)
        )
        subviews[1].place(
            at: CGPoint(x: bounds.minX, y: bounds.minY + firstSize.height + verticalSpacing),
            anchor: .topLeading,
            proposal: ProposedViewSize(width: bounds.width, height: nil)
        )
    }

    private func placeHorizontalSubviews(in bounds: CGRect, subviews: Subviews) {
        let widths = columnWidths(totalWidth: bounds.width)
        subviews[0].place(
            at: bounds.origin,
            anchor: .topLeading,
            proposal: ProposedViewSize(width: widths.first, height: nil)
        )
        subviews[1].place(
            at: CGPoint(x: bounds.minX + widths.first + horizontalSpacing, y: bounds.minY),
            anchor: .topLeading,
            proposal: ProposedViewSize(width: widths.second, height: nil)
        )
    }

    private func resolvedWidth(proposal: ProposedViewSize, subviews: Subviews) -> CGFloat {
        proposal.width ?? subviews.reduce(horizontalSpacing) {
            $0 + $1.sizeThatFits(.unspecified).width
        }
    }

    private func measuredSizes(width: CGFloat, subviews: Subviews) -> (first: CGSize, second: CGSize) {
        if usesStackedLayout(width: width) {
            return (
                subviews[0].sizeThatFits(ProposedViewSize(width: width, height: nil)),
                subviews[1].sizeThatFits(ProposedViewSize(width: width, height: nil))
            )
        }
        let widths = columnWidths(totalWidth: width)
        return (
            subviews[0].sizeThatFits(ProposedViewSize(width: widths.first, height: nil)),
            subviews[1].sizeThatFits(ProposedViewSize(width: widths.second, height: nil))
        )
    }

    private func columnWidths(totalWidth: CGFloat) -> (first: CGFloat, second: CGFloat) {
        let contentWidth = max(0, totalWidth - horizontalSpacing)
        let first = contentWidth / 3
        return (first, contentWidth - first)
    }

    private func usesStackedLayout(width: CGFloat) -> Bool {
        width < stackedWidthThreshold
    }
}
