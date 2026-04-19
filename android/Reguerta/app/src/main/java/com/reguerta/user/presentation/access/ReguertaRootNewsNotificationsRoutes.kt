package com.reguerta.user.presentation.access

import android.net.Uri
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Image
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.reguerta.user.R
import com.reguerta.user.domain.news.NewsArticle
import com.reguerta.user.domain.notifications.NotificationAudience
import com.reguerta.user.domain.notifications.NotificationEvent
import com.reguerta.user.ui.components.auth.ReguertaFlatButton
import com.reguerta.user.ui.components.auth.ReguertaFullButton

@Composable
fun NewsFeedRoute(
    articles: List<NewsArticle>,
    isLoading: Boolean,
    isAdmin: Boolean,
    onRefresh: () -> Unit,
    onCreateNews: () -> Unit,
    onEditNews: (String) -> Unit,
    onRequestDeleteNews: (String) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Card {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Text(
                    text = stringResource(R.string.home_shell_news_title),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                )
                Text(
                    text = stringResource(R.string.news_list_subtitle),
                    style = MaterialTheme.typography.bodyMedium,
                )
                if (isAdmin) {
                    ReguertaFullButton(
                        label = stringResource(R.string.news_create_action),
                        onClick = onCreateNews,
                        fullWidth = true,
                    )
                }
                ReguertaFlatButton(
                    label = stringResource(R.string.news_refresh_action),
                    onClick = onRefresh,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        }

        if (isLoading) {
            Card {
                Text(
                    text = stringResource(R.string.news_loading),
                    modifier = Modifier.padding(16.dp),
                )
            }
        } else if (articles.isEmpty()) {
            Card {
                Text(
                    text = stringResource(R.string.news_empty_state),
                    modifier = Modifier.padding(16.dp),
                )
            }
        } else {
            articles.forEach { article ->
                Card {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        Text(
                            text = article.title,
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.SemiBold,
                        )
                        Text(
                            text = stringResource(R.string.news_meta_format, article.publishedBy),
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        if (!article.active) {
                            Text(
                                text = stringResource(R.string.news_inactive_badge),
                                style = MaterialTheme.typography.labelMedium,
                                color = MaterialTheme.colorScheme.primary,
                            )
                        }
                        Text(
                            text = article.body,
                            style = MaterialTheme.typography.bodyMedium,
                        )
                        article.urlImage?.let { url ->
                            Text(
                                text = url,
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.primary,
                            )
                        }
                        if (isAdmin) {
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                ReguertaFlatButton(
                                    label = stringResource(R.string.news_edit_action),
                                    onClick = { onEditNews(article.id) },
                                )
                                TextButton(onClick = { onRequestDeleteNews(article.id) }) {
                                    Text(stringResource(R.string.news_delete_action))
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun NewsEditorRoute(
    draft: NewsDraft,
    isSaving: Boolean,
    isUploadingImage: Boolean,
    isEditing: Boolean,
    onPickImage: (Uri) -> Unit,
    onClearImage: () -> Unit,
    onDraftChanged: (NewsDraft) -> Unit,
    onCancel: () -> Unit,
    onSave: () -> Unit,
) {
    val focusManager = LocalFocusManager.current
    Card {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .imePadding()
                .navigationBarsPadding()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(
                text = stringResource(
                    if (isEditing) R.string.news_editor_title_edit else R.string.news_editor_title_create,
                ),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
            )
            ReguertaImagePickerField(
                imageUrl = draft.urlImage,
                isUploading = isUploadingImage,
                onPickImage = onPickImage,
                onClearImage = onClearImage,
                placeholderIcon = Icons.Default.Image,
            )
            OutlinedTextField(
                value = draft.title,
                onValueChange = { onDraftChanged(draft.copy(title = it)) },
                modifier = Modifier.fillMaxWidth(),
                label = { Text(stringResource(R.string.news_field_title)) },
                enabled = !isSaving,
            )
            OutlinedTextField(
                value = draft.body,
                onValueChange = { onDraftChanged(draft.copy(body = it)) },
                modifier = Modifier.fillMaxWidth(),
                label = { Text(stringResource(R.string.news_field_body)) },
                minLines = 6,
                enabled = !isSaving,
            )
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Text(text = stringResource(R.string.news_field_active))
                Switch(
                    checked = draft.active,
                    onCheckedChange = { onDraftChanged(draft.copy(active = it)) },
                    enabled = !isSaving,
                )
            }
            ReguertaFullButton(
                label = stringResource(
                    if (isSaving) {
                        R.string.news_save_action_saving
                    } else if (isEditing) {
                        R.string.news_save_action_update
                    } else {
                        R.string.news_save_action_create
                    },
                ),
                onClick = {
                    focusManager.clearFocus(force = true)
                    onSave()
                },
                fullWidth = true,
                enabled = !isSaving && !isUploadingImage,
            )
            ReguertaFlatButton(
                label = stringResource(R.string.common_action_back),
                onClick = {
                    focusManager.clearFocus(force = true)
                    onCancel()
                },
                modifier = Modifier.fillMaxWidth(),
                enabled = !isSaving && !isUploadingImage,
            )
            Spacer(modifier = Modifier.height(64.dp))
        }
    }
}

@Composable
fun NotificationsFeedRoute(
    notifications: List<NotificationEvent>,
    isLoading: Boolean,
    isAdmin: Boolean,
    onRefresh: () -> Unit,
    onCreateNotification: () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Card {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Text(
                    text = stringResource(R.string.home_shell_notifications),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                )
                Text(
                    text = stringResource(R.string.notifications_list_subtitle),
                    style = MaterialTheme.typography.bodyMedium,
                )
                if (isAdmin) {
                    ReguertaFullButton(
                        label = stringResource(R.string.notifications_create_action),
                        onClick = onCreateNotification,
                        fullWidth = true,
                    )
                }
                ReguertaFlatButton(
                    label = stringResource(R.string.notifications_refresh_action),
                    onClick = onRefresh,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        }

        if (isLoading) {
            Card {
                Text(
                    text = stringResource(R.string.notifications_loading),
                    modifier = Modifier.padding(16.dp),
                )
            }
        } else if (notifications.isEmpty()) {
            Card {
                Text(
                    text = stringResource(R.string.notifications_empty_state),
                    modifier = Modifier.padding(16.dp),
                )
            }
        } else {
            notifications.forEach { event ->
                Card {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        Text(
                            text = event.title,
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.SemiBold,
                        )
                        Text(
                            text = stringResource(
                                R.string.notifications_meta_format,
                                event.sentAtMillis.toLocalizedDateTime(),
                            ),
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Text(
                            text = event.body,
                            style = MaterialTheme.typography.bodyMedium,
                        )
                        Text(
                            text = stringResource(event.audienceLabelRes()),
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.primary,
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun NotificationEditorRoute(
    draft: NotificationDraft,
    isSending: Boolean,
    onDraftChanged: (NotificationDraft) -> Unit,
    onCancel: () -> Unit,
    onSend: () -> Unit,
) {
    val focusManager = LocalFocusManager.current
    Card {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .imePadding()
                .navigationBarsPadding()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(
                text = stringResource(R.string.notifications_editor_title),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
            )
            Text(
                text = stringResource(R.string.notifications_editor_subtitle),
                style = MaterialTheme.typography.bodyMedium,
            )
            OutlinedTextField(
                value = draft.title,
                onValueChange = { onDraftChanged(draft.copy(title = it)) },
                modifier = Modifier.fillMaxWidth(),
                label = { Text(stringResource(R.string.notifications_field_title)) },
                enabled = !isSending,
            )
            OutlinedTextField(
                value = draft.body,
                onValueChange = { onDraftChanged(draft.copy(body = it)) },
                modifier = Modifier.fillMaxWidth(),
                minLines = 5,
                label = { Text(stringResource(R.string.notifications_field_body)) },
                enabled = !isSending,
            )
            Text(
                text = stringResource(R.string.notifications_field_audience),
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.SemiBold,
            )
            NotificationAudience.values().forEach { audience ->
                ReguertaFlatButton(
                    label = buildString {
                        if (draft.audience == audience) append("• ")
                        append(stringResource(audience.labelRes()))
                    },
                    onClick = { onDraftChanged(draft.copy(audience = audience)) },
                    modifier = Modifier.fillMaxWidth(),
                    enabled = !isSending,
                )
            }
            ReguertaFullButton(
                label = stringResource(
                    if (isSending) {
                        R.string.notifications_send_action_sending
                    } else {
                        R.string.notifications_send_action_send
                    },
                ),
                onClick = {
                    focusManager.clearFocus(force = true)
                    onSend()
                },
                enabled = !isSending,
                fullWidth = true,
            )
            ReguertaFlatButton(
                label = stringResource(R.string.common_action_back),
                onClick = {
                    focusManager.clearFocus(force = true)
                    onCancel()
                },
                modifier = Modifier.fillMaxWidth(),
                enabled = !isSending,
            )
            Spacer(modifier = Modifier.height(48.dp))
        }
    }
}
