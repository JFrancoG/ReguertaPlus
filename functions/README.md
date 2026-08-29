# Reguerta Firebase Cloud Functions

Este proyecto contiene funciones en la nube (Cloud Functions) para mantener actualizados los timestamps de colecciones críticas en Firestore.

Este README distingue el codigo candidato del estado Firebase real. Firestore
Phase 1 si esta desplegado y fue releido; el backfill de `authLinks` esta
aplicado y verificado. Las Functions nuevas, los demas backfills y las Rules
estrictas no estan desplegadas.

## 🧭 Arboles Firestore y compatibilidad viva

El proyecto Firebase `reguerta-9f27f` contiene dos arboles distintos bajo
`develop` y `production`:

- `{env}/collections/**`: dataset legacy consumido por las apps actualmente
  publicadas. Temporalmente conserva lectura/escritura para cualquier cuenta
  autenticada solo en los ocho prefijos observados: `config`, `containers`,
  `measures`, `news`, `orderLines`, `orders`, `products` y `users`. Cualquier
  prefijo legacy desconocido se deniega. No hay enlaces `authUid` deterministas
  y, en la foto de 2026-07-27, 27 de 49 cuentas Auth siguen sin verificar;
  activar el corte estricto ahora excluiria usuarios legitimos.
- `{env}/plus-collections/**`: dataset Reguerta+. En Firestore Phase 1 conserva
  el contrato autenticado anterior, incluido el guard de estado de productor de
  HU-045; la matriz deny-by-default basada en `authLinks` existe solo en
  `firestore.strict.rules` y no esta desplegada.

El acceso amplio legacy es deuda de seguridad explicita, no una propiedad de
`develop` o `production`. Su match debe quedar aislado para que nunca autorice
`plus-collections` ni rutas desconocidas.

Storage live sigue en el baseline global `allow read, write` para cualquier
cuenta autenticada. `storage.phase1.rules` reproduce exactamente esa semantica
como rollback; no es la politica estricta. El candidato no desplegado
`storage.strict.rules` separa:

- legacy `products/**`: `get`, `create` y `update` para autenticados; `list` y
  `delete` denegados;
- Reguerta+ `{env}/images/{products|news|shared_profiles}/...`: `get` para socio
  activo enlazado; `create`/`update` y `delete` por rol y propietario;
  `create`/`update` solo JPEG de hasta 2 MiB; `list` siempre denegado;
- cualquier otra ruta: denegada.

Las URLs tokenizadas de descarga ya emitidas no se reevaluan con Rules y
requieren inventario y rotacion/revocacion independientes.

## ⛔ Puerta operativa actual

Las siete cuentas Auth que coinciden con admins activos de develop ya estan
verificadas; los tres admins de production son un subconjunto. El backfill
guardado de `authLinks` creo 22 enlaces en develop y 16 en production. La
verificacion posterior confirma 7 admins enlazados en develop, 3 en production,
cero conflictos y cero operaciones pendientes.

Los documentos `member_admin_001` y `member_producer_001` son fixtures
intencionales no-Auth de UI tests en develop. El migrador conserva solo las dos
parejas exactas conocidas, siempre que no exista usuario Auth ni `authLink`, y
las cuenta como `retainedDevelopNonAuthFixtures`. No se les crea identidad real,
no se ignora ningun prefijo `mock_*` y no existe excepcion equivalente en Rules
o production.

Las 27 cuentas Auth restantes se verificaran desde Reguerta+. Hasta que esten
verificadas y enlazadas, no se debe desplegar `firestore.strict.rules` ni
`storage.strict.rules`. Functions y los backfills restantes siguen requiriendo
dry-run, allowlist y despliegue/aplicacion explicitos.

## 🔧 Tecnologías

- Firebase Functions (2ª generación)
- Firebase Admin SDK 14.2.0 (entrypoints modulares)
- Firebase Functions SDK 7.3.2
- Node.js 22
- TypeScript
- Firestore
- Eventarc

## 🧠 Funcionalidad

El codigo candidato de esta rama despacha notificaciones push cuando se crea un
documento en:

`{env}/plus-collections/notificationEvents/{eventId}`

El trigger:
- resuelve la audiencia (`all`, `users`, `segment.role`)
- materializa una copia privada y acotada en
  `{env}/plus-collections/users/{userId}/notificationInbox/{eventId}`
- busca destinatarios en `{env}/plus-collections/users/{userId}/devices/{deviceId}`
- mantiene `fcmToken` para tokens legacy/iOS y envia el nuevo
  `firebaseInstallationId` de Android a FCM mediante `fids`; ambos destinos se
  leen y despachan por separado durante la migracion
- deja trazabilidad mínima en `notificationEvents.dispatch`

Otro trigger candidato proyecta cada socio activo de `plus-collections/users` en
`plus-collections/memberDirectory`, con solo ID, nombres visibles, roles y
capacidades operativas. Nunca copia email, telefono, `authUid` ni datos de
dispositivo; al desactivar o eliminar el socio borra su proyeccion.

Para eventos `order_reminder` (HU-046), además:
- aplica idempotencia por `weekKey + reminderSlotHour + userId`
  usando `{env}/plus-collections/orderReminderDispatchMarkers/{markerId}`
- clasifica errores transitorios y programa reintentos acotados
  (`retry_pending`) con backoff exponencial
- ejecuta un scheduler de reintentos cada 15 minutos
  (`retryPendingOrderReminderDispatches`, zona `Europe/Madrid`)
- persiste trazas por ejecución en
  `{env}/plus-collections/orderReminderRetryRuns/{runId}`
  con métricas: `processed`, `sent`, `skipped`, `failed`, `retryQueued`

## 📅 Sincronización de turnos con Google Sheets

`HU-020` deja `plus-collections/shifts` como fuente que consumen Android/iOS,
pero respaldada por una hoja compartida de Google Sheets.

### Flujo inbound

El endpoint HTTP:

`https://europe-west1-reguerta-9f27f.cloudfunctions.net/syncShiftsFromGoogleSheets`

lee los rangos configurados de Google Sheets y actualiza:

`{env}/plus-collections/shifts/{shiftId}`

