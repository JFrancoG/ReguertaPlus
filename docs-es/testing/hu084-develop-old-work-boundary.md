# Límite de operaciones antiguas de develop — 2026-10-29

## Resultado y autoridad

Evaluación de solo lectura; el mantenimiento sigue NOT_READY. El índice de consulta
que faltaba ya está READY y verificado independientemente. El bloqueo restante no
es ese índice. [ADR-0025](../decisions/0025-separate-contained-deliveries-from-business-drain.md)
se aceptó después de esta evaluación y está implementado/ensayado localmente; véase
su apartado de implementación. Modifica solo el requisito de entregas de captura
de develop de ADR-0024. Efectos antiguos y autoridad siguen bloqueando la admisión real.

Esta tabla sustituye el **uso como estado actual**, no la evidencia histórica, de
la preparación anterior de 26 escritores. El inventario cooperativo actual de
`functions/src/shift-planning-writer-inventory.ts` tiene exactamente 31 identidades:
25 controles de entrada y seis comprobaciones de activación. Los receptores privados
son evidencia asociada a cuatro disparadores existentes, no escritores inventados.

## Evaluación finita de escritores

«Cerrado» describe solo la ruta actual observada. No acredita terminación de una
operación antigua, recibo de mantenimiento ni exclusión de procesos no inventariados.

| ID canónico del escritor | Evidencia actual / obligación pendiente |
| --- | --- |
| `firestore-client-shifts` | Rules desplegadas deniegan escritura develop; conservar comprobaciones de fuente/versión. |
| `firestore-client-delivery-calendar` | Mismo cierre de clientes; los cuatro documentos actuales son una base, no prueba de terminación anterior. |
| `firestore-client-shift-planning-requests` | Mismo cierre; que la colección esté vacía no cuenta invocaciones. |
| `firestore-client-shift-swap-requests` | Mismo cierre; conservar el censo de transiciones/operaciones. |
| `https-sync-shifts-from-google-sheets` | 503 develop revisado antes de la operación original. La importación observada de 62 filas tiene terminación acreditada; no es un censo completo de invocaciones. |
| `https-export-shifts-to-google-sheets` | 503 develop revisado antes de la operación original. Los envíos anteriores a Sheets aún requieren terminación o aislamiento efectivo del destino. |
| `https-transition-shift-swap` | Sin equivalente en el inventario revisado de 24 Functions; confirmar proceso/autoridad, no deducir ausencia global solo por el nombre. |
| `https-shift-coverage` | Misma ausencia acotada; código/disponibilidad local no acreditan exclusión real. |
| `scheduler-order-reminder-sunday20` | Job PAUSED. Doce ejecuciones recientes entre los tres jobs tienen terminaciones correlacionadas; resultados de envíos antiguos y autoridad de invocación directa siguen separados. |
| `scheduler-order-reminder-sunday22` | Lo mismo; pausar Scheduler no deshabilita por sí solo el servicio de destino. |
| `scheduler-order-reminder-sunday23` | Lo mismo; no se inventa un cero de operaciones en curso. |
| `worker-shift-coverage-effects` | Sin proceso desplegado separado observado; vincular cualquier proceso propietario y trabajo retenido antes de declarar cierre. |
| `worker-shift-coverage-push` | Lo mismo; colecciones vacías no prueban ausencia de una invocación externa. |
| `trigger-on-shift-planning-request-created` | Pareja compartida/privada exacta revisada. La entrega actual no puede invocar la operación original de develop; las invocaciones anteriores siguen separadas. |
| `trigger-on-versioned-shift-planning-request-created` | Sin equivalente en el inventario revisado; conservar ausencia acotada y comprobación de autoridad. |
| `trigger-on-shift-written` | Pareja exacta revisada. Efectos antiguos de Sheets/avisos separados; la salida por origen importado explica solo la importación observada. |
| `trigger-on-delivery-calendar-override-written` | Pareja exacta revisada. El updatedCount0 del ensayo no demuestra terminación de modificaciones anteriores de calendario. |
| `trigger-on-notification-event-created` | Pareja exacta revisada. Los 117 avisos históricos siguen posiblemente entregados y no se reenvían. |
| `firestore-client-membership-fairness` | Rules deniegan escritura develop; la activación debe fijar campos de planificación y socios actuales. |
| `firestore-client-planning-config` | Rules deniegan escritura develop; la activación debe fijar configuración/versión exactas. |
| `https-resolve-authorized-member` | El cierre revisado incluye cuentas revisoras hacia develop; volver a vincular la proyección de activación. |
| `https-upsert-member-by-admin` | 503 develop revisado; conservar comprobaciones de servidor/activación. |
| `https-clone-global-config` | El original archivado lee configuración develop y escribe en producción. Ese cuerpo no modifica develop. Conservar identidad y revalidar código desplegado; nunca invocarlo para comprobarlo. |
| `https-config-maintenance-writers` | Cinco endpoints de marcas y dos validadores rechazan peticiones que afectan a develop; fijar fuentes/configuración y proyección de activación. |
| `iam-firestore-admin-and-server-writers` | Persisten identidades privilegiadas compartidas. Rules no las limitan; usos automáticos y efectos anteriores requieren evidencia técnica. |
| `workbook-human-and-offline-editors` | Faltan ACL efectiva exacta y cierre de editores sin conexión; las ventanas acordadas anteriores han vencido. |
| `workbook-apps-script-and-addons` | El mantenedor declara solo apps/acciones de aquí; conservar declaración y alcance exacto, sin afirmar visibilidad de todas las cuentas. |
| `workbook-api-oauth-and-service-accounts` | Identificar/restringir escritores distintos del propietario durante la ventana; los envíos API anteriores siguen separados. |
| `workbook-shared-drive-and-admin-authority` | Acreditar ubicación, herencia y autoridad efectivas; visibilidad limitada de lector no significa ausencia. |
| `workbook-owner-retained-capability` | ADR-0021 permite acuerdo nuevo, nominal, acotado y temporal del propietario; no hay compromiso de ventana actual. |
| `develop-firebase-administrator-retained-capability` | ADR-0022 exige acuerdo nuevo de todos los administradores humanos identificados; no cubre uso automático de credenciales. |

