import Foundation
import Testing

@Suite("Auth route composition boundaries")
struct AuthRouteCompositionBoundaryTests {
    @Test("Cada ruta Auth vive en un archivo con un unico View, preview e init sintetizado")
    func routeViewsHaveOneViewAndSynthesizedInitialization() throws {
        for contract in authRouteContracts {
            let routeURL = authSourceURL().appending(path: contract.fileName)
            let exists = FileManager.default.fileExists(atPath: routeURL.path)
            #expect(exists, "Falta \(contract.fileName)")
            guard exists else { continue }

            let routeSource = try source(at: routeURL)
            let sourceLines = routeSource.split(separator: "\n")
            let viewDeclarations = sourceLines.filter(isViewDeclaration)
            let initializerDeclarations = sourceLines.filter(isInitializerDeclaration)

            #expect(routeSource.contains("struct \(contract.typeName): View"))
            #expect(viewDeclarations.count == 1, "\(contract.fileName) debe declarar un unico View")
            #expect(routeSource.contains("#Preview("), "\(contract.fileName) necesita preview propia")
            #expect(routeSource.contains("\(contract.typeName)("), "La preview debe construir \(contract.typeName)")
            #expect(
                initializerDeclarations.isEmpty,
                "\(contract.typeName) debe conservar el init memberwise sintetizado"
            )
        }
    }

    @Test("El switch tipado construye las cuatro rutas dedicadas")
    func shellSwitchConstructsDedicatedRouteViews() throws {
        let switchSource = try source(at: authSourceURL().appending(path: "ContentView+AuthRoutes.swift"))

        for contract in authRouteContracts {
            #expect(switchSource.contains("case .\(contract.routeCase):"))
            #expect(switchSource.contains("\(contract.typeName)("))
        }
    }

    @Test("Las rutas reciben solo estado y acciones de presentacion estrechos")
    func routeViewsDoNotOwnModelsInfrastructureOrTasks() throws {
        let repositoryReference = try Regex(#"\b[A-Za-z0-9_]*Repository\b"#)
        let asynchronousWork = try Regex(#"(?:\bTask\b|\.task\s*[\(\{])"#)
        let forbiddenLiteralDependencies = [
            "SessionViewModel",
            "AccessRootViewModel",
            "ReguertaAppEnvironment",
            "Firebase"
        ]

        for contract in authRouteContracts {
            let routeURL = authSourceURL().appending(path: contract.fileName)
            guard FileManager.default.fileExists(atPath: routeURL.path) else {
                Issue.record("No se puede auditar el boundary ausente \(contract.fileName)")
                continue
            }

            let routeSource = try source(at: routeURL)
            for dependency in forbiddenLiteralDependencies {
                #expect(!routeSource.contains(dependency), "\(contract.typeName) retiene \(dependency)")
            }
            #expect(
                routeSource.firstMatch(of: repositoryReference) == nil,
                "\(contract.typeName) no debe conocer repositories"
            )
            #expect(
                routeSource.firstMatch(of: asynchronousWork) == nil,
                "\(contract.typeName) no debe iniciar trabajo asincrono"
            )
        }
    }

    @Test("Cada control Auth conserva un identificador de accesibilidad canonico")
    func routeControlsExposeCanonicalAccessibilityIdentifiers() throws {
        for contract in authRouteContracts {
            let routeURL = authSourceURL().appending(path: contract.fileName)
            guard FileManager.default.fileExists(atPath: routeURL.path) else {
                Issue.record("No se pueden validar IDs en \(contract.fileName) ausente")
                continue
            }

            let routeSource = try source(at: routeURL)
            for identifier in contract.accessibilityIdentifiers {
                #expect(routeSource.contains("\"\(identifier)\""), "Falta \(identifier) en \(contract.fileName)")
            }
        }
    }

    @Test("Las rutas calculadas y cards monoliticas anteriores desaparecen")
    func legacyComputedRoutesAndCardsAreRemoved() throws {
        let combinedAuthSource = try swiftSourceURLs(in: authSourceURL())
            .map(source(at:))
            .joined(separator: "\n")
        let legacyDeclarations = [
            "var welcomeRoute: some View",
            "var loginRoute: some View",
            "var registerRoute: some View",
            "var recoverRoute: some View",
            "var signInCard: some View",
            "var signUpCard: some View",
            "var recoverPasswordCard: some View"
        ]

        for declaration in legacyDeclarations {
            #expect(!combinedAuthSource.contains(declaration), "Permanece \(declaration)")
        }
    }

    @Test("Las previews Auth cubren la matriz canonica sin servicios live")
    func routePreviewsCoverDynamicTypeLocaleAppearanceMotionAndContrast() throws {
        var routeSources: [String] = []

        for contract in authRouteContracts {
            let routeURL = authSourceURL().appending(path: contract.fileName)
            guard FileManager.default.fileExists(atPath: routeURL.path) else {
                Issue.record("Falta la preview de \(contract.fileName)")
                continue
            }
            let routeSource = try source(at: routeURL)
            let previewCount = routeSource.components(separatedBy: "#Preview(").count - 1
            let surfaceCount = routeSource.components(separatedBy: ".reguertaAuthRoutePreviewSurface(").count - 1
            #expect(surfaceCount == previewCount, "Cada preview de \(contract.fileName) necesita la superficie runtime")
            routeSources.append(routeSource)
        }

        let combinedSource = routeSources.joined(separator: "\n")
        #expect(combinedSource.contains(".environment(\\.dynamicTypeSize, .large)"))
        #expect(combinedSource.contains(".environment(\\.dynamicTypeSize, .xxxLarge)"))
        #expect(combinedSource.contains(".environment(\\.dynamicTypeSize, .accessibility5)"))
        #expect(combinedSource.contains("Locale(identifier: \"es\")"))
        #expect(combinedSource.contains("Locale(identifier: \"en\")"))
        #expect(combinedSource.contains(".preferredColorScheme(.light)"))
        #expect(combinedSource.contains(".preferredColorScheme(.dark)"))
        #expect(combinedSource.contains("ReguertaMotionPolicy(reducesMotion: true)"))
        #expect(combinedSource.contains("external Increased Contrast override"))
        #expect(!combinedSource.contains("routePreviewEnvironment("))
    }

    @Test("Las previews directas reproducen el scroll del shell sin anidarlo")
    func routePreviewsMirrorTheRuntimeScrollSurface() throws {
        let previewSurfaceSource = try source(
            at: authSourceURL().appending(path: "AuthRoutePreviewSurfaceModifier.swift")
        )
        let shellSource = try source(
            at: authSourceURL().deletingLastPathComponent().appending(path: "Root/AuthShellView.swift")
        )
        let shellPreviewCount = shellSource.components(separatedBy: "#Preview(").count - 1
        let shellNonScrollingSurfaceCount = shellSource
            .components(separatedBy: ".reguertaAuthRoutePreviewSurface(tokens: .light, scrollsContent: false)")
            .count - 1

        #expect(previewSurfaceSource.contains("let scrollsContent: Bool"))
        #expect(previewSurfaceSource.contains("ScrollView(.vertical, showsIndicators: false)"))
        #expect(previewSurfaceSource.contains("Color.clear"))
        #expect(previewSurfaceSource.contains(".containerRelativeFrame(.vertical, alignment: .top)"))
        #expect(shellNonScrollingSurfaceCount == shellPreviewCount)
    }

    @Test("Welcome agrupa su titulo como encabezado y Register delega validacion")
    func routeAccessibilityAndValidationStayAtTheirOwners() throws {
        let welcomeSource = try source(at: authSourceURL().appending(path: "AuthWelcomeRouteView.swift"))
        let registerSource = try source(at: authSourceURL().appending(path: "AuthRegisterRouteView.swift"))
        let switchSource = try source(at: authSourceURL().appending(path: "ContentView+AuthRoutes.swift"))
        let validationSource = try source(at: authSourceURL().appending(path: "AuthInputValidation.swift"))

        #expect(welcomeSource.contains(".accessibilityElement(children: .combine)"))
        #expect(welcomeSource.contains(".accessibilityAddTraits(.isHeader)"))
        #expect(!registerSource.contains("accessRepeatedPasswordErrorKey("))
        #expect(registerSource.contains("repeatedPasswordValidationMessage"))
        #expect(registerSource.contains("textContentType: .username"))
        #expect(switchSource.contains("sessionViewModel.registerRepeatedPasswordValidationMessage"))
        #expect(validationSource.contains("func registerRepeatedPasswordValidationMessage("))
    }

    @Test("El contenido Auth conserva el viewport minimo y puede crecer dentro del scroll")
    func authShellUsesViewportPeerInsteadOfConstrainingTheRouteHeight() throws {
        let shellSourceURL = authSourceURL()
            .deletingLastPathComponent()
            .appending(path: "Root/AuthShellView.swift")
        let shellSource = try source(at: shellSourceURL)

        let stackStart = try #require(shellSource.range(of: "ZStack(alignment: .topLeading) {"))
        let stackTail = shellSource[stackStart.lowerBound...]
        let stackEnd = try #require(stackTail.range(of: "\n                .padding(.bottom"))
        let stackSource = stackTail[..<stackEnd.lowerBound]
        let viewportPeer = try #require(stackSource.range(of: "Color.clear"))
        let routeStart = try #require(stackSource.range(of: "currentAuthRoute"))
        let routeSource = stackSource[routeStart.lowerBound...]

        #expect(viewportPeer.lowerBound < routeStart.lowerBound)
        #expect(stackSource[viewportPeer.lowerBound..<routeStart.lowerBound]
            .contains(".containerRelativeFrame(.vertical, alignment: .top)"))
        #expect(routeSource.contains(".frame(maxWidth: .infinity, alignment: .topLeading)"))
        #expect(!routeSource.contains(".containerRelativeFrame(.vertical"))
        #expect(!routeSource.contains("height:"))
        let previewCount = shellSource.components(separatedBy: "#Preview(").count - 1
        let surfaceCount = shellSource.components(separatedBy: ".reguertaAuthRoutePreviewSurface(").count - 1
        #expect(surfaceCount == previewCount, "Cada preview de AuthShell necesita la superficie runtime")
    }

    @Test("Login separa los fixtures de validacion y DRAINING")
    func loginPreviewsIsolateValidationAndDrainingStates() throws {
        let loginSource = try source(at: authSourceURL().appending(path: "AuthLoginRouteView.swift"))
        let validationSource = try #require(
            previewSource(named: "Login · validation error", in: loginSource)
        )
        let drainingSource = try #require(
            previewSource(named: "Login · draining", in: loginSource)
        )

        #expect(validationSource.contains("emailErrorKey: AccessL10nKey.feedbackEmailInvalid"))
        #expect(validationSource.contains("passwordErrorKey: AccessL10nKey.authErrorWeakPassword"))
        #expect(validationSource.contains("canSubmit: false"))
        #expect(drainingSource.contains("email = \"member@example.com\""))
        #expect(drainingSource.contains("password = \"secret12\""))
        #expect(drainingSource.contains("emailErrorKey: nil"))
        #expect(drainingSource.contains("passwordErrorKey: nil"))
        #expect(drainingSource.contains("isLoading: false"))
        #expect(drainingSource.contains("canSubmit: false"))
    }
}