Reglas MVP:
- si la hoja trae `shiftId`, se reutiliza como id estable
- si no, se genera un id determinista a partir de `type + date`
- el documento se marca con `source: "google_sheets"`
- se guarda trazabilidad mínima en `shifts.syncMeta`
- tras leer la hoja, la operación captura la autoridad de planificación abierta;
  cada alta, actualización o borrado revalida esa misma revisión/época dentro de
  su transacción y se detiene si cambia

El importador sigue siendo no atómico entre filas: una deriva posterior detiene
las mutaciones restantes, pero no revierte las ya confirmadas. HU-083 sustituye
este flujo por el consumidor multi-temporada gobernado.

### Flujo outbound

- El endpoint HTTP:

  `https://europe-west1-reguerta-9f27f.cloudfunctions.net/exportShiftsToGoogleSheets`

  hace export completo de `plus-collections/shifts` hacia la hoja.

- El trigger Firestore sobre:

  `{env}/plus-collections/shifts/{shiftId}`

  exporta de forma incremental los cambios confirmados hechos desde la app
  (`source != google_sheets` y `status == confirmed`) y además crea una
  `notificationEvents` de tipo `shift_updated`.

- El trigger de `deliveryCalendar` captura la autoridad de planificación antes
  de reflejar una excepción en Sheets, la revalida antes de cada fila y después
  de la última, y crea la notificación en una transacción con la misma autoridad.
  Esto cerca sus efectos derivados, no la escritura directa original de Android/
  iOS ni convierte Sheets en una transacción atómica.

Los dos endpoints de Sheets aceptan solo `POST`, exigen un Firebase ID token
bearer valido y requieren un socio activo con rol `admin` en el entorno
solicitado.

## 🔐 Frontera HTTP autenticada

Ningun endpoint HTTP mutante confia en UID, email, roles o memberId recibidos
en el body. Todos verifican un Firebase ID token (incluida revocacion),
resuelven el enlace server-owned
`{env}/plus-collections/authLinks/{firebaseUid}` y comprueban el documento
reciproco `users/{memberId}`.

Contrato comun:

- metodo `POST`
- cabecera `Authorization: Bearer <Firebase ID token>`
- `Content-Type: application/json`
- `env` o `environment`: `develop` o `production`

Ejemplo de invocacion administrativa:

```bash
curl -X POST \
  -H "Authorization: Bearer $FIREBASE_ID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"env":"develop"}' \
  "https://europe-west1-reguerta-9f27f.cloudfunctions.net/syncShiftsFromGoogleSheets"
```

Endpoints de aplicacion:

- `resolveAuthorizedMember`: socio autenticado; crea el primer enlace solo si
  el email del token esta verificado y corresponde de forma univoca a un socio
  preautorizado.
- `upsertMemberByAdmin`: admin; alta y edicion transaccional de socios, sin
  permitir eliminar el ultimo admin activo.
- `transitionShiftSwap`: socio activo; valida actor/candidato y aplica el
  intercambio final de turnos en una transaccion.
- `resolveDeliveryCalendarMutationContext`: admin activo; devuelve la autoridad
  abierta exacta y el digest (o ausencia) de una excepcion semanal.
- `transitionDeliveryCalendarOverride`: admin activo; aplica un `upsert` o
  `delete` idempotente solo si siguen coincidiendo autoridad y digest.

El comando de calendario usa un body v1 de campos exactos. Para `upsert`, el
cliente envia `environment`, `operationId`, `weekKey`,
`expectedPlanningAuthority`, `expectedOverrideDigest` y `deliveryWeekday`
(`TUE|THU|FRI`). El backend deriva las cinco fechas en `Europe/Madrid`,
`updatedBy` y `updatedAt`; para `delete` se omite `deliveryWeekday`. La
transaccion relee el enlace y rol admin, el estado de planificacion y el
documento semanal, y crea a la vez un recibo privado en
`deliveryCalendarMutationReceipts/{operationId}`. Un replay identico converge;
una autoridad, override, actor o payload diferente falla sin mutacion.

Este endpoint queda preparado para la migracion movil, pero Android/iOS aun
escriben directamente y las Rules todavia conservan esa compatibilidad. No debe
negarse la ruta legacy hasta que ambos clientes usen el comando y se prueben las
colas offline antiguas.

El resto de endpoints HTTP candidatos de sincronizacion, exportacion,
timestamps y validacion requieren admin activo.

## 🗓️ Contrato local de planificación continua HU-082

El corte actual define un contrato v2 cerrado para una sola petición con los
subplanes `delivery` y `market`. Los módulos nuevos validan el wire contract y
calculan planes deterministas en local. Ya existe un repositorio Firestore
privado, validado en local/emulador, para el lifecycle de `preview` y `stage`, y
un orquestador local sin dependencia del SDK que ejecuta ese lifecycle contra un
read-set autoritativo de mantenimiento y ambas rotaciones. Los artefactos internos
usan schema v2 y revisiones `bundle-v2-*`; la petición conserva
`schemaVersion = 2` y el resumen terminal público wire conserva
`schemaVersion = 1`. Stage materializa ya una proyección privada de inspección
ligada por digest, y `activate` permanece limitado a un preflight estrictamente
de solo lectura sobre candidato, bundle inmutable y posiciones.
Ya existe un serializador local del `CommitRequest` protobuf exacto para un
write-set completamente resuelto y un token transaccional real. El adaptador de
intento exige que terminen primero las lecturas, puebla el batch interno vacio del
`Transaction`, lo mide y sella, y deja que el SDK confirme ese mismo objeto. Cada
retry vuelve a resolver y medir; el guard reserializa justo antes del transporte.
El materializador forward local ya puede entregar al adaptador el dominio exacto,
pero ese seam aun no se conecta al lifecycle/runtime. Todavía no hay materializador
inverse, barrera externa fiable, migración de writers, CAS productivo de
activación/publicación/recovery, trigger v2 conectado al orquestador, consumidores
de sync/notificaciones/recovery, integración móvil, despliegue ni activación live;
todas esas fronteras siguen fail-closed. La publicación humana de consulta se
describe por separado a continuación. El trigger
legacy `onShiftPlanningRequestCreated` de `src/index.ts` sigue siendo la
implementación runtime activa y aún no consume este contrato v2. Como barrera
de compatibilidad, captura la autoridad de planificación abierta inmediatamente
antes de escribir su hoja y la revalida en cada mutación Firestore posterior,
incluida la notificación. Una deriva detiene los efectos restantes, pero no puede
revertir una escritura de Sheets ya confirmada; HU-083 sustituye ese flujo no
atómico.

