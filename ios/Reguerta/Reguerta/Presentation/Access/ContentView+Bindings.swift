import SwiftUI

extension ContentView {
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

    var newsTitleBinding: Binding<String> {
        Binding(
            get: { viewModel.newsDraft.title },
            set: { value in
                viewModel.updateNewsDraft { $0.title = value }
            }
        )
    }

    var newsBodyBinding: Binding<String> {
        Binding(
            get: { viewModel.newsDraft.body },
            set: { value in
                viewModel.updateNewsDraft { $0.body = value }
            }
        )
    }

    var newsUrlImageBinding: Binding<String> {
        Binding(
            get: { viewModel.newsDraft.urlImage },
            set: { value in
                viewModel.updateNewsDraft { $0.urlImage = value }
            }
        )
    }

    var newsActiveBinding: Binding<Bool> {
        Binding(
            get: { viewModel.newsDraft.active },
            set: { value in
                viewModel.updateNewsDraft { $0.active = value }
            }
        )
    }

    var notificationTitleBinding: Binding<String> {
        Binding(
            get: { viewModel.notificationDraft.title },
            set: { value in
                viewModel.updateNotificationDraft { $0.title = value }
            }
        )
    }

    var notificationBodyBinding: Binding<String> {
        Binding(
            get: { viewModel.notificationDraft.body },
            set: { value in
                viewModel.updateNotificationDraft { $0.body = value }
            }
        )
    }

    var notificationAudienceBinding: Binding<NotificationAudience> {
        Binding(
            get: { viewModel.notificationDraft.audience },
            set: { value in
                viewModel.updateNotificationDraft { $0.audience = value }
            }
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

    var pendingNewsDeletionArticle: NewsArticle? {
        guard let pendingNewsDeletionId else { return nil }
        return viewModel.newsFeed.first(where: { $0.id == pendingNewsDeletionId })
    }

    func displayName(for userId: String, session: AuthorizedSession) -> String {
        session.members.first(where: { $0.id == userId })?.displayName ?? userId
    }
}
