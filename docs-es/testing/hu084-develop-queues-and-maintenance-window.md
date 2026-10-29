# Colas de develop y propuesta de ventana de mantenimiento — HU-084 / HU-085

## Entrega y decisión actual

La conciliación anterior está commiteada y subida como
`4cb216824dc908293311a4f9c496fc2326c0f350`, con comprobación exacta de la rama
remota y del head de la PR borrador #278. Se mantienen #268/#269. Este bloque
comprueba las entregas reales y prepara una ventana futura; no la abre.

**Estado de la ventana: NO PREPARADA.** Producción queda fuera del alcance de datos
de negocio. No se extraen, confirman, reposicionan ni repiten mensajes manualmente.
La inspección no cambia hojas, notificaciones, Auth, IAM ni documentos de negocio.
Los datos recibidos, identidades y configuración completa quedan en evidencia privada.

## Límite de las observaciones de colas y operaciones

Se leen ocho relaciones Function/Eventarc/topic/subscription: cuatro disparadores
antiguos compartidos y cuatro receptores privados exclusivos de develop. Conservan
reintentos, plazo de confirmación de 600 segundos y retención de 86.400 segundos.

| Observación | Significado y límite |
| --- | --- |
| Cuatro suscripciones privadas: un mensaje pendiente en cada una | En la observación acotada de 20:47:55–21:47:55 UTC, la antigüedad ronda los 31.600 segundos. Es un problema real de reintentos. |
| Cuatro receptores privados: 44 conflictos y 44 HTTP500 | Otra consulta acotada de 90 minutos encuentra once intentos fallidos por receptor, para un ID de CloudEvent ya conservado en cada uno. Las trazas distintas prueban intentos repetidos; no órdenes de negocio diferentes. |
| Suscripciones compartidas: sin series de métricas | DESCONOCIDO. También incluyen producción y no separan develop; la ausencia de serie no equivale a cero pendientes u operaciones en curso. |
| Alineación y visibilidad de Monitoring | Las agrupaciones de 60 segundos y los retrasos de visibilidad documentados (120/240 segundos en los contadores consultados) no son contadores atómicos actuales de drenaje. |
| Consulta de operaciones largas de Cloud Run | El proveedor rechaza el filtro dirigido de metadatos. No se hace una consulta global alternativa; las operaciones de despliegue no equivalen a un censo de invocaciones en curso. |

La clave de entrega combina punto de entrada/origen/ID y su resumen incluye todos
los metadatos. Por eso puede haber conflicto con la misma clave y versión de origen.
Cambiar solo traceparent reproduce el mecanismo localmente; aún no está demostrado
qué campo cambia en los reintentos reales. No se presupone equivalencia de transporte.

## Corrección preparada y límite exacto del despliegue

[ADR-0023](../decisions/0023-retain-develop-delivery-metadata-observations.md)
conserva el primer sobre, las doce entregas schema1 y sus fragmentos. Permite añadir
otra observación completa de metadatos como schema2 en la misma colección, tras
validar su entrega original, el contenido de origen y los campos exactos id/source/
type/subject/time/specversion del CloudEvent. La transacción conserva la evidencia
antes de aceptar la entrega, incrementa una sola vez los contadores existentes y
mantiene eventCount. Los conflictos de contenido, identidad, clave o integridad
siguen rechazándose, con diagnósticos específicos sin datos personales. No ejecuta negocio.

El inspector local valida ambos esquemas, rechaza filas huérfanas o incoherentes e
incluye todas en el resumen del conjunto. El conjunto schema1 anterior conserva su
resumen; añadir observaciones exige renovarlo. Los cinco campos raíz siguen siendo
compatibles con los seis envoltorios antiguos desplegados. Sus codecs archivados
quedan fuera de esta corrección y no deben darse por actualizados.

El paquete privado `capture-update4` solo exporta:

- captureDevelopShiftPlanningRequest
- captureDevelopShiftWritten
- captureDevelopDeliveryCalendarWritten
- captureDevelopNotificationCreated