### Baseline comunicable sin activación de producción

La vía urgente documentada en
`spec/shifts/hu-082-continuous-seasonal-shift-rotation/communication-baseline.md`
queda fuera del runtime: prepara offline, desde un snapshot autorizado de solo
lectura cuyo manifest y digests se contrastan, una única propuesta completa de reparto
y mercado. Sigue `proposal -> approved -> sealed -> rendered -> communicated` y no
invoca el `preview` de producción, porque ese contrato permite persistir artefactos
privados. La preparación, aprobación, sellado y render no escriben Firestore, Sheets,
Drive, notificaciones, configuración ni estado visible en las apps. Después, una
autorización separada puede copiar exclusivamente ese render saneado a pestañas de
consulta del documento compartido, sin activar Firestore ni las apps.

`assignmentDigest` liga UIDs y planes; `resolverDigest`, únicamente los pares
UID/displayName; y `planningDigest` sella ambos junto a `sourceManifestDigest`. El
paquete privado puede conservar UIDs, pero el render de audiencia devuelve únicamente
las filas humanas de ambos turnos, sin ayudante de reparto: nunca expone UIDs, otros
IDs, digests, metadata de lifecycle ni teléfonos. Una proposal no es comunicable: solo
un seal con aprobación global exacta, atestación de cero escrituras y
vigencia/supersesión ligadas por esa aprobación puede continuar. La vigencia aprobada
no puede superar 15 minutos desde `approvedAt`; al render, el núcleo revalida el seal y
comprueba con su propio reloj que `Date.now()` pertenece a `[sealedAt, validUntil)`.
Este baseline offline no prueba currentness, supersession ni CAS autoritativos:
HU-085 deberá resolverlos contra el registro de producción antes de activar.

`planningDigest` no sustituye a `bundleDigest` ni `candidateDigest`. HU-085 debe
enlazarlos mediante contraste de fuentes e igualdad de filas de ambos subplanes, o
superseder, volver a aprobar/sellar y recomunicar el baseline completo antes de
activar.

El 2026-08-24 se completó una instancia real: 27 participantes, 54 asignaciones de
reparto y 18 mercados de tres personas se publicaron en cinco pestañas de consulta. La
lectura posterior verificó contenido, formato y privacidad; los turnos públicos de
Firestore siguieron vacíos y ninguna app quedó activada. Los identificadores y la
evidencia técnica exacta se conservan fuera del repositorio.

Ruta de petición prevista:

`{env}/plus-collections/shiftPlanningRequests/{requestId}`

El documento de entrada tiene exactamente estos campos:

- `schemaVersion: 2`;
- `requestId`, que coincide con el ID del documento;
- `bundleId`, común a reparto y mercado;
- `environment`, `develop` o `production`, igual a `{env}`;
- `requestedByUserId`, igual al socio admin enlazado que crea la petición;
- `requestedAt`, un `Timestamp` real de Firestore que el parser normaliza a
  `requestedAtMillis` solo dentro de Functions;
- `mode`: `preview`, `stage` o `activate`;
- `status: "requested"`;
- `expectedWriteEpoch`, entero no negativo;
- `expectedActiveRevision`, string o `null`;
- `subplans`, mapa de claves exactas `delivery` y `market`, cada una con el
  único campo `targetSeasonStartYear` (`2000...9998`);
- `binding`, discriminado por modo:
  - `preview`: `null`;
  - `stage`: mapa exacto
    `{ kind: "preview", sourceRequestId, bundleRevision, bundleDigest }`;
  - `activate`: mapa exacto
    `{ kind: "candidate", candidateId, bundleRevision, bundleDigest, candidateDigest }`.

Los digests usan
`shift-planning:v1:sha256:<64 caracteres hexadecimales minusculos>`. No se
aceptan campos extra ni temporadas implicitas deducidas del reloj.

### Cadena pura y persistencia privada `preview -> stage -> activate`

- `preview` no consume artefactos previos y devuelve un recibo con
  `requestId`, identidad/revision/digest de bundle, entorno, solicitante y
  `expectedStateDigest`. Después del claim, el lifecycle carga en una sola lectura
  coherente `shiftPlanningState/current` y ambas rotaciones. El bundle persiste ese
  read-set completo y su digest dentro de `expectedState`; el recibo conserva solo
  el digest transitivo. El repositorio completa preview persistiendo el bundle, el
  recibo y su estado terminal en una sola transaccion privada. Preview puede
  inspeccionar mantenimiento abierto o cerrado.
- `stage` exige ese recibo de preview ya persistido y exactamente coincidente.
  Tras cargarlo, el lifecycle lee de nuevo el estado autoritativo; el resolver debe
  devolver un bundle ligado exactamente a ese read-set. El repositorio vuelve a
  cargar tanto el preview como el bundle persistidos y crea, sin sobreescritura,
  la cabecera staged con su digest/linaje y un documento inmutable por futuro
  turno publico bajo `positions/{shiftId}`. Mercado conserva sus tres posiciones
  ordenadas en el mismo documento. Cabecera, posiciones y terminalizacion se
  crean en una sola transaccion privada. Stage requiere mantenimiento cerrado
  y el mismo estado del preview. Por ello, entrar en mantenimiento invalida un
  preview abierto y obliga a crear otro preview ya cerrado antes de stage. Stage
  no acepta ni conserva evidencia transaccional: el candidato es inmutable y
  anterior a los IDs, before-images y token del intento real.
- `activate` solo dispone por ahora de un preflight de lectura. Carga y valida el
  candidato staged, su bundle preview inmutable y todas las posiciones frente a
  IDs, linajes, conteos y digests exactos; no reclama ni completa la peticion y
  no escribe estado. El bundle sigue siendo la autoridad y las posiciones son
  solo su proyeccion de inspeccion. El planner/runtime futuro debe recalcular y
  revalidar el snapshot live y el digest del bundle antes de cualquier CAS.

El claim transaccional enlaza cada peticion con una operacion y un lease de
procesamiento. El mismo worker puede reanudarla; otro recibe `busy` mientras el
lease siga vigente; tras expirar, el takeover incrementa el `fencingEpoch` y
rechaza al owner anterior. Un resultado terminal exacto devuelve replay sin
recalcular ni reescribir. `preview` y `stage` recorren
`requested -> processing -> completed|failed`; los fallos terminales usan el
resumen estable y no persisten mensajes internos sin tipar.

