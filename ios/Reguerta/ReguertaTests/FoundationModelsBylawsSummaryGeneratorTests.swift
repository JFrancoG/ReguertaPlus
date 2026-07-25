import FoundationModels
import Testing

@testable import Reguerta

struct FoundationModelsBylawsSummaryGeneratorTests {
    @Test("Las instrucciones españolas fijan solo el idioma español")
    func spanishInstructionsSelectSpanish() {
        let instructions = FoundationModelsBylawsSummaryGenerator.instructions(for: .spanish)

        #expect(instructions.contains("The person's locale is es_ES."))
        #expect(instructions.contains("You MUST respond in Spanish"))
        #expect(!instructions.contains("You MUST respond in English"))
    }

    @Test("Las instrucciones inglesas fijan solo el idioma inglés")
    func englishInstructionsSelectEnglish() {
        let instructions = FoundationModelsBylawsSummaryGenerator.instructions(for: .english)

        #expect(instructions.contains("The person's locale is en_US."))
        #expect(instructions.contains("You MUST respond in English"))
        #expect(!instructions.contains("You MUST respond in Spanish"))
    }

    @Test("La perdida de assets durante la generacion conserva la indisponibilidad")
    func assetsUnavailableMapsToModelUnavailable() {
        let error = LanguageModelSession.GenerationError.assetsUnavailable(
            .init(debugDescription: "Test assets unavailable")
        )

        #expect(
            FoundationModelsBylawsSummaryGenerator.consultationError(for: error)
                == .modelUnavailable
        )
    }

    @Test("Un locale rechazado durante la generacion conserva la indisponibilidad")
    func unsupportedLocaleMapsToModelUnavailable() {
        let error = LanguageModelSession.GenerationError.unsupportedLanguageOrLocale(
            .init(debugDescription: "Test locale unsupported")
        )

        #expect(
            FoundationModelsBylawsSummaryGenerator.consultationError(for: error)
                == .modelUnavailable
        )
    }

    @Test("Un fallo de decodificacion sigue siendo fallo de generacion")
    func decodingFailureMapsToGenerationFailed() {
        let error = LanguageModelSession.GenerationError.decodingFailure(
            .init(debugDescription: "Test decoding failure")
        )

        #expect(
            FoundationModelsBylawsSummaryGenerator.consultationError(for: error)
                == .generationFailed
        )
    }
}
