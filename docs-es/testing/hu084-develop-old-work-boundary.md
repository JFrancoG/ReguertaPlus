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