El orquestador enruta y reclama dentro de una única transacción del repositorio.
Para `preview` y `stage` adquiere el lease antes de invocar al planner, evita
invocarlo en `busy` o replay terminal y, para `stage`, carga el preview persistido
exacto antes de leer el estado autoritativo. Para `preview`, lee ese estado justo
después del claim. El resolver recibe el read-set y su resultado debe ligarlo de
forma canónica y exacta. Los errores deterministas tipados de planificación o
digest terminan con un resumen estable; los fallos de infraestructura se propagan
sin terminalizar el lease para permitir un retry seguro. Para `activate` la misma
transacción devuelve la ruta de preflight sin crear operación ni escribir;
después solo ejecuta el preflight del paquete candidato, no lee el estado live y
no invoca al planner.

### Estado autoritativo y CAS local de mantenimiento

Un segundo repositorio privado lee en una única transacción
`shiftPlanningState/current`, `shiftRotations/delivery` y
`shiftRotations/market`. Valida campos exactos, cursores/cohortes, fronteras,
leases, baseline de migración y un único linaje activo; después liga los tres
documentos y el entorno a un digest autoritativo. Un documento ausente o
incoherente falla cerrado y nunca provoca bootstrap o reparación implícita.
Una cohorte solo puede figurar congelada con el cursor dentro de una ronda; en
el límite debe quedar no congelada y sin snapshot retenido.

Ese mismo normalizador SDK-free valida el read-set recibido por el planner. El
`expectedState` de artifact schema v2 contiene el estado autoritativo completo y
la autoridad de medición (`adapterRevision` e `indexConfigurationDigest`). Los
campos de rotación heredados del fairness snapshot deben coincidir canónicamente
con ambos agregados autoritativos; cualquier drift de barrera, transición,
revisión, lease, cursor o linaje cambia los digests y rompe la cadena. Los recibos
preview y candidatos staged no duplican el estado: guardan su
`expectedStateDigest`.

El puerto sin dependencia del SDK implementa dos transiciones desconectadas del
runtime: `enterMaintenance` y `abortPreActivationMaintenance`. Ambas exigen el
digest, `stateRevision`, `writeEpoch` y linaje activo exactos; avanzan las dos
revisiones una vez, conservan el linaje activo y crean atómicamente evidencia
inmutable schema v2 en `shiftPlanningOperations/state-{transitionId}`. V2 añade
el deadline de admisión y renombra su muestra temporal a `attemptedAt`; no existe
estado v1 desplegado que preservar porque este flujo sigue desconectado. Un retry
exacto reproduce el resultado original y una colisión de intención falla. Ese replay
del repositorio es evidencia terminal histórica: el coordinador solo lo acepta
si una nueva lectura confirma que su digest posterior sigue siendo el actual,
el mantenimiento continúa cerrado, `lastTransitionId` coincide y conserva la
misma barrera compacta. El registro conserva ambas rotaciones para recalcular sus digests before/after y rechazar
evidencia alterada. La entrada recibe evidencia de barrera ya verificada. Su
intención inmutable conserva además `intakeBarrierExpiresAtMillis`, y la
transacción exige
`verifiedAtMillis <= attemptedAtMillis <= intakeBarrierExpiresAtMillis`, donde
`attemptedAtMillis` es el reloj de confianza muestreado dentro del callback y no
el instante físico de commit del servidor. Este repositorio no verifica ni abre
la barrera externa Rules/IAM. El aborto limpia la barrera del estado actual, pero
el registro inmutable conserva la evidencia histórica. Solo puede abortar si la
operación de entrada exacta sigue poseyendo el read-set y ambos leases de release
son nulos. Un replay terminal de aborto vuelve a comprobar esas dos condiciones
contra la evidencia persistida antes de devolver el resultado original.

El inventario compilado `hu082-affected-writers-v1` separa ingresos cliente,
endpoints HTTP, deliveries de triggers, autoridades Admin/IAM y todas las vias
humanas o automatizadas del workbook. El trigger generico de notificaciones debe
aislar solo la entrega causal de HU-082, sin detener productores ajenos; si no
puede probarse ese aislamiento, la entrada aborta o requiere un puente/fence
gobernado. La autoridad Admin/IAM no manifestada se modela database-wide, aunque
a cada runtime conocido se le aplica su propio control. Incluye ademas seis
writers logicos de membership/configuracion que no se cercan si la activacion
puede revalidar atomicamente su version; ese guard
aun esta pendiente. `resolveAuthorizedMember` queda incluido: sus cambios de
autenticacion deben excluirse canonicamente de la proyeccion de fairness o hacer
avanzar su version. El digest del inventario forma parte del paquete de barrera y
cualquier writer ausente, duplicado, extra o desconocido lo invalida.

Un verificador SDK-free normaliza un paquete de auditoria de claves exactas y lo
liga al entorno, transicion, CAS de estado, Rules esperadas, ID exacto del
workbook, controles de todos los writers, conjunto causal aceptado, drenaje,
colas, revision/digest del workbook y horizonte de calma. Exige read-backs
iniciales tras cerrar Rules y controles, un primer read-back de colas a cero tras
el drenaje, y read-backs finales de Rules, controles, colas y workbook despues
del horizonte. Solo con recuentos cero, ausencia de drift, cronologia valida y
evidencia fresca deriva el compacto `{ revision, digest, verifiedAtMillis }`.
La caducidad se calcula desde la observacion final mas antigua mas la edad maxima
y limita las dos verificaciones y la admision del intento transaccional. No
afirma que el commit fisico del servidor ocurra antes del deadline: el adaptador
debe mantener los fences hasta que la transaccion resuelva, cubriendo esa latencia.

Antes de invocar el puerto, el flujo de control externo debe mantener todos los
fences cerrados y autorizar explicitamente el checkpoint dinamico exacto: Rules,
manifest de controles, workbook, conjunto causal y politica temporal. Dentro del
callback que ese adaptador declara retenido, el coordinador verifica el paquete,
lo retiene por la clave estable `environment + transitionId`, relee y reverifica
el sobre completo, y ejecuta la CAS. El repositorio Firestore local/emulador crea
`shiftPlanningOperations/barrier-evidence-{transitionId}` cuando no existe, devuelve el
sobre previo solo para un replay con digest identico y falla ante una colision o
un schema, binding o digest alterado; nunca sobreescribe evidencia ni cambia
`retainedAt`. Ese timestamp debe ser no negativo, exacto al milisegundo y no
anterior a `verifiedAtMillis`; el read-back posterior debe coincidir con el
registro completo observado o creado por la transaccion.

