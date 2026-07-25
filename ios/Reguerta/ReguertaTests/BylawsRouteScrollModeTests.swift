import SwiftUI
import Testing

@testable import Reguerta

struct BylawsRouteScrollModeTests {
    @Test("Sin respuesta se desplaza la pagina completa")
    func noAnswerUsesFullPageScrolling() {
        #expect(
            BylawsRouteScrollMode.resolve(
                hasAnswer: false,
                dynamicTypeSize: .large,
                verticalSizeClass: .regular
            ) == .fullPage
        )
    }

    @Test("Con altura regular la respuesta posee el scroll")
    func regularHeightUsesAnswerScrolling() {
        #expect(
            BylawsRouteScrollMode.resolve(
                hasAnswer: true,
                dynamicTypeSize: .large,
                verticalSizeClass: .regular
            ) == .answerOnly
        )
    }

    @Test("XX Large conserva el scroll exclusivo de la respuesta")
    func xxLargeUsesAnswerScrolling() {
        #expect(
            BylawsRouteScrollMode.resolve(
                hasAnswer: true,
                dynamicTypeSize: .xxLarge,
                verticalSizeClass: .regular
            ) == .answerOnly
        )
    }

    @Test("XXX Large desplaza la pagina completa")
    func xxxLargeUsesFullPageScrolling() {
        #expect(
            BylawsRouteScrollMode.resolve(
                hasAnswer: true,
                dynamicTypeSize: .xxxLarge,
                verticalSizeClass: .regular
            ) == .fullPage
        )
    }

    @Test("Los tamanos de accesibilidad desplazan la pagina completa")
    func accessibilitySizeUsesFullPageScrolling() {
        #expect(
            BylawsRouteScrollMode.resolve(
                hasAnswer: true,
                dynamicTypeSize: .accessibility5,
                verticalSizeClass: .regular
            ) == .fullPage
        )
    }

    @Test("La altura compacta desplaza la pagina completa")
    func compactHeightUsesFullPageScrolling() {
        #expect(
            BylawsRouteScrollMode.resolve(
                hasAnswer: true,
                dynamicTypeSize: .large,
                verticalSizeClass: .compact
            ) == .fullPage
        )
    }

    @Test("Una altura indeterminada desplaza la pagina completa")
    func unspecifiedHeightUsesFullPageScrolling() {
        #expect(
            BylawsRouteScrollMode.resolve(
                hasAnswer: true,
                dynamicTypeSize: .large,
                verticalSizeClass: nil
            ) == .fullPage
        )
    }
}
