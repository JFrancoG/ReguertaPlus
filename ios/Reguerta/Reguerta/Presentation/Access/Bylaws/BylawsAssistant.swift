import Foundation

enum BylawsAnswerMode: Equatable, Sendable {
    case local
    case cloud
    case fallback
}

struct BylawsDecisionTrace: Equatable, Sendable {
    let shouldEscalate: Bool
    let reasons: [String]
    let localCoverage: Double
    let localConfidence: Double
}

struct BylawsAnswerResult: Equatable, Sendable {
    let mode: BylawsAnswerMode
    let answer: String
    let citedPages: [Int]
    let trace: BylawsDecisionTrace
}

private struct BylawsKnowledgeIndex: Decodable {
    let chunks: [BylawsChunk]
}

private struct BylawsChunk: Decodable {
    let id: String
    let pageStart: Int
    let pageEnd: Int
    let title: String
    let text: String
}

private struct RankedChunk {
    let chunk: BylawsChunk
    let score: Double
    let coverage: Double
}

private struct LocalMatch {
    let answer: String
    let context: String
    let pages: [Int]
    let coverage: Double
    let confidence: Double
}

@MainActor
private final class BylawsKnowledgeStore {
    static let shared = BylawsKnowledgeStore()

    private var cached: [BylawsChunk]?

    func chunks() -> [BylawsChunk] {
        if let cached {
            return cached
        }

        guard
            let url = resolveBundledBylawsURL(fileName: "bylaws-index-es", fileExtension: "json"),
            let data = try? Data(contentsOf: url),
            let index = try? JSONDecoder().decode(BylawsKnowledgeIndex.self, from: data)
        else {
            cached = []
            return []
        }

        cached = index.chunks
        return index.chunks
    }
}

private struct BylawsCloudAnswer: Sendable {
    let answer: String
    let pages: [Int]
}

private struct BylawsCloudGateway {
    let endpointURL: URL?

    init(endpoint: String = "") {
        let trimmed = endpoint.trimmingCharacters(in: .whitespacesAndNewlines)
        endpointURL = trimmed.isEmpty ? nil : URL(string: trimmed)
    }

    func requestAnswer(
        question: String,
        localContext: String,
        modelId: String,
        timeoutSeconds: TimeInterval
    ) async -> BylawsCloudAnswer? {
        guard let endpointURL else { return nil }

        var request = URLRequest(url: endpointURL, timeoutInterval: timeoutSeconds)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        let body: [String: Any] = [
            "question": question,
            "context": localContext,
            "language": "es",
            "model": modelId
        ]
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)

        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse, 200 ... 299 ~= http.statusCode else {
                return nil
            }
            guard
                let payload = try JSONSerialization.jsonObject(with: data) as? [String: Any],
                let answer = (payload["answer"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines),
                !answer.isEmpty
            else {
                return nil
            }

            var pages: [Int] = []
            if let numericPages = payload["pages"] as? [NSNumber] {
                pages = numericPages.map(\.intValue)
            } else if let citations = payload["citations"] as? [[String: Any]] {
                pages = citations.compactMap { $0["pageStart"] as? Int }
            }

            return BylawsCloudAnswer(answer: answer, pages: Array(Set(pages)).sorted())
        } catch {
            return nil
        }
    }
}

struct BylawsAssistant {
    let localModelId: String
    let cloudTimeoutSeconds: TimeInterval
    private let cloudGateway: BylawsCloudGateway

    init(
        localModelId: String = "google/gemma-4-e2b",
        cloudTimeoutSeconds: TimeInterval = 8,
        cloudEndpoint: String = BylawsRuntimeConfig.cloudEndpoint
    ) {
        self.localModelId = localModelId
        self.cloudTimeoutSeconds = cloudTimeoutSeconds
        self.cloudGateway = BylawsCloudGateway(endpoint: cloudEndpoint)
    }

