import SwiftUI

extension AccessRootRoutingView {
    func binding(_ keyPath: ReferenceWritableKeyPath<SessionViewModel, String>) -> Binding<String> {
        Binding(
            get: { viewModel[keyPath: keyPath] },
            set: { viewModel[keyPath: keyPath] = $0 }
        )
    }

    var memberDraftBinding: Binding<MemberDraft> {
        Binding(
            get: { viewModel.memberDraft },
            set: { viewModel.memberDraft = $0 }
        )
    }

    func localizedKey(_ key: String) -> LocalizedStringKey {
        LocalizedStringKey(key)
    }

    var currentHomeMember: Member? {
        switch viewModel.mode {
        case .authorized(let session):
            return session.member
        case .signedOut, .unauthorized:
            return nil
        }
    }

    var currentHomeSession: AuthorizedSession? {
        switch viewModel.mode {
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