El adaptador production-shaped implementado recibe puertos de control inyectados,
liga scope, revision de hold y evidencia en un checkpoint digerido, lo relee antes
y despues del unico callback y no expone reapertura. Si falla el cierre, cualquier
read-back, el callback o la comprobacion final, vuelve a probar el cierre y retiene
`shiftPlanningOperations/barrier-failure-{transitionId}` con la fase y los digests
del scope, hold y checkpoint. Un cierre fallido previo bloquea el retry antes de
volver a operar. Los prefijos `barrier-evidence-` y `barrier-failure-` son
disjuntos incluso cuando un ID comienza por `failure-`. Esto prueba la
orquestacion y el journal local, no que existan los
drivers reales ni que los fences externos hayan sido cerrados. El futuro driver
debe hacer converger cierres concurrentes del mismo scope en un unico checkpoint;
la CAS de mantenimiento conserva la idempotencia durable de cada callback.

Antes de exigir frescura, el coordinador consulta la operacion terminal. Una
entrada inexistente debe superar ambos checks temporales antes del intento; una
entrada terminal con intent exacto usa lectura `existing-only` del sobre ya
retenido y puede recuperar su resultado incluso despues del deadline. Nunca
recrea evidencia historica ausente. Tras el replay, la comprobacion de propiedad
actual sigue siendo obligatoria.

Este contrato no prueba una barrera real. Los bindings que desplieguen y relean
Rules, deshabiliten/drenen Functions/Eventarc, auditen IAM y cerquen
Drive/Workspace siguen pendientes y pertenecen al rollout autorizado posterior;
el adaptador no se conecta todavia desde `index.ts`. Las Rules Phase 1
configuradas en el repositorio siguen permitiendo rutas legacy y las strict
locales aun admiten escrituras admin directas de turnos/calendario, por lo que
ninguna de ellas cuenta por si sola como evidencia de cierre HU-082.

El gate canonico y conservador de HU-082 limita cada direccion a 500 escrituras
documentales mas transformaciones declaradas y 10 MiB de peticion serializada.
El planner puro calcula presupuestos forward/inverse, pero deja los bytes como
`requiresPersistenceAdapter`. Stage valida ese presupuesto conservador, pero no
fabrica una futura peticion exacta. La cabecera candidata queda fuera de los
write-sets forward/inverse y de las before-images, igual que las futuras peticiones
y operaciones de activacion. El serializador `firestore-grpc-v1-fs8.7.0-r1`
puede construir un batch canonico de referencia y mide el `WriteBatch` real
suministrado por un intento ya resuelto; liga `manifestDigest`, `writeSetDigest`,
`commitRequestDigest`, conteos, bytes, revision del adaptador y autoridad de
indices. El adaptador de intento exige lecturas terminadas, el batch interno vacio
y la misma instancia fijada de Firestore; aplica ahi las mutaciones canonicas y
espera el token real. Tras medir, sella el batch contra nuevas mutaciones y
reemplaza sus operaciones por copias separadas de los protos `Write` medidos. El
guard conserva solo una copia del token, reserializa la peticion justo antes del
transporte y rechaza cualquier drift; el reset obliga a medir de nuevo. Ni el token
ni el digest se persisten dentro de la propia peticion medida, porque ese digest
seria autorreferencial.

La autoridad de medicion (`adapterRevision` e `indexConfigurationDigest`) sigue
formando parte del snapshot de fairness y del estado esperado; cambiarla invalida
el candidato para una activacion posterior. El digest de indices liga la autoridad,
pero el protobuf no calcula el coste de entradas de indice que aplica el backend:
el ensayo posterior en un clon aislado sigue siendo obligatorio. El repositorio ya
prueba que preview, bundle, cabecera candidata y posiciones de inspeccion estan
persistidos y ligados por digest.

El contrato puro `shift-planning-publication-contract.ts` fija ahora el codec v1
que precede a la materializacion. Convierte cada posicion staged en un documento
plano compatible con las apps instaladas (`type`, `date`, `assignedUserIds`,
`helperUserId`, `status`, `source = app`, `createdAt`, `updatedAt`) y añade
propiedad de rotacion, revisiones de asignacion/finalizacion, linaje, epoch y
`documentRevision`. Reparto exige una asignacion y mercado exactamente tres.
Las fechas se escriben como `Timestamp` a medianoche UTC.

Cada escritura controlada cambia `lastBackendMutation`, ligado a ruta, revision,
payload sin marcador, bundle, epoch y `operationIntentDigest`. La validacion
estricta del evento exige esa coincidencia solo cuando el marcador acaba de
cambiar. Una edicion ordinaria posterior puede conservar un marcador historico
ya no coincidente: al no cambiar el marcador, el futuro consumidor HU-083 debe
procesarla normalmente en vez de silenciarla.

La activacion crea atomicamente un tombstone backend `state = committed` con el
manifest, mutaciones publicas ordenadas y referencias de before-image. Su
`attemptedAt` es la muestra de reloj del callback, no un timestamp de ack; la
existencia del tombstone demuestra que la transaccion se confirmo. Las
before-images usan el codec taggeado `firestore-value-v1`, conservan mapas,
arrays, escalares, `Timestamp`, bytes y `GeoPoint`, y ligan payload, ruta,
`targetUpdateTime`, contrato de captura y envelope por digest. Sentinels,
referencias, clases, accessors, extras ocultos y valores con perdida fallan
cerrado.

`shift-planning-forward-materializer.ts` recompone el artefacto live completo y
exige que reproduzca exactamente el bundle staged antes de construir ninguna
mutacion. Resuelve todas las posiciones publicas, la actualizacion acotada del
helper predecesor cuando existe, ambas rotaciones con sus leases, el estado
activo, request terminal, comandos de Sheets, intenciones retenidas, tombstone y
before-images. Cada update usa el `lastUpdateTime` leido en el mismo intento y el
conjunto completo debe coincidir con presupuesto forward y manifest inverse.
Despues entrega esas mutaciones al adaptador real, que mide y sella el batch del
`Transaction`; un vector de emulador confirma el commit atomico del mismo objeto.
Los creditos no nulos siguen cerrados hasta HU-084.

