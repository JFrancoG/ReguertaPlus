import Foundation

struct ShiftSwapCopy {
    let title: String
    let subtitle: String
    let requestsTitle: String
    let requestsSubtitle: String
    let empty: String
    let incoming: String
    let outgoing: String
    let history: String
    let reasonLabel: String
    let send: String
    let sending: String
    let back: String
    let cancel: String
    let confirm: String
    let acknowledge: String
    let noReason: String
    let responses: String
    let open: String
    let cancelled: String
    let applied: String
    let ask: String
    let deliveryLabel: String
    let marketLabel: String
    let acceptShort: String
    let rejectShort: String
    let shift: (String) -> String
    let broadcastScope: (String) -> String
    let requestedBy: (String) -> String
    let offerShift: (String) -> String
    let reason: (String) -> String
    let waitingMany: (Int) -> String
    let confirmBeforeAfter: (String, String) -> String
    let selected: (String) -> String

    static var localized: ShiftSwapCopy {
        ShiftSwapCopy(
            title: l10n(AccessL10nKey.shiftSwapRequestScreenTitle),
            subtitle: l10n(AccessL10nKey.shiftSwapRequestScreenSubtitle),
            requestsTitle: l10n(AccessL10nKey.shiftSwapRequestRequestsTitle),
            requestsSubtitle: l10n(AccessL10nKey.shiftSwapRequestRequestsSubtitle),
            empty: l10n(AccessL10nKey.shiftSwapRequestEmpty),
            incoming: l10n(AccessL10nKey.shiftSwapRequestIncoming),
            outgoing: l10n(AccessL10nKey.shiftSwapRequestOutgoing),
            history: l10n(AccessL10nKey.shiftSwapRequestHistory),
            reasonLabel: l10n(AccessL10nKey.shiftSwapRequestReasonLabel),
            send: l10n(AccessL10nKey.shiftSwapRequestActionSend),
            sending: l10n(AccessL10nKey.shiftSwapRequestActionSending),
            back: l10n(AccessL10nKey.shiftSwapRequestActionBack),
            cancel: l10n(AccessL10nKey.shiftSwapRequestActionCancel),
            confirm: l10n(AccessL10nKey.shiftSwapRequestActionConfirm),
            acknowledge: l10n(AccessL10nKey.shiftSwapRequestActionAcknowledge),
            noReason: l10n(AccessL10nKey.shiftSwapRequestReasonEmpty),
            responses: l10n(AccessL10nKey.shiftSwapRequestResponsesTitle),
            open: l10n(AccessL10nKey.shiftSwapRequestStatusOpen),
            cancelled: l10n(AccessL10nKey.shiftSwapRequestStatusCancelled),
            applied: l10n(AccessL10nKey.shiftSwapRequestStatusApplied),
            ask: l10n(AccessL10nKey.shiftSwapRequestActionAsk),
            deliveryLabel: l10n(AccessL10nKey.shiftSwapRequestScopeDelivery),
            marketLabel: l10n(AccessL10nKey.shiftSwapRequestScopeMarket),
            acceptShort: l10n(AccessL10nKey.shiftSwapRequestActionAcceptShort),
            rejectShort: l10n(AccessL10nKey.shiftSwapRequestActionRejectShort),
            shift: { l10n(AccessL10nKey.shiftSwapRequestFormatShift, $0) },
            broadcastScope: { l10n(AccessL10nKey.shiftSwapRequestFormatBroadcastScope, $0) },
            requestedBy: { l10n(AccessL10nKey.shiftSwapRequestFormatRequestedBy, $0) },
            offerShift: { l10n(AccessL10nKey.shiftSwapRequestFormatOfferShift, $0) },
            reason: { l10n(AccessL10nKey.shiftSwapRequestFormatReason, $0) },
            waitingMany: { l10n(AccessL10nKey.shiftSwapRequestFormatWaitingMany, $0) },
            confirmBeforeAfter: { l10n(AccessL10nKey.shiftSwapRequestFormatConfirmBeforeAfter, $0, $1) },
            selected: { l10n(AccessL10nKey.shiftSwapRequestFormatSelected, $0) }
        )
    }
}
