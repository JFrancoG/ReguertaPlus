# Firestore - Colecciones y Campos (MVP v1)

Fecha: 2026-03-06
Estado: Canonico para implementacion de modelos
Ambito: MVP Reguerta

## 1. Objetivo

Definir de forma cerrada las colecciones Firestore y los campos de cada una para que:
- Android, iOS y backend compartan el mismo contrato de datos.
- La implementacion de modelos sea consistente y sin ambiguedades.
- La migracion desde datos existentes sea incremental y segura.

## 2. Convenciones globales

- Zona horaria funcional del negocio: `Europe/Madrid`.
- Timestamps en Firestore: `Timestamp` (UTC); conversion a zona local en cliente.
- Nombres de campos: `camelCase`.
- Entornos runtime: `local`, `develop`, `production`.
- Namespaces cloud Firestore actualmente usados:
  - `develop/{collections|plus-collections}/...`
  - `production/{collections|plus-collections}/...`
  - `local` se considera runtime/emulador, no namespace cloud obligatorio.
- IDs de documentos:
  - `users/{userId}`: ID interno estable del socio (no tiene que coincidir con Firebase Auth UID).
  - `users.authUid`: Firebase Auth UID tras primer login autorizado (nullable antes de ese primer acceso).
  - `users/{userId}/devices/{deviceId}`: metadatos por dispositivo para notificaciones push y diagnostico.
  - `orders/{orderId}`: recomendado `order_{userId}_{weekKey}`.
  - `deliveryCalendar/{weekKey}`: ejemplo `2026-W10` (`weekKey` es el ID del documento).
- Moneda/precios en MVP: `number` decimal (maximo 2 decimales operativos).
- Borrado logico para entidades historicas:
  - `archived` (bool) y/o `archivedAt` (timestamp|null).
- Campos de auditoria minima en documentos principales:
  - `createdAt`, `updatedAt`.

## 3. Enumeraciones canonicas

### 3.1 Roles
- `member`
- `producer`
- `admin`

### 3.2 Estado consumidor (`orders.consumerStatus`)
- `sin_hacer`
- `en_carrito`
- `confirmado`

### 3.3 Estado productor (`orders.producerStatus`)
- `unread`
- `read`
- `prepared`
- `delivered`

### 3.4 Modo compromiso ecocesta (`users.ecoCommitment.mode`)
- `weekly`
- `biweekly`

### 3.5 Paridad compromiso (`users.ecoCommitment.parity`)
- `even`
- `odd`
- `null` (si no aplica)

### 3.5.b Paridad de productor (`users.producerParity`)
- `even`
- `odd`
- `null` (si no aplica)

### 3.6 Stock de producto (`products.stockMode`)
- `finite`
- `infinite`

### 3.6.b Modo de precio (`products.pricingMode`)
- `fixed`
- `weight`

### 3.6.c Opcion ecocesta en pedido (`orderlines.ecoBasketOptionAtOrder`)
- `pickup`
- `no_pickup`
- `null`

### 3.7 Tipo compra comun (`products.commonPurchaseType`)
- `seasonal`
- `spot`
- `null`

### 3.8 Tipo turno (`shifts.type`)
- `delivery`
- `market`

### 3.9 Estado de turno (`shifts.status`)
- `planned`
- `swap_pending`
- `confirmed`

### 3.10 Origen de turno (`shifts.source`)
- `app`
- `google_sheets`

### 3.11 Estado de solicitud de intercambio (`shiftSwapRequests.status`)
- `pending`
- `accepted`
- `requester_confirmed`
- `rejected`
- `cancelled`
- `applied`

### 3.12 Plataforma de dispositivo (`users/{userId}/devices.platform`)
- `android`
- `ios`

### 3.13 Tipo de evento de notificación (`notificationEvents.type`)
- `order_reminder`
- `order_auto_generated`
- `shift_swap_requested`
- `shift_swap_accepted`
- `shift_swap_applied`
- `shift_updated`
- `news_published`
- `admin_broadcast`

### 3.14 Objetivo de notificación (`notificationEvents.target`)
- `all`
- `users`
- `segment`

