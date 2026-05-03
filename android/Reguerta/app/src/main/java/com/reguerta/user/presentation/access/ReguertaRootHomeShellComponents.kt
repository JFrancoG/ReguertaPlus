package com.reguerta.user.presentation.access

import androidx.compose.foundation.background
import androidx.compose.foundation.Image
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Article
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.AccountCircle
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.CalendarToday
import androidx.compose.material.icons.filled.Campaign
import androidx.compose.material.icons.filled.Group
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Inbox
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.PictureAsPdf
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.ShoppingCart
import androidx.compose.material.icons.filled.Storefront
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import com.reguerta.user.R
import com.reguerta.user.domain.access.Member
import com.reguerta.user.domain.access.canAccessReceivedOrders
import com.reguerta.user.domain.access.canManageMembers
import com.reguerta.user.domain.access.canManageProductCatalog
import com.reguerta.user.domain.access.canPublishNews
import com.reguerta.user.domain.access.canSendAdminNotifications
import com.reguerta.user.domain.calendar.DeliveryCalendarOverride
import com.reguerta.user.domain.news.NewsArticle
import com.reguerta.user.domain.profiles.SharedProfile
import com.reguerta.user.domain.shifts.ShiftAssignment
import com.reguerta.user.ui.components.auth.ReguertaFlatButton

@Composable
fun HomeShellTopBar(
    title: String,
    canNavigateBack: Boolean,
    hasNotificationIndicator: Boolean,
    onBack: () -> Unit,
    onOpenMenu: () -> Unit,
    onOpenNotifications: () -> Unit,
) {
    Card {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 10.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = if (canNavigateBack) onBack else onOpenMenu) {
                Icon(
                    imageVector = if (canNavigateBack) Icons.AutoMirrored.Filled.ArrowBack else Icons.Filled.Menu,
                    contentDescription = if (canNavigateBack) {
                        stringResource(R.string.common_action_back)
                    } else {
                        stringResource(R.string.home_shell_menu)
                    },
                )
            }

            Text(
                text = title,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
            )

            Box(contentAlignment = Alignment.TopEnd) {
                IconButton(onClick = onOpenNotifications) {
                Icon(
                    imageVector = Icons.Filled.Notifications,
                    contentDescription = stringResource(R.string.home_shell_notifications),
                )
                }
                if (hasNotificationIndicator) {
                    Box(
                        modifier = Modifier
                            .padding(top = 9.dp, end = 9.dp)
                            .size(9.dp)
                            .clip(CircleShape)
                            .background(MaterialTheme.colorScheme.error),
                    )
                }
            }
        }
    }
}

