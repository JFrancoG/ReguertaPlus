import SwiftUI

extension HomeShellView {
    func rootBinding<Value>(_ keyPath: ReferenceWritableKeyPath<AccessRootViewModel, Value>) -> Binding<Value> {
        Binding(
            get: { rootViewModel[keyPath: keyPath] },
            set: { rootViewModel[keyPath: keyPath] = $0 }
        )
    }

    func localizedKey(_ key: String) -> LocalizedStringKey { LocalizedStringKey(key) }

    var currentHomeMember: Member? {
        switch sessionViewModel.mode {
        case .authorized(let session):
            return session.member
        case .signedOut, .unauthorized:
            return nil
        }
    }

    var currentHomeSession: AuthorizedSession? {
        switch sessionViewModel.mode {
        case .authorized(let session):
            return session
        case .signedOut, .unauthorized:
            return nil
        }
    }

    func displayName(for userId: String, session: AuthorizedSession) -> String {
        session.members.first(where: { $0.id == userId })?.displayName ?? userId
    }
}