### 3.15 Tipo de segmento (`notificationEvents.targetPayload.segmentType`)
- `members_with_pending_order`
- `users_with_shift`
- `producers_by_vendor`
- `role`

## 4. Colecciones canonicas MVP

Prefijos de ruta para cada coleccion descrita abajo:
- Dataset legacy: `<env>/collections/<collectionName>/...`
- Dataset nuevo: `<env>/plus-collections/<collectionName>/...`
- `<env>`: `develop` o `production`

## 4.1 `users/{userId}`

| Campo | Tipo | Req | Editable | Notas |
|---|---|---|---|---|
| `displayName` | string | si | si | Nombre visible del socio |
| `email` | string | si | no | Fuente Auth |
| `emailNormalized` | string | si | no | Email normalizado (`trim().lowercase()`) para lookup de autorización |
| `authUid` | string\|null | no | sistema/admin | `null` hasta primer login autorizado |
| `phone` | string | no | si | Telefono de contacto |
| `roles` | array<string> | si | admin | `member`, `producer`, `admin` |
| `isActive` | bool | si | admin | Alta/baja operativa |
| `producerCatalogEnabled` | bool | si | productor/admin | Flag de negocio del productor para visibilidad de su catalogo (por defecto `true`) |
| `producerParity` | string\|null | no | admin | `even` / `odd` / `null`; clasifica productores de ecocesta por paridad fija |
| `isCommonPurchaseManager` | bool | si | admin | Marca si el socio gestiona compras comunes |
| `ecoCommitment.mode` | string | si | admin | `weekly` o `biweekly` |
| `ecoCommitment.parity` | string\|null | no | admin | `even` / `odd` si biweekly |
| `settings.theme` | string | si | usuario | `light`/`dark`/`system` |
| `createdAt` | timestamp | si | no | Alta doc |
| `updatedAt` | timestamp | si | sistema | Ultima modificacion |
| `archivedAt` | timestamp\|null | no | admin | Borrado logico opcional |
| `lastDeviceId` | string\|null | no | sistema | Ultimo dispositivo activo del socio |

Subcoleccion `users/{userId}/devices/{deviceId}`:

| Campo | Tipo | Req | Editable | Notas |
|---|---|---|---|---|
| `deviceId` | string | si | no | Debe coincidir con docId |
| `platform` | string | si | sistema/usuario | `android` o `ios` |
| `appVersion` | string | si | sistema/usuario | Version app instalada |
| `osVersion` | string | si | sistema/usuario | Version sistema operativo |
| `apiLevel` | number\|null | no | sistema/usuario | Android: numero; iOS: `null` |
| `manufacturer` | string\|null | no | sistema/usuario | Requerido en Android, nullable en iOS |
| `model` | string\|null | no | sistema/usuario | Requerido en Android, nullable en iOS |
| `fcmToken` | string\|null | no | sistema | Ultimo token FCM conocido del dispositivo |
| `tokenUpdatedAt` | timestamp\|null | no | sistema | Ultima actualizacion del token FCM |
| `firstSeenAt` | timestamp | si | sistema | Primera vez detectado |
| `lastSeenAt` | timestamp | si | sistema | Ultima actividad detectada |

## 4.2 `sharedProfiles/{userId}`

| Campo | Tipo | Req | Editable | Notas |
|---|---|---|---|---|
| `userId` | string | si | no | Debe coincidir con docId |
| `familyNames` | string | no | propietario | Nombres unidad familiar |
| `photoUrl` | string\|null | no | propietario | URL en Storage |
| `about` | string | no | propietario | Texto libre |
| `updatedAt` | timestamp | si | sistema | |

Regla: lectura para socios autenticados; escritura solo propietario o admin.

## 4.3 `products/{productId}`

