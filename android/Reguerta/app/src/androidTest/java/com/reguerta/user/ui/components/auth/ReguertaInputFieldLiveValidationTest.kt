package com.reguerta.user.ui.components.auth

import androidx.compose.foundation.layout.Column
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.reguerta.user.ui.theme.ReguertaTheme
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class ReguertaInputFieldLiveValidationTest {
    @get:Rule
    val composeRule = createComposeRule()

    @Test
    fun acceptedSubmissionClearsSecretWithoutShowingAValidationError() {
        val errorMessage = "Password must be valid"

        composeRule.setContent {
            var password by remember { mutableStateOf("valid-pass") }
            var validationRevision by remember { mutableStateOf(0) }

            ReguertaTheme {
                Column {
                    ReguertaInputField(
                        label = "Password",
                        value = password,
                        onValueChange = { password = it },
                        liveValidationErrorMessage = errorMessage,
                        liveValidation = { it.length >= 6 },
                        liveValidationRevision = validationRevision,
                    )
                    Button(
                        onClick = {
                            password = ""
                            validationRevision += 1
                        },
                    ) {
                        Text("Accept submission")
                    }
                }
            }
        }

        composeRule.onNodeWithText("valid-pass").performClick()
        composeRule.onNodeWithText("Accept submission").performClick()
        composeRule.onAllNodesWithText(errorMessage).assertCountEquals(0)
    }
}