private struct AuthRouteCompositionContract {
    let routeCase: String
    let typeName: String
    let fileName: String
    let accessibilityIdentifiers: [String]
}

private let authRouteContracts = [
    AuthRouteCompositionContract(
        routeCase: "welcome",
        typeName: "AuthWelcomeRouteView",
        fileName: "AuthWelcomeRouteView.swift",
        accessibilityIdentifiers: [
            "auth.welcome.enterButton",
            "auth.welcome.registerButton"
        ]
    ),
    AuthRouteCompositionContract(
        routeCase: "login",
        typeName: "AuthLoginRouteView",
        fileName: "AuthLoginRouteView.swift",
        accessibilityIdentifiers: [
            "auth.header.backButton",
            "auth.login.emailField",
            "auth.login.passwordField",
            "auth.login.recoverPasswordButton",
            "auth.login.signInButton"
        ]
    ),
    AuthRouteCompositionContract(
        routeCase: "register",
        typeName: "AuthRegisterRouteView",
        fileName: "AuthRegisterRouteView.swift",
        accessibilityIdentifiers: [
            "auth.header.backButton",
            "auth.register.emailField",
            "auth.register.passwordField",
            "auth.register.repeatPasswordField",
            "auth.register.createAccountButton"
        ]
    ),
    AuthRouteCompositionContract(
        routeCase: "recoverPassword",
        typeName: "AuthRecoverPasswordRouteView",
        fileName: "AuthRecoverPasswordRouteView.swift",
        accessibilityIdentifiers: [
            "auth.header.backButton",
            "auth.recoverPassword.emailField",
            "auth.recoverPassword.sendEmailButton"
        ]
    )
]