| Campo | Tipo | Req | Editable | Notas |
|---|---|---|---|---|
| `vendorId` | string | si | no | Inmutable tras creacion |
| `companyName` | string | si | si | Visible en buscador/listados |
| `name` | string | si | si | |
| `description` | string | no | si | |
| `productImageUrl` | string\|null | no | si | URL de imagen (Storage/media) |
| `price` | number | si | si | Precio actual |
| `pricingMode` | string | si | si | `fixed` o `weight` |
| `weightStep` | number\|null | no | si | Requerido si `pricingMode == weight` (misma unidad que `unitName`) |
| `minWeight` | number\|null | no | si | Opcional solo en `weight` (misma unidad que `unitName`) |
| `maxWeight` | number\|null | no | si | Opcional solo en `weight` (misma unidad que `unitName`) |
| `unitName` | string | si | si | Ej. unidad/kg/docena |
| `unitAbbreviation` | string | no | si | Abreviatura para UI compacta (ej. `kg`, `gr`) |
| `unitPlural` | string | si | si | |
| `unitQty` | number | si | si | Cantidad base |
| `packContainerName` | string | no | si | Ej. caja/bolsa |
| `packContainerAbbreviation` | string | no | si | Abreviatura para UI compacta |
| `packContainerPlural` | string | no | si | |
| `packContainerQty` | number | no | si | |
| `isAvailable` | bool | si | si | Disponible esta semana |
| `stockMode` | string | si | si | `finite` o `infinite` |
| `stockQty` | number\|null | no | si | Requerido si `finite` |
| `isEcoBasket` | bool | si | si | Marca ecocesta |
| `isCommonPurchase` | bool | si | si | Marca compra comun |
| `commonPurchaseType` | string\|null | no | si | `seasonal`/`spot` |
| `archived` | bool | si | admin/productor | Borrado logico |
| `createdAt` | timestamp | si | no | |
| `updatedAt` | timestamp | si | sistema | |

Nota de modelado:
- `products` debe mantenerse como catalogo estable sin atarlo a una campaña o año concreto.
- La temporalidad pertenece a `seasonalCommitments` y, si hiciera falta mas adelante, a una futura entidad de campañas.
- La eleccion `pickup`/`no_pickup` no es atributo de producto; pertenece a la linea de pedido semanal.

## 4.4 `orders/{orderId}`

| Campo | Tipo | Req | Editable | Notas |
|---|---|---|---|---|
| `userId` | string | si | no | Propietario pedido |
| `consumerDisplayName` | string | si | no | Snapshot del nombre visible del comprador a nivel pedido |
| `week` | number | si | no | Semana ISO numerica |
| `weekKey` | string | si | no | Formato `YYYY-Www` |
| `deliveryDate` | timestamp | si | no/admin | Deriva de `deliveryCalendar` |
| `consumerStatus` | string | si | usuario/sistema | `sin_hacer`/`en_carrito`/`confirmado` |
| `producerStatus` | string | si | productor/sistema | `unread`/`read`/`prepared`/`delivered`; valor inicial `unread` |
| `total` | number | si | sistema | Recalculado |
| `totalsByVendor` | map<string, number> | no | sistema | Subtotales por productor con clave `vendorId` |
| `isAutoGenerated` | bool | si | sistema | Pedido por olvido (si aplica) |
| `autoGeneratedReason` | string\|null | no | sistema | Campo opcional de trazabilidad; usar cuando `isAutoGenerated = true` (valor actual: `forgotten_commitment`) |
| `createdAt` | timestamp | si | no | |
| `updatedAt` | timestamp | si | sistema | |
| `confirmedAt` | timestamp\|null | no | sistema | |

Regla: un pedido por usuario+weekKey (unicidad logica).

Regla de snapshot:
- `consumerDisplayName` debe copiarse desde `users.displayName` al crear el pedido por primera vez.
- Si el socio cambia luego su nombre de perfil, los pedidos historicos deben conservar el valor ya guardado.
- Si una regla de negocio permitiera sustituir la identidad compradora de un pedido ya existente, el snapshot debe reescribirse junto con `userId`; en caso contrario permanece inmutable.

## 4.5 `orderlines/{orderlineId}`