## Qué acredita la nueva lectura del proveedor

A las 09:41:56 UTC del 2026-10-29, los metadatos de 23 servicios, excluido el inspector,
indican disponibilidad y el 100% del tráfico dirigido a las versiones revisadas.
Entre los 20 servicios con historial, 284 versiones no actuales tienen condición
RETIRED. Se normalizaron nombres al ID de versión antes de excluir las 23 actuales.
Son metadatos del ciclo de vida, **no** un censo de invocaciones ni un recibo terminal
de envíos a Firestore, Sheets o FCM. La inspección no invocó ninguna Function.

Los 183 documentos fuente, 12 capturas de ensayo clasificadas y 16 entregas medidos
antes siguen siendo el último censo conciliado: leer metadatos de ejecución no ha
obtenido un censo nuevo. Ocho suscripciones tuvieron muestras históricas a cero;
la ausencia de muestras actuales sigue UNKNOWN. No se hace pull, acuse, seek ni reenvío.

Evidencia privada: `2026-10-29-old-work-boundary/runtime-metadata-private.json`,
cuerpo/archivo original revisado y manifiestos previos de fuentes/censos/recibos
en el directorio de artefactos HU-084. No se incorporan al repositorio identidades
sin filtrar, respuestas completas del proveedor ni credenciales.

## Próximas acciones y condiciones de parada

1. Completado localmente: aceptar ADR-0025 e implementar/ensayar su alternativa
   acotada en un bloque. No acredita el drenaje real de operaciones de negocio.
