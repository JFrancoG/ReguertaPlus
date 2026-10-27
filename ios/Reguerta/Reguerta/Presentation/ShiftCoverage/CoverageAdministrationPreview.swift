#if DEBUG
import SwiftUI

enum CoverageAdministrationPreview {
    @MainActor
    static func prepare(_ model: CoverageRehearsalViewModel, spacing: Bool = false) async {
        await model.coverage.refresh()
        await model.coverage.refreshAdministration()
        if spacing, let candidate = model.coverage.administration?.spacingCandidates.first {
            model.presentAdministration(.spacing(candidate))
        } else if let member = model.coverage.administration?.members.first {
            model.presentAdministration(.permanentDeparture(member))
        }
    }
}
#endif
