package com.reguerta.user.presentation.news

import com.reguerta.user.presentation.root.NewsDraft
import com.reguerta.user.presentation.root.NotificationDraft
import com.reguerta.user.presentation.root.NotificationFeedItem
import com.reguerta.user.presentation.root.ReguertaImagePickerField
import com.reguerta.user.presentation.shifts.labelRes
import com.reguerta.user.presentation.shifts.toNotificationDateLabel

import android.net.Uri
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Article
import androidx.compose.material.icons.filled.CalendarToday
import androidx.compose.material.icons.filled.Campaign
import androidx.compose.material.icons.filled.Image
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.ShoppingCart
import androidx.compose.material.icons.filled.SwapHoriz
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuAnchorType
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import com.reguerta.user.R
import com.reguerta.user.domain.news.NewsArticle
import com.reguerta.user.domain.notifications.NotificationAudience
import com.reguerta.user.domain.notifications.NotificationEvent
import com.reguerta.user.ui.components.auth.ReguertaDeleteListActionButton
import com.reguerta.user.ui.components.auth.ReguertaEditListActionButton
import com.reguerta.user.ui.components.auth.ReguertaFloatingActionButton
import com.reguerta.user.ui.components.auth.ReguertaListItemCard
import com.reguerta.user.ui.theme.ColorFeedbackWarningDefault

@Composable
fun NewsFeedRoute(
    articles: List<NewsArticle>,
    isLoading: Boolean,
    isAdmin: Boolean,
    highlightedNewsId: String? = null,
    onCreateNews: () -> Unit,
    onEditNews: (String) -> Unit,
    onRequestDeleteNews: (String) -> Unit,
) {
    val listState = rememberLazyListState()

    LaunchedEffect(highlightedNewsId, articles) {
        val targetIndex = articles.indexOfFirst { article -> article.id == highlightedNewsId }
        if (targetIndex >= 0) {
            listState.animateScrollToItem(targetIndex)
        }
    }

    Box(modifier = Modifier.fillMaxSize()) {
        LazyColumn(
            state = listState,
            modifier = Modifier
                .fillMaxSize(),
            verticalArrangement = Arrangement.spacedBy(16.dp),
            contentPadding = PaddingValues(bottom = if (isAdmin) 128.dp else 0.dp),
        ) {
            if (isLoading) {
                item {
                    Text(
                        text = stringResource(R.string.news_loading),
                        style = MaterialTheme.typography.bodyMedium,
                    )
                }
            } else if (articles.isEmpty()) {
                item {
                    Text(
                        text = stringResource(R.string.news_empty_state),
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            } else {
                itemsIndexed(
                    items = articles,
                    key = { _, article -> article.id },
                ) { index, article ->
                    ReguertaListItemCard(isHighlighted = highlightedNewsId == article.id) {
                        NewsArticleSummaryRow(
                            article = article,
                            index = index,
                            metaText = stringResource(R.string.news_meta_format, article.publishedBy),
                            isAdmin = isAdmin,
                            bodyMaxLines = Int.MAX_VALUE,
                            onEditNews = onEditNews,
                            onRequestDeleteNews = onRequestDeleteNews,
                        )
                    }
                }
            }
        }

        if (isAdmin) {
            ReguertaFloatingActionButton(
                label = stringResource(R.string.news_create_action),
                modifier = Modifier.align(Alignment.BottomCenter),
                onClick = onCreateNews,
            )
        }
    }
}

@Composable
private fun NewsArticleSummaryRow(
    article: NewsArticle,
    index: Int,
    metaText: String?,
    isAdmin: Boolean,
    bodyMaxLines: Int,
    onEditNews: (String) -> Unit,
    onRequestDeleteNews: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    val imageUrl = article.urlImage?.trim().orEmpty()
    val imageOnStart = index % 2 == 1
    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.Top,
        ) {
            if (imageOnStart && imageUrl.isNotBlank()) {
                NewsArticleImage(imageUrl = imageUrl)
            }
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                Text(
                    text = article.title,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                )
                metaText?.let {
                    Text(
                        text = it,
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
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
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = bodyMaxLines,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            if (!imageOnStart && imageUrl.isNotBlank()) {
                NewsArticleImage(imageUrl = imageUrl)
            }
        }

        if (isAdmin) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.End,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                ReguertaEditListActionButton(
                    contentDescription = stringResource(R.string.news_edit_action),
                    onClick = { onEditNews(article.id) },
                )
                Spacer(modifier = Modifier.size(8.dp))
                ReguertaDeleteListActionButton(
                    contentDescription = stringResource(R.string.news_delete_action),
                    onClick = { onRequestDeleteNews(article.id) },
                )
            }
        }
    }
}

@Composable
private fun NewsArticleImage(imageUrl: String) {
    AsyncImage(
        model = imageUrl,
        contentDescription = null,
        modifier = Modifier
            .size(112.dp)
            .clip(MaterialTheme.shapes.medium),
        contentScale = ContentScale.Crop,
    )
}