2. Resolver las operaciones antiguas **capaces de producir cambios** y la autoridad
   automática por proceso/destino identificado. Conservar los 117 avisos históricos
   sin reenviarlos. Los resultados desconocidos no obligan a reconstruir cada recepción
   en dispositivos, pero no prueban que terminó un escritor o envío externo.
   Un caso sin resolver bloquea la admisión o sigue la vía residual acotada existente.
3. Fijar permisos efectivos de la hoja, política de fuentes real, socios, fechas
   publicadas y cursores; recabar acuerdos nuevos de propietario/administradores
   solo cuando estén preparados los requisitos técnicos. Después ensayar/aplicar
   la migración y recuperación acotadas, autorizadas por separado con esos datos.

Estos tres grupos no se presentan como tres cortes pequeños ni como plazo garantizado.
Esta evaluación no abre ventana, acepta política, migra, reenvía, cambia apps ni
modifica producción. Solo documentación/evidencia: comprobar tabla completa, paridad
bilingüe, enlaces locales y diff; reutilizar las 73 pruebas/build/lint anteriores
sin presentar una nueva ejecución de pruebas de runtime.

## Cierre preparado de la entrada directa de recordatorios — 2026-10-29

ADR-0025 y las observaciones anteriores están commiteados y pusheados como
`5f648963398d2e600f70129bc8fdec19317b77aa`. La corrección de recordatorios siguiente
es trabajo local nuevo, todavía sin desplegar ni commitear en este punto.

La inspección de solo lectura confirma que `sendPendingOrderReminderSunday20`,
`sendPendingOrderReminderSunday22` y `sendPendingOrderReminderSunday23` siguen
ACTIVE con sus fuentes originales revisadas y la misma configuración. Sus jobs
Scheduler están PAUSED, pero cada servicio Cloud Run disponible admite invocación
directa por su identidad de ejecución compartida. El resolver original selecciona
develop: pausar los jobs no cerraba esta entrada capaz de modificar datos.
La consulta corregida de logs usó los nombres Cloud Run en minúsculas desde el
2026-10-28 a las22:00 UTC hasta la inspección y no devolvió entradas. Es cobertura
acotada de logs, no prueba de terminación de invocaciones o envíos externos anteriores.

El preparador existente incorpora `reminders3`: envuelve exactamente las tres
operaciones archivadas con el resolver original y rechaza cualquier conjunto que
incluya develop antes de leer/escribir, también si mezcla destinos. No redirige a
producción. Conserva cuerpos originales para otros destinos, horarios, dependencias
y configuración. El SDK archivado de Scheduler devuelve HTTP **500**, no503, ante
este rechazo; la prueba local con ese SDK verifica el contrato. No se invoca ninguna
Function real durante la preparación.

Validación con Node22.23.4: build/lint completo de Functions, lint CJS dirigido,
**15 pruebas locales y24 de emulador Firestore**, sin fallos ni omitidas. Para cada
recordatorio, el original crea el aviso ficticio en el emulador y la protección
rechaza antes de acceder a datos. Las ejecuciones solo producción con datos ficticios
conservan efectos/traza originales. Se cubren destinos ausentes/por defecto/mixtos,
fuentes alteradas y límites de instancias inventados. Las apps no cambian.

### Despliegue concreto propuesto

- Proyecto `reguerta-9f27f`, región `europe-west1`: solo las tres Functions anteriores.
  Los tres jobs deben seguir PAUSED y las otras21 Functions deben conservarse.
- ZIP SHA256: `f8827f509ca6d4bab29e025a0b78857097616dfbfe12d9bae2db40fb4cc653fe`.
  Sus seis ficheros coinciden con el manifiesto. SHA256 del archivo original:
  `98175ecc32c5c2e4b94c82df856aeadb9d804b38f625d9db4a2cd6b0871de1a5`.
