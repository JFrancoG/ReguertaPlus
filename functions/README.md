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
- `resolveShiftPlanningRequestContext`: admin activo; proyecta el estado privado
  abierto a los unicos campos de linaje que necesita una peticion v2.

El comando de calendario usa un body v1 de campos exactos. Para `upsert`, el
cliente envia `environment`, `operationId`, `weekKey`,
`expectedPlanningAuthority`, `expectedOverrideDigest` y `deliveryWeekday`
(`TUE|THU|FRI`). El backend deriva las cinco fechas en `Europe/Madrid`,
`updatedBy` y `updatedAt`; para `delete` se omite `deliveryWeekday`. La
transaccion relee el enlace y rol admin, el estado de planificacion y el
documento semanal, y crea a la vez un recibo privado en
`deliveryCalendarMutationReceipts/{operationId}`. Un replay identico converge;
una autoridad, override, actor o payload diferente falla sin mutacion.

Android/iOS ya usan este comando para mutar el calendario; iOS envía `null`
explícito en ambas claves de linaje cuando no existe bundle activo. Las Rules
locales niegan escrituras directas. Desplegar ese cierre y comprobar las colas
offline antiguas sigue perteneciendo a la barrera de activación de HU-085.

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
ligada por digest; `activate` valida candidato, bundle inmutable y posiciones
antes del CAS de publicación gobernado.
La corrección posterior a la auditoría usa transacciones públicas de Firestore
para activación y recovery, con un manifiesto lógico inmutable y admisión
conservadora de tamaño. El runtime v2, los consumidores locales y ambas apps ya
están implementados; la I/O real de Sheets, su integración de eventos y el despliegue
siguen sujetos a HU-083 y HU-085. El detalle vigente está en ADR-0014 y en
`spec/shifts/hu-082-continuous-seasonal-shift-rotation/post-audit-corrections.md`.

`onVersionedShiftPlanningRequestCreated` procesa exclusivamente schema v2 con
`retry: true`: propaga fallos transitorios y leases ocupados para reentrega; los
terminales idempotentes no repiten efectos. Las denegaciones reales y peticiones
malformadas terminan sin retry. `onShiftPlanningRequestCreated` conserva el flujo
legacy sin retry y excluye v2. La autorización v2 propaga indisponibilidad de sus
lecturas, sin convertirla en permiso ni confirmar prematuramente el evento.
El trigger legacy conserva la barrera de compatibilidad: captura la autoridad
abierta inmediatamente antes de escribir su hoja y la revalida en cada mutación Firestore posterior,
incluida la notificación. Una deriva detiene los efectos restantes, pero no puede
revertir una escritura de Sheets ya confirmada; HU-083 sustituye ese flujo no
atómico.

### HU-083: adaptador y consumidor local de Sheets por temporadas

`shift-sheets-config.ts` exige el ID del libro del entorno solicitado, sin
fallback global ni préstamo del otro entorno. El formateador propuesto usa
`turnos-reparto YYYY-YY` y `turnos-mercado YYYY-YY`, con temporada de septiembre a
agosto y aliases explícitos. Estos nombres y la cabecera técnica nueva se prueban
con fixtures: aún no sustituyen el inventario de las pestañas humanas existentes.
Un alias cambia el destino; no convierte una cabecera legacy al formato nuevo.

`shift-sheets.ts` prepara cambios por identidad estable, conserva filas ajenas y
columnas adicionales, y rechaza cambios manuales en celdas gestionadas pendientes
de importación gobernada. Nunca limpia una pestaña. Crea pestañas y escribe las
celdas y el marcador de operación en un solo `spreadsheets.batchUpdate`, con
reintentos del SDK desactivados y autorización inmediatamente antes del envío.
La lectura posterior confirma celdas y marcador. `inspect` sólo lee: un resultado
ambiguo exige reconciliación por el consumidor y no autoriza reenviar.

Hay un marcador reemplazable por pestaña, sin historial creciente en Sheets. La
historia durable, el rechazo de comandos sustituidos y el intento persistido antes
de enviar pertenecen a `shift-planning-sheets-consumer.ts` y al repositorio de
comandos. La atomicidad de un lote no ofrece
CAS frente a colaboradores: requiere exclusión de escritores externos, como
explica la [referencia de Google Sheets](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets/batchUpdate).
Los límites del adaptador están centralizados en `SHIFT_SHEETS_LIMITS`; excederlos
rechaza el lote completo, no lo fragmenta ni descarta filas.

`shift-planning-firestore-public-event-audit.ts` añade persistencia transaccional
a los codecs de HU-082, con política de retención explícita y tiempo estable del
CloudEvent. Propaga fallos transitorios y devuelve la señal `alertRequired`; esa
señal todavía no prueba envío de una alerta. No elimina terminales ni crea una
política de retención por defecto. El sexto corte local admite recovery UPDATE
solo con el before activado exacto y el after idéntico al before-image persistido.
El terminal recovery v2 conserva `activationTerminal` en el mismo documento y liga
ese archivo por digest: los eventos retrasados de activación usan su autoridad
original; las restauraciones usan el ID/digest de recovery. Los artefactos recovery
v1 siguen decodificándose estrictamente y sus UPDATE sin archivo se rechazan.
Se necesitan bindings de retención explícitos para ambas operaciones lógicas.
El terminal físico compartido y sus before-images deben conservarse hasta que todas
sus dependencias permitan eliminarlos; no hay TTL ni ejecutor de cleanup habilitado.
El séptimo corte conecta en el código candidato `onShiftWritten` al filtro de
eventos controlados, antes de decodificar/exportar una fila. El nuevo
`onShiftPlanningPublicWritten`, autenticado y con `retry: true`, persiste la
auditoría de esos eventos. Se mantiene el trigger ordinario sin reintentos
automáticos para no duplicar sus efectos Sheets/notificación.