| Campo | Tipo | Req | Editable | Notas |
|---|---|---|---|---|
| `orderId` | string | si | no | FK logica |
| `userId` | string | si | no | Duplicado para query |
| `productId` | string | si | no | |
| `vendorId` | string | si | no | |
| `consumerDisplayName` | string | si | no | Snapshot duplicado del comprador para agrupacion/vistas de productor |
| `companyName` | string | si | no | Snapshot |
| `productName` | string | si | no | Snapshot |
| `productImageUrl` | string\|null | no | no | Snapshot |
| `quantity` | number | si | usuario | Cantidad pedida |
| `priceAtOrder` | number | si | no | Snapshot precio |
| `subtotal` | number | si | sistema | `quantity * priceAtOrder` |
| `pricingModeAtOrder` | string | si | no | `fixed` o `weight` |
| `unitName` | string | no | no | Snapshot unidad |
| `unitAbbreviation` | string\|null | no | no | Snapshot abreviatura unidad |
| `unitPlural` | string | no | no | Snapshot unidad plural |
| `unitQty` | number | no | no | Snapshot unidad qty |
| `packContainerName` | string | no | no | Snapshot |
| `packContainerAbbreviation` | string\|null | no | no | Snapshot abreviatura pack |
| `packContainerPlural` | string | no | no | Snapshot |
| `packContainerQty` | number | no | no | Snapshot |
| `ecoBasketOptionAtOrder` | string\|null | no | no | Snapshot `pickup`/`no_pickup` |
| `week` | number | si | no | |
| `weekKey` | string | si | no | |
| `createdAt` | timestamp | si | no | |
| `updatedAt` | timestamp | si | sistema | |

Nota de modelo de lectura para productor:
- Conviene cargar `Pedidos recibidos` desde `orderlines` filtradas por `vendorId`.
- La pestaña por producto agrupa/ordena esas lineas por producto/productor.
- La pestaña por usuario reutiliza el mismo dataset agrupando por `consumerDisplayName` (con `userId` como clave estable de respaldo).
- `orders` queda como fuente de estado global, totales y trazabilidad del pedido completo.

Regla de snapshot:
- `consumerDisplayName` debe escribirse en la linea con el mismo valor guardado en `orders.consumerDisplayName` al crear cada `orderline`.
- Si las lineas de un pedido se regeneran o reconstruyen, deben conservar o repoblar ese mismo valor desde el pedido padre.
- Los cambios posteriores en `users.displayName` no deben propagarse retroactivamente a lineas ya historicas.

## 4.6 `deliveryCalendar/{weekKey}`

| Campo | Tipo | Req | Editable | Notas |
|---|---|---|---|---|
| `weekKey` | string | si | no | Debe coincidir con docId |
| `deliveryDate` | timestamp | si | admin | Dia real reparto |
| `ordersBlockedDate` | timestamp | si | sistema/admin | Dia +1 reparto |
| `ordersOpenAt` | timestamp | si | sistema/admin | Dia +2 00:00 |
| `ordersCloseAt` | timestamp | si | sistema/admin | Domingo 23:59 |
| `updatedBy` | string | si | sistema | Admin UID |
| `updatedAt` | timestamp | si | sistema | |

Estrategia canonica de calendario:
- `weekKey` debe coincidir con el ID del documento.
- `deliveryCalendar` guarda solo semanas excepcionales.
- Si falta el documento de una semana, el sistema resuelve desde `config/global.deliveryDayOfWeek` y deriva ventanas de bloqueo/apertura en runtime.

## 4.7 `seasonalCommitments/{commitmentId}`

| Campo | Tipo | Req | Editable | Notas |
|---|---|---|---|---|
| `userId` | string | si | admin | |
| `productId` | string | si | admin | |
| `seasonKey` | string | si | admin | Ej. `2026-mango` |
| `fixedQtyPerOfferedWeek` | number | si | admin | Cantidad fija |
| `active` | bool | si | admin | |
| `createdAt` | timestamp | si | sistema | |
| `updatedAt` | timestamp | si | sistema | |

## 4.8 `shifts/{shiftId}`