El manifiesto de siete archivos vincula seis de ejecución y `firebase.capture.json`.
Su SHA256 es `d5bb2d15e607f949edd1336a4eaaaf9f5436f38527d78f3ea244fda38d1cd2b3`;
el SHA256 de intake compilado es
`a5617f4da0a44b87ccee112a24fa3f35920c6f07886c33fce6fd54b7f8ee5d34`.
Conserva el lock/SDK6 archivado y los controles de ejecución. La carga con el SDK
real descubre solo cuatro funciones con reintentos. Pasan build/lint de Functions
y 147 pruebas conjuntas de emulador, Rules, compatibilidad, paquetes, censo,
conciliación y barrera: cero fallos u omisiones. No cambia código nativo.

El mantenedor autorizó explícitamente estos cuatro receptores en `reguerta-9f27f`
el 2026-10-29. El despliegue ha terminado y los ZIP inmutables coinciden con el
paquete; se conservan los cuatro runtimes/IAM y las otras veinte Functions. Antes se cotejan por lectura las 24 Functions, el selector exacto,
los cuatro runtimes/IAM completos y el manifiesto. Después se verifican los ZIP
inmutables y la conservación de ejecución, identidad, variables, secretos, filtros,
reintentos, IAM y tráfico, además de las otras 20 Functions. Cualquier diferencia
cierra el paso. No se admite desplegar la aplicación raíz ni usar `--force`.

Tras autorizarlo, se dejan actuar los reintentos naturales, se inspeccionan las
observaciones guardadas y los logs reales de éxito/error, y se vuelven a consultar
las métricas con su retraso. Se cotejan los 183 documentos y los sobres, entregas y
fragmentos originales; solo se permiten nuevas observaciones y sus contadores.
No se presupone que aparezcan exactamente cuatro filas ni que su éxito pruebe el
drenaje global.

## Ventana futura propuesta — todavía sin fecha ni compromisos

Reservar provisionalmente veinte minutos de trabajo controlado y otros veinte
para recuperación. Solo se fija el inicio al completar esta preparación técnica:

1. Resolver los reintentos privados observados y obtener evidencia reciente de
   colas/operaciones. Lo DESCONOCIDO en las compartidas sigue bloqueando la entrada estricta.
2. Preparar un contrato/adaptador de control por origen para los disparadores
   compartidos ACTIVE que solo conservan develop. No se puede desactivar su entrega
   global de producción ni declararlos desactivados falsamente. El acuerdo humano
   de ADR-0022 no sustituye los controles ni los ocho contadores de drenaje causal.
3. Preparar el arranque controlado de las cinco rutas de autoridad ausentes:
   shiftPlanningState/current, sourcePolicy, sheetsSubmission y las shiftRotations
   delivery/market. La ausencia no equivale a epoch0 ni autoriza crearlas.
4. Vincular autoridades automáticas exactas, jobs pausados, entradas HTTP/clientes
   cerradas, conjuntos de origen/registro renovados, valores/permisos de la hoja
   y condiciones de recuperación. Conservar fechas, orden e historial sin reenvíos.

Solo entonces se pedirán compromisos actuales al propietario de la hoja, todas las
personas con administración de Firebase y un operador autorizado de identidad distinta.
Deben estar en línea, detener ediciones y automatismos no revisados, cerrar cambios
pendientes/sin conexión y pruebas o despliegues concurrentes, y seguir disponibles
durante la recuperación. Poner dos etiquetas a una misma identidad no separa
propietario y operador. No se pide ahora un compromiso de veinte minutos que caducaría
mientras sigue pendiente el trabajo técnico.

La comprobación previa cerrará el paso ante cambios, acuerdos vencidos, evidencia
de proveedor ausente o efectos inciertos. La recuperación conserva registro y base
de origen, detiene nuevas operaciones y usa la salida existente de incidente/residual
acotado, sin reenviar avisos ni dar por terminados efectos antiguos. La secuencia
exacta de arranque/migración/reversión será revisable antes de su autorización
independiente. Este presupuesto provisional no autoriza ninguna de esas escrituras.

Siguen en false physicalHandoffReady, canEnterMaintenance y canApply; legacyUntracked
sigue en true. HU-084/HU-085 y la PR borrador #278 continúan abiertas.

## Actualización autorizada de los cuatro receptores — 2026-10-29

