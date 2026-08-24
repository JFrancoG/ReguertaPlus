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
  - `develop/collections/...` y `production/collections/...` son los arboles
    legacy vivos que consumen las apps actualmente publicadas.
  - `develop/plus-collections/...` y `production/plus-collections/...` son los
    arboles de Reguerta+.
  - `local` se considera runtime/emulador, no namespace cloud obligatorio.
- `develop` y `production` conviven intencionadamente en el mismo proyecto
  Firebase y se mantienen cercanos para los flujos de testers. El namespace es
  contexto de enrutado, nunca prueba de identidad, rol, propiedad o autorizacion.
- IDs de documentos:
  - `users/{userId}`: ID interno estable del socio (no tiene que coincidir con Firebase Auth UID).
  - `users.authUid`: Firebase Auth UID tras primer login autorizado (nullable antes de ese primer acceso).
  - `authLinks/{firebaseUid}`: enlace determinista, propiedad del servidor, a `users/{memberId}`.
  - `users/{userId}/devices/{deviceId}`: metadatos por dispositivo para notificaciones push y diagnostico.
  - `users/{userId}/notificationReads/{eventId}`: marcas de lectura por usuario para notificaciones in-app.
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

### 3.10.b Procedencia de turno generado (`shifts.origin`)
- `planner`

### 3.11 Estado de solicitud de intercambio (`shiftSwapRequests.status`)
- `open`
- `cancelled`
- `applied`

### 3.11.b Estado de respuesta de intercambio (`shiftSwapRequests.responses.status`)
- `available`
- `unavailable`

### 3.12 Plataforma de dispositivo (`users/{userId}/devices.platform`)
- `android`
- `ios`

### 3.13 Tipo de evento de notificación (`notificationEvents.type`)
- `order_reminder`
- `order_auto_generated`
- `shift_swap_requested`
- `shift_swap_available`
- `shift_swap_unavailable`
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
- `role`

## 4. Colecciones canonicas MVP

Prefijos de ruta para cada coleccion descrita abajo:
- Dataset runtime: `<env>/plus-collections/<collectionName>/...`
- `<env>`: `develop` o `production`

## 4.1 `users/{userId}`

| Campo | Tipo | Req | Editable | Notas |
|---|---|---|---|---|
| `displayName` | string | si | admin | Nombre visible del socio |
| `normalizedEmail` | string | si | admin | Email canonico normalizado (`trim().lowercase()`) para lookup de autorizacion |
| `email` / `emailNormalized` | string | no | no | Aliases legacy aceptados solo durante migracion; las escrituras confiables los eliminan |
| `authUid` | string\|null | no | sistema | `null` hasta primer login autorizado |
| `phoneNumber` | string | no | admin | Telefono de contacto; los lectores aceptan aliases legacy como `phone` |
| `roles` | array<string> | si | admin | `member`, `producer`, `admin` |
| `isActive` | bool | si | admin | Alta/baja operativa |
| `producerCatalogEnabled` | bool | si | productor/admin | Flag de negocio del productor para visibilidad de su catalogo (por defecto `true`) |
| `producerParity` | string\|null | no | admin | `even` / `odd` / `null`; clasifica productores de ecocesta por paridad fija |
| `isCommonPurchaseManager` | bool | si | admin | Marca si el socio gestiona compras comunes |
| `ecoCommitment.mode` | string | si | admin | `weekly` o `biweekly` |
| `ecoCommitment.parity` | string\|null | no | admin | `even` / `odd` si biweekly |
| `settings.theme` | string | no | no | Campo legacy/reservado; las preferencias actuales son locales |
| `createdAt` | timestamp | si | no | Alta doc |
| `updatedAt` | timestamp | si | sistema | Ultima modificacion |
| `archivedAt` | timestamp\|null | no | admin | Borrado logico opcional |
| `lastDeviceId` | string\|null | no | propietario | Debe referenciar un dispositivo propio existente |

Subcoleccion `users/{userId}/devices/{deviceId}`:

