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
- usa `fcmToken` como destino de FCM
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

### Flujo outbound

- El endpoint HTTP:

  `https://europe-west1-reguerta-9f27f.cloudfunctions.net/exportShiftsToGoogleSheets`

  hace export completo de `plus-collections/shifts` hacia la hoja.

- El trigger Firestore sobre:

  `{env}/plus-collections/shifts/{shiftId}`

  exporta de forma incremental los cambios confirmados hechos desde la app
  (`source != google_sheets` y `status == confirmed`) y además crea una
  `notificationEvents` de tipo `shift_updated`.

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

El resto de endpoints HTTP candidatos de sincronizacion, exportacion,
timestamps y validacion requieren admin activo.

## 🗓️ Planificación manual de turnos activos

`HU-017` añade una vía prudente para que un admin lance desde la app la
planificación de la siguiente temporada sin automatizar todavía el proceso
por cron.

Flujo:
- Android/iOS escriben una petición en
  `{env}/plus-collections/shiftPlanningRequests/{requestId}`
- El trigger Firestore `onShiftPlanningRequestCreated` genera la temporada
  siguiente usando solo socios activos
- Reparto:
  - rota socios activos en orden aleatorio
  - mantiene socios nuevos/reactivados al final
  - deriva `helperUserId` a partir del siguiente turno
- Mercado:
  - garantiza al menos 3 socios por mes
  - redistribuye sobrantes si un bloque final queda incompleto
- La función escribe:
  - `plus-collections/shifts`
  - nuevas pestañas de Google Sheets con formato humano:
    - `turnos-reparto YYYY-YY`
    - `turnos-mercado YYYY-YY`
- Finalmente crea una `notificationEvents` dirigida a los socios afectados.

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