El trigger de auditoría exige el JSON completo del codec de política (incluido
`policyDigest`) en `SHIFT_PLANNING_PUBLIC_EVENT_RETENTION_POLICY_DEVELOP` o
`SHIFT_PLANNING_PUBLIC_EVENT_RETENTION_POLICY_PRODUCTION`, según la ruta del evento.
No hay valor por defecto ni fallback entre entornos. La política se valida al
procesar un evento controlado; su ausencia/fallo o un fallo transitorio de autoridad
rechaza la invocación para reintento. Los eventos ordinarios no necesitan esa
configuración. Los rechazos persistidos emiten un diagnóstico estructurado con
correlación opaca, código y `alertRequired`; el log no demuestra entrega de alerta.

Antes de habilitar escrituras controladas, HU-085 debe desplegar/verificar ambos
triggers bajo exclusión de escritores, fijar la política aprobada, garantizar los
bindings de retención de cada productor y verificar el canal real de alertas.
Este corte no despliega ni configura recursos live. Prueba reproducible local:
`npm run test:shift-planning:public-event-trigger:emulator` ejecuta los handlers
exportados con snapshots SDK/autoridad Firestore en un proyecto demo, sin Sheets
ni FCM reales.

### Auditoría local de snapshots (HU-083, décimo corte)

`audit-shift-planning.cjs` lee exclusivamente un archivo JSON local (máximo 4 MiB).
No inicializa clientes Firebase/Google, no usa credenciales y no tiene modo apply,
conexión live ni generador de reparaciones. Primero compilar `npm run build` y luego:

```sh
npm run --silent audit:shift-planning -- --mode audit --input /ruta/absoluta/snapshot.json --project demo-reguerta-audit --environment develop --workbook audit-book
```

Los tres identificadores deben coincidir exactamente con `target` del archivo;
los valores del ejemplo son sintéticos. No se selecciona el proyecto por variables
ambientales. La captura live y su auditor autorizado siguen siendo un paso separado.
La evidencia JSON v1 contiene exactamente estos campos; v2 añade `lineage`:

| Campo | Contenido |
| --- | --- |
| `schemaVersion` | `1` o `2` |
| `target` | `projectId`, `environment`, `workbookId` |
| `capturedAt` | Fecha UTC ISO, con milisegundos, declarada por la captura |
| `aliases`, `tabs` | Aliases y mapeo explícito del contrato de importación |
| `workbookVersion` | Versión Drive positiva conservada como texto |
| `spreadsheet` | Snapshot de `spreadsheets.get`: ID, metadatos y grids `userEnteredValue` de todas las pestañas incluidas |
| `source` | Array de `{row, documentRevision, assignmentRevision, completionRevision, completed}`; `row` es la proyección `ShiftSheetsProjectionRow` |
| `members` | Array de `{userId, names, phones, eligibleTypes}` del lector de importación |
| `expectedDates` | `{delivery: ["YYYY-MM-DD", ...], market: ["YYYY-MM-DD", ...]}`; horizonte explícito para ambos tipos |

El archivo es evidencia normalizada, no un export Firestore bruto. Debe conservar
las revisiones, el estado real de completado y cualquier valor inválido observado
(por ejemplo `source: "planner"`); no corregirlos durante la preparación. Cada grid
debe traer `data` y `rowData` explícitos, y cada fila `values`, incluso vacíos.
El formato humano necesita su mapeo revisado; no se deduce del nombre de la pestaña.
El snapshot puede contener datos personales: el informe solo emite códigos, índices
de `source`, fechas del horizonte y digests, nunca nombres, teléfonos ni errores raw.

Se detectan identidades/fechas duplicadas, huecos y fechas extra respecto al horizonte,
fuente inválida, proyecciones/grupos inválidos, inelegibilidad actual, líderes
adyacentes iguales, ayudantes planificados incoherentes y diferencias entre almacenes.
La comparación de ayudantes cruza temporadas, pero no salta huecos del horizonte ni
recalcula ayudantes completados. La elegibilidad actual se comprueba solo para turnos
no completados. Una lectura Sheets incompleta/ambigua rechaza toda la comparación;
un origen inválido la deja sin evaluar. Nunca se interpreta ausencia como borrado.

Stdout contiene JSON con `inputDigest`, `reportDigest`, hallazgos y comprobaciones
pendientes; stderr muestra un resumen. Salidas: `0` sin hallazgos **en el alcance
comprobado**, `2` con hallazgos, `1` con argumentos/evidencia rechazados. La herramienta
no certifica captura, permisos, completitud live ni calendario aprobado. En v1,
linaje/rondas y bootstrap quedan sin evaluar; la elegibilidad histórica y los
ayudantes en los extremos siguen pendientes en ambas versiones. Siempre devuelve
`readyForRepair: false`; incluso `0` no completa HU-083 ni autoriza apply. El digest
vincula exactamente el archivo normalizado (incluido el orden de arrays), no acredita
su procedencia. Validación local: `npm run test:shift-planning:audit`.

El undécimo corte conserva v1 y añade evidencia v2 de linaje para ambos tipos:
`lineage: {delivery: ..., market: ...}`. Cada tipo puede ser `null` (hallazgo de
falta de evidencia) o contener exactamente:

| Campo | Evidencia observada |
| --- | --- |
| `beforeDate` | Primera fecha de `expectedDates[type]`; el bootstrap debe describir el estado inmediatamente anterior a ese horizonte |
| `bootstrap` | Contrato `ShiftRotationBootstrapInput` de HU-082, con los siete campos explícitos: `type`, `eligibleUserIds`, `isTrulyNewRotation`, `versionedState`, `ownerHistory`, `approvedMapping`, `legacyDeliveryHelper`; los cuatro últimos admiten `null` |
| `rows` | `[{shiftId, positions: [{roundNumber, positionInRound}, ...]}]`; metadatos observados de cada turno del horizonte, una posición para reparto y tres para mercado |
| `rotationAfterHorizon` | Cursor observado después del horizonte completo: `schemaVersion`, `type`, `cohortUserIds`, `roundNumber`, `nextMemberIndex` |

