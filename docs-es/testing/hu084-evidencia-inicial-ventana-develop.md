# HU-084 — Evidencia inicial y propuesta de ventana de develop

Preparación a 2026-11-02; **NOT_READY_INITIAL_SEAL_ORDER**. No hay mantenimiento abierto.
Los adaptadores de observaciones/permisos están publicados en `658b7e9c`. Este bloque
prepara evidencias y una ventana propuesta; no autoriza ejecutarla.

## Evidencias y operación exactas

Directorio privado: `2026-11-02-initial-evidence-window`.
`initial-evidence-draft-private.json` fija el paquete revisado, las lecturas nuevas
Cloud/censo, la imagen anterior del propietario, la inspección de fuentes y la
revisión del canal nativo. Enumera los 25 controles de escritores y las ocho rutas
de entrega contenida. Paquete de barrera, ámbito, acuerdos, aceptación de riesgo
histórico de la operación, recibo de cierre del permiso e intervalo real de quietud
siguen nulos. El constructor real rechaza el borrador antes de acceder a proveedores.

Se conserva el paquete `9d5287014d6ac4ff82b62841f164aeb3137e6545bbf72ad729e04e5d617d1b8f`,
la ida `request-hu084-initial-68e09b87cef3ef75a357` y la inversa
`hu084-inverse-68e09b87cef3ef75a357`. Las lecturas nuevas coinciden con las fuentes
fijadas; adjuntarlas no exige regenerar el paquete. La intención revisada conserva
203 escrituras Firestore, 53 celdas de ayudantes y dos marcadores, protegiendo fechas,
orden y avisos históricos. La inversa requiere admisión propia y nunca es un reintento
automático.

Lecturas nuevas de solo lectura (Europe/Madrid, 2 de noviembre):

- Censo a las 00:17:55: las 14 colecciones revisadas, documentos individuales y registros
  de captura conservan exactamente contenidos y versiones del servicio. Hay 62 turnos,
  48 usuarios proyectados, cuatro calendarios, tres documentos de configuración,
  117 avisos, 12 eventos capturados y 16 registros de entrega. La autoridad inicial
  del planificador sigue ausente.
- Cloud a las 00:18:02: coinciden las 24 configuraciones de Functions, tres jobs
  pausados, Rules, IAM de proyecto/invocador y seis índices READY. El escritor sigue
  deshabilitado, sin claves de usuario ni bindings propios y fuera del inventario
  de ejecución comprobado.
- Cambió un hash del inventario bruto. Dos respuestas completas nuevas difieren solo
  en el orden de los filtros de eventos y coinciden al normalizarlo. Los 24 nombres/
  configuraciones de Functions y los 24 nombres/revisiones/identidades de servicios
  coinciden con lo revisado. No se conservó la respuesta bruta anterior; su hash solo
  no se presenta como prueba de igualdad de toda aquella respuesta histórica.
- El ejecutor real realiza una transacción de lectura de fuentes y cero adquisiciones
  de controles/escrituras. Las fuentes coinciden; rechaza con `window_scope_missing`.
- La evidencia del propietario de Sheets es **anterior**, del 1 de noviembre a las
  21:50:39 de Madrid. No es una observación nueva de ventana. Su OAuth ya se revocó.

La lectura Cloud duró 1,072s y el censo 3,709s. No acreditan la duración conjunta de
permisos, admisión, Sheets y limpieza. Trabajo histórico y entregas desconocidos
siguen desconocidos; no se reenvía ningún aviso.

## Horario propuesto, todavía sin iniciar

Reservar **hasta 15 minutos** desde una confirmación futura: hasta cinco para entradas
iniciales de solo lectura y diez para el ciclo existente del escritor. OAuth debe
estar preparado antes de esa confirmación. No se rellenan ahora inicio, fin ni
condición IAM reales.

| Desde la futura confirmación | Finalidad máxima |
| --- | --- |
| 0–5 minutos | Conciliación de lectura, compromisos nominativos y entradas iniciales; sin permisos ni mantenimiento |
| 5–8 minutos | Permisos exactos, propagación IAM mínima de 120s, completar evidencia inicial real y un token |
| 8–10:30 minutos | Barrera/admisión y una dirección de ida |
| 10:30–11:30 minutos | Retirar permiso de hoja y comprobar negativa con el mismo token |
| 11:30–13 minutos | Retirar IAM y deshabilitar explícitamente al escritor |
| 13–15 minutos | Revocar OAuth y verificar negativas de Drive y Sheets |

Son límites máximos, no esperas obligatorias. Se mantienen 180/150/60/90/120s dentro
de los 600s operativos, sin ampliar la duración de los permisos. Las comprobaciones
estrictas de margen pueden rechazar antes del límite de la tabla. Incumplir un límite
de preparación o ejecución detiene el avance; nunca amplía la ventana en silencio.

Valores propuestos del comando: 30s de quietud observada, antigüedad máxima de evidencia
de 600s y fin de quietud inicial a no más de 30s del inicio del ciclo del escritor.
Ese fin de quietud sigue siendo inmutable para comprobar antigüedad; las relecturas
no pueden cambiarle la fecha. Son propuestas, no valores desplegados ni prueba de
terminación histórica. El horario no genera consentimientos ni fechas del proveedor.

## Problema concreto de orden detectado

La excepción prevista para el propietario como controlador de permisos en ADR-0021
debe vincular la acción ACL exacta y su cierre real. Este intento todavía no tiene
ese recibo. `createOriginalWindowSessions.start` llama a `ensureServices` **antes**
de la acción de permisos. `composeDevelopWindowServices` construye inmediatamente
el observador, que exige la evidencia inicial completa y validada; la transición
real del permiso se produce después. Usar el recibo de otro intento, una fecha
futura, una excepción nula o un éxito sintético falsearía esa excepción.

Siguiente implementación: conservar el plan inmutable de acciones/paquete antes de
cualquier efecto y completar y fijar la evidencia/vinculación inicial después de
verificar la acción nativa exacta y su cierre, antes del token/admisión. Reutilizar
el registro persistente y las limpiezas independientes; una preparación parcial debe
poder recuperarse aunque falte el paquete final. No se propone otro motor, inversa
automática, relajar validadores ni alargar el token. Debe probarse ese orden localmente
antes de solicitar la ventana real. Por eso los 15 minutos aún no están listos para
autorización de ejecución.

## Validación y entrega

Pasan siete comprobaciones locales: archivos/fuentes exactos, rechazo del borrador
antes de acceder a proveedores, reparto de tiempos, límites estrictos de envío/
preparación, reservas completas de limpieza, normalización del inventario completo
y conservación de desconocidos/evidencias anteriores. Los archivos de ejecución y
337 hashes no cambian respecto a las 175 pruebas locales y 90 de emulador publicadas;
se reutilizan build/lint. Este bloque solo cambia documentación y preparación privada,
por lo que no se repiten compilaciones ni suites nativas/emuladas.

Sin cambios IAM/ACL, renovación OAuth del propietario, escrituras Sheets, FCM,
despliegues, mantenimiento ni acceso a datos de negocio de producción. Sin brecha
nativa nueva. HU-084/HU-085 siguen abiertas y PR #278 en borrador. No necesitas cerrar
la hoja ni hacer nada ahora.