@Composable
fun LatestNewsSummaryRows(
    news: List<NewsArticle>,
) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        news.forEachIndexed { index, article ->
            ReguertaListItemCard {
                NewsArticleSummaryRow(
                    article = article,
                    index = index,
                    metaText = null,
                    isAdmin = false,
                    bodyMaxLines = 3,
                    onEditNews = {},
                    onRequestDeleteNews = {},
                )
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
    onSave: () -> Unit,
) {
    val focusManager = LocalFocusManager.current
    Box(
        modifier = Modifier
            .fillMaxSize()
            .imePadding(),
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .navigationBarsPadding()
                .padding(bottom = 112.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(
                text = stringResource(R.string.news_field_title),
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            OutlinedTextField(
                value = draft.title,
                onValueChange = { onDraftChanged(draft.copy(title = it)) },
                modifier = Modifier.fillMaxWidth(),
                enabled = !isSaving,
                singleLine = true,
            )
            Text(
                text = stringResource(R.string.news_field_body),
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            OutlinedTextField(
                value = draft.body,
                onValueChange = { onDraftChanged(draft.copy(body = it)) },
                modifier = Modifier.fillMaxWidth(),
                minLines = 6,
                enabled = !isSaving,
            )
            ReguertaImagePickerField(
                imageUrl = draft.urlImage,
                isUploading = isUploadingImage,
                onPickImage = onPickImage,
                onClearImage = onClearImage,
                placeholderIcon = Icons.Default.Image,
                actionsBesideImage = true,
            )
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Text(text = stringResource(R.string.news_field_active))
                Switch(
                    checked = !draft.active,
                    onCheckedChange = { archived -> onDraftChanged(draft.copy(active = !archived)) },
                    enabled = !isSaving,
                )
            }
        }
        ReguertaFloatingActionButton(
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
            modifier = Modifier.align(Alignment.BottomCenter),
            enabled = !isSaving && !isUploadingImage,
            loading = isSaving,
        )
    }
}

@Composable
fun NotificationsFeedRoute(
    notificationItems: List<NotificationFeedItem>,
    isLoading: Boolean,
) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        if (isLoading) {
            Text(
                text = stringResource(R.string.notifications_loading),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        } else if (notificationItems.isEmpty()) {
            Text(
                text = stringResource(R.string.notifications_empty_state),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.error,
            )
        } else {
            notificationItems.forEach { item ->
                NotificationFeedItemCard(
                    item = item,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        }
    }
}

@Composable
private fun NotificationFeedItemCard(
    item: NotificationFeedItem,
    modifier: Modifier = Modifier,
) {
    val event = item.notification
    val containerColor = if (item.isRead) {
        MaterialTheme.colorScheme.primary.copy(alpha = 0.15f)
    } else {
        ColorFeedbackWarningDefault.copy(alpha = 0.15f)
    }

    Column(
        modifier = modifier,
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text(
            text = event.sentAtMillis.toNotificationDateLabel(),
            modifier = Modifier.fillMaxWidth(),
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = containerColor),
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(
                        imageVector = event.notificationIcon(),
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.onSurface,
                    )
                    Text(
                        text = event.title,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold,
                        color = MaterialTheme.colorScheme.onSurface,
                    )
                }
                Text(
                    text = event.body,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurface,
                )
            }
        }
    }
}

private fun NotificationEvent.notificationIcon(): ImageVector =
    when (type) {
        "order_reminder", "order_auto_generated" -> Icons.Filled.ShoppingCart
        "shift_swap_requested", "shift_swap_accepted", "shift_swap_applied" -> Icons.Filled.SwapHoriz
        "shift_updated" -> Icons.Filled.CalendarToday
        "news_published" -> Icons.AutoMirrored.Filled.Article
        "admin_broadcast" -> Icons.Filled.Campaign
        else -> Icons.Filled.Notifications
    }

@Composable
fun NotificationEditorRoute(
    draft: NotificationDraft,
    isSending: Boolean,
    onDraftChanged: (NotificationDraft) -> Unit,
    onSend: () -> Unit,
) {
    val focusManager = LocalFocusManager.current
    Box(
        modifier = Modifier
            .fillMaxSize()
            .imePadding(),
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .navigationBarsPadding()
                .padding(bottom = 112.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(
                text = stringResource(R.string.notifications_field_title),
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            OutlinedTextField(
                value = draft.title,
                onValueChange = { onDraftChanged(draft.copy(title = it)) },
                modifier = Modifier.fillMaxWidth(),
                enabled = !isSending,
            )
            Text(
                text = stringResource(R.string.notifications_field_body),
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            OutlinedTextField(
                value = draft.body,
                onValueChange = { onDraftChanged(draft.copy(body = it)) },
                modifier = Modifier.fillMaxWidth(),
                minLines = 5,
                enabled = !isSending,
            )
            NotificationAudiencePicker(
                selectedAudience = draft.audience,
                enabled = !isSending,
                onAudienceSelected = { audience -> onDraftChanged(draft.copy(audience = audience)) },
            )
        }
        ReguertaFloatingActionButton(
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
            loading = isSending,
            modifier = Modifier.align(Alignment.BottomCenter),
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun NotificationAudiencePicker(
    selectedAudience: NotificationAudience,
    enabled: Boolean,
    onAudienceSelected: (NotificationAudience) -> Unit,
) {
    var isExpanded by rememberSaveable { mutableStateOf(false) }
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(
            text = stringResource(R.string.notifications_field_audience),
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        ExposedDropdownMenuBox(
            expanded = isExpanded,
            onExpandedChange = {
                if (enabled) {
                    isExpanded = !isExpanded
                }
            },
        ) {
            OutlinedTextField(
                value = stringResource(selectedAudience.labelRes()),
                onValueChange = {},
                modifier = Modifier
                    .menuAnchor(ExposedDropdownMenuAnchorType.PrimaryNotEditable)
                    .fillMaxWidth(),
                readOnly = true,
                enabled = enabled,
                trailingIcon = {
                    ExposedDropdownMenuDefaults.TrailingIcon(expanded = isExpanded)
                },
            )
            ExposedDropdownMenu(
                expanded = isExpanded,
                onDismissRequest = { isExpanded = false },
            ) {
                NotificationAudience.values().forEach { audience ->
                    DropdownMenuItem(
                        text = { Text(stringResource(audience.labelRes())) },
                        onClick = {
                            onAudienceSelected(audience)
                            isExpanded = false
                        },
                    )
                }
            }
        }
    }
}
