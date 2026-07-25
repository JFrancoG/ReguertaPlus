package com.reguerta.user.data.bylaws

import com.reguerta.user.domain.bylaws.BylawsOnDeviceAssistant
import com.reguerta.user.domain.bylaws.PdfOnlyBylawsOnDeviceAssistant

/** Production remains PDF-only until a model family passes the Spanish evaluation dataset. */
fun createPlatformBylawsOnDeviceAssistant(): BylawsOnDeviceAssistant =
    PdfOnlyBylawsOnDeviceAssistant