- Subir fuentes mediante Functions v2 y PATCH con updateMask explícito
  `buildConfig.source`, conservando opciones de compilación, entorno, IAM y Scheduler.
  No usar despliegue Firebase CLI de exports programados: esta operación no debe
  reconciliar ni reanudar jobs. La máscara limita los campos solicitados
  ([contrato oficial PATCH](https://docs.cloud.google.com/functions/docs/reference/rest/v2/projects.locations.functions/patch)).
- Antes de subir/actualizar, releer las24 Functions, fuentes/configuración de las tres,
  jobs e IAM; detenerse ante discrepancias. Conservar base de las otras21. Actualizar
  secuencialmente, guardar IDs de operación e inspeccionar resultados inciertos antes
  de reintentar. Verificar fuentes, configuración/IAM efectivos, tráfico disponible,
  jobs PAUSED y otras21 intactas. No invocar Functions ni rutas de producción.
- Un cambio inesperado detiene la secuencia. No restaurar automáticamente una operación
  capaz de escribir develop. Registrar cualquier aplicación parcial y mantener cerrado
  el mantenimiento.

Paquete privado: `2026-10-29-old-business-closure/reminder-package`,
`reminder-source-reviewed.zip`, `reminder-update-plan.json` y captura de autoridad.
No se commitean credenciales, valores de entorno ni identidades del proveedor sin filtrar.
El despliegue requiere autorización nueva y acotada. Prepara el cierre de **nuevas
entradas**: llamadas anteriores, resultados de Sheets/FCM y usos de credenciales
compartidas siguen separados. Conservar `legacyUntracked=true`, los117 avisos sin
reenviar y mantenimiento/migración NOT_READY. Siguen pendientes política/permisos
de la hoja y acuerdos nuevos de propietario/administradores.

### Despliegue autorizado completado — 2026-10-29

Tras la autorización explícita de las tres Functions en `reguerta-9f27f`, terminaron
las tres actualizaciones secuenciales de `buildConfig.source`. Las lecturas posteriores
verifican ACTIVE, disponibilidad, 100% del tráfico a la última revisión y los bytes
exactos del ZIP revisado en las tres:

| Sufijo de Function | Revisión Cloud Run verificada |
| --- | --- |
| Sunday20 | `sendpendingorderremindersunday20-00002-mec` |
| Sunday22 | `sendpendingorderremindersunday22-00002-niw` |
| Sunday23 | `sendpendingorderremindersunday23-00002-gel` |

Los tres jobs siguen PAUSED con todos sus metadatos intactos. Se conservan opciones
de ejecución/compilación, entorno e IAM de los servicios; las otras 21 Functions
conservan sus metadatos completos. Google añadió únicamente etiquetas de identidad
de Function/región y una anotación de identidad a los servicios actualizados.
El verificador comprueba esos valores exactos, sin ignorar cambios arbitrarios.
No se invocaron Functions ni se escribieron datos de negocio, Sheets o enviaron FCM.

El primer intento de subida falló antes de desplegar; un GET del objeto exacto devolvió
404. La misma URL firmada funcionó con las cabeceras del contrato de subida firmado
del CLI fijado y se verificó su generación. Se normalizó el orden de `eventFilters`
solo tras demostrar igualdad de contenido; las pruebas rechazan cambios de contenido.
Las comprobaciones negativas también rechazan cambios de ejecución, job, IAM e identidad.
El paquete/código no ha cambiado y reutiliza build/lint y las 15 pruebas locales/24 de
emulador anteriores. Este turno valida el despliegue real, no una nueva ejecución de
las pruebas de aplicación.

`authorized-deployment-result.json`, operaciones y lecturas de fuentes inmutables bajo
`2026-10-29-old-business-closure` conservan la evidencia privada. Código/documentación
siguen sin commitear tras `5f648963`. Se cierra solo la entrada directa de recordatorios;
siguen pendientes operaciones de negocio antiguas/autoridad automática, permisos/política
de la hoja y acuerdos nuevos de mantenimiento. Se mantienen `legacyUntracked=true`,
los 117 avisos sin reenviar y mantenimiento/migración NOT_READY.
