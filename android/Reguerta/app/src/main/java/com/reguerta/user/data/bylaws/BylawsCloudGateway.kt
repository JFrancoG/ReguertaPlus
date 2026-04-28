package com.reguerta.user.data.bylaws

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

data class BylawsCloudAnswer(
    val answer: String,
    val citedPages: List<Int>,
)

class BylawsCloudGateway(
    private val endpointUrl: String,
) {
    suspend fun requestAnswer(
        question: String,
        localContext: String,
        modelId: String,
        timeoutMillis: Int,
    ): BylawsCloudAnswer? = withContext(Dispatchers.IO) {
        if (endpointUrl.isBlank()) return@withContext null

        val requestBody = JSONObject()
            .put("question", question)
            .put("context", localContext)
            .put("language", "es")
            .put("model", modelId)
            .toString()

        val connection = (URL(endpointUrl).openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = timeoutMillis
            readTimeout = timeoutMillis
            doOutput = true
            setRequestProperty("Content-Type", "application/json")
            setRequestProperty("Accept", "application/json")
        }

        try {
            connection.outputStream.use { output ->
                output.write(requestBody.toByteArray(Charsets.UTF_8))
            }

            if (connection.responseCode !in 200..299) {
                return@withContext null
            }

            val response = connection.inputStream.bufferedReader().use { it.readText() }
            val json = JSONObject(response)
            val answer = json.optString("answer").trim()
            if (answer.isEmpty()) return@withContext null

            val pages = mutableListOf<Int>()
            val pagesArray = json.optJSONArray("pages")
            if (pagesArray != null) {
                pages.addAll(parseIntArray(pagesArray))
            } else {
                val citationsArray = json.optJSONArray("citations")
                if (citationsArray != null) {
                    for (index in 0 until citationsArray.length()) {
                        val item = citationsArray.optJSONObject(index) ?: continue
                        val page = item.optInt("pageStart", -1)
                        if (page > 0) pages.add(page)
                    }
                }
            }

            BylawsCloudAnswer(
                answer = answer,
                citedPages = pages.distinct().sorted(),
            )
        } catch (_: Throwable) {
            null
        } finally {
            connection.disconnect()
        }
    }

    private fun parseIntArray(array: JSONArray): List<Int> {
        val output = mutableListOf<Int>()
        for (index in 0 until array.length()) {
            val value = array.optInt(index, -1)
            if (value > 0) output.add(value)
        }
        return output
    }
}
