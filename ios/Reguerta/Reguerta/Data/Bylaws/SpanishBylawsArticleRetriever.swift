import Foundation

nonisolated struct SpanishBylawsArticleRetriever: BylawsRetrieving {
    func retrieve(
        question: String,
        in articles: [BylawsArticle],
        maxResults: Int
    ) -> [BylawsRetrievedArticle] {
        guard maxResults > 0 else { return [] }

        let normalizedQuestion = normalize(question)
        let questionTokens = relevantTokens(in: normalizedQuestion)
        guard !questionTokens.isEmpty else { return [] }

        if let articleNumber = explicitArticleNumber(in: normalizedQuestion) {
            guard let article = articles.first(where: { $0.articleNumber == articleNumber }) else {
                return []
            }
            return [
                BylawsRetrievedArticle(
                    article: article,
                    score: 1_000,
                    excerpt: article.text
                )
            ]
        }

        let documentFrequency = Dictionary(uniqueKeysWithValues: questionTokens.map { token in
            let count = articles.count { article in
                searchableTokens(for: article).contains(token)
            }
            return (token, count)
        })

        return articles
            .compactMap { article -> BylawsRetrievedArticle? in
                guard let score = score(
                    article: article,
                    normalizedQuestion: normalizedQuestion,
                    questionTokens: questionTokens,
                    documentFrequency: documentFrequency
                ), score >= 20 else {
                    return nil
                }

                return BylawsRetrievedArticle(
                    article: article,
                    score: score,
                    excerpt: article.text
                )
            }
            .sorted { lhs, rhs in
                if lhs.score != rhs.score {
                    return lhs.score > rhs.score
                }
                if lhs.article.articleNumber != rhs.article.articleNumber {
                    return (lhs.article.articleNumber ?? .max) < (rhs.article.articleNumber ?? .max)
                }
                return lhs.article.id < rhs.article.id
            }
            .prefix(maxResults)
            .map { $0 }
    }

    private func score(
        article: BylawsArticle,
        normalizedQuestion: String,
        questionTokens: Set<String>,
        documentFrequency: [String: Int]
    ) -> Double? {
        var bestAliasScore = 0.0
        var hasStrongCuratedMatch = false

        for alias in article.searchAliases {
            let normalizedAlias = normalize(alias)
            let aliasTokens = relevantTokens(in: normalizedAlias)
            guard !aliasTokens.isEmpty else { continue }

            let overlapCount = aliasTokens.intersection(questionTokens).count
            guard overlapCount > 0 else { continue }

            let aliasCoverage = Double(overlapCount) / Double(aliasTokens.count)
            let questionCoverage = Double(overlapCount) / Double(questionTokens.count)
            let phraseBonus = normalizedQuestion.contains(normalizedAlias) ? 120.0 : 0.0
            let hasRareTerm = aliasTokens.intersection(questionTokens).contains { token in
                (documentFrequency[token] ?? .max) <= 3
            }
            guard phraseBonus > 0 || overlapCount >= 2 || hasRareTerm else { continue }
            hasStrongCuratedMatch = true
            let candidate = phraseBonus
                + aliasCoverage * 60
                + questionCoverage * 20
                + Double(overlapCount) * 6
            bestAliasScore = max(bestAliasScore, candidate)
        }

        let titleTokens = relevantTokens(in: normalize(article.title))
        let titleOverlapTokens = titleTokens.intersection(questionTokens)
        if titleOverlapTokens.count >= 2 || titleOverlapTokens.contains(where: { token in
            (documentFrequency[token] ?? .max) <= 3
        }) {
            hasStrongCuratedMatch = true
            bestAliasScore += Double(titleOverlapTokens.count) * 12
        }

        let bodyOverlapTokens = relevantTokens(in: normalize(article.text))
            .intersection(questionTokens)
        let rareBodyMatches = bodyOverlapTokens.filter { token in
            (documentFrequency[token] ?? .max) <= 2
        }
        let hasStrongBodyMatch = rareBodyMatches.count >= 2
            || (questionTokens.count == 1 && rareBodyMatches.count == 1)
        guard hasStrongCuratedMatch || hasStrongBodyMatch else { return nil }

        return bestAliasScore
            + Double(rareBodyMatches.count) * 18
            + Double(bodyOverlapTokens.count) * 2
    }

    private func searchableTokens(for article: BylawsArticle) -> Set<String> {
        relevantTokens(
            in: normalize(
                ([article.title] + article.searchAliases + [article.text])
                    .joined(separator: " ")
            )
        )
    }

    private func explicitArticleNumber(in normalizedQuestion: String) -> Int? {
        let words = normalizedQuestion.split(whereSeparator: \.isWhitespace).map(String.init)
        guard let index = words.firstIndex(of: "articulo"),
              words.indices.contains(index + 1)
        else { return nil }
        return Int(words[index + 1].filter(\.isNumber))
    }

    private func normalize(_ text: String) -> String {
        text
            .folding(
                options: [.caseInsensitive, .diacriticInsensitive],
                locale: Locale(identifier: "es_ES")
            )
            .unicodeScalars
            .map { CharacterSet.alphanumerics.contains($0) ? Character(String($0)) : " " }
            .reduce(into: "") { $0.append($1) }
            .split(whereSeparator: \.isWhitespace)
            .joined(separator: " ")
    }

    private func relevantTokens(in normalizedText: String) -> Set<String> {
        Set(
            normalizedText
                .split(whereSeparator: \.isWhitespace)
                .map(String.init)
                .filter { token in
                    token.count > 1 && !Self.stopWords.contains(token)
                }
                .map(stem)
        )
    }

    private func stem(_ token: String) -> String {
        var result = removingAttachedArticle(from: token)
        result = removingAdverbSuffix(from: result)
        result = singularizing(result)
        result = removingConditionalEnding(from: result)
        result = removingVerbEnding(from: result)
        return removingFinalVowel(from: result)
    }

    private func removingAttachedArticle(from token: String) -> String {
        for suffix in ["los", "las", "lo", "la"] where token.hasSuffix(suffix) {
            let candidate = String(token.dropLast(suffix.count))
            if candidate.count > 5, candidate.hasSuffix("r") {
                return candidate
            }
        }
        return token
    }

    private func removingAdverbSuffix(from token: String) -> String {
        var result = token
        if result.count > 8, result.hasSuffix("mente") {
            result.removeLast(5)
        }
        return result
    }

    private func singularizing(_ token: String) -> String {
        var result = token
        if result.count > 7, result.hasSuffix("ciones") {
            result.removeLast(5)
            result.append("cion")
        } else if result.count > 5, result.hasSuffix("es") {
            result.removeLast(2)
        } else if result.count > 4, result.hasSuffix("s") {
            result.removeLast()
        }
        return result
    }

    private func removingConditionalEnding(from token: String) -> String {
        var result = token
        if result.count > 7, result.hasSuffix("ara") {
            result.removeLast(3)
        } else if result.count > 6, result.hasSuffix("ia") {
            result.removeLast(2)
        }
        return result
    }

    private func removingVerbEnding(from token: String) -> String {
        var result = token
        if result.count > 7, result.hasSuffix("acion") {
            result.removeLast(5)
        } else if result.count > 6,
                  result.hasSuffix("ar") || result.hasSuffix("er") || result.hasSuffix("ir") {
            result.removeLast(2)
        }
        return result
    }

    private func removingFinalVowel(from token: String) -> String {
        var result = token
        if result.count > 5, let last = result.last, "aeio".contains(last) {
            result.removeLast()
        }
        return result
    }

    private static let stopWords: Set<String> = [
        "a", "al", "asociacion", "como", "con", "cual", "cuales", "de", "del",
        "dice", "dicen", "el", "en", "es", "esta", "estatuto", "estatutos", "haberlos", "hacer", "hace", "hay", "la",
        "las", "le", "les", "lo", "los", "mas", "mediante", "mi", "mis",
        "menciona", "mencionar", "no", "o", "organo", "para", "por", "poder", "puede", "pueden", "que", "reguerta",
        "se", "ser", "si", "sin", "sobre", "son", "su", "sus", "un", "una", "unos",
        "unas", "y"
    ]
}