| Campo | Tipo | Req | Editable | Notas |
|---|---|---|---|---|
| `type` | string | si | sistema/admin | `delivery`/`market` |
| `date` | timestamp | si | sistema/admin | |
| `assignedUserIds` | array<string> | si | sistema/admin | 1-2 en reparto, >=3 en mercado |
| `helperUserId` | string\|null | no | sistema/admin | Reparto |
| `status` | string | si | sistema | `planned`/`swap_pending`/`confirmed` |
| `source` | string | si | sistema | `app`/`google_sheets` |
| `createdAt` | timestamp | si | no | |
| `updatedAt` | timestamp | si | sistema | |

## 4.9 `shiftSwapRequests/{requestId}`

| Campo | Tipo | Req | Editable | Notas |
|---|---|---|---|---|
| `shiftId` | string | si | no | |
| `requesterUserId` | string | si | no | |
| `targetUserId` | string | si | no | |
| `status` | string | si | sistema/flujo | Enum swaps |
| `requestedAt` | timestamp | si | no | |
| `respondedAt` | timestamp\|null | no | sistema | |
| `confirmedAt` | timestamp\|null | no | sistema | |
| `appliedAt` | timestamp\|null | no | sistema | |

## 4.10 `news/{newsId}`

| Campo | Tipo | Req | Editable | Notas |
|---|---|---|---|---|
| `title` | string | si | admin | |
| `body` | string | si | admin | |
| `publishedBy` | string | si | sistema/admin | |
| `publishedAt` | timestamp | si | sistema/admin | |
| `active` | bool | si | admin | |
| `urlImage` | string\|null | no | admin | URL opcional de imagen para enriquecer la noticia |

## 4.11 `notificationEvents/{eventId}` (recomendado MVP)

| Campo | Tipo | Req | Editable | Notas |
|---|---|---|---|---|
| `title` | string | si | sistema/admin | titulo mostrado en push y listado |
| `body` | string | si | sistema/admin | cuerpo mostrado en push y listado |
| `type` | string | si | sistema/admin | `order_reminder`/`order_auto_generated`/`shift_swap_requested`/`shift_swap_accepted`/`shift_swap_applied`/`shift_updated`/`news_published`/`admin_broadcast` |
| `target` | string | si | sistema/admin | `all`/`segment`/`users` |
| `targetPayload` | map | no | sistema/admin | Contrato segun `target` |
| `sentAt` | timestamp | si | sistema | |
| `createdBy` | string | si | sistema/admin | `system` o UID |
| `weekKey` | string\|null | no | sistema | |

Contrato de `targetPayload`:
- Para `target == all`: mapa vacio o `null`.
- Para `target == users`: `{ userIds: string[] }` obligatorio y no vacio.
- Para `target == segment`: `{ segmentType: string, ... }` con estas formas:
  - `segmentType == members_with_pending_order`: requiere `weekKey`.
  - `segmentType == users_with_shift`: requiere `shiftId`.
  - `segmentType == producers_by_vendor`: requiere `vendorId`.
  - `segmentType == role`: requiere `role` (`member`/`producer`/`admin`).

## 4.12 `config/global` (configuracion operativa por entorno)

Ruta actual en produccion/desarrollo:
- `develop/collections/config/global`
- `production/collections/config/global`

Ruta objetivo compatible para dataset nuevo:
- `develop/plus-collections/config/global`
- `production/plus-collections/config/global`

Campos actuales en uso (se deben preservar):
- `cacheExpirationMinutes` (number, requerido)
- `lastTimestamps` (map, requerido)
  - claves actuales: `containers`, `measures`, `orderlines`, `orders`, `products`, `users`
  - se añadiran nuevas claves cuando nuevas colecciones en `plus-collections` entren en sync critica
- `otherConfig` (map, requerido)
  - `deliveryDayOfWeek` (string, requerido, formato actual tipo `WED`)
- `versions` (map, requerido)
  - `android.current` (string, requerido)
  - `android.min` (string, requerido)
  - `android.forceUpdate` (bool, requerido)
  - `android.storeUrl` (string, requerido)
  - `ios.current` (string, requerido)
  - `ios.min` (string, requerido)
  - `ios.forceUpdate` (bool, requerido)
  - `ios.storeUrl` (string, requerido)

