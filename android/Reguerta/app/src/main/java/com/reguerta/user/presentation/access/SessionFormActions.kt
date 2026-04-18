package com.reguerta.user.presentation.access

import com.reguerta.user.R
import com.reguerta.user.domain.access.canPublishNews
import com.reguerta.user.domain.access.canSendAdminNotifications
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.update

internal class SessionFormActions(
    private val uiState: MutableStateFlow<SessionUiState>,
    private val emitMessage: (Int) -> Unit,
) {
    fun onEmailChanged(value: String) {
        uiState.update {
            it.copy(
                emailInput = value,
                emailErrorRes = null,
                passwordErrorRes = null,
            )
        }
    }

    fun onPasswordChanged(value: String) {
        uiState.update {
            it.copy(
                passwordInput = value,
                emailErrorRes = null,
                passwordErrorRes = null,
            )
        }
    }

    fun onRegisterEmailChanged(value: String) {
        uiState.update {
            it.copy(
                registerEmailInput = value,
                registerEmailErrorRes = null,
                registerPasswordErrorRes = null,
                registerRepeatPasswordErrorRes = null,
            )
        }
    }

    fun onRegisterPasswordChanged(value: String) {
        uiState.update {
            it.copy(
                registerPasswordInput = value,
                registerEmailErrorRes = null,
                registerPasswordErrorRes = null,
                registerRepeatPasswordErrorRes = null,
            )
        }
    }

    fun onRegisterRepeatPasswordChanged(value: String) {
        uiState.update {
            it.copy(
                registerRepeatPasswordInput = value,
                registerEmailErrorRes = null,
                registerPasswordErrorRes = null,
                registerRepeatPasswordErrorRes = null,
            )
        }
    }

    fun onRecoverEmailChanged(value: String) {
        uiState.update { it.copy(recoverEmailInput = value, recoverEmailErrorRes = null) }
    }

    fun clearLoginForm() {
        uiState.update {
            it.copy(
                emailInput = "",
                passwordInput = "",
                emailErrorRes = null,
                passwordErrorRes = null,
                isAuthenticating = false,
            )
        }
    }

    fun clearRegisterForm() {
        uiState.update {
            it.copy(
                registerEmailInput = "",
                registerPasswordInput = "",
                registerRepeatPasswordInput = "",
                registerEmailErrorRes = null,
                registerPasswordErrorRes = null,
                registerRepeatPasswordErrorRes = null,
                isRegistering = false,
            )
        }
    }

    fun clearRecoverForm() {
        uiState.update {
            it.copy(
                recoverEmailInput = "",
                recoverEmailErrorRes = null,
                isRecoveringPassword = false,
                showRecoverSuccessDialog = false,
            )
        }
    }

    fun dismissRecoverSuccessDialog() {
        uiState.update { it.copy(showRecoverSuccessDialog = false) }
    }

    fun dismissSessionExpiredDialog() {
        uiState.update { it.copy(showSessionExpiredDialog = false) }
    }

    fun dismissUnauthorizedDialog() {
        uiState.update { it.copy(showUnauthorizedDialog = false) }
    }

    fun onNewsDraftChanged(newDraft: NewsDraft) {
        uiState.update { it.copy(newsDraft = newDraft) }
    }

    fun onNotificationDraftChanged(newDraft: NotificationDraft) {
        uiState.update { it.copy(notificationDraft = newDraft) }
    }

    fun onProductDraftChanged(newDraft: ProductDraft) {
        uiState.update { it.copy(productDraft = newDraft) }
    }

    fun startCreatingNews() {
        val mode = uiState.value.mode as? SessionMode.Authorized ?: return
        if (!mode.member.canPublishNews) {
            emitMessage(R.string.feedback_only_admin_publish_news)
            return
        }

        uiState.update {
            it.copy(
                newsDraft = NewsDraft(active = true),
                editingNewsId = null,
            )
        }
    }

    fun startEditingNews(newsId: String) {
        val mode = uiState.value.mode as? SessionMode.Authorized ?: return
        if (!mode.member.canPublishNews) {
            emitMessage(R.string.feedback_only_admin_edit_news)
            return
        }
        val article = uiState.value.newsFeed.firstOrNull { it.id == newsId } ?: return
        uiState.update {
            it.copy(
                newsDraft = NewsDraft(
                    title = article.title,
                    body = article.body,
                    urlImage = article.urlImage.orEmpty(),
                    active = article.active,
                ),
                editingNewsId = article.id,
            )
        }
    }

    fun clearNewsEditor() {
        uiState.update {
            it.copy(
                newsDraft = NewsDraft(),
                editingNewsId = null,
                isSavingNews = false,
            )
        }
    }

    fun startCreatingNotification() {
        val mode = uiState.value.mode as? SessionMode.Authorized ?: return
        if (!mode.member.canSendAdminNotifications) {
            emitMessage(R.string.feedback_only_admin_send_notification)
            return
        }

        uiState.update {
            it.copy(
                notificationDraft = NotificationDraft(),
                isSendingNotification = false,
            )
        }
    }

    fun clearNotificationEditor() {
        uiState.update {
            it.copy(
                notificationDraft = NotificationDraft(),
                isSendingNotification = false,
            )
        }
    }

    fun startCreatingProduct() {
        val mode = uiState.value.mode as? SessionMode.Authorized ?: return
        if (!mode.member.canManageSessionProductCatalog) {
            emitMessage(R.string.feedback_only_producer_manage_products)
            return
        }
        uiState.update {
            it.copy(
                productDraft = ProductDraft(),
                editingProductId = "",
                isUploadingProductImage = false,
            )
        }
    }

    fun startEditingProduct(productId: String) {
        val mode = uiState.value.mode as? SessionMode.Authorized ?: return
        if (!mode.member.canManageSessionProductCatalog) {
            emitMessage(R.string.feedback_only_producer_manage_products)
            return
        }
        val product = uiState.value.productsFeed.firstOrNull { it.id == productId } ?: return
        uiState.update {
            it.copy(
                productDraft = product.toDraft(),
                editingProductId = product.id,
                isUploadingProductImage = false,
            )
        }
    }

    fun clearProductEditor() {
        uiState.update {
            it.copy(
                productDraft = ProductDraft(),
                editingProductId = null,
                isSavingProduct = false,
                isUploadingProductImage = false,
            )
        }
    }

    fun onSharedProfileDraftChanged(draft: SharedProfileDraft) {
        uiState.update { it.copy(sharedProfileDraft = draft) }
    }

    fun onShiftSwapDraftChanged(draft: ShiftSwapDraft) {
        uiState.update { it.copy(shiftSwapDraft = draft) }
    }

    fun startCreatingShiftSwap(shiftId: String) {
        uiState.update {
            it.copy(
                shiftSwapDraft = ShiftSwapDraft(
                    shiftId = shiftId,
                ),
            )
        }
    }

    fun clearShiftSwapDraft() {
        uiState.update {
            it.copy(
                shiftSwapDraft = ShiftSwapDraft(),
                isSavingShiftSwapRequest = false,
            )
        }
    }

    fun onMemberDraftChanged(newDraft: MemberDraft) {
        uiState.update { it.copy(memberDraft = newDraft) }
    }
}