    func ask(question: String) async -> BylawsAnswerResult {
        let chunks = await MainActor.run { BylawsKnowledgeStore.shared.chunks() }
        guard let localMatch = resolveLocalMatch(question: question, chunks: chunks) else {
            let trace = BylawsDecisionTrace(
                shouldEscalate: true,
                reasons: ["sin_cobertura_local"],
                localCoverage: 0,
                localConfidence: 0
            )
            return BylawsAnswerResult(
                mode: .fallback,
                answer: fallbackAnswer(question: question, localAnswer: nil),
                citedPages: [],
                trace: trace
            )
        }

        let trace = evaluateEscalation(question: question, localMatch: localMatch)
        if !trace.shouldEscalate {
            return BylawsAnswerResult(
                mode: .local,
                answer: localMatch.answer,
                citedPages: localMatch.pages,
                trace: trace
            )
        }

        let cloudAnswer = await cloudGateway.requestAnswer(
            question: question,
            localContext: localMatch.context,
            modelId: localModelId,
            timeoutSeconds: cloudTimeoutSeconds
        )
        if let cloudAnswer {
            return BylawsAnswerResult(
                mode: .cloud,
                answer: cloudAnswer.answer,
                citedPages: cloudAnswer.pages.isEmpty ? localMatch.pages : cloudAnswer.pages,
                trace: trace
            )
        }

        return BylawsAnswerResult(
            mode: .fallback,
            answer: fallbackAnswer(question: question, localAnswer: localMatch.answer),
            citedPages: localMatch.pages,
            trace: trace
        )
    }

    @MainActor
    func bundledPdfURL() -> URL? {
        resolveBundledBylawsURL(fileName: "reguerta-estatutos", fileExtension: "pdf")
    }
}

private enum BylawsRuntimeConfig {
    static var cloudEndpoint: String {
        if let fromEnvironment = ProcessInfo.processInfo.environment["BYLAWS_CLOUD_ENDPOINT"] {
            let trimmed = fromEnvironment.trimmingCharacters(in: .whitespacesAndNewlines)
            if !trimmed.isEmpty { return trimmed }
        }
        if let fromInfo = Bundle.main.object(forInfoDictionaryKey: "BYLAWS_CLOUD_ENDPOINT") as? String {
            let trimmed = fromInfo.trimmingCharacters(in: .whitespacesAndNewlines)
            if !trimmed.isEmpty { return trimmed }
        }
        return ""
    }
}

@MainActor
private func resolveBundledBylawsURL(fileName: String, fileExtension: String) -> URL? {
    let subdirectories = ["bylaws", "Resources/bylaws", "Resources"]
    for subdirectory in subdirectories {
        if let url = Bundle.main.url(forResource: fileName, withExtension: fileExtension, subdirectory: subdirectory) {
            return url
        }
    }
    return Bundle.main.url(forResource: fileName, withExtension: fileExtension)
}

private extension BylawsAssistant {
    func fallbackAnswer(question: String, localAnswer: String?) -> String {
        let guidance = "No he podido completar el escalado a nube en este momento. Abre el PDF completo para validar el detalle jurídico."
        guard let localAnswer, !localAnswer.isEmpty else {
            return "Pregunta: \"\(question)\". \(guidance)"
        }
        return "\(localAnswer)\n\n\(guidance)"
    }

    func evaluateEscalation(question: String, localMatch: LocalMatch) -> BylawsDecisionTrace {
        var reasons: [String] = []
        if localMatch.coverage < 0.45 { reasons.append("cobertura_baja") }
        if localMatch.confidence < 0.12 { reasons.append("confianza_baja") }
        if isComplexIntent(question) { reasons.append("intencion_compleja") }
        if isExplicitDeepRequest(question) { reasons.append("solicitud_explicita_profunda") }

        return BylawsDecisionTrace(
            shouldEscalate: !reasons.isEmpty,
            reasons: reasons,
            localCoverage: localMatch.coverage,
            localConfidence: localMatch.confidence
        )
    }