nonisolated struct SpanishBylawsQuestionScopeClassifier: BylawsQuestionScopeClassifying {
    func classify(question: String) -> BylawsQuestionScope {
        let tokens = normalizedTokens(in: question)
        if !tokens.isDisjoint(with: Self.bylawsSignals) {
            return .potentiallyRelated
        }
        if isClearlyUnrelated(tokens: tokens) {
            return .clearlyUnrelated
        }
        return .potentiallyRelated
    }

    private func isClearlyUnrelated(tokens: Set<String>) -> Bool {
        if !tokens.isDisjoint(with: Self.foodSignals)
            || !tokens.isDisjoint(with: Self.entertainmentSignals)
            || !tokens.isDisjoint(with: Self.sportsSignals) {
            return true
        }
        if !tokens.isDisjoint(with: Self.weatherSignals) {
            return true
        }
        return tokens.contains("tiempo") && tokens.contains("manana")
    }

    private func normalizedTokens(in text: String) -> Set<String> {
        Set(
            text
                .folding(
                    options: [.caseInsensitive, .diacriticInsensitive],
                    locale: Locale(identifier: "es_ES")
                )
                .unicodeScalars
                .map { CharacterSet.alphanumerics.contains($0) ? Character(String($0)) : " " }
                .reduce(into: "") { $0.append($1) }
                .split(whereSeparator: \.isWhitespace)
                .map(String.init)
        )
    }

    private static let bylawsSignals: Set<String> = [
        "alta", "altas", "asamblea", "asociacion", "asociado", "asociados",
        "baja", "bajas", "cargo", "cargos", "comision", "coordinacion", "cuota",
        "cuotas", "deber", "deberes", "derecho", "derechos", "dimision", "dimitir",
        "disolucion", "eleccion", "elecciones", "estatuto", "estatutos", "fondos",
        "miembro", "miembros", "obligacion", "obligaciones", "patrimonio",
        "presupuesto", "presupuestos", "quorum", "rectora", "reglamento", "reguerta",
        "reunion", "secretaria", "socio", "socios", "tesoreria", "vocal", "vocales",
        "votacion", "votaciones"
    ]

    private static let foodSignals: Set<String> = [
        "bacalao", "cocina", "cocinar", "horno", "ingrediente", "ingredientes", "receta"
    ]
    private static let entertainmentSignals: Set<String> = [
        "actor", "actriz", "cine", "pelicula", "serie"
    ]
    private static let sportsSignals: Set<String> = [
        "futbol", "gol", "liga"
    ]
    private static let weatherSignals: Set<String> = [
        "clima", "lluvia", "temperatura"
    ]
}
