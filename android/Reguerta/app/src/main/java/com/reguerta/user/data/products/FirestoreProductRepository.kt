package com.reguerta.user.data.products

import com.google.android.gms.tasks.Tasks
import com.google.firebase.Timestamp
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.SetOptions
import com.reguerta.user.data.firestore.ReguertaFirestoreCollection
import com.reguerta.user.data.firestore.ReguertaFirestoreEnvironment
import com.reguerta.user.data.firestore.ReguertaFirestorePath
import com.reguerta.user.domain.products.CommonPurchaseType
import com.reguerta.user.domain.products.Product
import com.reguerta.user.domain.products.ProductPricingMode
import com.reguerta.user.domain.products.ProductRepository
import com.reguerta.user.domain.products.ProductStockMode
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class FirestoreProductRepository(
    private val firestore: FirebaseFirestore,
    private val environment: ReguertaFirestoreEnvironment = ReguertaFirestoreEnvironment.DEVELOP,
) : ProductRepository {
    private val firestorePath = ReguertaFirestorePath(environment = environment)

    private val productsCollectionPath: String
        get() = firestorePath.collectionPath(ReguertaFirestoreCollection.PRODUCTS)

    override suspend fun getAllProducts(): List<Product> = withContext(Dispatchers.IO) {
        runCatching {
            val snapshot = Tasks.await(
                firestore.collection(productsCollectionPath).get(),
            )
            snapshot.documents
                .mapNotNull { it.toProduct() }
                .sortedWith(compareBy<Product> { it.archived }.thenBy { it.name.lowercase() })
        }.getOrDefault(emptyList())
    }

    override suspend fun getProductsForVendor(vendorId: String): List<Product> = withContext(Dispatchers.IO) {
        runCatching {
            val snapshot = Tasks.await(
                firestore.collection(productsCollectionPath)
                    .whereEqualTo("vendorId", vendorId)
                    .get(),
            )
            snapshot.documents
                .mapNotNull { it.toProduct() }
                .sortedWith(compareBy<Product> { it.archived }.thenBy { it.name.lowercase() })
        }.getOrDefault(emptyList())
    }

    override suspend fun upsertProduct(product: Product): Product = withContext(Dispatchers.IO) {
        val documentId = product.id.ifBlank {
            firestore.collection(productsCollectionPath).document().id
        }
        val persisted = product.copy(id = documentId)
        val payload = mutableMapOf<String, Any>(
            "vendorId" to persisted.vendorId,
            "companyName" to persisted.companyName,
            "name" to persisted.name,
            "description" to persisted.description,
            "price" to persisted.price,
            "pricingMode" to persisted.pricingMode.toWireValue(),
            "unitName" to persisted.unitName,
            "unitPlural" to persisted.unitPlural,
            "unitQty" to persisted.unitQty,
            "isAvailable" to persisted.isAvailable,
            "stockMode" to persisted.stockMode.toWireValue(),
            "isEcoBasket" to persisted.isEcoBasket,
            "isCommonPurchase" to persisted.isCommonPurchase,
            "archived" to persisted.archived,
            "createdAt" to Timestamp(persisted.createdAtMillis / 1_000, ((persisted.createdAtMillis % 1_000) * 1_000_000).toInt()),
            "updatedAt" to Timestamp(persisted.updatedAtMillis / 1_000, ((persisted.updatedAtMillis % 1_000) * 1_000_000).toInt()),
        )
        persisted.productImageUrl?.let { payload["productImageUrl"] = it }
        persisted.unitAbbreviation?.let { payload["unitAbbreviation"] = it }
        persisted.packContainerName?.let { payload["packContainerName"] = it }
        persisted.packContainerAbbreviation?.let { payload["packContainerAbbreviation"] = it }
        persisted.packContainerPlural?.let { payload["packContainerPlural"] = it }
        persisted.packContainerQty?.let { payload["packContainerQty"] = it }
        persisted.stockQty?.let { payload["stockQty"] = it }
        persisted.commonPurchaseType?.toWireValue()?.let { payload["commonPurchaseType"] = it }

        runCatching {
            Tasks.await(
                firestore.collection(productsCollectionPath)
                    .document(documentId)
                    .set(payload, SetOptions.merge()),
            )
            persisted
        }.getOrDefault(persisted)
    }
}

private fun com.google.firebase.firestore.DocumentSnapshot.toProduct(): Product? {
    if (!exists()) return null
    val vendorId = getString("vendorId")?.trim()?.ifBlank { null } ?: return null
    val companyName = getString("companyName")?.trim()?.ifBlank { null } ?: return null
    val name = getString("name")?.trim()?.ifBlank { null } ?: return null
    val unitName = getString("unitName")?.trim()?.ifBlank { null } ?: return null
    val unitPlural = getString("unitPlural")?.trim()?.ifBlank { null } ?: return null
    val price = getDouble("price") ?: return null
    val unitQty = getDouble("unitQty") ?: return null
    return Product(
        id = id,
        vendorId = vendorId,
        companyName = companyName,
        name = name,
        description = getString("description")?.trim().orEmpty(),
        productImageUrl = getString("productImageUrl")?.trim()?.ifBlank { null },
        price = price,
        pricingMode = getString("pricingMode").toProductPricingMode(),
        unitName = unitName,
        unitAbbreviation = getString("unitAbbreviation")?.trim()?.ifBlank { null },
        unitPlural = unitPlural,
        unitQty = unitQty,
        packContainerName = getString("packContainerName")?.trim()?.ifBlank { null },
        packContainerAbbreviation = getString("packContainerAbbreviation")?.trim()?.ifBlank { null },
        packContainerPlural = getString("packContainerPlural")?.trim()?.ifBlank { null },
        packContainerQty = getDouble("packContainerQty"),
        isAvailable = getBoolean("isAvailable") ?: true,
        stockMode = getString("stockMode").toProductStockMode(),
        stockQty = getDouble("stockQty"),
        isEcoBasket = getBoolean("isEcoBasket") ?: false,
        isCommonPurchase = getBoolean("isCommonPurchase") ?: false,
        commonPurchaseType = getString("commonPurchaseType").toCommonPurchaseType(),
        archived = getBoolean("archived") ?: false,
        createdAtMillis = getTimestamp("createdAt")?.toDate()?.time ?: 0L,
        updatedAtMillis = getTimestamp("updatedAt")?.toDate()?.time ?: 0L,
    )
}

private fun String?.toProductPricingMode(): ProductPricingMode = when (this?.trim()?.lowercase()) {
    "weight" -> ProductPricingMode.WEIGHT
    else -> ProductPricingMode.FIXED
}

private fun String?.toProductStockMode(): ProductStockMode = when (this?.trim()?.lowercase()) {
    "finite" -> ProductStockMode.FINITE
    else -> ProductStockMode.INFINITE
}

private fun String?.toCommonPurchaseType(): CommonPurchaseType? = when (this?.trim()?.lowercase()) {
    "seasonal" -> CommonPurchaseType.SEASONAL
    "spot" -> CommonPurchaseType.SPOT
    else -> null
}

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