| Campo | Tipo | Req | Editable | Notas |
|---|---|---|---|---|
| `deviceId` | string | si | no | Debe coincidir con docId |
| `platform` | string | si | sistema/usuario | `android` o `ios` |
| `appVersion` | string | si | sistema/usuario | Version app instalada |
| `osVersion` | string | si | sistema/usuario | Version sistema operativo |
| `apiLevel` | integer\|null | no | sistema/usuario | Android: entero no negativo y obligatorio; iOS: `null` |
| `manufacturer` | string\|null | no | sistema/usuario | Metadato opcional |
| `model` | string\|null | no | sistema/usuario | Metadato opcional |
| `fcmToken` | string\|null | no | sistema | Ultimo token FCM conocido del dispositivo |
| `tokenUpdatedAt` | timestamp\|null | no | sistema | Ultima actualizacion del token FCM |
| `firebaseInstallationId` | string\|null | no | sistema | Firebase Installation ID de Android para la API de registro FCM actual; se envia separado de los tokens legacy/iOS |
| `registrationUpdatedAt` | timestamp\|null | no | sistema | Ultima actualizacion de `firebaseInstallationId` |
| `firstSeenAt` | timestamp | si | sistema | Primera vez detectado |
| `lastSeenAt` | timestamp | si | sistema | Ultima actividad detectada |

Subcoleccion `users/{userId}/notificationReads/{eventId}`:

| Campo | Tipo | Req | Editable | Notas |
|---|---|---|---|---|
| `notificationEventId` | string | si | no | Debe coincidir con docId y con `notificationEvents/{eventId}` cuando exista |
| `readAt` | timestamp | si | sistema | Momento en que el usuario salio de la pantalla de notificaciones con el evento visible |

## 4.1.b `authLinks/{firebaseUid}`

| Campo | Tipo | Req | Editable | Notas |
|---|---|---|---|---|
| `memberId` | string | si | sistema | Referencia el documento canonico `users/{memberId}` |

Contrato de autorizacion:

- Solo backend confiable y scripts de migracion controlados crean o modifican
  estos documentos.
- Un cliente solo puede obtener `authLinks/{request.auth.uid}` y nunca puede
  listar, crear, actualizar ni borrar enlaces de identidad.
- El acceso operativo exige que `users.authUid == request.auth.uid`, que el
  socio enlazado tenga `isActive == true` y que contenga el rol canonico
  `member`. Ambas direcciones del enlace deben coincidir.
- El primer enlace verifica en backend el Firebase ID token y su email
  verificado, y escribe `users.authUid` y `authLinks/{uid}` en una transaccion.

## 4.1.c `memberDirectory/{memberId}`

Proyeccion sin PII, propiedad del backend, para descubrir socios:

| Campo | Tipo | Req | Editable | Notas |
|---|---|---|---|---|
| `userId` | string | si | sistema | Coincide con el ID canonico del documento `users` |
| `displayName` | string | si | sistema | Nombre visible |
| `companyName` | string\|null | no | sistema | Nombre de empresa visible |
| `roles` | array<string> | si | sistema | Solo roles canonicos |
| `isActive` | bool | si | sistema | Solo se proyectan documentos con valor `true` |
| `producerCatalogEnabled` | bool | si | sistema | Capacidad visible de catalogo |
| `isCommonPurchaseManager` | bool | si | sistema | Capacidad visible de compra comun |
| `producerParity` | string\|null | no | sistema | `even` / `odd` / `null` |
| `ecoCommitment` | map | si | sistema | `mode` y `parity` canonicos |

