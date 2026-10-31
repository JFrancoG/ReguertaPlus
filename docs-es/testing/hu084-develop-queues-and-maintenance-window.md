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
antiguos compartidos y cuatro receptores privados exclusivos de develop. Los compartidos
conservan `RETRY_POLICY_DO_NOT_RETRY`; los privados, `RETRY_POLICY_RETRY`.
Sus suscripciones conservan un plazo de confirmación de 600 segundos y retención de 86.400 segundos.

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


## Control de disparadores compartidos y preparación inicial — 2026-10-29

La conciliación residual está entregada en `3dbbd4dadfbfd6f87a9f193afc46b68ad4fad0d7`;
coinciden HEAD local, remoto y PR borrador #278. La preparación siguiente sigue local.

`functions/scripts/prepare-develop-planner-entry.cjs` prepara una revisión sin conexión;
no despliega ni migra. Compara las ocho configuraciones actuales con las fuentes
inmutables revisadas, conservando runtime, identidad, revisiones, tráfico, filtros y
reintentos. Normaliza el orden de los filtros; rechaza cambios de valores, ampliaciones
de alcance, funciones ausentes o cambios de fuente. Cada disparador compartido queda
representado como **solo captura para develop, ACTIVE para producción**. Describe el
puente desplegado, no una desactivación física. Los cuatro receptores privados
correspondientes siguen limitados a develop.

Las lecturas del proveedor coinciden con las ocho configuraciones revisadas. El censo
nuevo de las06:35:52.940 UTC conserva los mismos183 documentos de origen, doce eventos
y dieciséis entregas, incluidas cuatro observaciones de metadatos; captureRevision16.
Su huella estable es
`2e759f15bc51e1a3d9f955b4544bd56c35996b514d5f573561c1cd681d6b0692`.
Las cinco rutas de autoridad están ausentes en su instantánea. La propuesta es:

| Ruta bajo develop/plus-collections | Acción preparada tras una admisión fiable |
| --- | --- |
| shiftPlanningState/current | Crear revisión1/writeEpoch1 con barrera cerrada real, operación y linaje; ausencia no significa época0. |
| shiftPlanningState/sourcePolicy | Vincular versión real de hoja/autoridad de índices, ayudantes, horizonte de mercado y frontera del planificador. |
| shiftRotations/delivery | Conservar titulares publicados y cursor posterior de vuelta2/índice22. |
| shiftRotations/market | Conservar titulares publicados y cursor posterior de vuelta2/índice22. |
| shiftPlanningState/sheetsSubmission | Mantener ausente hasta que lo necesite una operación gobernada de Sheets. |

Se reutiliza exactamente la propuesta conservada:72 turnos,108 posiciones, ambas
rotaciones de54 posiciones y su cohorte de32 socios. No se regeneran fechas, orden ni
asignaciones. Sigue siendo la propuesta sintética de develop, no una aprobación
renovada de hoja/cohorte reales. Mercado sin julio/agosto2027,53 celdas de ayudante
vacías y62 filas antiguas conservan su tratamiento pendiente de política/migración.
Se reutiliza el comprobador de secuencia existente, sin añadir otro planificador.

Huella de la preparación privada:
`shift-planning:v1:sha256:2b84751806ee7ce2fa8905a72e9e10de592a548ee664a4f2c28a11218722303a`.
Los datos del proveedor, registros y propuesta quedan fuera de Git.
Se reproduce con `node functions/scripts/prepare-develop-planner-entry.cjs --input
<entrada-privada.json> --output <revision-privada-nueva.json>`; crea salida exclusiva
con modo0600 y no admite modo de aplicación.

**La admisión sigue bloqueada.** La barrera estricta actual todavía no consume este
control de captura por origen. La revisión mantiene `compatibleWithCurrentBarrier=false`,
contadores pendientes/en curso nulos e `initialStateDocument=null`; no inventa un
estado admitido. Siguiente bloque: integrar y ensayar conjuntamente este control
fiable y la admisión atómica inicial, conservando drenaje causal independiente,
vínculos renovados de fuentes y acuerdos de propietario/administradores. No cambian
los requisitos técnicos de ADR-0022. No se ha escrito en la nube, desplegado,
editado Sheets ni enviado FCM.

Validación: build/lint de Functions, lint CJS focal y60 pruebas conjuntas de preparación,
censo, puente y migración correctas, sin omisiones. Sin cambios nativos; no se repiten
sus suites. Estas pruebas de migración son locales sin conexión y no acreditan una
nueva ejecución en emulador ni en Firebase compartido.


## Integración local y recuperación ensayada — 2026-10-29

