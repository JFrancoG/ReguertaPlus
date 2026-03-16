import SwiftUI

extension Int {
    var resize: CGFloat {
        CGFloat(self).resize
    }

    var resizeBottomSize: CGFloat {
        CGFloat(self).resizeBottomSize
    }

    var resizeStatusBarSize: CGFloat {
        CGFloat(self).resizeStatusBarSize
    }
}

extension CGFloat {
    var resize: CGFloat {
        DeviceScale.resize(self)
    }

    var resizeBottomSize: CGFloat {
        DeviceScale.resizeBottom(self)
    }

    var resizeStatusBarSize: CGFloat {
        DeviceScale.resizeStatusBar(self)
    }
}

extension Double {
    var resize: CGFloat {
        CGFloat(self).resize
    }
}