Nota de normalizacion para `plus-collections`:
- Se prefiere `deliveryDayOfWeek` en primer nivel.
- Debe mantenerse compatibilidad de lectura con `otherConfig.deliveryDayOfWeek`.
- `deliveryDayOfWeek` se mantiene obligatorio mientras `deliveryCalendar` siga estrategia de solo excepciones.

## 4.13 Dataset legacy en `collections` (as-is)

Nombres actuales bajo `<env>/collections`:
- `config` (documento `global`)
- `containers`
- `measures`
- `news` (actualmente vacia)
- `orders`
- `orderLines` (nombre legacy real en BD)
- `products`
- `users` (con subcoleccion `devices`)

Nota de nomenclatura canonica:
- En specs/docs se usa `orderlines`; la migracion/adaptadores deben mapear `orderLines` <-> `orderlines` sin riesgo.

## 4.13.1 Campos legacy confirmados en `collections` (datos actuales)

`containers/{containerId}`:
- `name`
- `plural`

`measures/{measureId}`:
- `abbreviation`
- `name`
- `plural`
- `type`

`users/{userId}` (muestra observada, no exhaustiva):
- `available`
- `companyName`
- `email`
- `isAdmin`
- `isProducer`
- `lastDeviceId`
- `name`
- `numResignations`
- `phone`
- `surname`
- `tropical1`
- `tropical2`
- `typeConsumer`
- `typeProducer`
- subcoleccion: `devices`

`products/{productId}` (muestra observada, no exhaustiva):
- `available`
- `companyName`
- `container`
- `description`
- `name`
- `price`
- `quantityContainer`
- `quantityWeight`
- `stock`
- `unity`
- `urlImage`
- `userId`

`orders/{orderId}` (muestra observada, no exhaustiva):
- `name`
- `surname`
- `userId`
- `week`

`orderLines/{orderLineId}` (muestra observada, no exhaustiva):
- `companyName`
- `orderId`
- `productId`
- `quantity`
- `subtotal`
- `userId`
- `week`

Nota de migracion:
- Antes de ejecutar migraciones en produccion, hacer inventario completo de esquema para `users`, `products`, `orders` y `orderLines` en `develop/collections` y `production/collections`.

## 5. Reglas de validacion de negocio (obligatorias)

- `users.roles` debe contener siempre al menos `member` para socios activos.
- `users.emailNormalized` debe ser unico entre socios activos.
- `users.producerCatalogEnabled` debe ser booleano y no debe guardarse dentro de `users.settings`.
- `users.producerParity` debe ser `even`, `odd` o `null`.
- `users.isCommonPurchaseManager` debe ser booleano.
- Un usuario autenticado solo tiene acceso operativo si existe `users` con `emailNormalized` coincidente e `isActive == true`.
- En primer login autorizado, si `users.authUid` es `null`, se enlaza con UID autenticado; si ya existe, debe coincidir.
- Si no existe socio preautorizado para el email autenticado, la app debe mostrar alerta de no autorizado y bloquear acciones operativas.
- Si `users.lastDeviceId` tiene valor, debe existir `users/{userId}/devices/{lastDeviceId}`.
- En `users/{userId}/devices`, `platform` solo admite `android` o `ios`.
- En iOS, `apiLevel` debe ser `null`; en Android debe ser numero >= 0.
- Consistencia temporal de dispositivo: `firstSeenAt <= lastSeenAt`.
- `config/global.versions.android` y `config/global.versions.ios` deben incluir `current`, `min`, `forceUpdate` y `storeUrl` antes del gate de arranque.
- `config/global.cacheExpirationMinutes` debe ser > 0.
- El dia de reparto debe poder leerse de `config/global.deliveryDayOfWeek` (preferido) o `config/global.otherConfig.deliveryDayOfWeek` (compatibilidad).
- Los documentos `deliveryCalendar/{weekKey}` son solo excepciones; si no existe documento de semana, aplica el calendario por defecto de `deliveryDayOfWeek`.
- `config/global.lastTimestamps` debe incluir las colecciones criticas usadas por la puerta de frescura.
- No se permite revocar `admin` si deja la app sin ningun admin.
- `products.vendorId` no se puede modificar tras creacion.
- Si `products.productImageUrl` tiene valor, debe ser una URL valida de Storage/media.
- Si `products.stockMode == finite`, entonces `stockQty` es requerido y >= 0.
- La visibilidad de producto en pedido debe exigir a la vez:
  - `users.producerCatalogEnabled == true` del productor
  - `products.isAvailable == true`
  - `products.archived == false`