@Composable
fun HomeDrawerContent(
    member: Member?,
    sharedProfile: SharedProfile?,
    currentDestination: HomeDestination,
    installedVersion: String,
    isDevelopBuild: Boolean,
    onNavigate: (HomeDestination) -> Unit,
    onCloseDrawer: () -> Unit,
    onSignOut: () -> Unit,
) {
    val drawerScrollState = rememberScrollState()
    val canManageMembers = member?.canManageMembers == true
    val canPublishNews = member?.canPublishNews == true
    val canSendAdminNotifications = member?.canSendAdminNotifications == true

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp, vertical = 20.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.Start,
        ) {
            IconButton(
                onClick = onCloseDrawer,
                modifier = Modifier.size(36.dp),
            ) {
                Icon(
                    imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                    contentDescription = stringResource(R.string.common_action_back),
                )
            }
        }

        Column(
            modifier = Modifier.fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            HomeDrawerAvatar(sharedProfile = sharedProfile)
            if (member != null) {
                Text(
                    text = sharedProfile?.familyNames?.takeIf(String::isNotBlank) ?: member.displayName,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    text = member.normalizedEmail,
                    style = MaterialTheme.typography.bodySmall,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }

        Column(
            modifier = Modifier
                .weight(1f, fill = true)
                .verticalScroll(drawerScrollState),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            HomeDrawerItem(
                icon = Icons.Filled.Home,
                label = stringResource(R.string.home_title),
                selected = currentDestination == HomeDestination.DASHBOARD,
                onClick = { onNavigate(HomeDestination.DASHBOARD) },
            )
            HomeDrawerItem(
                icon = Icons.Filled.ShoppingCart,
                label = stringResource(R.string.module_my_order),
                selected = currentDestination == HomeDestination.MY_ORDER,
                onClick = { onNavigate(HomeDestination.MY_ORDER) },
            )
            HomeDrawerItem(
                icon = Icons.AutoMirrored.Filled.Article,
                label = stringResource(R.string.module_my_orders),
                selected = currentDestination == HomeDestination.MY_ORDERS,
                onClick = { onNavigate(HomeDestination.MY_ORDERS) },
            )
            HomeDrawerItem(
                icon = Icons.Filled.CalendarToday,
                label = stringResource(R.string.module_shifts),
                selected = currentDestination == HomeDestination.SHIFTS,
                onClick = { onNavigate(HomeDestination.SHIFTS) },
            )
            HomeDrawerItem(
                icon = Icons.Filled.PictureAsPdf,
                label = stringResource(R.string.home_shell_action_bylaws),
                selected = currentDestination == HomeDestination.BYLAWS,
                onClick = { onNavigate(HomeDestination.BYLAWS) },
            )
            HomeDrawerItem(
                icon = Icons.AutoMirrored.Filled.Article,
                label = stringResource(R.string.home_shell_news_title),
                selected = currentDestination == HomeDestination.NEWS,
                onClick = { onNavigate(HomeDestination.NEWS) },
            )
            HomeDrawerItem(
                icon = Icons.Filled.Notifications,
                label = stringResource(R.string.home_shell_notifications),
                selected = currentDestination == HomeDestination.NOTIFICATIONS,
                onClick = { onNavigate(HomeDestination.NOTIFICATIONS) },
            )
            HomeDrawerItem(
                icon = Icons.Filled.Group,
                label = stringResource(R.string.home_shell_action_profile),
                selected = currentDestination == HomeDestination.PROFILE,
                onClick = { onNavigate(HomeDestination.PROFILE) },
            )
            HomeDrawerItem(
                icon = Icons.Filled.Settings,
                label = stringResource(R.string.home_shell_action_settings),
                selected = currentDestination == HomeDestination.SETTINGS,
                onClick = { onNavigate(HomeDestination.SETTINGS) },
            )

            if (member?.canManageProductCatalog == true || member?.canAccessReceivedOrders == true) {
                HomeDrawerDivider()
            }
            if (member?.canManageProductCatalog == true) {
                HomeDrawerItem(
                    icon = Icons.Filled.Storefront,
                    label = stringResource(R.string.home_shell_action_products),
                    selected = currentDestination == HomeDestination.PRODUCTS,
                    onClick = { onNavigate(HomeDestination.PRODUCTS) },
                )
            }
            if (member?.canAccessReceivedOrders == true) {
                HomeDrawerItem(
                    icon = Icons.Filled.Inbox,
                    label = stringResource(R.string.home_shell_action_received_orders),
                    selected = currentDestination == HomeDestination.RECEIVED_ORDERS,
                    onClick = { onNavigate(HomeDestination.RECEIVED_ORDERS) },
                )
            }

            if (canManageMembers || canPublishNews || canSendAdminNotifications) {
                HomeDrawerDivider()
                if (canManageMembers) {
                    HomeDrawerItem(
                        icon = Icons.Filled.Group,
                        label = stringResource(R.string.home_shell_action_users),
                        selected = currentDestination == HomeDestination.USERS,
                        onClick = { onNavigate(HomeDestination.USERS) },
                    )
                }
                if (canPublishNews) {
                    HomeDrawerItem(
                        icon = Icons.Filled.Add,
                        label = stringResource(R.string.home_shell_action_publish_news),
                        selected = currentDestination == HomeDestination.PUBLISH_NEWS,
                        onClick = { onNavigate(HomeDestination.PUBLISH_NEWS) },
                    )
                }
                if (canSendAdminNotifications) {
                    HomeDrawerItem(
                        icon = Icons.Filled.Campaign,
                        label = stringResource(R.string.home_shell_action_admin_broadcast),
                        selected = currentDestination == HomeDestination.ADMIN_BROADCAST,
                        onClick = { onNavigate(HomeDestination.ADMIN_BROADCAST) },
                    )
                }
            }
        }

        HorizontalDivider()
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clip(MaterialTheme.shapes.medium)
                .clickable(onClick = onSignOut)
                .padding(horizontal = 10.dp, vertical = 10.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(
                imageVector = Icons.AutoMirrored.Filled.Logout,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.primary,
            )
            Text(
                text = stringResource(R.string.access_action_sign_out),
                style = MaterialTheme.typography.bodyLarge,
                modifier = Modifier.weight(1f),
            )
        }
        HomeDrawerVersion(installedVersion = installedVersion, isDevelopBuild = isDevelopBuild)
    }
}

