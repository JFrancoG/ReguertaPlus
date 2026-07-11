package com.reguerta.user.domain.products

enum class ProductContainerOption(
    val singular: String,
    val plural: String,
    val abbreviation: String,
) {
    BULK("A granel", "A granel", "A granel"),
    BOTTLE("Botella", "Botellas", "Botella"),
    JAR("Bote", "Botes", "Bote"),
    BOX("Caja", "Cajas", "Caja"),
    ECO_BASKET("Ecocesta", "Ecocestas", "Ecocesta"),
    JUG("Garrafa", "Garrafas", "Garrafa"),
    CAN("Lata", "Latas", "Lata"),
    NET("Malla", "Mallas", "Malla"),
    BUNCH("Manojo", "Manojos", "Manojo"),
    PACKAGE("Paquete", "Paquetes", "Paquete"),
    PIECE("Pieza", "Piezas", "Pieza"),
    ;

    companion object {
        fun matching(name: String): ProductContainerOption? =
            entries.firstOrNull { it.singular.equals(name.trim(), ignoreCase = true) }
    }
}

enum class ProductMeasureOption(
    val singular: String,
    val plural: String,
    val abbreviation: String,
) {
    CENTILITER("centilitro", "centilitros", "cL"),
    GRAM("gramo", "gramos", "g"),
    KILOGRAM("kilo", "kilos", "kg"),
    LITER("litro", "litros", "L"),
    UNIT("unidad", "unidades", "ud(s)."),
    ;

    companion object {
        fun matching(name: String): ProductMeasureOption? {
            val normalized = name.trim().lowercase().removeSuffix(".")
            return entries.firstOrNull {
                it.singular.lowercase().removeSuffix(".") == normalized
            }
        }
    }
}
