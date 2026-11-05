package com.reguerta.user.presentation.shiftcoverage

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.reguerta.user.R
import com.reguerta.user.domain.shiftcoverage.ShiftCoverageAdministration
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle
import java.util.Locale

internal fun LazyListScope.coverageAdministration(
    snapshot: ShiftCoverageAdministration,
    model: CoverageRouteViewModel,
    enabled: Boolean,
) {
    item {
        Text(stringResource(R.string.coverage_admin_title), style = MaterialTheme.typography.titleLarge)
        Text(stringResource(R.string.coverage_admin_source_note))
        if (!snapshot.membershipWritable) Text(stringResource(R.string.coverage_admin_membership_closed))
    }
    items(snapshot.members, key = { "admin.member.${it.userId}" }) { member ->
        Card(Modifier.fillMaxWidth().testTag("coverage.admin.member.${member.userId}")) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                CoverageAdministrationMemberSummary(member)
                Button(onClick = { model.presentMembership(member) }, enabled = enabled && snapshot.membershipWritable,
                    modifier = Modifier.testTag("coverage.admin.reconcile.${member.userId}")) {
                    Text(stringResource(R.string.coverage_admin_reconcile))
                }
                if (member.allowsPermanentDeparture) {
                    Button(onClick = { model.presentMembership(member, permanentDeparture = true) }, enabled = enabled && snapshot.membershipWritable,
                        modifier = Modifier.testTag("coverage.admin.departure.${member.userId}")) {
                        Text(stringResource(R.string.coverage_admin_departure))
                    }
                }
            }
        }
    }
    item {
        Text(stringResource(R.string.coverage_admin_spacing_title), style = MaterialTheme.typography.titleLarge)
        Text(stringResource(R.string.coverage_admin_spacing_note))
        if (snapshot.spacingCandidates.isEmpty()) Text(stringResource(
            if (snapshot.spacingUnavailableReason == null) R.string.coverage_admin_no_spacing else R.string.coverage_admin_spacing_unavailable))
    }
    items(snapshot.spacingCandidates, key = { "admin.spacing.${it.id}" }) { pair ->
        Card(Modifier.fillMaxWidth()) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                CoverageAdministrationSpacingSummary(pair)
                Button(onClick = { model.presentSpacing(pair) }, enabled = enabled,
                    modifier = Modifier.testTag("coverage.admin.spacing.${pair.id}")) {
                    Text(stringResource(R.string.coverage_admin_spacing_authorize))
                }
            }
        }
    }
}

@Composable
internal fun CoverageAdministrationMemberSummary(member: ShiftCoverageAdministration.Member) {
    Text(member.displayName, style = MaterialTheme.typography.titleMedium)
    Text(stringResource(when (member.sourceActive) {
        true -> R.string.coverage_admin_member_active
        false -> R.string.coverage_admin_member_inactive
        null -> R.string.coverage_admin_member_missing
    }))
    Text(stringResource(if (member.eligible) R.string.coverage_admin_member_eligible else R.string.coverage_admin_member_ineligible))
    if (member.permanentDeparture) Text(stringResource(R.string.coverage_admin_departure_recorded))
    if (member.pendingQueueTransition) Text(stringResource(R.string.coverage_admin_queue_pending))
    member.reserves.forEach { reserve ->
        Text(stringResource(coverageKindLabel(reserve.type)))
        Text(stringResource(if (reserve.active) R.string.coverage_reserve_active else R.string.coverage_reserve_inactive))
        if (reserve.active) Text(stringResource(R.string.coverage_admin_reserve_entered, coverageDate(reserve.enteredAtMillis)))
    }
    member.credits.forEach { credit ->
        Text(stringResource(R.string.coverage_admin_credit_counts, stringResource(coverageKindLabel(credit.type)),
            credit.pendingCount, credit.consumedCount, credit.cancelledCount))
    }
}

@Composable
internal fun CoverageAdministrationSpacingSummary(pair: ShiftCoverageAdministration.SpacingCandidate) {
    Text(pair.displayName, style = MaterialTheme.typography.titleMedium)
    Text(stringResource(R.string.coverage_admin_spacing_proposal, pair.planningRequestId))
    Text(stringResource(R.string.coverage_admin_spacing_pair,
        coverageAdministrationDate(pair.previousDate), pair.previousRoundNumber,
        coverageAdministrationDate(pair.date), pair.roundNumber))
}

private fun coverageAdministrationDate(date: String): String = LocalDate.parse(date)
    .format(DateTimeFormatter.ofLocalizedDate(FormatStyle.MEDIUM).withLocale(Locale.getDefault()))
