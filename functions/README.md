# Reguerta Firebase Cloud Functions

Este proyecto contiene funciones en la nube (Cloud Functions) para mantener actualizados los timestamps de colecciones críticas en Firestore.

## 🔧 Tecnologías

- Firebase Functions (2ª generación)
- Node.js 22
- TypeScript
- Firestore
- Eventarc

## 🧠 Funcionalidad

Además de los endpoints HTTP de soporte, el backend ahora despacha notificaciones push reales cuando se crea un documento en:

`{env}/plus-collections/notificationEvents/{eventId}`

El trigger:
- resuelve la audiencia (`all`, `users`, `segment.role`)
- busca destinatarios en `{env}/plus-collections/users/{userId}/devices/{deviceId}`
- usa `fcmToken` como destino de FCM
- deja trazabilidad mínima en `notificationEvents.dispatch`

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
  sheets.market_range="Market!A:Z"
```

Opcionalmente puedes separar por entorno:

```bash
firebase functions:config:set \
  sheets.spreadsheet_id_develop="YOUR_DEV_SPREADSHEET_ID" \
  sheets.spreadsheet_id_production="YOUR_PROD_SPREADSHEET_ID"
```

Después:

```bash
firebase deploy --only functions
```

Cada vez que se crea o modifica un documento en ciertas colecciones, puedes llamar manualmente a una función HTTP para actualizar el campo correspondiente en el documento:

```
{entorno}/collections/config/global.lastTimestamps.{colección}
```

### 📦 Colecciones observadas y funciones HTTP asociadas

| Colección     | Campo actualizado                                 | Endpoint HTTP                                                              |
|---------------|---------------------------------------------------|----------------------------------------------------------------------------|
| `products`    | `lastTimestamps.products`                         | `https://europe-west1-reguerta-9f27f.cloudfunctions.net/onProductWrite`   |
| `orderlines`  | `lastTimestamps.orders`                           | `https://europe-west1-reguerta-9f27f.cloudfunctions.net/onOrderWrite`     |
| `containers`  | `lastTimestamps.containers`                       | `https://europe-west1-reguerta-9f27f.cloudfunctions.net/onContainerWrite` |
| `measures`    | `lastTimestamps.measures`                         | `https://europe-west1-reguerta-9f27f.cloudfunctions.net/onMeasureWrite`   |
| `orders`      | `lastTimestamps.orders`                           | `https://europe-west1-reguerta-9f27f.cloudfunctions.net/onOrderWrite`     |
| `users`       | `lastTimestamps.users`                            | `https://europe-west1-reguerta-9f27f.cloudfunctions.net/onUserWrite`      |

### ✅ Validación de política de versión remota

Para asegurar que `config/global.versions.{android,ios}` siempre tenga
`current|min|forceUpdate|storeUrl`, existe el endpoint:

`https://europe-west1-reguerta-9f27f.cloudfunctions.net/validateGlobalVersionPolicy`

Parámetros opcionales:
- `env=develop` o `env=production` o `env=local`
- `envs=local,develop,production` (lista separada por comas)

Si no se envía ningún parámetro, valida/siembra por defecto en:
`local`, `develop` y `production`.

### ✅ Validación de contrato de frescura crítica

Para asegurar que `config/global` siempre incluya:
- `cacheExpirationMinutes > 0`
- `lastTimestamps.{products,containers,measures,orders,orderlines,users}`

existe el endpoint:

`https://europe-west1-reguerta-9f27f.cloudfunctions.net/validateGlobalFreshnessConfig`

La validación actualiza tanto:
- `{env}/collections/config/global`
- `{env}/plus-collections/config/global`

Parámetros opcionales:
- `env=develop` o `env=production` o `env=local`
- `envs=local,develop,production` (lista separada por comas)

## ⚙️ Configuración del entorno

Este proyecto usa una variable `ENV` para determinar si se debe escribir en la rama `develop` o `production`. Puedes establecerla con:

```bash
firebase functions:config:set app.env="develop"
```

## 🚀 Despliegue

```bash
firebase deploy --only functions
```

### 📤 Desplegar funciones individuales

Puedes desplegar una única función (útil para desarrollo o cambios puntuales):

```bash
firebase deploy --only functions:onProductWrite
```

O varias funciones separadas por coma:

```bash
firebase deploy --only functions:onProductWrite,functions:onUserWrite
```