La proyeccion nunca puede contener `normalizedEmail`, aliases legacy de email,
`phoneNumber`, aliases legacy de telefono, `authUid`, datos de dispositivos ni
configuracion reviewer. Solo backend confiable la escribe. En
`plus-collections` estricto, un socio activo puede consultar el directorio,
mientras que los documentos `users` completos solo los leen su propietario o
admin. Las apps legacy publicadas siguen usando el arbol separado `collections`
durante la migracion.

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
| `minWeight` | number\|null | no | si | Requerido si `pricingMode == weight` (kg en la app movil) |
| `maxWeight` | number\|null | no | si | Requerido si `pricingMode == weight` (kg en la app movil) |
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
| `fixedQty` | number | si | admin | Cantidad fija (campo canonico) |
| `fixedQtyPerOfferedWeek` | number | no | admin | Alias legacy temporal |
| `fixedQtyPerWeek` | number | no | admin | Alias legacy temporal |
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
| `origin` | string\|null | no | sistema | `planner` para un turno generado por HU-082 |
| `planningRequestId` | string\|null | no | sistema | Linaje de la peticion que genero el turno |
| `bundleRevision` | string\|null | no | sistema | Revision de publicacion; obligatoria en el futuro adaptador HU-082 |
| `bundleDigest` | string\|null | no | sistema | Digest ligado a `bundleRevision`; obligatorio en el futuro adaptador HU-082 |
| `writeEpoch` | integer\|null | no | sistema | Epoca de mantenimiento/publicacion; obligatoria en el futuro adaptador HU-082 |
| `projectionSeasonStartYear` | integer\|null | no | sistema | Temporada en cuya proyeccion cae la fecha |
| `rotationOwnerUserId` | string\|null | no | sistema | Propietario inmutable de cola para un reparto generado |
| `rotationOwnerUserIds` | array<string>\|null | no | sistema | Tres propietarios inmutables de cola para un mercado generado |
| `roundNumber` | integer\|null | no | sistema | Ronda, desde 1, del propietario de reparto |
| `positionInRound` | integer\|null | no | sistema | Posicion, desde 1, del propietario de reparto |
| `rotationPositions` | array<map>\|null | no | sistema | Posiciones de mercado alineadas con `assignedUserIds` |
| `planningReason` | string\|null | no | sistema | `target`/`boundaryRoundRemainder`; una posicion de mercado tambien puede ser `finalGroupPadding` |
| `createdAt` | timestamp | si | no | |
| `updatedAt` | timestamp | si | sistema | |

Cada elemento de `rotationPositions` contiene
`rotationOwnerUserId`, `effectiveAssigneeUserId`, `roundNumber` y
`positionInRound`. HU-082 separa la asignacion efectiva (`assignedUserIds`) de
la propiedad de rotacion. Una posicion nueva copia inicialmente su propietario
como asignado efectivo, pero una cobertura o reasignacion posterior no puede
reescribir propietario, ronda ni posicion. Los turnos generados conservan
compatibilidad usando `source = app`; `origin = planner` y los campos de linaje
los distinguen de una edicion ordinaria de la app. Revision, digest, epoca y
persistencia completa de propiedad son el contrato previsto para el adaptador
de publicacion/activacion. Este corte aun no activa ese adaptador ni esas
escrituras en `index.ts`.

## 4.8.b `shiftPlanningRequests/{requestId}`

| Campo | Tipo | Req | Editable | Notas |
|---|---|---|---|---|
| `schemaVersion` | integer | si | no | Valor exacto `2` |
| `requestId` | string | si | no | Coincide con el ID del documento |
| `bundleId` | string | si | no | ID estable compartido por los dos subplanes |
| `environment` | string | si | no | `develop`/`production`; coincide con `<env>` de la ruta |
| `requestedByUserId` | string | si | no | Socio admin enlazado que crea la peticion |
| `requestedAt` | timestamp | si | no | `Timestamp` de Firestore; el parser de Functions lo normaliza internamente a `requestedAtMillis` |
| `mode` | string | si | no | `preview`/`stage`/`activate` |
| `status` | string | si | no | Valor exacto de entrada `requested` |
| `expectedWriteEpoch` | integer | si | no | Precondicion no negativa |
| `expectedActiveRevision` | string\|null | si | no | Precondicion optimista |
| `subplans` | map | si | no | Claves exactas `delivery` y `market` |
| `binding` | map\|null | si | no | Binding exacto discriminado por modo |

Cada subplan contiene solo `targetSeasonStartYear`, entero entre 2000 y 9998.
El `binding` es:

- `preview`: `null`;
- `stage`: mapa exacto
  `{ kind: "preview", sourceRequestId, bundleRevision, bundleDigest }`;
- `activate`: mapa exacto
  `{ kind: "candidate", candidateId, bundleRevision, bundleDigest, candidateDigest }`.

`bundleDigest` y `candidateDigest` usan el formato
`shift-planning:v1:sha256:<64 caracteres hexadecimales minusculos>`. El esquema
v2 es cerrado: un campo extra o ausente falla, y el backend nunca deduce ninguna
de las temporadas por la fecha actual. En Rules estrictas solo un admin activo y
enlazado puede crear y leer peticiones; la creacion tambien liga `requestId`,
`environment` y `requestedByUserId` al estado autenticado de la ruta. Ningun
cliente puede actualizar ni borrar una peticion.

## 4.8.c `shiftPlanningCandidates/{bundleId}`