private func source(at url: URL) throws -> String {
    try String(contentsOf: url, encoding: .utf8)
}

private func previewSource(named name: String, in source: String) -> Substring? {
    guard let titleRange = source.range(of: "\"\(name)"),
          let previewStart = source[..<titleRange.lowerBound].range(of: "#Preview(", options: .backwards) else {
        return nil
    }
    let remainingSource = source[titleRange.upperBound...]
    let previewEnd = remainingSource.range(of: "#Preview(")?.lowerBound ?? source.endIndex
    return source[previewStart.lowerBound..<previewEnd]
}

private func isViewDeclaration(_ line: Substring) -> Bool {
    let normalizedLine = line.trimmingCharacters(in: .whitespaces)
    let declaration = normalizedLine.hasPrefix("struct ") || normalizedLine.hasPrefix("private struct ")
    return declaration && normalizedLine.contains(": View {")
}

private func isInitializerDeclaration(_ line: Substring) -> Bool {
    let normalizedLine = line.trimmingCharacters(in: .whitespaces)
    return normalizedLine.hasPrefix("init(") || normalizedLine.hasPrefix("private init(")
}

private func swiftSourceURLs(in directoryURL: URL) throws -> [URL] {
    guard let enumerator = FileManager.default.enumerator(
        at: directoryURL,
        includingPropertiesForKeys: [.isRegularFileKey]
    ) else {
        throw AuthRouteCompositionBoundaryTestError.unavailable(directoryURL)
    }

    return try enumerator.compactMap { element in
        guard let sourceURL = element as? URL,
              sourceURL.pathExtension == "swift",
              try sourceURL.resourceValues(forKeys: [.isRegularFileKey]).isRegularFile == true else {
            return nil
        }
        return sourceURL
    }
}

private func authSourceURL() -> URL {
    URL(fileURLWithPath: #filePath)
        .deletingLastPathComponent()
        .deletingLastPathComponent()
        .appending(path: "Reguerta/Presentation/Auth")
}

private enum AuthRouteCompositionBoundaryTestError: Error {
    case unavailable(URL)
}