`shift-planning-inverse-materializer.ts` parte exclusivamente del bundle y
manifest inverse persistidos, tombstone de activacion, request completada,
before-images revalidadas y read-set actual. Exige que todos los creates sigan
ligados a la activacion, que el CAS activo conserve bundle/digest/epoch exactos y
que ambos release leases sigan sellados por esa operacion. El batch inverse borra
solo esos creates y restaura targets con su `lastUpdateTime`. Recupera el lineage
de negocio anterior, pero avanza un `writeEpoch` nuevo y revisiones monotonicamente
superiores, limpia ambos leases y reemplaza el tombstone por un terminal de
recovery ligado por digest. Para no dejar campos posteriores, la restauracion
reescribe mapas top-level completos y usa `FieldValue.delete()` en los campos
top-level que ya no deben existir. Before-images y request historica completada
se conservan. Un vector de emulador confirma el mismo batch inverse medido y
sellado por el adaptador real.

`shift-planning-attempt-outcome.ts` fija el acuse backend-only que se construye
solo despues de que la transaccion medida devuelve exito. Su ID estable combina
direccion y digest exacto del `CommitRequest`; el documento liga intent, bundle,
epoch, manifest, medicion completa, timestamp posterior al retorno y digests
derivados, sin persistir el token opaco ni introducir su digest dentro de la
peticion medida.

`shift-planning-firestore-attempt-outcome-repository.ts` crea ese documento sin
sobrescritura bajo `shiftPlanningOperations/{operationId}/attemptOutcomes`,
valida el terminal forward o inverse que lo autoriza, hace converger el replay
exacto y ejecuta una relectura independiente. Un replay historico exacto sigue
siendo valido aunque el terminal de activacion haya pasado despues a recovery;
un intento nuevo siempre debe concordar con el terminal actual.

`shift-planning-firestore-cas-runtime.ts` ejecuta los CAS forward e inverse. El
resolver inyectado se llama dentro de cada callback que Firestore reintenta; el
materializador real recibe exclusivamente ese read-set y solo el intento que
`runTransaction` devuelve puede crear el outcome posterior. Antes de ejecutar,
el runtime recupera un outcome exacto ya retenido sin repetir el CAS. Si existe
un terminal de activacion o recovery confirmado pero falta su outcome
direccional, falla cerrado para no duplicar una publicacion o restauracion cuyo
ack se perdio. Solo un error de planificacion tipado lanzado dentro del callback,
antes de que este pueda retornar al commit, se clasifica como rechazo determinista
pre-commit. El runtime lo persiste como `failed` mediante CAS contra el request y
su operacion; un terminal `completed` concurrente gana y se relee como activacion
confirmada. Errores de transporte, agotamiento de retries, retencion/read-back del
outcome o cualquier ambiguedad posterior al callback permanecen reintentables y
nunca se convierten en un falso terminal fallido.

`shift-planning-firestore-source-resolver.ts` fija
`shiftPlanningState/fairness` como la envolvente live backend-only. Su revision y
digest sellan el snapshot normalizado de roster/membership, rotaciones,
configuracion/politica/calendario, overrides, credito deshabilitado, particiones
de workbook, autoridad de medicion, baseline y fronteras de planificacion. Cada
retry forward relee esa envolvente, request, bundle, candidato, posiciones,
estado, rotaciones y targets de before-image antes de recomputar el bundle. El
resolver inverse relee tombstone, bundle, request, before-images y todos los
targets actuales de delete/restore. Un vector end-to-end de emulador prueba drift
sin escrituras, activacion completa y recovery con epoch superior.

`shift-planning-operator-recovery.ts` compone el unico puerto local autorizado
para recovery. El comando minimo liga entorno, IDs de activacion/recovery y el
digest de una autorizacion backend-only en
`shiftPlanningOperations/{activationOperationId}/recoveryAuthorizations/`
`{recoveryOperationId}`. Esa autorizacion sella revision/digest del bundle,
digest del terminal forward, ventana temporal y el estado completo de
mantenimiento esperado. El executor la relee antes de entrar y dentro de cada
retry CAS; expiry, extras, digest, epoch, revision, lineage o terminal drift
fallan antes de mutar. El replay terminal conserva la misma allowlist de entrada.

El productor gobernado mantiene `shiftPlanningState/fairness` desde las fuentes
reales y `index.ts` clasifica primero la version para conservar el trigger legacy,
rechazar versiones desconocidas y enrutar localmente v2 a preview, stage o CAS de
activacion. Recovery se exporta localmente con `onRequest` solo para el invoker
futuro exacto `reguerta-shifts-operator@reguerta-9f27f.iam.gserviceaccount.com`.
La frontera acepta solo POST, cuerpo exacto y cero query params; correlaciona
respuestas y auditoria sanitizada sin registrar el cuerpo, digest de autorizacion,
datos de miembros ni diagnosticos internos. No selecciona una service account de
runtime. HU-085 aun debe aprovisionar el operador, otorgar y releer solo invocacion,
probar permisos negativos, desplegar y ensayar; no existe escritura compartida.

`shift-planning-sync-command.ts` versiona y valida estrictamente los comandos de
sync creados por activacion. `shift-planning-firestore-sync-command-repository.ts`
los descubre mediante polling acotado, reclama o recupera leases expirados con un
epoch de fencing superior, revalida linaje activo y particion inmediatamente antes
del batch externo, y solo completa/libera el lease con read-back de revision y
digest. `shift-planning-sync-command-executor.ts` mantiene la I/O fuera del
repositorio y demuestra con un consumidor falso que una confirmacion perdida se
redescubre sin duplicar el efecto idempotente. HU-083 implementara la I/O real y
la evidencia durable de resultados ambiguos; no se exporta aqui ningun trigger.

`shift-planning-public-event-contract.ts` fija el filtro puro que el futuro
`onShiftWritten` de HU-083 debe usar. Solo clasifica como no-op controlado un
create/update cuyo `lastBackendMutation` haya cambiado en ese mismo evento y
coincida exactamente con el terminal de activacion, reparacion o correccion de
sync; un recovery delete exige que el before-document conserve ruta, revision,
payload, bundle, epoch e intent de activacion y que su ruta figure en el terminal
inverse. Un marcador retenido sin cambios en una edicion o borrado posterior se
clasifica como operacion ordinaria. Un marcador cambiado sin registro valido
falla cerrado. El `eventDigest` estable permite que el futuro ledger audite el
replay sin convertirlo en exportacion o notificacion por fila. Este corte no
conecta ni modifica el trigger legacy de `index.ts`.

