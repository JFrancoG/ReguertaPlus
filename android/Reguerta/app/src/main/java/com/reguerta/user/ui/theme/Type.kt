package com.reguerta.user.ui.theme

import androidx.compose.material3.Typography
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import com.reguerta.user.R

private val CabinSketch = FontFamily(
    Font(R.font.cabin_sketch_regular, FontWeight.Normal),
    Font(R.font.cabin_sketch_bold, FontWeight.Bold),
)

internal fun reguertaTypography(scale: Float = 1f): Typography {
    val safeScale = scale.coerceIn(0.9f, 1.2f)
    return Typography(
        displayLarge = TextStyle(
            fontFamily = CabinSketch,
            fontWeight = FontWeight.Bold,
            fontSize = (32f * safeScale).sp,
            lineHeight = (38f * safeScale).sp,
        ),
        headlineSmall = TextStyle(
            fontFamily = CabinSketch,
            fontWeight = FontWeight.Bold,
            fontSize = (24f * safeScale).sp,
            lineHeight = (30f * safeScale).sp,
        ),
        headlineMedium = TextStyle(
            fontFamily = CabinSketch,
            fontWeight = FontWeight.Bold,
            fontSize = (22f * safeScale).sp,
            lineHeight = (28f * safeScale).sp,
        ),
        titleLarge = TextStyle(
            fontFamily = CabinSketch,
            fontWeight = FontWeight.SemiBold,
            fontSize = (20f * safeScale).sp,
            lineHeight = (26f * safeScale).sp,
        ),
        titleMedium = TextStyle(
            fontFamily = CabinSketch,
            fontWeight = FontWeight.SemiBold,
            fontSize = (18f * safeScale).sp,
            lineHeight = (24f * safeScale).sp,
        ),
        bodyLarge = TextStyle(
            fontFamily = CabinSketch,
            fontWeight = FontWeight.Normal,
            fontSize = (16f * safeScale).sp,
            lineHeight = (22f * safeScale).sp,
        ),
        bodyMedium = TextStyle(
            fontFamily = CabinSketch,
            fontWeight = FontWeight.Normal,
            fontSize = (14f * safeScale).sp,
            lineHeight = (20f * safeScale).sp,
        ),
        bodySmall = TextStyle(
            fontFamily = CabinSketch,
            fontWeight = FontWeight.Normal,
            fontSize = (12f * safeScale).sp,
            lineHeight = (16f * safeScale).sp,
        ),
        labelLarge = TextStyle(
            fontFamily = CabinSketch,
            fontWeight = FontWeight.Medium,
            fontSize = (14f * safeScale).sp,
            lineHeight = (18f * safeScale).sp,
        ),
    )
}