@Composable
private fun HomeDrawerAvatar(sharedProfile: SharedProfile?) {
    val photoUrl = sharedProfile?.photoUrl?.takeIf(String::isNotBlank)
    Box(
        modifier = Modifier
            .size(76.dp)
            .clip(CircleShape)
            .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.14f))
            .border(1.dp, MaterialTheme.colorScheme.primary.copy(alpha = 0.36f), CircleShape),
        contentAlignment = Alignment.Center,
    ) {
        if (photoUrl != null) {
            AsyncImage(
                model = photoUrl,
                contentDescription = stringResource(R.string.home_shell_profile_placeholder),
                modifier = Modifier.fillMaxSize(),
                contentScale = ContentScale.Crop,
            )
        } else {
            Image(
                painter = painterResource(R.drawable.reguerta_logo),
                contentDescription = stringResource(R.string.home_shell_profile_placeholder),
                modifier = Modifier.size(58.dp),
                contentScale = ContentScale.Fit,
            )
        }
    }
}

@Composable
private fun HomeDrawerDivider() {
    HorizontalDivider(
        modifier = Modifier.padding(vertical = 4.dp),
        color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.55f),
    )
}

@Composable
private fun HomeDrawerVersion(
    installedVersion: String,
    isDevelopBuild: Boolean,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = stringResource(R.string.home_shell_version_android_format, installedVersion.ifBlank { "0.0.0" }),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        if (isDevelopBuild) {
            Surface(
                color = MaterialTheme.colorScheme.tertiaryContainer,
                contentColor = MaterialTheme.colorScheme.onTertiaryContainer,
                shape = CircleShape,
            ) {
                Text(
                    text = stringResource(R.string.home_shell_dev_marker),
                    style = MaterialTheme.typography.labelSmall,
                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp),
                )
            }
        }
    }
}

@Composable
private fun HomeDrawerItem(
    icon: ImageVector,
    label: String,
    selected: Boolean = false,
    onClick: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(MaterialTheme.shapes.medium)
            .background(
                if (selected) MaterialTheme.colorScheme.primary.copy(alpha = 0.10f) else MaterialTheme.colorScheme.surface,
            )
            .clickable(onClick = onClick)
            .padding(horizontal = 10.dp, vertical = 10.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.primary,
        )
        Text(
            text = label,
            style = MaterialTheme.typography.bodyLarge,
            modifier = Modifier.weight(1f),
        )
    }
}

@Composable
fun NextShiftsCard(
    nextDeliveryShift: ShiftAssignment?,
    nextMarketShift: ShiftAssignment?,
    deliveryCalendarOverrides: List<DeliveryCalendarOverride>,
    isLoading: Boolean,
    members: List<Member>,
    onViewAll: () -> Unit,
) {
    Card {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(
                text = stringResource(R.string.shifts_next_title),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
            )
            Text(
                text = stringResource(R.string.shifts_next_subtitle),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            if (isLoading) {
                Text(
                    text = stringResource(R.string.shifts_loading),
                    style = MaterialTheme.typography.bodyMedium,
                )
            } else {
                ShiftSummaryRow(
                    label = stringResource(R.string.shifts_next_delivery),
                    shift = nextDeliveryShift,
                    overrides = deliveryCalendarOverrides,
                    members = members,
                )
                ShiftSummaryRow(
                    label = stringResource(R.string.shifts_next_market),
                    shift = nextMarketShift,
                    overrides = deliveryCalendarOverrides,
                    members = members,
                )
            }
            Button(onClick = onViewAll) {
                Text(text = stringResource(R.string.shifts_view_all))
            }
        }
    }
}

@Composable
private fun ShiftSummaryRow(
    label: String,
    shift: ShiftAssignment?,
    overrides: List<DeliveryCalendarOverride>,
    members: List<Member>,
) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.labelLarge,
            color = MaterialTheme.colorScheme.primary,
        )
        Text(
            text = shift?.toSummaryLine(members, overrides).orEmpty().ifBlank {
                stringResource(R.string.shifts_next_pending)
            },
            style = MaterialTheme.typography.bodyMedium,
        )
    }
}

@Composable
fun LatestNewsCard(
    news: List<NewsArticle>,
    onViewAll: () -> Unit,
) {
    Card {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Text(
                text = stringResource(R.string.home_shell_news_title),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
            )
            if (news.isEmpty()) {
                Text(
                    text = stringResource(R.string.news_empty_state),
                    style = MaterialTheme.typography.bodyMedium,
                )
            } else {
                news.forEach { article ->
                    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(
                            text = article.title,
                            style = MaterialTheme.typography.bodyLarge,
                            fontWeight = FontWeight.SemiBold,
                        )
                        Text(
                            text = article.body,
                            style = MaterialTheme.typography.bodySmall,
                            maxLines = 3,
                        )
                    }
                }
            }
            ReguertaFlatButton(
                label = stringResource(R.string.news_view_all),
                onClick = onViewAll,
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}