Los formatos anidados de bootstrap son los existentes en
[`shift-rotation-bootstrap.ts`](src/shift-rotation-bootstrap.ts); se comprueban también
sus claves y límites antes de resolverlos. Los propietarios salen exclusivamente de
`source[].row.rotationOwnerUserIds`, nunca de los asignados efectivos. El auditor
ordena las fechas y consume las posiciones con `consumeRotationPositions`: compara
propietarios, ronda/posición y cursor final, sin reiniciar en septiembre. Mercado
consume tres posiciones por fecha, incluso si un grupo cruza una ronda. Faltas o
duplicados en `rows` o en su origen no cuentan como una comprobación satisfactoria.

Se conserva la prioridad HU-082: estado versionado, historial reproducible y mapeo
aprobado; un estado corrupto no permite fallback. La auditoría informa por separado
fuentes alternativas inválidas o contradictorias, aunque la selección principal sea
válida. El historial se ordena por su secuencia explícita y los mapeos respetan orden
estable y continuidad del ayudante heredado según HU-082. El estado versionado
conserva su excepción de helper heredado; comprobar ayudantes fuera del horizonte
sigue pendiente. No se inventa un mapeo para resolver un conflicto.

La cohorte debe coincidir con el roster elegible suministrado para ese tipo. Esta
versión audita una cohorte congelada por horizonte; no reconstruye cambios históricos
de membresía ni aprueba la política HU-084. Las referencias `revision`, `digest` y
`provenance`, igual que `approvalStatus`, son evidencia declarada en el archivo: no
se certifica su origen, la aprobación externa, la captura ni el calendario. Un cursor
capturado después de generar filas no puede etiquetarse como estado anterior.

El informe v2 añade `lineage` por tipo con estado, fuente seleccionada y digest del
bootstrap resuelto, sin volcar UIDs ni evidencia privada. La ausencia o el rechazo se
reflejan en hallazgos; v1 sigue marcando linaje/bootstrap como no evaluados. Las dos
versiones mantienen `readyForRepair: false`; coherencia interna no equivale a permiso
para preparar/aplicar una reparación live. La CLI y sus códigos de salida no cambian.

### Revisión de reparación en seco (HU-083, duodécimo corte)

`repair-planned-shifts.cjs` compara un snapshot v2 original con una propuesta v2
explícita. Ambos usan el formato del auditor anterior. Primero ejecutar el auditor
sobre cada archivo y revisar sus resultados; sus respectivos `inputDigest` son los
valores que exige este comando (después de `npm run build`):

```sh
npm run --silent repair:planned-shifts -- --mode dry-run --input /ruta/original.json --proposal /ruta/propuesta.json --project demo-reguerta-audit --environment develop --workbook audit-book --expected-input-digest '<inputDigest original>' --expected-proposal-digest '<inputDigest propuesta>'
```

Cada archivo está acotado a 4 MiB. La propuesta expresa valores deseados sobre la
misma captura: conserva `capturedAt`, `workbookVersion`, horizonte, miembros, aliases,
mapeo de pestañas y bootstrap anterior al horizonte. No se presenta como una nueva
captura ni autoriza sustituir evidencia ambigua. Debe pasar la auditoría sin hallazgos
en el alcance comprobado y con ambos linajes consistentes. El original puede tener
filas/posiciones/cursor incorrectos o ausentes, pero exige bootstrap resoluble y sin
fuentes alternativas contradictorias. Un caso ambiguo requiere evidencia revisada
antes de volver a preparar el plan; el script no fabrica un mapeo.

El resultado JSON contiene:

- `projectionChanges`: proyecciones normalizadas completas antes/después, con las
  revisiones observadas y el estado de completado. `before: null` representa un alta
  propuesta con revisiones cero, no un documento ya persistido. Para filas existentes
  se conservan los contadores; el ejecutor futuro deberá definir su incremento CAS.
- `lineageChanges`: posiciones y cursor final antes/después, manteniendo el bootstrap.
- `sheetsChanges`: ID de pestaña, fila/columna base 1 y valor literal antes/después de
  cada celda gestionada. No cambia metadatos, cabeceras, columnas manuales, fórmulas,
  celdas protegidas/fusionadas ni pestañas fuera del mapeo. Las altas solo ocupan filas
  sin contenido previo en las columnas gestionadas. No convierte formatos humanos ni
  crea pestañas.
- Digests de ambos snapshots, de sus auditorías y del plan completo. El digest original
  vincula también los vecinos y filas sin cambios; no equivale a una precondición
  Firestore `updateTime` ni a un CAS de Sheets.

No admite borrados ni IDs ambiguos, cambios de completado/revisiones, mutaciones de
filas completadas o de sus posiciones históricas. Un cambio de líder requiere ambos
vecinos en original y propuesta; cambiar un ayudante requiere su sucesor. La auditoría
comprueba la continuidad resultante. Una corrección de fuente/origen debe terminar
en `source: "app"`, `origin: "planner"`. El historial completado se conserva incluso
si contiene un dato que no se puede reparar con este corte.

El plan es un artefacto privado de revisión: contiene UIDs y valores de celdas, por
lo que no debe copiarse en logs o comentarios públicos. Stdout emite el JSON y stderr
solo cantidades/errores genéricos. Salida `0` significa plan generado; `1`, rechazo.
Siempre incluye `readyForApply: false`: no es un manifiesto ejecutable de documentos
Firestore completos, un lote Sheets listo para enviar, un baseline de migración ni
un backup/inverso de rollback. Faltan captura/calendario acreditados, historia y
extremos, backups/restore, exclusión de escritores y triggers, CAS/provenance atómicos,
baseline y rollback. No hay clientes live ni modo apply. Repetir las mismas entradas
produce el mismo plan; esto no demuestra idempotencia de una futura escritura.
`npm run test:shift-planning:audit` valida conjuntamente auditoría y plan en seco.

