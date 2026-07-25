package com.reguerta.user.domain.bylaws

import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class PdfOnlyBylawsOnDeviceAssistantTest {
    @Test
    fun `production fallback never exposes generation without an evaluated model family`() = runTest {
        assertEquals(
            BylawsAssistantStatus.UNAVAILABLE,
            PdfOnlyBylawsOnDeviceAssistant.checkCapability().status,
        )
        assertEquals(false, PdfOnlyBylawsOnDeviceAssistant.checkCapability().canRetry)
        assertEquals(
            BylawsAssistantStatus.UNAVAILABLE,
            PdfOnlyBylawsOnDeviceAssistant.prepare().status,
        )
        assertNull(
            PdfOnlyBylawsOnDeviceAssistant.generate(
                BylawsGenerationRequest(question = "pregunta", evidence = emptyList()),
            ),
        )
    }
}