Candidato versionado de dos subplanes que debe persistir el futuro adaptador de
staging propiedad del backend. Queda fuera de la proyeccion publica `shifts`,
la exportacion a Sheets y las consultas de socios ordinarios. Las Rules
estrictas permiten a admins activos enlazados leer, obtener y listar candidatos
para revisarlos, pero niegan create, update y delete a todo cliente, incluido
admin; solo el backend confiable puede escribirlos.

El contrato puro exige esta cadena exacta de artefactos:

1. `preview` produce un recibo ligado por digest con identidad de peticion y
   bundle, entorno, solicitante y `expectedStateDigest`. El futuro repositorio
   debe persistirlo antes de que pueda autorizar staging.
2. `stage` debe recibir ese recibo de preview persistido exacto y
   `transactionEvidence` producido por el adaptador para los manifiestos forward
   de activacion e inverse de recovery. Produce un candidato `status = staged`
   con IDs de preview/stage origen, digest del recibo, digest del estado esperado,
   revision/digest del bundle y la evidencia transaccional completa.
3. `activate` debe recibir solo ese candidato staged persistido. Su binding debe
   coincidir en `candidateId`, `bundleRevision`, `bundleDigest` y
   `candidateDigest`; `candidateDigest` cubre el candidato staged completo, no
   solo el bundle generado. Un artefacto ausente, sustituido, obsoleto o alterado
   falla antes de publicar.

La funcion pura valida los artefactos recibidos, pero no los persiste ni los
carga. Siguen pendientes el repositorio Firestore y el adaptador CAS que deben
probar esa persistencia.

La evidencia transaccional es exacta y especifica del adaptador en ambos
sentidos. Cada medicion liga `manifestDigest`, `documentWriteCount`,
`fieldTransformCount`, `requestByteCount`, `adapterRevision` e
`indexConfigurationDigest`. El gate conservador canonico del adaptador HU-082
es de 500 escrituras documentales previstas mas transformaciones de campo
declaradas, y 10 MiB por peticion transaccional serializada. El presupuesto puro
cuenta las mutaciones documentales previstas, incluidas las escrituras forward que
persisten las before-images de recovery; solo el futuro adaptador de persistencia
puede serializar las escrituras reales y aportar evidencia de
bytes/transformaciones. La autoridad de medicion (`adapterRevision` e
`indexConfigurationDigest`) forma parte del snapshot de fairness y del estado
esperado, por lo que cambiarla invalida la evidencia y el candidato staged. Stage
falla cerrado si falta una direccion, esta obsoleta, no coincide con su
manifiesto/presupuesto o supera cualquiera de los limites.

Otros invariantes del bundle puro ligados por digest son:

- `futureProjectionOccupancy` es independiente por tipo y contiene entradas
  exactas `{ seasonStartYear, occupiedPositionCount, lineageRevision,
  lineageDigest }`. Permite avanzar sobre proyecciones futuras ya completas y
  rechaza solape, temporadas duplicadas, capacidad invalida o linaje ausente.
- Un baseline de migracion esta ausente en todos los niveles o tiene exactamente
  la misma `revision`/`digest` en bundle, rotacion de reparto y rotacion de mercado.
- Hasta que HU-084 defina transiciones exactas de credito, el ledger debe estar
  desactivado y no puede contener transiciones previstas; cualquier otro valor
  falla cerrado.
- La activacion congela una cohorte tipada solo cuando su ronda activa en el
  limite queda incompleta. Una cohorte congelada conserva el orden de su cursor;
  un drift de elegibilidad live puede inspeccionarse en preview, pero bloquea
  stage y activate.
- El bundle lleva manifiestos forward e inverse ligados por digest. El manifiesto
  inverse de recovery nombra rutas creadas que borrar, rutas objetivo cuyas
  before-images persistidas debe restaurar, digests de contrato de esas imagenes,
  el CAS requerido de bundle activo/epoca y una epoca de recovery estrictamente
  superior que nunca se reutiliza ni decrementa.

## 4.8.d Colecciones de planificacion HU-082 solo backend

Los nombres siguientes quedan congelados para el plano de control privado:

- `shiftPlanningState`: `current` guarda mantenimiento, `writeEpoch` monotono y
  las claves emparejadas de linaje activo `activeRevision`/`activeDigest`.
