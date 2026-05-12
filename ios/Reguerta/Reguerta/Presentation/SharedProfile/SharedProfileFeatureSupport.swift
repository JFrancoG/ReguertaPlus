import Foundation

struct SharedProfileDraft: Equatable, Sendable {
    var familyNames = ""
    var photoUrl = ""
    var about = ""

    var normalized: SharedProfileDraft {
        SharedProfileDraft(
            familyNames: familyNames.trimmingCharacters(in: .whitespacesAndNewlines),
            photoUrl: photoUrl.trimmingCharacters(in: .whitespacesAndNewlines),
            about: about.trimmingCharacters(in: .whitespacesAndNewlines)
        )
    }

    var hasVisibleContent: Bool {
        !familyNames.isEmpty || !photoUrl.isEmpty || !about.isEmpty
    }

    var persistedPhotoUrl: String? {
        photoUrl.isEmpty ? nil : photoUrl
    }
}

extension SharedProfile {
    func toDraft() -> SharedProfileDraft {
        SharedProfileDraft(
            familyNames: familyNames,
            photoUrl: photoUrl ?? "",
            about: about
        )
    }
}