El decimotercer corte permite vincular ese plan a una captura completa de los
documentos de turnos. Añadir **ambas** opciones al comando anterior:

```sh
--firestore-capture /ruta/captura.json --expected-capture-digest '<digest de la captura>'
```

El digest es `createShiftPlanningDigest(captura)` con el codec canónico existente,
no un hash del texto JSON. La captura (máximo 4 MiB) tiene exactamente estos campos:

| Campo | Contrato |
| --- | --- |
| `schemaVersion` | `1` |
| `target` | Mismo proyecto, entorno y libro del snapshot original |
| `inputDigest` | Digest del snapshot normalizado original completo |
| `capturedAt` | Misma fecha de captura del original |
| `documents` | Una entrada `{targetPath, updateTime, payload}` por cada fila original, incluidos vecinos sin cambios |
| `absentPaths` | Exactamente las rutas de las altas propuestas; sin duplicados ni rutas adicionales |

`payload` utiliza `encodeShiftPlanningFirestoreValue` y debe representar un mapa;
`updateTime`, un valor `{kind: "timestamp", seconds, nanoseconds}` del mismo codec.
No usar la serialización JSON directa de objetos SDK como sustituto. El decodificador
rechaza tipos no soportados y la recodificación debe reproducir el valor canónico.
Se conservan timestamps con nanosegundos, bytes, GeoPoints, anidamientos, campos
adicionales y la provenance original. No se convierte la captura en el esquema
estricto de una publicación nueva: por ejemplo, `source: "planner"` se conserva
como valor original que el plan pretende corregir.

Las rutas deben ser exactamente `{environment}/plus-collections/shifts/{id}` para
las filas del original. Se comprueba que cada documento reproduce su proyección,
revisiones, estado/revisión de completado y posiciones de ronda; también la relación
propietario/asignado de las posiciones de mercado. El formato de estos campos sigue
el payload HU-082 (incluidos los campos de rotación nulos del tipo opuesto). No se
inventan valores predeterminados para documentos legacy que no lo representan.
El helper real y su timestamp de completado permanecen en el cuerpo íntegro aunque
no aparezcan en la proyección. Un `updateTime` posterior a `capturedAt` se rechaza.

Con estas opciones, el resultado es un **plan v2** con `firestoreEvidence`: digest de
captura, documentos completos ordenados con `updateTime`, digest de payload y digest
de proyección, más las ausencias exactas. Cambiar incluso un campo adicional o un
nanosegundo de un vecino altera el digest del plan. Sin las opciones se conserva el
plan v1 sin vinculación; opciones incompletas, captura nula o discrepancias se rechazan.

Este vínculo solo acredita coherencia entre los archivos suministrados. No prueba
quién capturó los datos, completitud de una consulta live, ausencias reales ni la
actualidad de perfiles, rotaciones y fences. Los before-images son privados; no se
vuelcan en stderr. Sigue faltando construir y ensayar la transacción de documentos
finales, terminal, retención y provenance, el baseline y su recuperación. Los dos
formatos mantienen `readyForApply: false`; no hay captura live ni ejecutor de escritura.

El octavo corte exporta `executeShiftPlanningSheetsSync` como HTTP privado
(`invoker: private`, sin scheduler, timeout de 300 s). El acceso IAM al invoker y
la identidad runtime quedan para HU-085; no se amplía el permiso del operador de
recovery. Acepta solo POST sin query con `schemaVersion: 1`, `environment` y:

- `mode: "execute"` y el `commandId` persistido exacto.
- `mode: "drain"` y `limit: 1` o `2`; redescubre trabajo pendiente/caducado.

No acepta filas, workbook alternativo ni credenciales del solicitante. La composición
usa `SHEETS_SPREADSHEET_ID_DEVELOP`/`SHEETS_SPREADSHEET_ID_PRODUCTION` y exige el JSON
revisado `SHIFT_SHEETS_ALIASES_DEVELOP`/`SHIFT_SHEETS_ALIASES_PRODUCTION` del entorno,
incluso `[]` si no hay aliases. Cada alias contiene solo `type`, `seasonStartYear`
y `title`. No hay fallback a configuración global; un alias no autoriza convertir
el layout humano. El cliente usa scopes de Sheets y `drive.metadata.readonly` para
leer la versión del libro.

El worker devuelve 200 al completar/repetir terminales (o al no hallar trabajo),
202 con `retryAtMillis` si está ocupado y 409 si requiere reconciliación o rechaza
la autoridad/configuración; 503 indica fallo transitorio sin diagnóstico privado.
Los resultados solo incluyen tipo e ID/reintento, nunca filas. Un drain se detiene
al encontrar trabajo ocupado o incierto. Un error/timeout no demuestra que una
escritura anterior del mismo drain no ocurriera: una nueva invocación consulta los
comandos y recibos persistidos; nunca interpreta la ausencia de respuesta como
permiso para reenviar. Las llamadas ya enviadas mantienen recuperación solo de
lectura. Sigue siendo necesaria la exclusión operativa de escritores externos.
La ruta todavía consume comandos de activación; no habilita recuperación de
comandos consumidos ni reemplaza las barreras de recovery existentes.

El noveno corte exporta `executeShiftSheetsImport` como HTTP privado, sin scheduler
ni despliegue. Acepta POST sin query con `schemaVersion: 1`, `environment`,
`operationId` y una sola operación:

