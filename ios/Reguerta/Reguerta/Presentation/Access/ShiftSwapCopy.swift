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

    static let spanish = ShiftSwapCopy(
        title: "Solicitar cambio de turno",
        subtitle: "Revisa el turno, difunde la solicitud a los socios que pueden cubrirlo y añade el motivo si quieres.",
        requestsTitle: "Solicitudes de cambio",
        requestsSubtitle: "Responde si puedes cubrir turnos ajenos o confirma con quién haces el intercambio.",
        empty: "Ahora mismo no tienes solicitudes de cambio.",
        incoming: "Te piden cambio",
        outgoing: "Tus solicitudes",
        history: "Actividad reciente",
        reasonLabel: "Motivo (opcional)",
        send: "Enviar solicitud",
        sending: "Enviando solicitud…",
        back: "Volver",
        cancel: "Cancelar solicitud",
        confirm: "Confirmar cambio",
        acknowledge: "Entendido",
        noReason: "Sin motivo adicional",
        responses: "Pueden cubrirlo",
        open: "Abierta",
        cancelled: "Cancelada",
        applied: "Aplicada",
        ask: "Solicitar cambio",
        deliveryLabel: "reparto",
        marketLabel: "mercadillo",
        acceptShort: "Puedo",
        rejectShort: "No puedo",
        shift: { "Turno: \($0)" },
        broadcastScope: { "Se enviará a los socios con turnos futuros de \($0)." },
        requestedBy: { "Solicita: \($0)" },
        offerShift: { "Tu turno para intercambiar: \($0)" },
        reason: { "Motivo: \($0)" },
        waitingMany: { "Enviada a \($0) socios. Esperando respuestas." },
        confirmBeforeAfter: { "Cambiar tu turno del \($0) por el turno del \($1)." },
        selected: { "Cambio confirmado con: \($0)" }
    )

    static let english = ShiftSwapCopy(
        title: "Request shift swap",
        subtitle: "Review the shift, broadcast the request to members who can cover it, and add a reason if needed.",
        requestsTitle: "Swap requests",
        requestsSubtitle: "Respond if you can cover shifts or confirm which accepted offer you want to apply.",
        empty: "You have no shift swap requests right now.",
        incoming: "Incoming requests",
        outgoing: "Your requests",
        history: "Recent activity",
        reasonLabel: "Reason (optional)",
        send: "Send request",
        sending: "Sending request…",
        back: "Back",
        cancel: "Cancel request",
        confirm: "Confirm change",
        acknowledge: "OK",
        noReason: "No extra reason",
        responses: "Available members",
        open: "Open",
        cancelled: "Cancelled",
        applied: "Applied",
        ask: "Request swap",
        deliveryLabel: "delivery",
        marketLabel: "market",
        acceptShort: "I can",
        rejectShort: "I can't",
        shift: { "Shift: \($0)" },
        broadcastScope: { "It will be sent to members with future \($0) shifts." },
        requestedBy: { "Requested by: \($0)" },
        offerShift: { "Your shift to swap: \($0)" },
        reason: { "Reason: \($0)" },
        waitingMany: { "Sent to \($0) members. Waiting for responses." },
        confirmBeforeAfter: { "Swap your shift on \($0) with the shift on \($1)." },
        selected: { "Confirmed with: \($0)" }
    )
}
