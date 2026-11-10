package com.reguerta.user.presentation.auth

import com.reguerta.user.presentation.root.MemberDraft
import com.reguerta.user.presentation.root.MyOrderFreshnessUiState
import com.reguerta.user.presentation.root.NewsDraft
import com.reguerta.user.presentation.root.NotificationDraft
import com.reguerta.user.presentation.root.ProductDraft
import com.reguerta.user.presentation.root.SessionMode
import com.reguerta.user.presentation.root.SessionUiState
import com.reguerta.user.presentation.root.SharedProfileDraft
import com.reguerta.user.presentation.root.ShiftSwapDraft
import com.reguerta.user.presentation.root.canManageSessionProductCatalog
import com.reguerta.user.presentation.root.normalized
import com.reguerta.user.presentation.root.toDraft

import com.reguerta.user.domain.access.UnauthorizedReason
import com.reguerta.user.domain.profiles.SharedProfile

internal fun SessionUiState.toSignedOutSessionState(
    showSessionExpiredDialog: Boolean,
): SessionUiState = copy(
    sessionEpoch = sessionEpoch + 1,
    sessionEnvironment = null,
    mode = SessionMode.SignedOut,
    emailErrorRes = null,
    passwordErrorRes = null,
    isAuthenticating = false,
    registerEmailInput = "",
    registerEmailErrorRes = null,
    registerPasswordErrorRes = null,
    registerRepeatPasswordErrorRes = null,
    isRegistering = false,
    recoverEmailInput = "",
    recoverEmailErrorRes = null,
    isRecoveringPassword = false,
    showRecoverSuccessDialog = false,
    showSessionExpiredDialog = showSessionExpiredDialog,
    showUnauthorizedDialog = false,
    memberDraft = MemberDraft(),
    myOrderFreshnessState = MyOrderFreshnessUiState.Idle,
    myOrderFreshnessGeneration = null,
    myOrderFreshnessConsumerReceipt = null,
    latestNews = emptyList(),
    newsFeed = emptyList(),
    newsDraft = NewsDraft(),
    newsEditorRevision = newsEditorRevision + 1,
    newsDraftRevision = newsDraftRevision + 1,
    newsImageRevision = newsImageRevision + 1,
    pendingNewsDeletionId = null,
    newsDeletionRequestRevision = newsDeletionRequestRevision + 1,
    notificationsFeed = emptyList(),
    notificationShiftDetail = null,
    loadingNotificationDetailEventId = null,
    readNotificationIds = emptySet(),
    pendingNotificationAcknowledgements = emptyList(),
    pendingReadNotificationIds = emptySet(),
    notificationReadRevision = notificationReadRevision + 1,
    notificationDraft = NotificationDraft(),
    notificationEditorRevision = notificationEditorRevision + 1,
    notificationDraftRevision = notificationDraftRevision + 1,
    productsFeed = emptyList(),
    myOrderProductsFeed = emptyList(),
    myOrderSeasonalCommitmentsFeed = emptyList(),
    productDraft = ProductDraft(),
    editingProductId = null,
    pendingNewProductId = null,
    productEditorRevision = productEditorRevision + 1,
    sharedProfiles = emptyList(),
    sharedProfileDraft = SharedProfileDraft(),
    sharedProfileEditorRevision = sharedProfileEditorRevision + 1,
    sharedProfilesRevision = sharedProfilesRevision + 1,
    shiftsFeed = emptyList(),
    deliveryCalendarOverrides = emptyList(),
    defaultDeliveryDayOfWeek = null,
    shiftSwapRequests = emptyList(),
    dismissedShiftSwapRequestIds = emptySet(),
    acknowledgedShiftSwapRequestIds = emptySet(),
    acknowledgedShiftSwapCreates = emptyMap(),
    shiftSwapDraft = ShiftSwapDraft(),
    nextDeliveryShift = null,
    nextMarketShift = null,
    editingNewsId = null,
    isLoadingNews = false,
    isSavingNews = false,
    isDeletingNews = false,
    isUploadingNewsImage = false,
    isLoadingNotifications = false,
    isSendingNotification = false,
    isPushNotificationPermissionActive = true,
    showPushNotificationPermissionDialog = false,
    isLoadingProducts = false,
    isLoadingMyOrderProducts = false,
    isSavingProduct = false,
    isUploadingProductImage = false,
    isUpdatingProducerCatalogVisibility = false,
    isLoadingSharedProfiles = false,
    isSavingSharedProfile = false,
    isUploadingSharedProfileImage = false,
    isDeletingSharedProfile = false,
    isLoadingShifts = false,
    isLoadingDeliveryCalendar = false,
    isSavingDeliveryCalendar = false,
    isSubmittingShiftPlanningRequest = false,
    isSavingShiftSwapRequest = false,
    isUpdatingShiftSwapRequest = false,
)

