import Foundation
import Testing

@Suite("Reguerta input field accessibility contract")
struct ReguertaInputFieldAccessibilityContractTests {
    @Test func eachInputFieldViewHasItsOwnSourceFile() throws {
        let viewContracts = [
            ("ReguertaInputFieldView.swift", "ReguertaInputFieldView"),
            ("ReguertaInputTextEntryView.swift", "ReguertaInputTextEntryView"),
            ("ReguertaInputTrailingIconView.swift", "ReguertaInputTrailingIconView"),
            ("ReguertaInputMessageView.swift", "ReguertaInputMessageView")
        ]

        for (fileName, typeName) in viewContracts {
            let fileURL = inputFieldSourceURL(fileName)
            #expect(FileManager.default.fileExists(atPath: fileURL.path), "Falta \(fileName)")
            guard FileManager.default.fileExists(atPath: fileURL.path) else { continue }
            let viewSource = try source(at: fileURL)
            let viewCount = viewSource.components(separatedBy: ": View {").count - 1
            #expect(viewSource.contains("struct \(typeName): View"))
            #expect(viewCount == 1, "\(fileName) debe declarar un unico View")
        }
    }

    @Test func extractedInputFieldViewsHaveDirectDeterministicPreviews() throws {
        let extractedViewContracts = [
            ("ReguertaInputTextEntryView.swift", "ReguertaInputTextEntryView"),
            ("ReguertaInputTrailingIconView.swift", "ReguertaInputTrailingIconView"),
            ("ReguertaInputMessageView.swift", "ReguertaInputMessageView")
        ]

        for (fileName, typeName) in extractedViewContracts {
            let viewSource = try source(at: inputFieldSourceURL(fileName))
            #expect(viewSource.contains("#Preview("), "Falta una preview en \(fileName)")
            #expect(viewSource.contains("\n    \(typeName)("), "La preview debe construir \(typeName) directamente")
            #expect(viewSource.contains("ReguertaDesignSystemPreviewModifier(fixture:"))
            #expect(viewSource.contains(".fixedLayout(width:"))
        }
    }

    @Test func configurationAndHelperExposeOptionalTextContentType() throws {
        let configurationSource = try source(at: inputFieldSourceURL("ReguertaInputFieldConfiguration.swift"))

        #expect(configurationSource.contains("let textContentType: UITextContentType?"))
        #expect(configurationSource.contains("textContentType: UITextContentType? = nil"))
        #expect(configurationSource.contains("textContentType: textContentType"))
    }

    @Test func effectiveErrorIsForwardedToTheEditableControl() throws {
        let viewSource = try source(at: inputFieldSourceURL("ReguertaInputFieldView.swift"))
        let entryConstruction = try sourceSegment(
            from: "ReguertaInputTextEntryView(",
            to: "\n\n                if configuration.isSecure",
            in: viewSource
        )

        #expect(entryConstruction.contains("errorMessage: effectiveErrorMessage"))
    }

    @Test(
        "Every editable branch applies content type and conditional error semantics",
        arguments: [
            (
                "secure",
                "if configuration.isSecure && !passwordVisibility {",
                "} else if configuration.isMultiline {"
            ),
            (
                "multiline",
                "} else if configuration.isMultiline {",
                "} else {\n                TextField(\"\", text: $text)"
            ),
            (
                "single-line",
                "} else {\n                TextField(\"\", text: $text)",
                "\n            }\n        }\n        .frame("
            )
        ]
    )
    func everyEditableBranchAppliesContentTypeAndConditionalErrorSemantics(
        name: String,
        startMarker: String,
        endMarker: String
    ) throws {
        let viewSource = try source(at: inputFieldSourceURL("ReguertaInputTextEntryView.swift"))
        let branch = try sourceSegment(from: startMarker, to: endMarker, in: viewSource)

        #expect(
            branch.contains(".textContentType(configuration.textContentType)"),
            "The \(name) entry branch does not apply its configured text content type"
        )
        #expect(
            branch.contains(".reguertaAccessibilityError(errorMessage)"),
            "The \(name) entry branch does not expose only its effective error as high-priority custom content"
        )
        #expect(!branch.contains(".accessibilityHint("), "The \(name) entry incorrectly models an error as a hint")
    }

    @Test func visibleErrorIsNotADuplicateAccessibilityElement() throws {
        let viewSource = try source(at: inputFieldSourceURL("ReguertaInputMessageView.swift"))
        let errorMessageView = try sourceSegment(
            from: "if let errorMessage {",
            to: "} else if let helperMessage {",
            in: viewSource
        )

        #expect(errorMessageView.contains("Text(errorMessage)"))
        #expect(errorMessageView.contains(".accessibilityHidden(true)"))
    }

    @Test func visibleLabelsDoNotCreateDuplicateInputFocusAndErrorsUseLocalizedCustomContent() throws {
        let fieldSource = try source(at: inputFieldSourceURL("ReguertaInputFieldView.swift"))
        let entrySource = try source(at: inputFieldSourceURL("ReguertaInputTextEntryView.swift"))
        let localizationSource = try source(at: accessLocalizationSourceURL())
        let catalogSource = try source(at: localizableCatalogURL())

        let label = try sourceSegment(from: "Text(configuration.label)", to: "\n\n            HStack", in: fieldSource)
        let placeholder = try sourceSegment(
            from: "if let placeholder = configuration.placeholder {",
            to: "\n            if configuration.isSecure",
            in: entrySource
        )

        #expect(label.contains(".accessibilityHidden(true)"))
        #expect(placeholder.contains(".accessibilityHidden(true)"))
        #expect(entrySource.contains("func reguertaAccessibilityError("))
        #expect(entrySource.contains(".accessibilityCustomContent("))
        #expect(entrySource.contains("importance: .high"))
        #expect(localizationSource.contains("commonAccessibilityError = \"common.accessibility.error\""))
        #expect(catalogSource.contains("\"common.accessibility.error\""))
    }

    private func source(at url: URL) throws -> String {
        try String(contentsOf: url, encoding: .utf8)
    }

    private func sourceSegment(from startMarker: String, to endMarker: String, in source: String) throws -> Substring {
        guard let startRange = source.range(of: startMarker) else {
            throw ReguertaInputFieldAccessibilityContractTestError.missingMarker(startMarker)
        }
        guard let endRange = source.range(of: endMarker, range: startRange.upperBound..<source.endIndex) else {
            throw ReguertaInputFieldAccessibilityContractTestError.missingMarker(endMarker)
        }
        return source[startRange.lowerBound..<endRange.lowerBound]
    }

    private func inputFieldSourceURL(_ fileName: String) -> URL {
        URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .appending(path: "Reguerta/DesignSystem/Components/ReguertaInputField")
            .appending(path: fileName)
    }

    private func accessLocalizationSourceURL() -> URL {
        inputFieldSourceURL("ReguertaInputFieldView.swift")
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .appending(path: "Presentation/Localization/AccessLocalization.swift")
    }

    private func localizableCatalogURL() -> URL {
        inputFieldSourceURL("ReguertaInputFieldView.swift")
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .appending(path: "Resources/Localizable.xcstrings")
    }
}

private enum ReguertaInputFieldAccessibilityContractTestError: Error {
    case missingMarker(String)
}
