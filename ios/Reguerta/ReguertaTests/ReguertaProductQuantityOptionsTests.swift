import Testing

@testable import Reguerta

@MainActor
struct ReguertaProductQuantityOptionsTests {
    @Test
    func editorUsesTypedOptionsAndDefaultsQuantitiesToOne() async {
        let currentProducer = producer(id: "producer_even", parity: .even)
        let viewModel = await makeProductsViewModel(
            currentMember: currentProducer,
            members: [currentProducer]
        )

        viewModel.startCreating()
        #expect(viewModel.draft.packContainerQty == "1")
        #expect(viewModel.draft.unitQty == "1")
        #expect(viewModel.draft.stockMode == .finite)
        #expect(viewModel.draft.stockQty == "0")

        viewModel.selectContainer(ProductContainerOption.box)
        #expect(viewModel.draft.packContainerName == "Caja")
        #expect(viewModel.draft.packContainerPlural == "Cajas")

        viewModel.selectMeasure(ProductMeasureOption.kilogram)
        #expect(viewModel.draft.unitName == "kilo")
        #expect(viewModel.draft.unitPlural == "kilos")
        #expect(viewModel.draft.unitAbbreviation == "kg")
        #expect(ProductMeasureOption.matching(name: "gramos aprox") == nil)

        viewModel.selectContainer(.bulk)
        #expect(viewModel.draft.packContainerName == "A granel")
        #expect(viewModel.draft.packContainerQty.isEmpty)
        #expect(viewModel.draft.unitName == "kilo")
        #expect(viewModel.draft.isEcoBasket == false)

        viewModel.selectContainer(.box)
        #expect(viewModel.draft.packContainerQty == "1")
        #expect(viewModel.draft.unitQty == "1")
        viewModel.selectContainer(.bulk)

        viewModel.updateDraft {
            $0.name = "Patatas a granel"
            $0.price = "2"
        }
        let input = resolveProductSaveInput(draft: viewModel.draft, existing: nil, nowMillis: 10)
        #expect(input?.weightStep == 0.5)
        #expect(input?.minWeight == 0.5)
        #expect(input?.maxWeight == 3)
    }

    @Test
    func stockLevelUsesErrorWarningAndNormalThresholds() {
        #expect(productStockLevel(quantity: 0) == .error)
        #expect(productStockLevel(quantity: 1) == .warning)
        #expect(productStockLevel(quantity: 10) == .warning)
        #expect(productStockLevel(quantity: 11) == .normal)
    }

    @Test
    func weightedProductUsesMinimumMaximumAndStep() {
        let product = weightedProduct()

        #expect(product.minimumSelectionCount == 2)
        #expect(product.maximumSelectionCount == 6)
        #expect(product.selectedQuantity(selectionCount: 2) == 1)
        #expect(product.selectedQuantity(selectionCount: 6) == 3)
    }

    private func weightedProduct() -> Product {
        Product(
            id: "bulk",
            vendorId: "producer",
            companyName: "Producer",
            name: "Patatas",
            description: "",
            productImageUrl: nil,
            price: 2,
            pricingMode: .weight,
            unitName: "kilo",
            unitAbbreviation: "kg",
            unitPlural: "kilos",
            unitQty: 0.5,
            packContainerName: "A granel",
            packContainerAbbreviation: "A granel",
            packContainerPlural: "A granel",
            packContainerQty: nil,
            isAvailable: true,
            stockMode: .infinite,
            stockQty: nil,
            isEcoBasket: false,
            isCommonPurchase: false,
            commonPurchaseType: nil,
            archived: false,
            createdAtMillis: 1,
            updatedAtMillis: 1,
            weightStep: 0.5,
            minWeight: 1,
            maxWeight: 3
        )
    }
}
