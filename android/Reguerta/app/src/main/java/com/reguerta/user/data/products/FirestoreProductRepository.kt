package com.reguerta.user.data.products

import com.google.android.gms.tasks.Tasks
import com.google.firebase.Timestamp
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.SetOptions
import com.reguerta.user.data.firestore.ReguertaFirestoreCollection
import com.reguerta.user.data.firestore.ReguertaFirestoreEnvironment
import com.reguerta.user.data.firestore.ReguertaFirestorePath
import com.reguerta.user.data.firestore.toRepositoryException
import com.reguerta.user.domain.RepositoryErrorKind
import com.reguerta.user.domain.RepositoryException
import com.reguerta.user.domain.products.CommonPurchaseType
import com.reguerta.user.domain.products.Product
import com.reguerta.user.domain.products.ProductPricingMode
import com.reguerta.user.domain.products.ProductRepository
import com.reguerta.user.domain.products.ProductStockMode
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class FirestoreProductRepository(
    private val firestore: FirebaseFirestore,
    private val environment: ReguertaFirestoreEnvironment? = null,
) : ProductRepository {
    private val firestorePath = ReguertaFirestorePath(environment = environment)

    private val productsCollectionPath: String
        get() = firestorePath.collectionPath(ReguertaFirestoreCollection.PRODUCTS)

    override suspend fun getAllProducts(): List<Product> = withContext(Dispatchers.IO) {
        try {
            val snapshot = Tasks.await(
                firestore.collection(productsCollectionPath).get(),
            )
            decodeProductDocuments(snapshot.documents.map { document ->
                val data: Map<String, Any> = document.data ?: invalidProductDocument()
                document.id to data
            })
        } catch (error: Exception) {
            throw error.toRepositoryException(resource = "products")
        }
    }

    override suspend fun getProductsForVendor(vendorId: String): List<Product> = withContext(Dispatchers.IO) {
        try {
            val snapshot = Tasks.await(
                firestore.collection(productsCollectionPath)
                    .whereEqualTo("vendorId", vendorId)
                    .get(),
            )
            decodeProductDocuments(snapshot.documents.map { document ->
                val data: Map<String, Any> = document.data ?: invalidProductDocument()
                document.id to data
            })
        } catch (error: Exception) {
            throw error.toRepositoryException(resource = "products.vendor")
        }
    }

    override suspend fun upsertProduct(product: Product): Product = withContext(Dispatchers.IO) {
        val documentId = product.id.ifBlank {
            firestore.collection(productsCollectionPath).document().id
        }
        val persisted = product.copy(id = documentId)
        val payload = productUpsertPayload(persisted)

        try {
            Tasks.await(
                firestore.collection(productsCollectionPath)
                    .document(documentId)
                    .set(payload, SetOptions.merge()),
            )
            persisted
        } catch (error: Exception) {
            throw error.toRepositoryException(resource = "products.write")
        }
    }
}

internal fun productUpsertPayload(product: Product): Map<String, Any> = mutableMapOf<String, Any>(
    "vendorId" to product.vendorId,
    "companyName" to product.companyName,
    "name" to product.name,
    "description" to product.description,
    "productImageUrl" to (product.productImageUrl ?: FieldValue.delete()),
    "price" to product.price,
    "pricingMode" to product.pricingMode.toWireValue(),
    "unitName" to product.unitName,
    "unitAbbreviation" to (product.unitAbbreviation ?: FieldValue.delete()),
    "unitPlural" to product.unitPlural,
    "unitQty" to product.unitQty,
    "packContainerName" to (product.packContainerName ?: FieldValue.delete()),
    "packContainerAbbreviation" to (product.packContainerAbbreviation ?: FieldValue.delete()),
    "packContainerPlural" to (product.packContainerPlural ?: FieldValue.delete()),
    "packContainerQty" to (product.packContainerQty ?: FieldValue.delete()),
    "isAvailable" to product.isAvailable,
    "stockMode" to product.stockMode.toWireValue(),
    "stockQty" to (product.stockQty ?: FieldValue.delete()),
    "isEcoBasket" to product.isEcoBasket,
    "isCommonPurchase" to product.isCommonPurchase,
    "commonPurchaseType" to (product.commonPurchaseType?.toWireValue() ?: FieldValue.delete()),
    "archived" to product.archived,
    "createdAt" to product.createdAtMillis.toTimestamp(),
    "updatedAt" to product.updatedAtMillis.toTimestamp(),
    "weightStep" to (product.weightStep ?: FieldValue.delete()),
    "minWeight" to (product.minWeight ?: FieldValue.delete()),
    "maxWeight" to (product.maxWeight ?: FieldValue.delete()),
)

private fun Long.toTimestamp() = Timestamp(this / 1_000, ((this % 1_000) * 1_000_000).toInt())

internal fun decodeProductDocuments(documents: List<Pair<String, Map<String, Any>>>): List<Product> =
    documents
        .map { (documentId, data) -> decodeProductDocument(documentId, data) }
        .sortedWith(compareBy<Product> { it.archived }.thenBy { it.name.lowercase() })