El despliegue termina en los cuatro receptores privados autorizados. Los archivos
inmutables coinciden con el paquete revisado; se conservan configuración, identidad,
permisos, filtros, reintentos y tráfico, además de las otras veinte Functions.
Los reintentos naturales conservan cuatro observaciones schema2; en todas cambia
únicamente traceparent respecto a su registro original. Los 183 documentos de
negocio, doce eventos/entregas originales y fragmentos conservan contenido y
versiones. captureRevision/deliveryCount pasan de12 a16, eventCount sigue en12
y legacyUntracked en true. No se ejecuta negocio, se escribe en Sheets, se envía
FCM, se consumen mensajes manualmente ni se abre mantenimiento o migración.

Se reutiliza la validación de147 pruebas, build y lint con los mismos ejecutables.
La CLI avisa de la antigüedad del SDK archivado que se conserva deliberadamente;
esta actualización acotada no cambia dependencias. El código nativo no cambia.

Se verifican cuatro HTTP2xx por ID/origen exactos del CloudEvent, servicio y nueva
revisión, sin HTTP4xx/5xx ni errores de aplicación en la consulta acotada. Los ocho
hashes de entrada siguen iguales a los validados. Las colas compartidas desconocidas
y los requisitos de estado inicial, control por origen y participantes mantienen
cerrada la ventana. El mantenedor autoriza entregar el código; la evidencia exacta de Git/remoto queda en #268/#269 y la PR borrador #278.

La última observación acotada de las cuatro colas privadas devuelve 0/0/0/1.
Los cuatro HTTP2xx correlacionados y sus metadatos conservados no prueban el ACK
del proveedor ni el vaciado: el valor1 sigue pendiente de conciliación y no se
da por simple retraso de métricas. Las compartidas sin serie siguen DESCONOCIDAS.
El siguiente paso operativo es resolver esa entrega residual antes de declarar
vaciadas las colas privadas o admitir mantenimiento real.

## Conciliación del pendiente de la cola — 2026-10-29

El mantenedor autoriza commit/push y conciliación de lectura. La corrección queda
entregada como `3977fd6f2df13d87748c7db1e3dd31ed36b8db1d`, igual en local, remoto
y PR borrador #278. Se reutilizan build/lint y147 pruebas con ocho hashes ejecutables
idénticos. Este bloque no requiere código nuevo ni cambios en el proveedor.

El residual pertenece a la suscripción privada de captureDevelopShiftWritten.
La consulta acotada sin alineación encuentra un push ack_204 y un mensaje confirmado
entre00:30 y00:31 UTC. Tanto el contador pendiente como su antigüedad indican0 a
las00:36:00 y00:37:00 UTC. Esto concilia el pendiente observado mediante evidencia
del proveedor, junto con la petición CloudEvent correcta y sus metadatos conservados.
El ACK es una métrica agregada de esa suscripción: no aporta un identificador de
confirmación por mensaje y no se inventa esa prueba.

Los logs de las nuevas revisiones entre00:35 y06:22:51 UTC no contienen nuevas
peticiones ni errores. El censo actual conserva183 documentos,12 eventos,12 entregas
originales,4 observaciones y sus fragmentos/versiones; la revisión sigue en16. No
hay nuevas observaciones, reenvíos, ACK manual, pull, seek, escrituras de negocio,
Sheets/FCM, cambios IAM ni despliegues. Las relaciones proveedor/origen y las cuatro
Functions coinciden con el despliegue aceptado.

La consulta sin agregación de los últimos15 minutos no devuelve series: continúa
DESCONOCIDA, sin convertirla en cero actual ni en drenaje físico global. El residual
histórico queda conciliado; la ventana aún necesita el control provider/sourceScope,
el arranque inicial controlado y los compromisos de participantes. legacyUntracked
sigue en true y los permisos de entrada en mantenimiento/migración en false.
Las modificaciones nuevas de este bloque son documentales; basta comprobar el diff,
sin repetir pruebas nativas.

[La guía de métricas de Google](https://docs.cloud.google.com/pubsub/docs/metrics-autoscaling-best-practices)
advierte que ausencia de métricas no equivale a cola vacía. Las observaciones
acotadas y sus hashes permanecen en evidencia privada.