- `mode: "prepare"`: carga el origen y devuelve el plan completo con `planDigest`.
  Puede persistir el comando inmutable en Firestore privado; no modifica turnos
  públicos ni celdas. El plan contiene asignaciones por UID y guardas del origen:
  su respuesta es privada y lleva `Cache-Control: no-store`.
- `mode: "apply"` y `expectedPlanDigest`: exige el digest exacto revisado y aplica
  atómicamente las correcciones en Firestore tras revalidar la autoridad.
- `mode: "writeBack"` y el mismo `expectedPlanDigest`: completa explícitamente
  la escritura pendiente en Sheets. Nunca se encadena automáticamente con apply.

El cuerpo no acepta filas, origen, configuración ni políticas. Además del workbook,
aliases y política de retención del entorno, la composición exige el JSON revisado
`SHIFT_SHEETS_IMPORT_TABS_DEVELOP` o `SHIFT_SHEETS_IMPORT_TABS_PRODUCTION`. Cada entrada
contiene exactamente `type`, `seasonStartYear`, `title`, `layout` y `decorations`;
el título debe resolver al alias/ruta configurado. `layout` es `canonical` (con
`decorations: []`), `delivery_human` o `market_human` según el tipo. Cada decoración
contiene solo `rowNumber` (base 1) y `cells` literales. No se infiere el formato ni se
convierte el libro: una preparación humana sigue bloqueada para apply hasta la
conversión revisada. Los límites de pestañas, filas y columnas son los del adaptador.

Devuelve 200 con el plan o resultado, 400 para un comando mal formado, 405 para otro
método, 409 para rechazo o reconciliación pendiente y 503 para un fallo inesperado.
Apply/writeBack devuelven metadatos de resultado, sin payload interno. Ante pérdida
de respuesta se repite la misma operación con el mismo ID/digest; un envío incierto
solo permite lectura/reconciliación y nunca otro envío. Los logs omiten diagnósticos
privados. HU-085 debe establecer IAM, identidad runtime y exclusión de escritores.
`npm run test:shift-sheets:import:emulator` cubre los tres modos sobre Firestore demo
y Sheets simulado, incluidos digest alterado, revisión obsoleta y replay.

Las revisiones de libro del bundle son observaciones por partición y pueden
diferir; no son tokens CAS de Sheets. El ejecutor entrega al consumidor un callback
para revalidar autoridad antes de cada lote. El consumidor carga las filas exactas
del bundle activado y comprueba sus marcadores contra el terminal; incluye el
helper predecesor y su temporada cuando cambia.

Antes de `batchUpdate`, el repositorio crea
`shiftPlanningSyncCommands/{commandId}/externalSubmissions/sheets` y actualiza
`shiftPlanningState/sheetsSubmission` en la misma transacción. Este último documento
serializa reparto y mercado para el libro estable del entorno. El recibo conserva
el claim original, digests de proyección/petición, versión previa y hora de envío;
sólo admite añadir evidencia de lectura verificada. Un resultado desconocido,
incluso un fallo justo antes de invocar Sheets, no permite otro envío ni liberar
el libro por vencimiento. Los reintentos llaman únicamente a `inspect`.

