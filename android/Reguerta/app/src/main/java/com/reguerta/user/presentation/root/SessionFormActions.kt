package com.reguerta.user.presentation.root

import com.reguerta.user.R
import com.reguerta.user.domain.access.canPublishNews
import com.reguerta.user.domain.access.canSendAdminNotifications
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.update
import java.util.UUID

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

    fun onPasswordEdited() {
        uiState.update {
            it.copy(
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

    fun onRegisterPasswordEdited() {
        uiState.update {
            it.copy(
                registerEmailErrorRes = null,
                registerPasswordErrorRes = null,
                registerRepeatPasswordErrorRes = null,
            )
        }
    }

    fun onRegisterRepeatPasswordEdited() {
        uiState.update {
            it.copy(
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
        uiState.update {
            it.copy(
                newsDraft = newDraft,
                newsDraftRevision = it.newsDraftRevision + 1,
            )
        }
    }

    fun onNotificationDraftChanged(newDraft: NotificationDraft) {
        uiState.update {
            it.copy(
                notificationDraft = newDraft,
                notificationDraftRevision = it.notificationDraftRevision + 1,
            )
        }
    }

    fun onProductDraftChanged(newDraft: ProductDraft) {
        uiState.update {
            it.copy(
                productDraft = newDraft,
                productEditorRevision = it.productEditorRevision + 1,
            )
        }
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
                newsEditorRevision = it.newsEditorRevision + 1,
                newsDraftRevision = it.newsDraftRevision + 1,
                newsImageRevision = it.newsImageRevision + 1,
                isUploadingNewsImage = false,
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
                newsEditorRevision = it.newsEditorRevision + 1,
                newsDraftRevision = it.newsDraftRevision + 1,
                newsImageRevision = it.newsImageRevision + 1,
                isUploadingNewsImage = false,
            )
        }
    }

    fun clearNewsEditor() {
        uiState.update { it.clearedNewsEditor() }
    }

    fun clearNewsEditorIfCurrent(identity: EditorConfirmationIdentity): Boolean {
        while (true) {
            val state = uiState.value
            if (!state.matchesNewsEditor(identity)) return false
            if (uiState.compareAndSet(state, state.clearedNewsEditor())) return true
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
                notificationEditorRevision = it.notificationEditorRevision + 1,
                notificationDraftRevision = it.notificationDraftRevision + 1,
            )
        }
    }

    fun clearNotificationEditor() {
        uiState.update { it.clearedNotificationEditor() }
    }

    fun clearNotificationEditorIfCurrent(identity: EditorConfirmationIdentity): Boolean {
        while (true) {
            val state = uiState.value
            if (!state.matchesNotificationEditor(identity)) return false
            if (uiState.compareAndSet(state, state.clearedNotificationEditor())) return true
        }
    }

    fun requestNewsDeletion(newsId: String) {
        val mode = uiState.value.mode as? SessionMode.Authorized ?: return
        if (!mode.member.canPublishNews) {
            emitMessage(R.string.feedback_only_admin_delete_news)
            return
        }
        if (uiState.value.newsFeed.none { article -> article.id == newsId }) return
        uiState.update {
            it.copy(
                pendingNewsDeletionId = newsId,
                newsDeletionRequestRevision = it.newsDeletionRequestRevision + 1,
            )
        }
    }

    fun clearNewsDeletionRequest(requestRevision: Long) {
        uiState.update {
            if (it.newsDeletionRequestRevision != requestRevision) {
                it
            } else {
                it.copy(
                    pendingNewsDeletionId = null,
                    newsDeletionRequestRevision = it.newsDeletionRequestRevision + 1,
                )
            }
        }
    }

    private fun SessionUiState.clearedNewsEditor(): SessionUiState = copy(
        newsDraft = NewsDraft(),
        editingNewsId = null,
        newsEditorRevision = newsEditorRevision + 1,
        newsDraftRevision = newsDraftRevision + 1,
        newsImageRevision = newsImageRevision + 1,
        isUploadingNewsImage = false,
    )

    private fun SessionUiState.clearedNotificationEditor(): SessionUiState = copy(
        notificationDraft = NotificationDraft(),
        notificationEditorRevision = notificationEditorRevision + 1,
        notificationDraftRevision = notificationDraftRevision + 1,
    )

    private fun SessionUiState.matchesNewsEditor(identity: EditorConfirmationIdentity): Boolean =
        newsEditorRevision == identity.editorGeneration &&
            newsDraftRevision == identity.draftRevision

    private fun SessionUiState.matchesNotificationEditor(identity: EditorConfirmationIdentity): Boolean =
        notificationEditorRevision == identity.editorGeneration &&
            notificationDraftRevision == identity.draftRevision

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
                pendingNewProductId = UUID.randomUUID().toString(),
                productEditorRevision = it.productEditorRevision + 1,
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
                pendingNewProductId = null,
                productEditorRevision = it.productEditorRevision + 1,
                isUploadingProductImage = false,
            )
        }
    }

    fun clearProductEditor() {
        uiState.update {
            it.copy(
                productDraft = ProductDraft(),
                editingProductId = null,
                pendingNewProductId = null,
                productEditorRevision = it.productEditorRevision + 1,
                isUploadingProductImage = false,
            )
        }
    }

    fun onSharedProfileDraftChanged(draft: SharedProfileDraft) {
        uiState.update {
            it.copy(
                sharedProfileDraft = draft,
                sharedProfileEditorRevision = it.sharedProfileEditorRevision + 1,
            )
        }
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