- `shiftRotations`: agregados versionados e independientes de reparto y mercado.
- `shiftRotationMappings`: evidencia de bootstrap/migracion revisada por admin.
- `shiftPlanningBundles`: metadatos, manifiestos, presupuestos y linaje inmutables.
- `shiftPlanningSyncCommands`: comandos backend de Sheets ligados a
  workbook/revision, particion/revision de estado, epocas esperada y de comando,
  e intento de lease de claim.
- `shiftPlanningNotificationIntents`: una intencion generica retenida por
  posicion asignada, ligada a UID destinatario, turno y revisiones esperadas de
  asignacion, membership, elegibilidad y destino.
- `shiftPlanningOperations`: idempotencia/auditoria mas rutas de recovery,
  referencias/digests de before-images persistidas, CAS activo y epoca monotona
  de recovery.

Las siete colecciones son solo backend: las Rules estrictas niegan cualquier
lectura o escritura de cliente, tambien a admins. Sus esquemas internos no son
contrato movil en este corte.

Estado de rollout de este corte: el parser wire v2, los planners puros
deterministas y las Rules del plano de control/candidatos existen solo como
codigo candidato local. La implementacion legacy
`onShiftPlanningRequestCreated` de `functions/src/index.ts` sigue siendo el
runtime activo; aun no se han realizado persistencia v2, activacion, integracion
movil, despliegue ni cambios live. El candidato local de Rules Phase 1 niega a
todo cliente el nuevo plano de control, incluidas peticiones y candidatos. El
candidato estricto local permite solo la creacion/lectura admin exacta de
peticiones y la lectura admin de candidatos descritas arriba. Ninguno de esos
cambios de Rules se ha desplegado en este corte.

## 4.9 `shiftSwapRequests/{requestId}`

| Campo | Tipo | Req | Editable | Notas |
|---|---|---|---|---|
| `requestedShiftId` | string | si | no | |
| `requesterUserId` | string | si | no | |
| `reason` | string | si | no | Puede estar vacio |
| `status` | string | si | sistema/flujo | `open` / `cancelled` / `applied` |
| `candidates` | array | si | sistema | Elementos `{ userId, shiftId }` |
| `responses` | array | si | sistema/flujo | Elementos `{ userId, shiftId, status, respondedAt }`, con estado `available` / `unavailable` |
| `selectedCandidateUserId` | string\|null | no | sistema | |
| `selectedCandidateShiftId` | string\|null | no | sistema | |
| `requestedAt` | timestamp | si | no | |
| `confirmedAt` | timestamp\|null | no | sistema | |
| `appliedAt` | timestamp\|null | no | sistema | |

## 4.10 `news/{newsId}`

| Campo | Tipo | Req | Editable | Notas |
|---|---|---|---|---|
| `title` | string | si | admin | |
| `body` | string | si | admin | |
| `publishedBy` | string | si | sistema/admin | Nombre visible del autor |
| `publishedAt` | timestamp | si | sistema/admin | |
| `active` | bool | si | admin | |
| `urlImage` | string\|null | no | admin | URL opcional de imagen para enriquecer la noticia |

## 4.11 `notificationEvents/{eventId}` (recomendado MVP)

| Campo | Tipo | Req | Editable | Notas |
|---|---|---|---|---|
| `title` | string | si | sistema/admin | titulo mostrado en push y listado |
| `body` | string | si | sistema/admin | cuerpo mostrado en push y listado |
| `type` | string | si | sistema/admin | `order_reminder`/`order_auto_generated`/`shift_swap_requested`/`shift_swap_available`/`shift_swap_unavailable`/`shift_swap_accepted`/`shift_swap_applied`/`shift_updated`/`news_published`/`admin_broadcast` |
| `target` | string | si | sistema/admin | `all`/`segment`/`users` |
| `targetPayload` | map | no | sistema/admin | Contrato segun `target` |
| `sentAt` | timestamp | si | sistema | |
| `createdBy` | string | si | sistema/admin | `system` o `userId` autorizado |
| `weekKey` | string | no | sistema | Solo cuando la notificacion aplique a una semana concreta |

El estado de lectura por usuario se guarda fuera de los eventos inmutables en
`users/{userId}/notificationReads/{eventId}`. Las apps marcan como leidas las
notificaciones visibles al salir de la pantalla de notificaciones.