- Un `orders` por `userId + weekKey` (unicidad logica).
- `orders.total` debe ser suma de `orderlines.subtotal` del pedido.
- `orders.producerStatus` es obligatorio y solo admite `unread`, `read`, `prepared`, `delivered` (sin estado `null`).
- `orders.totalsByVendor` debe usar claves `vendorId` (no `companyName`) para estabilidad.
- `orders.autoGeneratedReason` es opcional y solo tiene sentido cuando `isAutoGenerated == true`; conjunto actual: `forgotten_commitment`.
- En confirmacion de pedido, deben cumplirse compromisos:
  - ecocesta semanal/bisemanal,
  - compromisos de temporada activos.
- La cantidad minima de ecocesta es una regla fija (=1) y no se modela como campo por socio.
- Si existe una linea de ecocesta, `orderlines.ecoBasketOptionAtOrder` puede ser `pickup` o `no_pickup`.
- `ecoBasketOptionAtOrder = no_pickup` significa que se paga igualmente, pero el productor no la prepara para recogida.
- Todos los productos de ecocesta activos deben compartir el mismo `price`, sin diferencias por `orderlines.ecoBasketOptionAtOrder` (`pickup`/`no_pickup`) ni por productor par/impar.
- Socio con `isActive == false` queda excluido de:
  - recordatorios por olvido,
  - auto-generacion de pedido por olvido,
  - planificacion de turnos.
- En mercado (`shifts.type == market`) debe haber minimo 3 asignados.
- `shifts.source` solo admite `app` o `google_sheets` (sin otros valores).
- `notificationEvents.targetPayload` debe respetar `target`:
  - `all`: payload vacio o `null`.
  - `users`: `userIds` no vacio.
  - `segment`: `segmentType` valido y claves obligatorias segun el tipo de segmento.
- Si `products.pricingMode == weight`, `price` y `weightStep` son requeridos y > 0.
- Si `orderlines.pricingModeAtOrder == weight`, `quantity` almacena cantidad de peso (permite decimal, en `unitName`) y `subtotal = quantity * priceAtOrder`.

## 6. Indices minimos recomendados

- `orders`: `(userId ASC, weekKey DESC)`
- `orders`: `(weekKey ASC, consumerStatus ASC)`
- `orderlines`: `(orderId ASC, companyName ASC)`
- `orderlines`: `(vendorId ASC, weekKey DESC)`
- `products`: `(vendorId ASC, archived ASC, isAvailable ASC)`
- `users`: `(emailNormalized ASC, isActive ASC)`
- `users/{userId}/devices`: `(lastSeenAt DESC)` (si se consulta historial por recencia)
- `shifts`: `(date ASC, type ASC)`
- `shiftSwapRequests`: `(targetUserId ASC, status ASC, requestedAt DESC)`
- `seasonalCommitments`: `(userId ASC, seasonKey ASC, active ASC)`

## 7. Mapeo a modelos Android/iOS (guia)

Recomendacion de nombres de DTO (alineados cross-platform):
- `UserDto`
- `DeviceDto`
- `SharedProfileDto`
- `ProductDto`
- `OrderDto`
- `OrderLineDto`
- `DeliveryCalendarDto`
- `SeasonalCommitmentDto`
- `ShiftDto`
- `ShiftSwapRequestDto`
- `NewsDto`
- `NotificationEventDto`

Regla de implementacion de modelos:
- Decodificacion tolerante (campos opcionales con defaults) para compatibilidad incremental.
- Validacion fuerte en capa dominio antes de persistir cambios.

## 8. Versionado de contrato

- Version actual: `v1` (este documento).
- Cualquier cambio de contrato debe:
  - actualizar este archivo,
  - reflejarse en specs afectadas,
  - incluir plan de migracion si rompe compatibilidad.
