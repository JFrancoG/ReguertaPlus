package com.reguerta.user.presentation.access

import androidx.annotation.StringRes
import com.reguerta.user.domain.access.AuthPrincipal
import com.reguerta.user.domain.access.Member
import com.reguerta.user.domain.access.UnauthorizedReason
import com.reguerta.user.domain.calendar.DeliveryCalendarOverride
import com.reguerta.user.domain.calendar.DeliveryWeekday
import com.reguerta.user.domain.commitments.SeasonalCommitment
import com.reguerta.user.domain.news.NewsArticle
import com.reguerta.user.domain.notifications.NotificationAudience
import com.reguerta.user.domain.notifications.NotificationEvent
import com.reguerta.user.domain.profiles.SharedProfile
import com.reguerta.user.domain.products.CommonPurchaseType
import com.reguerta.user.domain.products.Product
import com.reguerta.user.domain.products.ProductStockMode
import com.reguerta.user.domain.shifts.ShiftAssignment
import com.reguerta.user.domain.shifts.ShiftSwapRequest

data class MemberDraft(
    val displayName: String = "",
    val email: String = "",
    val companyName: String = "",
    val phoneNumber: String = "",
    val isMember: Boolean = true,
    val isProducer: Boolean = false,
    val isAdmin: Boolean = false,
    val isCommonPurchaseManager: Boolean = false,
    val isActive: Boolean = true,
)

data class NewsDraft(
    val title: String = "",
    val body: String = "",
    val urlImage: String = "",
    val active: Boolean = true,
)

data class NotificationDraft(
    val title: String = "",
    val body: String = "",
    val audience: NotificationAudience = NotificationAudience.ALL,
)

data class SharedProfileDraft(
    val familyNames: String = "",
    val photoUrl: String = "",
    val about: String = "",
)

data class ProductDraft(
    val name: String = "",
    val description: String = "",
    val productImageUrl: String = "",
    val price: String = "",
    val unitName: String = "",
    val unitAbbreviation: String = "",
    val unitPlural: String = "",
    val unitQty: String = "1",
    val packContainerName: String = "",
    val packContainerAbbreviation: String = "",
    val packContainerPlural: String = "",
    val packContainerQty: String = "",
    val isAvailable: Boolean = true,
    val stockMode: ProductStockMode = ProductStockMode.INFINITE,
    val stockQty: String = "",
    val isEcoBasket: Boolean = false,
    val isCommonPurchase: Boolean = false,
    val commonPurchaseType: CommonPurchaseType? = null,
)

data class ShiftSwapDraft(
    val shiftId: String = "",
    val reason: String = "",
)

sealed interface SessionMode {
    data object SignedOut : SessionMode

    data class Authorized(
        val principal: AuthPrincipal,
        val authenticatedMember: Member,
        val member: Member,
        val members: List<Member>,
    ) : SessionMode

    data class Unauthorized(
        val email: String,
        val reason: UnauthorizedReason,
    ) : SessionMode
}

data class SessionUiState(
    val emailInput: String = "",
    val passwordInput: String = "",
    @param:StringRes val emailErrorRes: Int? = null,
    @param:StringRes val passwordErrorRes: Int? = null,
    val isAuthenticating: Boolean = false,
    val registerEmailInput: String = "",
    val registerPasswordInput: String = "",
    val registerRepeatPasswordInput: String = "",
    @param:StringRes val registerEmailErrorRes: Int? = null,
    @param:StringRes val registerPasswordErrorRes: Int? = null,
    @param:StringRes val registerRepeatPasswordErrorRes: Int? = null,
    val isRegistering: Boolean = false,
    val recoverEmailInput: String = "",
    @param:StringRes val recoverEmailErrorRes: Int? = null,
    val isRecoveringPassword: Boolean = false,
    val showRecoverSuccessDialog: Boolean = false,
    val showSessionExpiredDialog: Boolean = false,
    val showUnauthorizedDialog: Boolean = false,
    val mode: SessionMode = SessionMode.SignedOut,
    val memberDraft: MemberDraft = MemberDraft(),
    val myOrderFreshnessState: MyOrderFreshnessUiState = MyOrderFreshnessUiState.Idle,
    val latestNews: List<NewsArticle> = emptyList(),
    val newsFeed: List<NewsArticle> = emptyList(),
    val newsDraft: NewsDraft = NewsDraft(),
    val notificationsFeed: List<NotificationEvent> = emptyList(),
    val notificationDraft: NotificationDraft = NotificationDraft(),
    val productsFeed: List<Product> = emptyList(),
    val myOrderProductsFeed: List<Product> = emptyList(),
    val myOrderSeasonalCommitmentsFeed: List<SeasonalCommitment> = emptyList(),
    val productDraft: ProductDraft = ProductDraft(),
    val sharedProfiles: List<SharedProfile> = emptyList(),
    val sharedProfileDraft: SharedProfileDraft = SharedProfileDraft(),
    val shiftsFeed: List<ShiftAssignment> = emptyList(),
    val deliveryCalendarOverrides: List<DeliveryCalendarOverride> = emptyList(),
    val defaultDeliveryDayOfWeek: DeliveryWeekday? = null,
    val shiftSwapRequests: List<ShiftSwapRequest> = emptyList(),
    val dismissedShiftSwapRequestIds: Set<String> = emptySet(),
    val shiftSwapDraft: ShiftSwapDraft = ShiftSwapDraft(),
    val nextDeliveryShift: ShiftAssignment? = null,
    val nextMarketShift: ShiftAssignment? = null,
    val editingProductId: String? = null,
    val editingNewsId: String? = null,
    val isLoadingNews: Boolean = false,
    val isSavingNews: Boolean = false,
    val isLoadingNotifications: Boolean = false,
    val isSendingNotification: Boolean = false,
    val isLoadingProducts: Boolean = false,
    val isLoadingMyOrderProducts: Boolean = false,
    val isSavingProduct: Boolean = false,
    val isUpdatingProducerCatalogVisibility: Boolean = false,
    val isLoadingSharedProfiles: Boolean = false,
    val isSavingSharedProfile: Boolean = false,
    val isDeletingSharedProfile: Boolean = false,
    val isLoadingShifts: Boolean = false,
    val isLoadingDeliveryCalendar: Boolean = false,
    val isSavingDeliveryCalendar: Boolean = false,
    val isSubmittingShiftPlanningRequest: Boolean = false,
    val isSavingShiftSwapRequest: Boolean = false,
    val isUpdatingShiftSwapRequest: Boolean = false,
    val nowOverrideMillis: Long? = null,
)

sealed interface SessionUiEvent {
    data class ShowMessage(@param:StringRes val messageRes: Int) : SessionUiEvent
}

sealed interface MyOrderFreshnessUiState {
    data object Idle : MyOrderFreshnessUiState

    data object Checking : MyOrderFreshnessUiState

    data object Ready : MyOrderFreshnessUiState

    data object TimedOut : MyOrderFreshnessUiState

    data object Unavailable : MyOrderFreshnessUiState
}
