import Foundation

struct SharedProfile: Identifiable, Equatable, Sendable {
    var id: String { userId }
    let userId: String
    let familyNames: String
    let photoUrl: String?
    let about: String
    let updatedAtMillis: Int64

    var hasVisibleContent: Bool {
        !familyNames.isEmpty || !(photoUrl?.isEmpty ?? true) || !about.isEmpty
    }
}