internal fun SessionUiState.resetProductEditorUnlessAuthorizedRefreshCanPreserve(
    principalUid: String,
    member: com.reguerta.user.domain.access.Member,
): SessionUiState {
    val currentMode = mode as? SessionMode.Authorized
    val canPreserve = currentMode?.principal?.uid == principalUid &&
        currentMode.member.id == member.id &&
        member.canManageSessionProductCatalog
    if (canPreserve) return this
    return copy(
        productDraft = ProductDraft(),
        editingProductId = null,
        pendingNewProductId = null,
        productEditorRevision = productEditorRevision + 1,
        isSavingProduct = false,
        isUploadingProductImage = false,
        isUpdatingProducerCatalogVisibility = false,
    )
}

/**
 * Reauthorization may finish after a camera result or a local profile save.
 * Preserve the same-context editor and its operation revision; a newer local
 * acknowledgement also wins over the remote snapshot read earlier.
 */
internal fun SessionUiState.reconcileSharedProfileAfterAuthorizedRefresh(
    memberId: String,
    profiles: List<SharedProfile>,
    profilesRevisionAtRead: Long,
    transition: AuthorizedSessionAccessTransition,
): SessionUiState {
    val sameContext = !transition.invalidatesSessionContext
    val canApplyProfiles = !sameContext || sharedProfilesRevision == profilesRevisionAtRead
    val previousSavedDraft = sharedProfiles.firstOrNull { it.userId == memberId }
        ?.toDraft()?.normalized() ?: SharedProfileDraft()
    val hasPendingChanges = sharedProfileDraft.normalized() != previousSavedDraft
    val hasPendingOperation = isUploadingSharedProfileImage || isSavingSharedProfile || isDeletingSharedProfile
    val preserveEditor = sameContext && (!canApplyProfiles || hasPendingChanges || hasPendingOperation)
    val remoteDraft = profiles.firstOrNull { it.userId == memberId }?.toDraft() ?: SharedProfileDraft()
    return copy(
        sharedProfiles = if (canApplyProfiles) {
            profiles.filter(SharedProfile::hasVisibleContent)
        } else {
            sharedProfiles
        },
        sharedProfileDraft = if (preserveEditor) sharedProfileDraft else remoteDraft,
        sharedProfileEditorRevision = if (preserveEditor) {
            sharedProfileEditorRevision
        } else {
            sharedProfileEditorRevision + 1
        },
        sharedProfilesRevision = if (canApplyProfiles) sharedProfilesRevision + 1 else sharedProfilesRevision,
        isLoadingSharedProfiles = false,
        isUploadingSharedProfileImage = preserveEditor && isUploadingSharedProfileImage,
        isSavingSharedProfile = preserveEditor && isSavingSharedProfile,
        isDeletingSharedProfile = preserveEditor && isDeletingSharedProfile,
    )
}

internal fun SessionUiState.clearCommunitySessionState(): SessionUiState = copy(
    latestNews = emptyList(),
    newsFeed = emptyList(),
    newsDraft = NewsDraft(),
    editingNewsId = null,
    newsEditorRevision = newsEditorRevision + 1,
    newsDraftRevision = newsDraftRevision + 1,
    newsImageRevision = newsImageRevision + 1,
    pendingNewsDeletionId = null,
    newsDeletionRequestRevision = newsDeletionRequestRevision + 1,
    isLoadingNews = false,
    isSavingNews = false,
    isDeletingNews = false,
    isUploadingNewsImage = false,
    notificationsFeed = emptyList(),
    notificationShiftDetail = null,
    loadingNotificationDetailEventId = null,
    readNotificationIds = emptySet(),
    pendingNotificationAcknowledgements = emptyList(),
    pendingReadNotificationIds = emptySet(),
    notificationReadRevision = notificationReadRevision + 1,
    notificationDraft = NotificationDraft(),
    notificationEditorRevision = notificationEditorRevision + 1,
    notificationDraftRevision = notificationDraftRevision + 1,
    isLoadingNotifications = false,
    isSendingNotification = false,
    isPushNotificationPermissionActive = true,
    showPushNotificationPermissionDialog = false,
)