El backend materializa una copia inmutable del feed para cada destinatario
resuelto en `users/{userId}/notificationInbox/{eventId}`. Incluye
`notificationEventId` y los campos de presentacion y audiencia del evento
origen. Los clientes solo listan su propia bandeja; solo el backend escribe o
elimina estos documentos. La coleccion global `notificationEvents` conserva el
dispatch y la auditoria admin, pero no se consulta como feed de socio de
Reguerta+ estricto. El arbol separado `collections` conserva el contrato de feed
legacy de las apps publicadas.

Contrato de `targetPayload`:
- Para `target == all`: mapa vacio.
- Para `target == users`: `{ userIds: string[] }` obligatorio y no vacio.
- Para `target == segment`: `{ segmentType: string, ... }` con estas formas:
  - `segmentType == role`: requiere `role` (`member`/`producer`/`admin`).

## 4.12 `config/public` (configuracion anonima de arranque)

Rutas por entorno:

- `develop/plus-collections/config/public`
- `production/plus-collections/config/public`

Este documento solo contiene el mapa `versions` descrito abajo. En el objetivo
estricto es la unica lectura Firestore anonima del dataset de la aplicacion. No
debe contener allowlists de reviewer, timestamps de frescura, calendario ni
otros valores operativos.

## 4.12.b `config/member` (proyeccion operativa para socio activo)

Rutas por entorno:

- `develop/plus-collections/config/member`
- `production/plus-collections/config/member`

Campos propiedad del backend, copiados de la configuracion global autoritativa:

| Campo | Tipo | Req | Editable | Notas |
|---|---|---|---|---|
| `cacheExpirationMinutes` | number | si | sistema | Mayor que cero |
| `lastTimestamps` | map | si | sistema | Solo timestamps de frescura necesarios por cliente |
| `deliveryDayOfWeek` | string | si | sistema | Codigo normalizado de dia de la semana |

La proyeccion no puede contener politica de versiones, allowlists reviewer,
secretos ni ajustes globales ajenos. En fase estricta la puede leer cualquier
socio activo enlazado y ningun cliente puede escribirla.

## 4.12.c `config/global` (configuracion autoritativa por entorno)

Ruta actual en produccion/desarrollo:
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

En `plus-collections` estricto, el acceso a `config/global` queda limitado a
backend confiable y admin. Las apps publicadas mantienen su contrato de config
existente bajo el arbol separado `collections` hasta migrarlas.

## 4.12.d Compatibilidad del despliegue de autorizacion

El proyecto Firebase es compartido, pero las apps publicadas y Reguerta+ usan
arboles Firestore distintos. Un unico fichero de Rules debe implementar ambas
matrices de forma explicita:

0. Se restauro el breve despliegue de transicion tras detectar la dependencia de
   clientes vivos.
1. Firestore Fase 1 ya esta desplegado y releido. Mantiene lectura/escritura
   autenticada para los ocho prefijos legacy y conserva el contrato autenticado
   anterior de `plus-collections`; plus estricto no esta desplegado. Storage live
   sigue global autenticado y `storage.phase1.rules` es solo su snapshot de
   rollback semantico.
2. El dry-run de identidad bloquea el avance: develop tiene 7 admins activos y
   production 3, pero ambos tienen cero admins operativamente enlazados porque
   las cuentas Auth coincidentes no estan verificadas. No se permite desplegar
   Functions, aplicar backfills ni desplegar Rules strict antes de una decision
   del owner.
3. Tras esa decision y un dry-run seguro de enlaces admin, desplegar una
   allowlist revisada de Functions, aplicar proyecciones aditivas y desplegar y
   releer Firestore/Storage strict por separado con `firebase.strict.json`.
4. Publicar y medir adopcion, y despues migrar y retirar acceso legacy.

Storage live aun permite lectura/escritura global autenticada, incluidos listado
y borrado. El candidato strict no desplegado cambia legacy `products/**` a
`get`/`create`/`update` para autenticados y deniega `list`/`delete`. Reguerta+
`{env}/images/{products|news|shared_profiles}/...` permite `get` a socio enlazado
y `create`/`update`/`delete` por rol/owner; create/update solo JPEG <= 2 MiB y
`list` denegado. Las URLs tokenizadas ya emitidas no se reevaluan con Rules y
exigen inventario y rotacion/revocacion aparte.