`shift-planning-public-event-retention.ts` fija el contrato productor que debe
envolver ese clasificador. Una politica versionada y ligada por digest define el
horizonte end-to-end maximo de entrega/reintento y un margen de seguridad
positivo. Cada terminal controlado obtiene una retencion inmutable hasta
`terminalAt + horizon + margin`; cada no-op controlado produce un ledger estable
por `eventDigest`. Un marcador cambiado invalido produce en cambio un terminal
`rejected`, deduplicado por el ID estable del evento, con alerta obligatoria y
los side effects legacy bloqueados. El cleanup conserva el terminal de operacion,
su binding de retencion y sus ledgers en el limite exacto, y solo los declara
elegibles un milisegundo despues. Las rutas quedan congeladas bajo
`shiftPlanningPublicEventLedgers/operation-{operationId}` y
`shiftPlanningPublicEventLedgers/event-{digestHex}`. HU-083 debe persistir esas
intenciones con create-or-exact-replay, conectar la alerta y demostrar el trigger
real; este corte sigue sin modificar `index.ts` ni escribir Firestore.

### Fronteras, manifests y side effects diferidos

- `futureProjectionOccupancy` se aporta por separado para reparto y mercado con
  entradas exactas `seasonStartYear`, `occupiedPositionCount`,
  `lineageRevision` y `lineageDigest`. Se incluye en el digest, permite saltar
  proyecciones futuras completas y rechaza solapes o capacidades invalidas.
- El baseline de migracion debe ser `null` en bundle y ambas rotaciones o la
  misma pareja exacta `revision`/`digest` en los tres niveles.
- Hasta que HU-084 defina transiciones exactas de credito, el ledger debe llegar
  desactivado (`enabled = false`) y sin transiciones previstas; cualquier otro
  valor falla cerrado.
- La activacion propuesta congela una cohorte solo si queda una ronda activa al
  cruzar el limite. Preview puede diagnosticar drift de una cohorte congelada;
  stage y activate lo rechazan sin side effects.
- Cada comando de sync queda ligado a workbook/revision, particion/revision de
  estado, epoca esperada, nueva epoca de comando y un lease de claim. Los leases
  de particion ya activos bloquean stage/activate.
- Se genera una intencion de notificacion generica por cada posicion asignada,
  con UID destinatario, turno y revisiones esperadas de asignacion, membership,
  elegibilidad y destino; no se deduplica solo por persona.
- El manifest inverse de recovery liga rutas creadas, rutas y digests de
  before-images persistidas, CAS de bundle activo/digest/epoca y una epoca
  posterior que nunca se reutiliza ni decrementa. El bundle inmutable ya
  persistido por preview queda fuera del write-set de activación y del inverse:
  no se actualiza, restaura ni borra, y se retiene como evidencia de replay.
- Ambos manifests incluyen `expectedStateDigest` y
  `expectedAuthoritativeDigest`. El forward declara la transición de
  `stateRevision` y `writeEpoch`; el contrato de before-image de
  `shiftPlanningState/current` cubre el documento de mantenimiento completo.

El planner y los manifests siguen siendo contrato/resultado puro. Los
repositorios solo ejecutan transacciones privadas sobre peticiones, operaciones,
bundles, candidatos/posiciones y el estado de mantenimiento; no ejecutan CAS
de publicación, comandos de Sheets, recovery ni notificaciones.

La partición prevista de acceso es:

- `shiftPlanningRequests`: en Rules estrictas, create/read solo para admin
  activo enlazado y con el esquema exacto; ningún cliente puede update/delete.
- `shiftPlanningCandidates`: candidatos de dos subplanes, escritos solo por
  backend y legibles para revisión por admin; ningún cliente puede mutarlos. La
  cabecera persistida incluye linaje preview/stage, `expectedStateDigest`,
  conteos, `positionSetDigest` y su `candidateDigest`; no contiene evidencia de
  una futura transaccion.
  Su subcoleccion `positions` contiene una proyeccion inmutable y digerida por
  turno planificado; solo esa subcoleccion anidada es legible por admin.
- Solo backend, sin lectura ni escritura de cliente incluso para admin:
  `shiftPlanningState`, `shiftRotations`, `shiftRotationMappings`,
  `shiftPlanningBundles`, `shiftPlanningSyncCommands`,
  `shiftPlanningNotificationIntents` y `shiftPlanningOperations`.

El documento `shiftPlanningState/current` usa `activeRevision` y `activeDigest`
como claves emparejadas de linaje activo; no reutiliza los nombres
`bundleRevision`/`bundleDigest` propios de bundles, bindings y publicación.
`maintenanceStatus = "open"` exige `intakeBarrier = null`; `closed` exige la
evidencia exacta `{ revision, digest, verifiedAtMillis }`.

El candidato local `firestore.phase1.rules` niega todo acceso de cliente a este
nuevo plano de control, incluidas peticiones y candidatos. El candidato local
`firestore.strict.rules` permite solo las aperturas admin exactas anteriores.
Ninguno de estos cambios de Rules se ha desplegado en este corte.

El adaptador futuro publicará los turnos generados con `source = "app"` para
mantener compatibilidad, más `origin = "planner"`, `planningRequestId`,
`bundleRevision`, `bundleDigest` y `writeEpoch`. También persistirá propiedad de
rotación separada de la asignación efectiva: `rotationOwnerUserId`, ronda y
posición para reparto; `rotationOwnerUserIds` y posiciones por propietario para
mercado. Una reasignación futura podrá cambiar `assignedUserIds` sin reescribir
la propiedad histórica. Estos son campos previstos del adaptador de
publicación/activación, no escrituras que los planners puros o el runtime activo
ya estén realizando.

### Contrato de hoja esperado

Cada pestaña usa esta cabecera:

`shiftId,type,date,assignedUserIds,assignedDisplayNames,helperUserId,helperDisplayName,status,source`

Rangos por defecto:
- `Delivery!A:Z`
- `Market!A:Z`

