package com.reguerta.user.data.media

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Test

class ImagePipelineSizingContractTest {
    @Test
    fun `scaled dimensions make short side exactly 300 for landscape`() {
        val scaled = ImagePipelineSizingContract.scaledDimensions(
            sourceWidth = 1200,
            sourceHeight = 800,
            targetShortSidePx = 300,
        )

        assertNotNull(scaled)
        assertEquals(450, scaled?.width)
        assertEquals(300, scaled?.height)
    }

    @Test
    fun `scaled dimensions make short side exactly 300 for portrait`() {
        val scaled = ImagePipelineSizingContract.scaledDimensions(
            sourceWidth = 800,
            sourceHeight = 1600,
            targetShortSidePx = 300,
        )

        assertNotNull(scaled)
        assertEquals(300, scaled?.width)
        assertEquals(600, scaled?.height)
    }

    @Test
    fun `center crop square is centered on long side`() {
        val croppedFromLandscape = ImagePipelineSizingContract.centerCropSquare(
            sourceWidth = 450,
            sourceHeight = 300,
            targetSidePx = 300,
        )
        assertNotNull(croppedFromLandscape)
        assertEquals(75, croppedFromLandscape?.left)
        assertEquals(0, croppedFromLandscape?.top)
        assertEquals(300, croppedFromLandscape?.size)

        val croppedFromPortrait = ImagePipelineSizingContract.centerCropSquare(
            sourceWidth = 300,
            sourceHeight = 600,
            targetSidePx = 300,
        )
        assertNotNull(croppedFromPortrait)
        assertEquals(0, croppedFromPortrait?.left)
        assertEquals(150, croppedFromPortrait?.top)
        assertEquals(300, croppedFromPortrait?.size)
    }
}