## 4.13 Dataset legacy vivo de compatibilidad (`collections`)

Las apps actualmente publicadas siguen leyendo y escribiendo rutas no-plus bajo
`develop/collections/**` y `production/collections/**`. Su allowlist top-level
completa observada para compatibilidad es:
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

## 4.13.1 Campos confirmados en el dataset legacy vivo

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

Notas de migracion y autorizacion:

- Antes de cambiar Rules legacy o ejecutar migraciones, inventariar el esquema y
  payloads reales completos de `users`, `products`, `orders` y `orderLines` en
  ambos entornos.
- Hasta poder enlazar deterministamente cada cuenta Firebase legitima con un
  socio legacy, mantener lecturas y escrituras con `request.auth != null` solo
  en los ocho prefijos vivos enumerados y denegar cualquier prefijo legacy
  desconocido. No inferir roles desde `develop`/`production`, email no
  verificado ni datos enviados por cliente.
- La regla autenticada amplia es deuda temporal de compatibilidad. La matriz
  estricta de `plus-collections` y el catch-all final deben impedir que autorice
  cualquier ruta de Reguerta+ o desconocida.

## 5. Reglas de validacion de negocio (obligatorias)

Salvo que una regla nombre expresamente el dataset legacy vivo, las validaciones
siguientes aplican al contrato canonico `plus-collections`.

- `users.roles` debe contener siempre al menos `member` para socios activos.
- `users.normalizedEmail` debe ser unico entre socios activos.
- `users.producerCatalogEnabled` debe ser booleano y no debe guardarse dentro de `users.settings`.
- `users.producerParity` debe ser `even`, `odd` o `null`.
- `users.isCommonPurchaseManager` debe ser booleano.
- Un usuario autenticado solo tiene acceso operativo si
  `authLinks/{request.auth.uid}` resuelve un `users` con `isActive == true` y el
  rol canonico `member`.
- En el primer login autorizado, el backend exige un email verificado en el
  token. Si `users.authUid` es `null`, escribe transaccionalmente el UID y
  `authLinks/{uid}`; si ya existe, debe coincidir.
- Si no existe socio preautorizado para el email autenticado, la app debe mostrar alerta de no autorizado y bloquear acciones operativas.
- Si `users.lastDeviceId` tiene valor, debe existir `users/{userId}/devices/{lastDeviceId}`.
- En `users/{userId}/devices`, `platform` solo admite `android` o `ios`.
- En iOS, `apiLevel` debe ser `null`; en Android debe ser numero >= 0.
- Consistencia temporal de dispositivo: `firstSeenAt <= lastSeenAt`.
- `config/public.versions.android` y `config/public.versions.ios` deben incluir
  `current`, `min`, `forceUpdate` y `storeUrl` antes del gate de arranque.
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
- Las consultas de directorio de un socio no admin usan solo `memberDirectory`
  y devuelven proyecciones activas; admin usa registros completos `users` para
  gobernanza y reactivacion.
- En mercado (`shifts.type == market`) debe haber minimo 3 asignados.
- `shifts.source` solo admite `app` o `google_sheets` (sin otros valores).
- `notificationEvents.targetPayload` debe respetar `target`:
  - `all`: mapa vacio.
  - `users`: `userIds` no vacio.
  - `segment`: `segmentType` valido y claves obligatorias segun el tipo de segmento.
- Si `products.pricingMode == weight`, `price`, `weightStep`, `minWeight` y `maxWeight` son requeridos y > 0; `minWeight <= maxWeight` y el maximo debe alcanzarse desde el minimo mediante incrementos enteros de `weightStep`.
- Si `orderlines.pricingModeAtOrder == weight`, `quantity` almacena cantidad de peso (permite decimal, en `unitName`) y `subtotal = quantity * priceAtOrder`.

## 6. Indices minimos recomendados

- `orders`: `(userId ASC, weekKey DESC)`
- `orders`: `(weekKey ASC, consumerStatus ASC)`
- `orderlines`: `(orderId ASC, companyName ASC)`
- `orderlines`: `(vendorId ASC, weekKey DESC)`
- `products`: `(vendorId ASC, archived ASC, isAvailable ASC)`
- `users`: `(normalizedEmail ASC, isActive ASC)`
- `memberDirectory`: `(isActive ASC, displayName ASC)` cuando se introduzcan
  consultas de directorio ordenadas
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