La importación intenta resolver participantes por:
- `userId`
- `normalizedEmail`
- `displayName`

### Configuración requerida

Comparte la hoja con la service account de Firebase Functions y configura:

```bash
firebase functions:config:set \
  sheets.spreadsheet_id="YOUR_SPREADSHEET_ID" \
  sheets.delivery_range="Delivery!A:Z" \
  sheets.market_range="Market!A:Z" \
  --project reguerta-9f27f
```

Opcionalmente puedes separar por entorno:

```bash
firebase functions:config:set \
  sheets.spreadsheet_id_develop="YOUR_DEV_SPREADSHEET_ID" \
  sheets.spreadsheet_id_production="YOUR_PROD_SPREADSHEET_ID" \
  --project reguerta-9f27f
```

Configurar valores no autoriza un despliegue. La fuente actual reutiliza nombres
de endpoints legacy que aceptan `GET` con implementaciones nuevas `POST`-only;
un despliegue global o por patron rompería esos consumidores. Hace falta una
allowlist revisada funcion por funcion despues de resolver el bloqueo de admin.

### ✅ Validación de política de versión remota

Para asegurar que `config/global.versions.{android,ios}` siempre tenga
`current|min|forceUpdate|storeUrl`, existe el endpoint:

`https://europe-west1-reguerta-9f27f.cloudfunctions.net/validateGlobalVersionPolicy`

Parámetros opcionales:
- `env=develop` o `env=production`
- `envs=develop,production` (lista separada por comas)

Si no se envía ningún parámetro, valida/siembra por defecto en:
`develop` y `production`.

### ✅ Validación de contrato de frescura crítica

Para asegurar que `config/global` siempre incluya:
- `cacheExpirationMinutes > 0`
- `lastTimestamps.{products,containers,measures,orders,orderlines,users}`

existe el endpoint:

`https://europe-west1-reguerta-9f27f.cloudfunctions.net/validateGlobalFreshnessConfig`

La validación actualiza:
- `{env}/plus-collections/config/global`
- `{env}/plus-collections/config/member` con solo
  `cacheExpirationMinutes`, `lastTimestamps` y `deliveryDayOfWeek`

Parámetros opcionales:
- `env=develop` o `env=production`
- `envs=develop,production` (lista separada por comas)

## 🧰 Migraciones de autorizacion

Los scripts exigen siempre `--project`, son dry-run por defecto y solo escriben
al anadir `--apply`. Su salida contiene recuentos, nunca emails, UID ni IDs de
socios.

```bash
npm run backfill:auth-links -- --project reguerta-9f27f
npm run backfill:public-versions -- --project reguerta-9f27f
npm run backfill:member-directory -- --project reguerta-9f27f
npm run backfill:notification-inbox -- --project reguerta-9f27f
```

Tras revisar que no hay conflictos bloqueantes, se repite cada comando con
`--apply`. Antes de hacerlo, un nuevo dry-run debe confirmar al menos:

- 7 admins enlazados en develop y 3 en production;
- `develop.retainedDevelopNonAuthFixtures == 2`;
- `develop.existingUidMissingAuthUser == 0`;
- `production.retainedDevelopNonAuthFixtures == 0`.

Los fixtures retenidos se excluyen por pareja exacta `memberId + authUid` solo
en `develop/plus-collections`; permanecen intactos y no reciben escrituras de
forma ni enlaces. Cualquier variante, aparicion en production, usuario Auth o
`authLink` inesperado vuelve a fallar de forma cerrada.

El backfill de socios/enlaces ya se aplico por entorno y su repeticion en
dry-run devuelve cero operaciones. Normalizo `roles`, `isActive` y
`normalizedEmail`, ademas de crear los enlaces reciprocos seguros. Los
backfills de inbox, directorio y configuracion siguen pendientes y requieren
su propia autorizacion.

`backfill:public-versions` materializa dos proyecciones desde
`plus-collections/config/global`: `config/public` contiene solo la politica de
versiones anonima y `config/member` solo los valores operativos seguros. Ningun
backfill de esta HU modifica el contrato del arbol legacy `collections`.

## 🛡️ Secuencia de rollout sin interrupcion

0. **Baseline restaurado.** Se restauraron las Rules previas tras detectar los
   clientes publicados y se separaron configuraciones por target.
1. **Firestore Phase 1 desplegado.** `firestore.phase1.rules` esta live y fue
   releido: ocho prefijos legacy autenticados, contrato plus anterior y rechazo
   implicito de rutas no contempladas. Storage live no cambio y sigue global
   autenticado; `storage.phase1.rules` es su rollback semantico.
2. **Bootstrap y enlaces resueltos.** Siete cuentas admin verificadas; el
   backfill creo 22 `authLinks` en develop y 16 en production y confirmo 7/3
   admins enlazados sin tocar los dos fixtures.
3. **Rollout aditivo restante.** Desplegar una allowlist exacta de Functions y
   aplicar los backfills restantes por alcance. Las 27 cuentas restantes
   verifican el correo desde Reguerta+.
4. **Corte estricto.** Solo tras validar adopcion y enlaces, desplegar Firestore
   y Storage strict por separado con canarios, read-back y rollback.
5. **Adopcion y deuda legacy.** Publicar clientes, medir adopcion, migrar
   identidades/objetos legacy y retirar permisos temporales cuando sea seguro.

## ⚙️ Configuración del entorno

Este proyecto usa una variable `ENV` para determinar si se debe escribir en la rama `develop` o `production`. Puedes establecerla con:

```bash
firebase functions:config:set app.env="develop" \
  --project reguerta-9f27f
```

## 🚫 Despliegue y emuladores

No existe una receta autorizada de despliegue completo de Functions. El unico
formato admisible es una allowlist explicita y revisada:

```text
firebase deploy --config firebase.functions.json \
  --only functions:<approved-function>[,functions:<approved-function>] \
  --project reguerta-9f27f
```

No uses nombres por patron ni despliegues los endpoints legacy de timestamps
desde esta fuente hasta conservar su contrato `GET` o migrar sus consumidores.

Los scripts `npm run serve` y `npm run shell` estan fijados a
`demo-reguerta-functions` y fallan de forma cerrada. El riesgo aparece al
invocar manualmente el emulador o shell sin ese proyecto demo y sin emuladores
Auth, Firestore y Storage compatibles: Admin SDK puede alcanzar servicios live.