Preparación entregada en `51b9c514`. [ADR-0024](../decisions/0024-admit-source-scoped-develop-capture-controls.md)
registra la integración local del control explícito de las cuatro parejas en la
barrera, conservando transporte ACTIVE de producción, acuerdos y drenaje separado.
Pasan build/lint, lint CJS,72 pruebas locales y33 de emulador. Estas últimas incluyen
creación inicial, reversión exacta, protección ante estado parcial y conservación del
incidente tras reinicio y confirmación perdida. Se conserva la época superior cerrada
al revertir; no se borra la auditoría ni se reabre automáticamente.

La preparación sin conexión anterior continúa sin admitir mantenimiento: no contiene
las nuevas pruebas fiables ni los contadores reales de drenaje. Queda componer las
observaciones reales por el puerto de control existente y renovar fuentes/política/
participantes para una ventana concreta. Sin despliegues ni escrituras compartidas.
Esta integración nueva permanece local, sin commit.

## Observaciones reales y preparación acotada de ventana — 2026-10-29

Integración de la barrera entregada en `f7ef299a`; la verificación exacta de remoto y
PR borrador queda en #268/#269. Esta continuación permanece local.

`observe-develop-capture-controls.cjs` conecta puertos de proveedor de solo lectura
con el verificador existente de ocho funciones y el parser de ADR-0024. Valida todos
los selectores antes de leer, descarga archivos de fuente con generación inmutable,
compara su SHA256 revisada, comprueba observaciones de colas/suscripciones y vuelve a
leer las ocho configuraciones al terminar. Cualquier cambio rechaza la observación.
Se extrae el verificador reutilizable de la preparación existente, sin otro planificador
ni motor de mantenimiento. Series ausentes siguen UNKNOWN; incluso muestras cero
siguen SAMPLED_ONLY. Ninguna fabrica drenaje causal ni una barrera retenida.

La ejecución real verifica los ocho archivos inmutables y genera cuatro pruebas de
control. Huella:
`shift-planning:v1:sha256:389112b5c8ff04aa6edbefb36f504df4dfbf05fc343d8b57bf8e3367129694db`.
Otra lectura confirma24 Functions sin cambios, los tres jobs de avisos PAUSED y la
misma versión/fuente aceptada de Rules. Se conservan183 documentos,12 eventos/16
entregas y la huella del censo. Los campos de planificación de48 socios no cambian;
32 siguen siendo elegibles. Créditos, reservas, casos, comandos de sincronización,
efectos y solicitudes de intercambio no devuelven documentos.

Las proyecciones formateadas A1:M80 de las cuatro pestañas publicadas coinciden con
las68/54/7/44 filas conservadas. Acredita paridad visible publicada, no identidad de
fórmulas/permisos ni una versión nueva de la hoja completa. No se ha editado ninguna
celda. El conector omite la versión numérica aunque se solicite. Tras autorización
expresa, se invocó una sola vez la inspección privada existente: HTTP200, seis pestañas
y versión259 antes y después, con canApply:false. La obtención del token OIDC devolvió
403 inicialmente; solo se reintentó esa obtención dentro del plazo original de diez
minutos, sin ampliar el permiso ni repetir la inspección. Ambas concesiones quedaron
retiradas. Una lectura IAM final independiente confirma cero concesiones directas y
conservación de la política anterior. No se persistieron tokens. El lector no puede
enumerar ACL/propietarios detallados; siguen desconocidos. Esta renovación aporta
una observación de la hoja, no admisión al mantenimiento.