    func resolveLocalMatch(question: String, chunks: [BylawsChunk]) -> LocalMatch? {
        let terms = tokenize(question).filter { !Self.stopWords.contains($0) }
        let uniqueTerms = Array(Set(terms)).sorted()
        guard !uniqueTerms.isEmpty else { return nil }

        let ranked: [RankedChunk] = chunks.compactMap { chunk in
            let lowered = chunk.text.lowercased()
            let overlap = uniqueTerms.filter { lowered.contains($0) }.count
            guard overlap > 0 else { return nil }
            let coverage = Double(overlap) / Double(uniqueTerms.count)
            let phraseBonus = lowered.contains(question.lowercased()) ? 0.2 : 0
            let titleBonus = uniqueTerms.contains(where: { chunk.title.lowercased().contains($0) }) ? 0.15 : 0
            return RankedChunk(
                chunk: chunk,
                score: coverage + phraseBonus + titleBonus,
                coverage: coverage
            )
        }
        .sorted { $0.score > $1.score }

        guard let first = ranked.first else { return nil }
        let secondScore = ranked.dropFirst().first?.score ?? 0
        let confidence = max(0, first.score - secondScore)

        let pages = Array(Set(ranked.prefix(3).map { $0.chunk.pageStart })).sorted()
        let context = ranked.prefix(3).map {
            "Página \($0.chunk.pageStart) - \($0.chunk.title)\n\($0.chunk.text)"
        }.joined(separator: "\n\n")

        let answer = buildLocalAnswer(primary: first.chunk, secondary: ranked.dropFirst().first?.chunk)
        return LocalMatch(
            answer: answer,
            context: context,
            pages: pages,
            coverage: first.coverage,
            confidence: confidence
        )
    }

    func buildLocalAnswer(primary: BylawsChunk, secondary: BylawsChunk?) -> String {
        let main = trimSnippet(primary.text)
        var answer = "Según \(primary.title) (página \(primary.pageStart)): \(main)"
        if let secondary {
            answer += "\n\nTambién puede ayudarte revisar \(secondary.title) (página \(secondary.pageStart)): \(trimSnippet(secondary.text))"
        }
        return answer
    }

    func trimSnippet(_ text: String, maxLength: Int = 480) -> String {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmed.count > maxLength else { return trimmed }
        let cut = String(trimmed.prefix(maxLength))
        if let idx = cut.lastIndex(where: { ".;:".contains($0) }), cut.distance(from: cut.startIndex, to: idx) > 200 {
            return String(cut[...idx])
        }
        return "\(cut)…"
    }

    func isComplexIntent(_ question: String) -> Bool {
        let normalized = question.lowercased()
        if tokenize(normalized).count >= 18 { return true }
        return Self.complexityHints.contains(where: { normalized.contains($0) })
    }

    func isExplicitDeepRequest(_ question: String) -> Bool {
        let normalized = question.lowercased()
        return Self.deepRequestHints.contains(where: { normalized.contains($0) })
    }

    func tokenize(_ text: String) -> [String] {
        let regex = try? NSRegularExpression(pattern: "[\\p{L}\\p{N}]+")
        let range = NSRange(text.startIndex..., in: text)
        return regex?.matches(in: text, range: range).compactMap { match in
            guard let range = Range(match.range, in: text) else { return nil }
            return String(text[range]).lowercased()
        } ?? []
    }

    static let complexityHints: [String] = [
        "compar", "diferenc", "paso a paso", "procedimiento",
        "excepcion", "extraordinaria", "revocar", "mayoria", "quorum", "si dimite"
    ]
    static let deepRequestHints: [String] = [
        "explica", "en detalle", "a fondo", "analiza", "razona", "justifica"
    ]
    static let stopWords: Set<String> = [
        "de", "la", "el", "los", "las", "un", "una", "unos", "unas", "y", "o",
        "que", "se", "del", "al", "en", "para", "por", "con", "sin", "como",
        "es", "son", "ser", "que", "cual", "cuales", "puede", "pueden", "hay",
        "hacer", "hace", "sobre", "si", "mas", "menos", "a", "lo", "le", "les",
        "su", "sus", "mi", "mis"
    ]
}