internal fun SessionUiState.clearCommunitySessionStateIfInvalidated(
    transition: AuthorizedSessionAccessTransition,
): SessionUiState = if (transition.invalidatesSessionContext) {
    clearCommunitySessionState()
} else {
    this
}

internal fun SessionUiState.toUnauthorizedSessionState(
    email: String,
    reason: UnauthorizedReason,
    showUnauthorizedDialog: Boolean,
): SessionUiState = copy(
    sessionEpoch = sessionEpoch + 1,
    sessionEnvironment = null,
    mode = SessionMode.Unauthorized(
        email = email,
        reason = reason,
    ),
    showSessionExpiredDialog = false,
    showUnauthorizedDialog = showUnauthorizedDialog,
    myOrderFreshnessState = MyOrderFreshnessUiState.Idle,
    myOrderFreshnessGeneration = null,
    myOrderFreshnessConsumerReceipt = null,
    latestNews = emptyList(),
    newsFeed = emptyList(),
    newsDraft = NewsDraft(),
    newsEditorRevision = newsEditorRevision + 1,
    newsDraftRevision = newsDraftRevision + 1,
    newsImageRevision = newsImageRevision + 1,
    pendingNewsDeletionId = null,
    newsDeletionRequestRevision = newsDeletionRequestRevision + 1,
    notificationsFeed = emptyList(),
    notificationShiftDetail = null,
    loadingNotificationDetailEventId = null,
    readNotificationIds = emptySet(),
    pendingNotificationAcknowledgements = emptyList(),
    pendingReadNotificationIds = emptySet(),
    notificationReadRevision = notificationReadRevision + 1,
    notificationDraft = NotificationDraft(),
    notificationEditorRevision = notificationEditorRevision + 1,
    notificationDraftRevision = notificationDraftRevision + 1,
    productsFeed = emptyList(),
    myOrderProductsFeed = emptyList(),
    myOrderSeasonalCommitmentsFeed = emptyList(),
    productDraft = ProductDraft(),
    editingProductId = null,
    pendingNewProductId = null,
    productEditorRevision = productEditorRevision + 1,
    sharedProfiles = emptyList(),
    sharedProfileDraft = SharedProfileDraft(),
    sharedProfileEditorRevision = sharedProfileEditorRevision + 1,
    sharedProfilesRevision = sharedProfilesRevision + 1,
    shiftsFeed = emptyList(),
    deliveryCalendarOverrides = emptyList(),
    defaultDeliveryDayOfWeek = null,
    shiftSwapRequests = emptyList(),
    dismissedShiftSwapRequestIds = emptySet(),
    acknowledgedShiftSwapRequestIds = emptySet(),
    acknowledgedShiftSwapCreates = emptyMap(),
    shiftSwapDraft = ShiftSwapDraft(),
    nextDeliveryShift = null,
    nextMarketShift = null,
    editingNewsId = null,
    isLoadingNews = false,
    isSavingNews = false,
    isDeletingNews = false,
    isUploadingNewsImage = false,
    isLoadingNotifications = false,
    isSendingNotification = false,
    isPushNotificationPermissionActive = true,
    showPushNotificationPermissionDialog = false,
    isLoadingProducts = false,
    isLoadingMyOrderProducts = false,
    isSavingProduct = false,
    isUploadingProductImage = false,
    isLoadingSharedProfiles = false,
    isSavingSharedProfile = false,
    isUploadingSharedProfileImage = false,
    isDeletingSharedProfile = false,
    isLoadingShifts = false,
    isLoadingDeliveryCalendar = false,
    isSavingDeliveryCalendar = false,
    isSubmittingShiftPlanningRequest = false,
    isSavingShiftSwapRequest = false,
    isUpdatingShiftSwapRequest = false,
)