internal fun decodeProductDocument(documentId: String, data: Map<String, Any?>): Product {
    val product = Product(
        id = documentId,
        vendorId = data.requiredString("vendorId"),
        companyName = data.requiredString("companyName"),
        name = data.requiredString("name"),
        description = data.optionalString("description").orEmpty(),
        productImageUrl = data.optionalString("productImageUrl"),
        price = data.requiredPositiveDouble("price"),
        pricingMode = data.optionalEnumString("pricingMode").toProductPricingMode(),
        unitName = data.requiredString("unitName"),
        unitAbbreviation = data.optionalString("unitAbbreviation"),
        unitPlural = data.requiredString("unitPlural"),
        unitQty = data.requiredPositiveDouble("unitQty"),
        packContainerName = data.optionalString("packContainerName"),
        packContainerAbbreviation = data.optionalString("packContainerAbbreviation"),
        packContainerPlural = data.optionalString("packContainerPlural"),
        packContainerQty = data.optionalPositiveDouble("packContainerQty"),
        isAvailable = data.optionalBoolean("isAvailable", default = true),
        stockMode = data.optionalEnumString("stockMode").toProductStockMode(),
        stockQty = data.optionalNonNegativeDouble("stockQty"),
        isEcoBasket = data.optionalBoolean("isEcoBasket", default = false),
        isCommonPurchase = data.optionalBoolean("isCommonPurchase", default = false),
        commonPurchaseType = data.optionalEnumString("commonPurchaseType").toCommonPurchaseType(),
        archived = data.optionalBoolean("archived", default = false),
        createdAtMillis = data.optionalTimestampMillis("createdAt"),
        updatedAtMillis = data.optionalTimestampMillis("updatedAt"),
        weightStep = data.optionalPositiveDouble("weightStep"),
        minWeight = data.optionalPositiveDouble("minWeight"),
        maxWeight = data.optionalPositiveDouble("maxWeight"),
    )
    validateSelectionRange(product)
    return product
}

private fun validateSelectionRange(product: Product) {
    if (product.pricingMode != ProductPricingMode.WEIGHT) return
    val step = product.weightStep ?: product.unitQty
    val minimumCount = kotlin.math.ceil((product.minWeight ?: step) / step)
    if (!minimumCount.isFinite() || minimumCount < 1.0 || minimumCount > Int.MAX_VALUE.toDouble()) {
        invalidProductDocument()
    }
    val maxWeight = product.maxWeight ?: return
    val maximumCount = kotlin.math.floor(maxWeight / step)
    if (!maximumCount.isFinite() ||
        maximumCount < minimumCount ||
        maximumCount > Int.MAX_VALUE.toDouble()
    ) {
        invalidProductDocument()
    }
}

private fun String?.toProductPricingMode(): ProductPricingMode = when (this?.trim()) {
    null -> ProductPricingMode.FIXED
    "fixed" -> ProductPricingMode.FIXED
    "weight" -> ProductPricingMode.WEIGHT
    else -> invalidProductDocument()
}

private fun String?.toProductStockMode(): ProductStockMode = when (this?.trim()) {
    null -> ProductStockMode.INFINITE
    "infinite" -> ProductStockMode.INFINITE
    "finite" -> ProductStockMode.FINITE
    else -> invalidProductDocument()
}

private fun String?.toCommonPurchaseType(): CommonPurchaseType? = when (this?.trim()) {
    "seasonal" -> CommonPurchaseType.SEASONAL
    "spot" -> CommonPurchaseType.SPOT
    null -> null
    else -> invalidProductDocument()
}

private fun Map<String, Any?>.requiredString(field: String): String =
    optionalString(field) ?: invalidProductDocument()

private fun Map<String, Any?>.optionalString(field: String): String? {
    val value = this[field] ?: return null
    if (value !is String) invalidProductDocument()
    return value.trim().ifBlank { null }
}

private fun Map<String, Any?>.optionalEnumString(field: String): String? {
    val value = this[field] ?: return null
    if (value !is String) invalidProductDocument()
    return value.trim().ifBlank { invalidProductDocument() }
}

private fun Map<String, Any?>.requiredDouble(field: String): Double =
    optionalDouble(field) ?: invalidProductDocument()

private fun Map<String, Any?>.requiredPositiveDouble(field: String): Double =
    requiredDouble(field).takeIf { it > 0.0 } ?: invalidProductDocument()

private fun Map<String, Any?>.optionalDouble(field: String): Double? {
    val value = this[field] ?: return null
    if (value !is Number) invalidProductDocument()
    return value.toDouble().takeIf(Double::isFinite) ?: invalidProductDocument()
}

private fun Map<String, Any?>.optionalPositiveDouble(field: String): Double? =
    optionalDouble(field)?.takeIf { it > 0.0 } ?: if (containsKey(field) && this[field] != null) {
        invalidProductDocument()
    } else {
        null
    }

private fun Map<String, Any?>.optionalNonNegativeDouble(field: String): Double? =
    optionalDouble(field)?.takeIf { it >= 0.0 } ?: if (containsKey(field) && this[field] != null) {
        invalidProductDocument()
    } else {
        null
    }

private fun Map<String, Any?>.optionalBoolean(field: String, default: Boolean): Boolean {
    val value = this[field] ?: return default
    if (value !is Boolean) invalidProductDocument()
    return value
}

private fun Map<String, Any?>.optionalTimestampMillis(field: String): Long {
    val value = this[field] ?: return 0L
    if (value !is Timestamp) invalidProductDocument()
    return value.toDate().time
}

private fun invalidProductDocument(): Nothing = throw RepositoryException(
    kind = RepositoryErrorKind.INVALID_DATA,
    resource = "products.document",
)

private fun ProductPricingMode.toWireValue(): String = when (this) {
    ProductPricingMode.FIXED -> "fixed"
    ProductPricingMode.WEIGHT -> "weight"
}

private fun ProductStockMode.toWireValue(): String = when (this) {
    ProductStockMode.FINITE -> "finite"
    ProductStockMode.INFINITE -> "infinite"
}

private fun CommonPurchaseType.toWireValue(): String = when (this) {
    CommonPurchaseType.SEASONAL -> "seasonal"
    CommonPurchaseType.SPOT -> "spot"
}