La lectura de `files.version` exige acceso de metadatos Drive, comprueba ID/tipo
del libro y conserva el int64 como texto. Lee la versión alrededor del read-back:
un cambio durante la lectura impide completar. La versión observada es la de
[Drive](https://developers.google.com/workspace/drive/api/reference/rest/v3/files),
no una revisión artificial ni una garantía CAS. El recibo verificado anterior
explica el avance del libro causado por la otra partición.

Una confirmación puede llegar después del lease original. La completion exige
entonces evidencia ya persistida y los mismos linaje/propiedad; conserva worker,
intento y epoch originales. Un claim sin recibo no obtiene esa excepción. No hay
TTL, borrado del recibo ni reenvío automático para resolver incertidumbre.
La exclusión efectiva de escritores externos sigue pendiente de HU-085.

Validación enfocada: `npm run test:shift-sheets` y
`npm run test:shift-planning:public-event-audit:emulator`, además de
`npm run test:shift-planning:sheets-consumer:emulator`. Esta última usa el
repositorio real contra Firestore emulado y el adaptador real contra una API Sheets
simulada; no demuestra comportamiento de red ni permisos de Google reales. El estado completo y
los siguientes cortes están en el
[plan de HU-083](../spec/shifts/hu-083-multi-season-shift-sheets/plan.md).
No hay conexión nueva en `index.ts`, importación sobre datos reales, reparación
de datos reales ni despliegue. Android e iOS siguen leyendo el contrato Firestore de
HU-082.

### HU-083: lectura de importación y plan previo

`readShiftSheetsImport` reutiliza la lectura acotada del exportador. Recibe las
pestañas exactas, baseline Firestore y miembros de confianza. Lee todas las pestañas
seleccionadas o rechaza el conjunto; verifica la versión Drive antes/después.
Devuelve asignaciones observadas, discrepancias por filas ausentes y digests de
baseline, mapping y miembros. No escribe ni genera órdenes de borrado.

Los formatos se seleccionan explícitamente por pestaña:

- `canonical`: cabecera técnica exacta; sólo admite cambios en asignados/estado.
  Identidad, fecha, temporada, propietario, helper, source/origin y rowDigest deben
  coincidir con el baseline. El digest de fila sigue representando la exportación
  anterior; no se recalcula en la hoja para encubrir una edición manual.
- `delivery_human`: A fecha, B nombre, C teléfono, E sustitución opcional
  `lo hace Nombre`. D/F no se importan. Los títulos/meses deben figurar en
  `decorations` con número de fila y contenido exacto; no hay descarte heurístico.
- `market_human`: cabecera de fecha seguida de tres participantes, con nombre,
  teléfono opcional y sustitución en A/B/C. Se permite distinta separación entre
  bloques. Un bloque incompleto, una identidad ambigua o sustitución desconocida
  rechaza la lectura; nunca vuelve silenciosamente al titular original.

Las fechas admiten ISO, día/mes/año explícito o serial entero de Sheets, sin
conversión por la zona horaria del libro. Fórmulas en las celdas interpretadas se
rechazan. Los nombres/teléfonos son aliases del catálogo facilitado; un teléfono
contradictorio no resuelve un nombre ambiguo. Los turnos históricos sin cambios
pueden conservar miembros inactivos; una asignación nueva exige elegibilidad.

`planShiftSheetsImport` produce parches limitados a asignados, estado y helper
previsto, más guards de revisión de los vecinos afectados. Conserva el helper del
predecesor completado y rechaza cambios de historial, swaps pendientes, responsables
adyacentes iguales y extremos sin vecinos demostrados. Los guards son valores para
revisión: aún no son un CAS ejecutado. Aplicar exige cargar y releer autoridad real,
cronología completa, elegibilidad y fences de escritores/notificaciones dentro del
flujo transaccional, y generar la procedencia de evento correspondiente.

Pruebas: `npm run test:shift-sheets` (38 casos) y
`npm run test:shift-planning:sheets-consumer:emulator` (15 casos). Las APIs Google
son simuladas. No se conecta este preflight al importador legacy de `index.ts`,
no se convierten pestañas humanas y no se modifica ningún dato real.

### Importación transaccional y write-back local (HU-083, cortes cuarto y quinto)

`createFirestoreShiftSheetsImport` compone `prepare(operationId)`,
`apply(operationId, expectedPlanDigest)` y `writeBack(operationId, expectedPlanDigest)`
sobre el cliente público de Firestore y el adaptador Sheets existente.
La preparación carga todos los turnos y socios (máximo combinado de 500), exige
estado activo abierto, rotaciones sin lease y sincronización Sheets libre, y
revalida la misma fuente después de leer Google. El catálogo usa `displayName`,
roles canónicos y `phoneNumber` con los alias legacy explícitos del escritor de
socios. No deduce identidades por nombre de pila. Los documentos públicos deben
cumplir el contrato canónico HU-082; este repositorio no migra documentos legacy.

El plan inmutable vive en
`{env}/plus-collections/shiftPlanningOperations/sheets-import-{id}/sheetsImport/prepared`.
Aplicar exige su digest revisado y relee autoridad, documentos, vecinos, socios y
fences de notificación en la transacción que escribe. Un alta/baja, revisión o
bloqueo posterior invalida el lote entero. Los parches deben pertenecer a la
revisión/digest/epoch activos. Se conservan propiedad de rotación, cursores e
historial completado; solo se modifican asignados, estado y helper previsto. En
mercado, `rotationPositions.effectiveAssigneeUserId` se actualiza junto al array de
asignados, conservando propietario, ronda, posición y motivo de planificación.

El límite es 100 parches y hasta 105 escrituras atómicas: turnos, terminal existente
`syncCorrection`, retención de operación, resultado, recibo de importación y reserva
del libro. La composición exige la
política explícita de retención HU-082, vinculada al plan; no introduce TTL. El
resultado inmutable en `sheetsImport/result` conserva las proyecciones exactas con
`writeBackState = pending`. Su replay no vuelve a consultar Google ni modifica
turnos. La auditoría existente reconoce el cambio como evento controlado; el
trigger real todavía requiere integración.

El lector conserva las once celdas canónicas de cada fila dentro de la observación
revisada. El write-back sólo admite esos valores exactos, incluida la ubicación,
antes de sustituir asignados, helper, estado y digest. El exportador ordinario sigue
rechazando ediciones manuales; columnas ajenas, fórmulas fuera del área gestionada
y formato permanecen intactos. Leer/planificar pestañas humanas sigue disponible,
pero aplicar parches sobre ellas se rechaza antes de escribir Firestore hasta que
exista una conversión explícita. El quinto corte no convierte formatos.

El recibo `sheetsImport/submission` y el documento compartido
`shiftPlanningState/sheetsSubmission` contienen la misma reserva `importWriteBack`.
Con `batch = null`, el libro está reservado pero no se ha enviado nada. Una vez
persistido el digest del lote y su instante de envío, todos los reintentos son de
lectura, aunque haya pasado un día: un timeout no autoriza reenviar. Esa reserva
impide preparar otra importación o reclamar/enviar una exportación de activación.
Se usa el mismo registro compartido para reparto y mercado, sin cola adicional.

`writeBack` relee el resultado, procedencia pública, baseline, vecinos, miembros y
fences antes del envío y de la confirmación. El marcador y las celdas deben coincidir
exactamente; la versión Drive debe ser estable durante la lectura y posterior a la
revisada. La confirmación guarda `evidence` en ambos recibos y actualiza las revisiones
de las dos particiones en una transacción. El resultado original conserva
`writeBackState = pending` como hecho histórico; el estado efectivo se consulta en
el recibo separado. Un replay confirmado no consulta Google ni recupera una reserva
que ya pertenece a otro envío. Un resultado desconocido o una divergencia conserva
el bloqueo y necesita reconciliación explícita, nunca una caducidad automática.

Validación local: `npm run test:shift-sheets:import:emulator` (37 casos),
`npm run test:shift-planning:sheets-consumer:emulator` (15), repositorio sync (7),
Sheets (38), Rules strict (32) y phase1 (8), sin skips. Firestore es emulado y las
APIs Google son simuladas. Las Rules deniegan estos artefactos privados a clientes.
La versión Drive sigue siendo una observación, no CAS entre servicios: la activación,
los escritores ordinarios y los colaboradores externos siguen necesitando su cerco
operativo antes de cualquier uso real. Este corte no conecta endpoints ni el trigger
legacy de `index.ts`, no envía FCM y no despliega ni modifica datos reales.

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

Ruta de petición:

`{env}/plus-collections/shiftPlanningRequests/{requestId}`

Antes de crearla, `resolveShiftPlanningRequestContext` acepta exclusivamente
`{ schemaVersion: 1, environment }` por `POST`, sin query. Tras verificar el token
y el enlace de admin activo, lee `shiftPlanningState/current` y devuelve solo
`schemaVersion`, `environment`, `expectedWriteEpoch` y
`expectedActiveRevision`. Estado ausente, invalido o en mantenimiento falla
cerrado; el endpoint no expone digest, revision interna, roster ni datos de socios.
Android/iOS resuelven este contexto antes de crear su petición v2.

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
  anterior a los IDs y before-images del intento real.
- `activate` valida el candidato staged, su bundle inmutable y sus posiciones,
  recompone las fuentes live y exige el mismo digest antes del CAS. El repositorio
  reclama la petición y publica todo el bundle atómicamente. Las posiciones
  siguen siendo sólo la proyección de inspección; el bundle es la autoridad.

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
el adaptador no se conecta todavía desde `index.ts`. Las Rules locales Phase 1
y strict niegan escrituras directas a turnos/calendario, pero su presencia en Git
no demuestra el despliegue ni el drenaje real de los procesos afectados.

El gate de HU-082 admite como máximo 500 escrituras, 8 MiB estimados por petición
y 768 KiB estimados por documento. `shift-planning-firestore-transaction-manifest.ts`
separa los valores mediante el codec existente y genera un manifiesto inmutable.
La estimación reserva 1 KiB por petición y suma 1 KiB más el doble del JSON
etiquetado por documento. No mide el protobuf, tokens ni entradas de índice.
Firestore conserva la autoridad sobre sus límites reales y el commit atómico.

El adaptador `public-transaction-v2` aplica el manifiesto con los métodos públicos
`Transaction.create/update/delete`, después de las lecturas y fences del intento.
Cada retry resuelve de nuevo las fuentes. La admisión schema v2 liga
`logicalMutationDigest`, `documentWriteCount`, `estimatedRequestBytes`, dirección,
manifest y autoridad de índices. Cambiar esa autoridad invalida el candidato.
Stage no fabrica evidencia de una transacción futura. HU-085 todavía debe ensayar
el volumen real forward/inverse contra los índices aprobados en un clon aislado.

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
Después entrega esas mutaciones al adaptador de APIs públicas; un vector de
emulador confirma la publicación atómica de todo el manifiesto.
Los creditos no nulos siguen cerrados hasta HU-084.

`shift-planning-inverse-materializer.ts` parte exclusivamente del bundle y
manifest inverse persistidos, tombstone de activacion, request completada,
before-images revalidadas y read-set actual. Exige que todos los creates sigan
ligados a la activacion, que el CAS activo conserve bundle/digest/epoch exactos y
que ambos release leases sigan sellados por esa operacion. El batch inverse borra
solo esos creates y restaura targets con su `lastUpdateTime`. Recupera el lineage
de negocio anterior, pero avanza un `writeEpoch` nuevo y revisiones monotonicamente
superiores, limpia ambos leases y reemplaza el tombstone por un terminal de
recovery v2 ligado por digest, que conserva el terminal de activación original
en `activationTerminal`. No añade rutas ni escrituras; el payload mayor atraviesa
la admisión existente de transacciones y documentos. Para no dejar campos posteriores, la restauracion
reescribe mapas top-level completos y usa `FieldValue.delete()` en los campos
top-level que ya no deben existir. Before-images y request historica completada
se conservan. Un vector de emulador confirma la restauración atómica mediante
el mismo adaptador de APIs públicas.

`shift-planning-attempt-outcome.ts` distingue en schema v2 dos evidencias:
`transactionReturned` conserva la admisión del intento que devuelve éxito;
`operationReadBack` registra la revalidación del terminal confirmado cuando falta
el recibo. Su ID estable liga dirección y `operationIntentDigest`. El repositorio
retiene el primer recibo sin sobrescritura y hace converger ambas vías.

`shift-planning-firestore-cas-runtime.ts` relee un recibo existente antes del CAS.
Si falta, revalida el terminal direccional, bundle, epoch e intent y registra una
relectura sin volver a publicar/restaurar ni inventar la admisión perdida. Si aún
no existe terminal, recompone las fuentes dentro de cada retry transaccional.
Solo un rechazo tipado demostrado antes de retornar del callback puede persistir
`failed`; un transporte ambiguo o una retención fallida siguen siendo reintentables.
Un terminal `completed` concurrente prevalece y se relee. La evidencia histórica
no autoriza una operación nueva con linaje distinto.

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
reales. Los dos triggers separan el flujo legacy de la ejecución v2 reintentable
de preview, stage o CAS de activación. Recovery se exporta localmente con `onRequest` solo para el invoker
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
redescubre sin duplicar el efecto idempotente. El consumidor local HU-083 añade la I/O real y
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
replay sin convertirlo en exportación o notificación por fila. HU-083 debe
conectar este filtro al trigger `onShiftWritten`.

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
real; el contrato puro de retención sigue sin escribir Firestore.

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
repositorios implementan también los CAS de publicación/recovery y el lifecycle
de comandos e intenciones. Sus contratos locales no acreditan una activación
compartida ni la I/O real de Sheets, pendiente de HU-083.

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

El adaptador local publica los turnos generados con `source = "app"` para
mantener compatibilidad, más `origin = "planner"`, `planningRequestId`,
`bundleRevision`, `bundleDigest` y `writeEpoch`. También persistirá propiedad de
rotación separada de la asignación efectiva: `rotationOwnerUserId`, ronda y
posición para reparto; `rotationOwnerUserIds` y posiciones por propietario para
mercado. Una reasignación futura podrá cambiar `assignedUserIds` sin reescribir
la propiedad histórica. Estos campos pertenecen al adaptador de publicación/activación. Los planners
puros siguen sin efectos; el despliegue y la activación compartida están pendientes.

### Requisitos de despliegue de la corrección HU-082

HU-085 debe revisar conjuntamente el alta de `onVersionedShiftPlanningRequestCreated`
y la actualización del trigger legacy que excluye v2: una versión antigua de ese
trigger todavía podría procesar el mismo evento. Ambos deliveries y sus reintentos
forman parte del inventario y drenaje de la barrera; no basta con cerrar uno.

Ambas apps descubren únicamente la petición v2 más reciente de su administrador,
fijan su documento mientras está pendiente y vuelven a descubrir tras el terminal.
Los listeners de fuente/candidato se recuperan con backoff cancelable de hasta 30 s.
El índice compuesto `shiftPlanningRequests` sobre `requestedByUserId`,
`schemaVersion` y `requestedAt DESC` está en `firestore.indexes.json`, referenciado
por `firebase.strict.json`. HU-085 debe desplegarlo y verificar estado READY antes
de habilitar estos clientes. Estas correcciones no han desplegado nada.

El transporte de notificaciones verifica plazo y cancelación antes de **cada**
llamada SDK. Un timeout impide iniciar otra llamada, pero no revoca una ya enviada;
esa incertidumbre permanece en el resultado. Reconciliación, entrada en incidente y
terminalización comparten una sola lectura transaccional de historial completo en
`shift-planning-firestore-notification-recovery-evidence.ts`, conservando sus
políticas puras. Un incidente con epoch nuevo no autoriza reenviar intenciones
antiguas: debe cerrarse con cancelación probada o corrección/reconciliación explícita.

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

## 📦 Migracion controlada de pedidos HU-086

`migrate:legacy-orders` sustituye el volcado desde la app publicada por una
operacion puntual con Admin SDK. No requiere abrir Rules ni desplegar Functions.
El origen esta cerrado en el propio script:

- `production/collections/orders`;
- `production/collections/orderLines`;
- `production/plus-collections/products` para resolver snapshots.

Solo acepta una semana por ejecucion, elegida entre `2026-W28` y `2026-W34`,
ambas inclusive, y un unico destino. El comando live tambien exige exactamente el proyecto
`reguerta-9f27f`, incorpora ese ID al digest y rechaza un
`FIRESTORE_EMULATOR_HOST` heredado. El dry-run de develop es:

```bash
npm run migrate:legacy-orders -- \
  --project reguerta-9f27f \
  --target-env develop \
  --week 2026-W28
```

La salida no contiene payloads ni IDs: muestra los conteos de esa semana,
bloqueos y
los digests SHA-256 de fuente, proyeccion y plan. Cualquier documento malformed,
linea huerfana, duplicado `userId + weekKey` con alguna linea, producto ausente
o documento destino divergente bloquea el apply completo. Los destinos identicos son no-op;
solo se crean documentos ausentes y nunca se hace merge, update ni delete.
El legacy es la entrada de esta proyeccion, no un espejo exclusivo: pedidos
nativos de Reguerta+ bien formados y sin colision de ID, socio/semana u
`orderId` pueden coexistir. El read-back verifica la proyeccion seleccionada,
no la igualdad total del namespace destino.

Como en el migrador publicado, el catalogo production es la autoridad de los
snapshots de producto: `vendorId`, nombre, `priceAtOrder`, pricing, pack y unidad.
`priceAtOrder` conserva el redondeo a centimos del migrador publicado; el
subtotal legacy no se recalcula desde ese snapshot.
La imagen puede usar el fallback legacy cuando el catalogo no la contiene; el
sentinel historico de string vacio se normaliza a `null`. A
diferencia del helper antiguo, esta herramienta no inventa vendors, nombres,
precios ni unidades. Los campos de pack opcionales se omiten cuando el catalogo
no los define; la ausencia o invalidez de un campo obligatorio bloquea el plan.
Los documentos `orders` sin ninguna linea vinculada se registran y omiten como
carritos vacios creados al entrar en el flujo legacy; no se convierten en
pedidos historicos `confirmed` con total cero. Si existen lineas vinculadas pero
son invalidas o incompatibles, el plan sigue bloqueando. Los carritos omitidos
forman parte de los digests mediante un manifiesto interno que no se muestra en
la salida y conservan las comprobaciones de colision por ID, socio/semana y
`orderId`; antes de aplicar, una transaccion verifica que sigan vacios y sin
destino concurrente. Si el helper legacy creo varios carritos vacios para el
mismo socio y semana, se omiten todos solo cuando ninguno tiene lineas; la
transaccion exige que la pertenencia completa del grupo siga siendo identica.

Tras revisar el dry-run y recibir autorizacion explicita, se repite el mismo
comando con:

```text
--apply --expected-plan-digest DIGEST_SHA256_REVISADO
```

El script recalcula el plan, exige el mismo digest, protege cada grupo de pedido
en una transaccion. Dentro de ella vuelve a consultar la pertenencia completa de
lineas por `orderId` y de pedidos por socio/semana para detectar inserciones de
writers activos, ademas de comprobar versiones con precision de nanosegundos.
Despues relee Firestore: el read-back debe devolver cero escrituras pendientes y
los mismos digests de fuente y proyeccion. Si falla un grupo, los anteriores
pueden haber quedado creados; se informa el numero agregado de escrituras y el
siguiente paso siempre es un dry-run nuevo, nunca un merge o borrado automatico.
Primero se completa y verifica `develop`; `production` requiere un dry-run nuevo,
su propio digest y una autorizacion de escritura separada. La autorizacion de un
paso no habilita el siguiente.

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
