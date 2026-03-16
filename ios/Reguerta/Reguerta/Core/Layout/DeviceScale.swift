import SwiftUI
import UIKit

enum LayoutScale {
    static let baseWidth: CGFloat = 390
}

@MainActor
enum DeviceScale {
    private(set) static var shortestSide: CGFloat = {
        let bounds = UIWindow.keyWindowScreenBounds
        return min(bounds.width, bounds.height)
    }()

    private(set) static var statusBarHeight: CGFloat = UIWindow.keyWindowSafeAreaInsets.top
    private(set) static var bottomSafeArea: CGFloat = UIWindow.keyWindowSafeAreaInsets.bottom

    static func capture(size: CGSize, safeAreaInsets: EdgeInsets) {
        let candidate = min(size.width, size.height)
        guard candidate > 0 else { return }

        shortestSide = candidate
        statusBarHeight = safeAreaInsets.top
        bottomSafeArea = safeAreaInsets.bottom
    }

    static var scaleFactor: CGFloat {
        let width = shortestSide
        let ratio = width / LayoutScale.baseWidth

        if width < 600 {
            return ratio
        } else if width < 800 {
            return 1.4
        } else if width < 1000 {
            return 1.5
        } else {
            return 1.7
        }
    }

    static func resize(_ value: CGFloat) -> CGFloat {
        value * scaleFactor
    }

    static func resizeStatusBar(_ value: CGFloat) -> CGFloat {
        resize(value) + statusBarHeight
    }

    static func resizeBottom(_ value: CGFloat) -> CGFloat {
        resize(value) + bottomSafeArea
    }
}

private extension UIWindow {
    @MainActor
    static var keyWindowSafeAreaInsets: UIEdgeInsets {
        UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap(\.windows)
            .first(where: \.isKeyWindow)?
            .safeAreaInsets ?? .zero
    }

    @MainActor
    static var keyWindowScreenBounds: CGRect {
        if let keyWindow = UIApplication.shared.connectedScenes
            .compactMap({ $0 as? UIWindowScene })
            .flatMap(\.windows)
            .first(where: \.isKeyWindow),
           let screenBounds = keyWindow.windowScene?.screen.bounds {
            return screenBounds
        }

        if let sceneScreenBounds = UIApplication.shared.connectedScenes
            .compactMap({ $0 as? UIWindowScene })
            .first?.screen.bounds {
            return sceneScreenBounds
        }

        return CGRect(x: 0, y: 0, width: LayoutScale.baseWidth, height: 844)
    }
}

struct DeviceScaleCaptureView: View {
    var body: some View {
        GeometryReader { proxy in
            Color.clear
                .onAppear {
                    DeviceScale.capture(size: proxy.size, safeAreaInsets: proxy.safeAreaInsets)
                }
                .onChange(of: proxy.size) { _, _ in
                    DeviceScale.capture(size: proxy.size, safeAreaInsets: proxy.safeAreaInsets)
                }
                .onChange(of: proxy.safeAreaInsets.top) { _, _ in
                    DeviceScale.capture(size: proxy.size, safeAreaInsets: proxy.safeAreaInsets)
                }
                .onChange(of: proxy.safeAreaInsets.bottom) { _, _ in
                    DeviceScale.capture(size: proxy.size, safeAreaInsets: proxy.safeAreaInsets)
                }
        }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }
}
