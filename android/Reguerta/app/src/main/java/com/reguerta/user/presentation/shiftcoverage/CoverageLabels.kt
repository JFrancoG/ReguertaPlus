package com.reguerta.user.presentation.shiftcoverage

import com.reguerta.user.R
import com.reguerta.user.domain.shiftcoverage.ShiftCoverageCommand.Action
import com.reguerta.user.domain.shiftcoverage.ShiftCoverageSnapshot.*

internal fun coverageActionLabel(value: Action): Int = when (value) {
    Action.open -> R.string.coverage_action_open
    Action.offer -> R.string.coverage_action_offer
    Action.accept -> R.string.coverage_action_accept
    Action.decline -> R.string.coverage_action_decline
    Action.expire -> R.string.coverage_action_expire
    Action.complete -> R.string.coverage_action_complete
    Action.startSelection -> R.string.coverage_action_startselection
    Action.volunteer -> R.string.coverage_action_volunteer
    Action.withdrawVolunteer -> R.string.coverage_action_withdrawvolunteer
    Action.commitDraw -> R.string.coverage_action_commitdraw
    Action.revealDraw -> R.string.coverage_action_revealdraw
    Action.offerNext -> R.string.coverage_action_offernext
    Action.offerAdmin -> R.string.coverage_action_offeradmin
    Action.resumeAdmin -> R.string.coverage_action_resumeadmin
    Action.cancel -> R.string.coverage_action_cancel
    Action.fail -> R.string.coverage_action_fail
}

internal fun coverageStatusLabel(value: Status): Int = when (value) {
    Status.open -> R.string.coverage_status_open
    Status.offered -> R.string.coverage_status_offered
    Status.accepted -> R.string.coverage_status_accepted
    Status.completed -> R.string.coverage_status_completed
    Status.cancelled -> R.string.coverage_status_cancelled
    Status.failed -> R.string.coverage_status_failed
}

internal fun coveragePhaseLabel(value: Phase): Int = when (value) {
    Phase.reserve -> R.string.coverage_phase_reserve
    Phase.volunteers -> R.string.coverage_phase_volunteers
    Phase.drawRequired -> R.string.coverage_phase_drawrequired
    Phase.draw -> R.string.coverage_phase_draw
    Phase.adminRequired -> R.string.coverage_phase_adminrequired
}

internal fun coverageKindLabel(value: Kind): Int = when (value) {
    Kind.delivery -> R.string.coverage_delivery
    Kind.market -> R.string.coverage_market
}
