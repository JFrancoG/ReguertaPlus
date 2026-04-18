package com.reguerta.user.data.media

import kotlin.math.roundToInt

internal data class PixelSize(
    val width: Int,
    val height: Int,
)

internal data class CropSquare(
    val left: Int,
    val top: Int,
    val size: Int,
)

internal object ImagePipelineSizingContract {
    fun scaledDimensions(
        sourceWidth: Int,
        sourceHeight: Int,
        targetShortSidePx: Int,
    ): PixelSize? {
        if (sourceWidth <= 0 || sourceHeight <= 0 || targetShortSidePx <= 0) return null
        val shortSide = minOf(sourceWidth, sourceHeight).toFloat()
        val scale = targetShortSidePx.toFloat() / shortSide
        val scaledWidth = (sourceWidth * scale).roundToInt().coerceAtLeast(targetShortSidePx)
        val scaledHeight = (sourceHeight * scale).roundToInt().coerceAtLeast(targetShortSidePx)
        return PixelSize(
            width = scaledWidth,
            height = scaledHeight,
        )
    }

    fun centerCropSquare(
        sourceWidth: Int,
        sourceHeight: Int,
        targetSidePx: Int,
    ): CropSquare? {
        if (sourceWidth < targetSidePx || sourceHeight < targetSidePx || targetSidePx <= 0) return null
        val left = ((sourceWidth - targetSidePx) / 2).coerceAtLeast(0)
        val top = ((sourceHeight - targetSidePx) / 2).coerceAtLeast(0)
        return CropSquare(
            left = left,
            top = top,
            size = targetSidePx,
        )
    }
}