La consulta de índices de shifts devolvió400 con pageSize100. Con pageSize0, exigido
por el proveedor, devuelve200 y cinco índices de orders, products y orderLines.
No acreditan preparación ni ausencia de índices de shifts. Su autoridad queda UNBOUND,
con petición/respuesta privadas. Se contrastó el contrato con la [API oficial de índices](https://docs.cloud.google.com/firestore/docs/reference/rest/v1/projects.databases.collectionGroups.indexes/list).
La lectura IAM del invocador se corrigió usando options.requestedPolicyVersion en
la consulta y confirma que no tiene concesiones directas; no se modificó nada.

### Ventana propuesta: sin programar y sin admisión

| Condición | Evidencia actual / pendiente |
| --- | --- |
| Controles desplegados | Cuatro pruebas exactas; transporte compartido ACTIVE. Los demás controles conservan su comprobación independiente. |
| Trabajo anterior y drenaje | Sin series recientes. Contadores UNKNOWN; un ACK histórico o censo quieto no sustituyen drenaje causal por origen ni conciliación de efectos inciertos. |
| Fuentes publicadas | Censo de planificación y cuatro proyecciones iguales; conservar propuesta de72 turnos y cursores. |
| Hoja/versión/política | Versión259 renovada y estable en seis pestañas; faltan inventario ACL/propietarios y vínculos revisados de horizonte/ayudantes/frontera. |
| Autoridad de índices | Respuesta ajena a shifts; no se declara preparada. |
| Acuerdos humanos | Los dos Owners humanos requieren compromisos actuales completos; el tercer usuario Viewer no se clasifica como administrador. No se pide aún compromiso de ventana. |

No fijar hora ni pedir veinte minutos sin edición mientras sigan abiertas las
condiciones técnicas. Después, fijar un único compromiso con controles exactos,
huellas de fuente/política, identificadores de operación/recuperación, participantes
y límites de inicio/fin/recuperación. Obtener las confirmaciones de esa ventana,
releer todas las autoridades, admitir la creación por la transacción existente y
comprobar sus resultados. Ante cambios, trabajo desconocido/no cero, confirmación
perdida o actividad de participantes, detener y conservar cierre/incidente. Sin
reapertura automática, repetición de avisos históricos ni cambios de producción.
Esta preparación no despliega ni escribe datos de negocio compartidos.

Validación: build/lint de Functions, lint CJS focal y73 pruebas de observación,
preparación, puente, censo y migración correctas, sin omisiones. Los controles nativos
y de migración en emulador siguen como en la integración entregada; no se repiten por
este adaptador de observación de solo lectura. Archivos, censo, métricas y ventana
quedan en evidencia privada.

## Autoridad de índices y diagnóstico acotado del drenaje — 2026-10-29

Esta continuación de solo lectura resuelve la respuesta anterior de índices ajena
a shifts: se consulta el inventario completo (`collectionGroups/-`), se comprueba
la paginación y se lee cada índice por su nombre de recurso exacto. Una segunda
lista coincide: cinco índices compuestos READY, de orders, products y orderLines.
La lista completa de excepciones de campos solo contiene la configuración general.
Las lecturas exactas del valor predeterminado, shifts/* y shifts/date confirman
índices READY ascendentes, descendentes y de arrays heredados; no hay compuesto de
shifts. Huella observada: `shift-planning:v1:sha256:35561b4957290cffa1a275e84316f674b4a4407d6fbde58fc7cb770265253216`. Debe renovarse antes de admitir una operación;
no mide el tamaño real de índices/peticiones ni autoriza escrituras.

Se encuentra además una carencia concreta para ambas apps: la consulta de la última
solicitud filtra requestedByUserId y schemaVersion, ordena requestedAt descendente
y limita a uno. El índice está declarado en firestore.indexes.json pero no está
desplegado. Query Explain sobre develop, con analyze:false, devuelve
FAILED_PRECONDITION, "no matching index found". No ejecuta la consulta ni lee datos
de socios. Véase el [contrato oficial de Query Explain](https://firebase.google.com/docs/firestore/query-explain).

La operación privada preparada añade solo ese índice COLLECTION mediante la API de
creación, tras comparar los cinco existentes. No sustituye el inventario ni utiliza
un despliegue global de índices. Campos ordenados: requestedByUserId ASC,
schemaVersion ASC y requestedAt DESC. Afecta a cualquier colección con ese nombre,
incluida producción. El script permite un envío, registra su intención antes del
POST y no repite una respuesta incierta. Tras autorizar: conservar la operación,
esperar READY, verificar los cinco índices anteriores, repetir Explain y renovar
la huella. Autorización pendiente. Esta continuación no ha modificado el proveedor.

| Elemento | Hallazgo renovado y límite |
| --- | --- |
| Fuentes | Mismos183 documentos y huella: cero solicitudes,62 turnos antiguos,4 filas de calendario y117 avisos. Los turnos planned son datos de referencia, no comandos pendientes. |
| Capturas retenidas | El conciliador existente vincula las12 a recibos de pruebas aceptadas; cero capturas sin atribuir. Se conservan16 entregas. No acredita el fin de callbacks antiguos. |
| Ocho colas | Consultas de24 horas sin alineación encuentran ceros históricos de pendientes/antigüedad/en vuelo en las ocho. Últimos ceros de pendientes:00:28–00:37 UTC del29 de octubre en privadas y13:10–13:11 UTC del28 en compartidas. Son antiguos, no contadores actuales. |
| Ejecución | Los23 servicios distintos del inspector están preparados y envían100% del tráfico a las revisiones revisadas, sin etiquetas de tráfico. Veinte conservan revisiones antiguas. La configuración no es un censo de invocaciones en curso. |
| Avisos anteriores | Los117 siguen posiblemente entregados y no se reenvían, incluidos tres avisos administrativos antiguos sin resumen de envío. Un plazo o redespliegue no demuestra un resultado externo desconocido. |

La [guía oficial de Pub/Sub](https://docs.cloud.google.com/pubsub/docs/metrics-autoscaling-best-practices)
advierte que la ausencia de métricas no significa ausencia de mensajes. La
investigación acotada termina aquí: repetir las mismas consultas no aporta la
terminación por origen que falta. Se mantienen causalDrain:null y legacyUntracked:true.
ADR-0024 sigue exigiendo todos los contadores numéricos a cero. El siguiente trabajo
debe vincular cada escritor pendiente a evidencia de terminación o aislamiento
efectivo y resolver la diferencia entre telemetría muestreada y el contrato de
entregas en vivo antes de proponer ajustes de contrato. No fabricar ceros, borrar
incertidumbre histórica, repetir avisos, eliminar revisiones ni parar transporte de
producción para forzar una aceptación. La ventana de mantenimiento sigue sin fecha.

Validación: lectores privados y preparación del único índice pasan sintaxis y
aserciones; esta última supera el preflight de solo lectura. El inspector/conciliador
existente acepta la captura renovada. Solo se cambian documentos/evidencias, por lo
que no se repiten build/pruebas nativas/unitarias bajo la excepción de cambio mínimo;
se conserva la aceptación anterior de73 pruebas/build/lint. Evidencia cruda privada.

## Creación autorizada del único índice y consulta validada — 2026-10-29

El mantenedor autorizó expresamente solo el compuesto de shiftPlanningRequests ya
declarado en reguerta-9f27f/(default). Se envió un POST de creación tras verificar
los cinco índices de referencia, sin repetición ni despliegue global. El nuevo
índice está READY y su lectura exacta confirma requestedByUserId ASC, schemaVersion
ASC, requestedAt DESC y el __name__ DESC implícito de Firestore. Los cinco índices
previos y toda la configuración de excepciones de campos permanecen iguales.
El índice se aplica también a colecciones del mismo nombre en producción.

El primer Explain tras READY aún devolvió FAILED_PRECONDITION. Un reintento posterior
de solo lectura obtuvo HTTP200 y seleccionó expresamente ese compuesto. No hubo
segunda creación ni ejecución de la consulta (analyze:false en todo momento).
Valida la disponibilidad del índice para la consulta compartida por Android e iOS;
no valida sesiones/Rules nativas ni activa la planificación de las apps.
Huella de configuración renovada: `shift-planning:v1:sha256:3e433596c64942e59ae7464ec44161fcb7bfc726de1a733727cd91552c7b028b`. Renovarla antes de admitir mantenimiento.

Validación mediante lecturas de operación/índice, comparación exacta de recursos
previos, aceptación del plan de consulta y sintaxis/diff. Sin cambios de código de
runtime, no se repiten las suites completas/nativas; se conserva la aceptación
anterior de73 pruebas/build/lint. No se modifican documentos, Rules, Functions,
Sheets ni FCM. Solo se cierra el requisito del índice: siguen abiertos drenaje y
ejecuciones antiguas, política de fuentes, autoridad de hoja y acuerdos de ventana.
La documentación sigue local.

Lectura final de la operación: done:true, sin error; READY y plan de consulta confirmados.

## Decisión actual pendiente — 2026-10-29

El índice ya está resuelto. La [evaluación de 31 escritores](hu084-develop-old-work-boundary.md)
separa entradas actuales, entregas contenidas y efectos antiguos. Una lectura nueva
observa 23 rutas de servicio revisadas y 284 versiones históricas RETIRED; no acredita
terminación de envíos externos. La propuesta [ADR-0025](../decisions/0025-separate-contained-deliveries-from-business-drain.md)
admitiría entregas expresamente contenidas sin inventar contadores a cero. No relaja
los controles de efectos anteriores ni autoridad automática. Decisión pendiente;
esta evaluación no implementa, abre ventana, migra ni modifica servicios compartidos.

## Implementación aceptada de entregas contenidas — 2026-10-29

ADR-0025 está aceptado para implementación/ensayo local e implementado. La selección
expresa en controles, las ocho rutas y la separación de fuentes/eventos conservan
observaciones desconocidas/no nulas sin relajar contadores de operaciones antiguas.
174 pruebas locales y37 de emulador, build/lint completo/lint CJS pasan, sin omitidas.
Los recibos retenidos siguen rechazando cambios. Véase la [implementación](../decisions/0025-separate-contained-deliveries-from-business-drain.md).
Siguiente: conciliar efectos antiguos/autoridad automática reales; después fijar
permisos de la hoja, política de fuentes y acuerdos nuevos de ventana. La admisión
real sigue cerrada; sin cambios compartidos ni nativos. Bloque sin commit junto
con el trabajo previo de observaciones.
