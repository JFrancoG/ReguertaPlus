package com.reguerta.user.presentation.access

import com.reguerta.user.R

enum class HomeDestination {
    DASHBOARD,
    MY_ORDER,
    MY_ORDERS,
    SHIFTS,
    SHIFT_SWAP_REQUEST,
    NEWS,
    NOTIFICATIONS,
    PROFILE,
    SETTINGS,
    PRODUCTS,
    RECEIVED_ORDERS,
    USERS,
    PUBLISH_NEWS,
    ADMIN_BROADCAST,
}

internal fun HomeDestination.titleRes(): Int = when (this) {
    HomeDestination.DASHBOARD -> R.string.home_title
    HomeDestination.MY_ORDER -> R.string.module_my_order
    HomeDestination.MY_ORDERS -> R.string.module_my_orders
    HomeDestination.SHIFTS -> R.string.module_shifts
    HomeDestination.SHIFT_SWAP_REQUEST -> R.string.shift_swap_request_screen_title
    HomeDestination.NEWS -> R.string.home_shell_news_title
    HomeDestination.NOTIFICATIONS -> R.string.home_shell_notifications
    HomeDestination.PROFILE -> R.string.home_shell_action_profile
    HomeDestination.SETTINGS -> R.string.home_shell_action_settings
    HomeDestination.PRODUCTS -> R.string.home_shell_action_products
    HomeDestination.RECEIVED_ORDERS -> R.string.home_shell_action_received_orders
    HomeDestination.USERS -> R.string.home_shell_action_users
    HomeDestination.PUBLISH_NEWS -> R.string.home_shell_action_publish_news
    HomeDestination.ADMIN_BROADCAST -> R.string.home_shell_action_admin_broadcast
}

internal fun HomeDestination.subtitleRes(): Int = when (this) {
    HomeDestination.DASHBOARD -> R.string.home_placeholder_subtitle
    HomeDestination.MY_ORDER -> R.string.home_placeholder_my_order
    HomeDestination.MY_ORDERS -> R.string.home_placeholder_my_orders
    HomeDestination.SHIFTS -> R.string.home_placeholder_shifts
    HomeDestination.SHIFT_SWAP_REQUEST -> R.string.shift_swap_request_screen_subtitle
    HomeDestination.NEWS -> R.string.news_list_subtitle
    HomeDestination.NOTIFICATIONS -> R.string.notifications_list_subtitle
    HomeDestination.PROFILE -> R.string.home_placeholder_profile
    HomeDestination.SETTINGS -> R.string.home_placeholder_settings
    HomeDestination.PRODUCTS -> R.string.home_placeholder_products
    HomeDestination.RECEIVED_ORDERS -> R.string.home_placeholder_received_orders
    HomeDestination.USERS -> R.string.home_placeholder_users
    HomeDestination.PUBLISH_NEWS -> R.string.news_editor_subtitle
    HomeDestination.ADMIN_BROADCAST -> R.string.notifications_editor_subtitle
}
