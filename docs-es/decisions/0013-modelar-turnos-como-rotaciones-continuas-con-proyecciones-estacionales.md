# ADR-0013: Modelar los turnos como rotaciones continuas con proyecciones estacionales

## Estado

Aceptada

## Fecha

2026-08-23

## Contexto

HU-017 introdujo la planificación de reparto y mercado lanzada por una persona
administradora con socios activos, y HU-020 conectó los turnos con Firestore y
Google Sheets. Una prueba posterior generó pestañas 2026-27, pero mostró fallos
estructurales:

- reparto repitió a la última persona de la temporada anterior en lugar de
  continuar con la siguiente persona/ayudante;
- reparto terminó con el horizonte de mercado en junio en vez de cubrir el
  calendario semanal hasta agosto y completar su ronda;
- el planificador escribió un valor de origen rechazado por ambos clientes;
- los rangos fijos de Sheets y el reemplazo de la pestaña completa no podían
  combinar de forma segura un arrastre con la generación siguiente;
- el libro de producción no estaba conectado mediante un despliegue gobernado.

La etiqueta de temporada es útil para las personas y para Sheets, pero la
justicia no es estacional. Una rotación puede cruzar septiembre, una generación
anterior puede ocupar ya fechas de octubre y una cohorte de mercado puede tener
menos o más de 30 personas para sus 30 posiciones anuales. Tampoco es seguro
reconstruir el orden a partir de las asignaciones actuales porque intercambios,
asignaciones efectivas manuales, bajas y futuras coberturas pueden cambiar quién
hace un turno sin cambiar de quién era la posición justa.

## Impulsores de la decisión

- Conservar el orden justo entre límites de ronda y temporada.
- Hacer el resultado reproducible, idempotente y seguro ante peticiones
  concurrentes.
- Mantener apps y backend sobre un único contrato canónico de Firestore.
- Permitir revisión/edición humana en Sheets sin darle autoridad sobre el cursor.
- Evitar repetir cada temporada configuración, permisos y migración del libro.
- Permitir una futura cobertura sin reescribir la justicia histórica.
- Mantener separadamente reversibles la reparación develop y la activación de
  producción.

## Decisión

### Firestore posee una rotación continua por tipo

Firestore almacena un agregado de rotación versionado para cada entorno y tipo
de turno. Posee cohorte ordenada, identidad/número de ronda, siguiente cursor,
horizonte publicado, datos de idempotencia/versión y procedencia.

Una **ronda** sirve una vez a cada persona de su cohorte congelada antes de que
nadie empiece la siguiente. En una ronda incompleta algunas personas pueden
tener una posición más, pero la diferencia máxima es uno y no se permite una
repetición anticipada.

Hasta ratificar HU-084, toda posición owner congelada debe servirse. La excepción
propuesta de baja permanente permitiría que un tombstone versionado
`excusedDeparture` contabilice terminalmente esa posición histórica sin contar
servicio ni crédito; no debilita la inmutabilidad del owner ni permite reordenar.

La cohorte solo se congela cuando se activa la primera posición de la ronda.
Ni el preview ni el stage no público la congelan; un cambio de padrón invalida el
snapshot/digest y exige un nuevo preview. Lo que ocurre con una persona que se
incorpora tras la activación sigue siendo parte de la política de HU-084
bloqueada por asamblea; hasta entonces, una diferencia de padrón hace fallar una
activación posterior como se describe más adelante.

Cada rotación por tipo solo arranca desde un agregado versionado válido, evidencia
cronológica reproducible de propiedad/ronda o un mapeo administrativo aprobado con
UIDs ordenadas exactas, ronda, cursor, evidencia y desempate estable. Las asignaciones
efectivas legacy tras cambios no prueban propiedad; se prohíben orden de query y
shuffle sin semilla. Una propuesta alfabética totalmente nueva se persiste como UIDs,
sin depender de colación locale en runtime. Reparto exige además que una ayudante
inequívoca/elegible registrada en la última fila legacy sea la primera propietaria y
encargada efectiva nueva. Un conflicto ayudante/cursor o evidencia ambigua/no elegible
falla para mapeo y nunca reescribe la ayudante. Mercado arranca de forma independiente.

La idea fija de exactamente dos turnos de reparto por persona y temporada no es
una invariante. La generación crea tantas rondas completas como sean necesarias
para llenar la temporada objetivo hasta agosto y después escribe el resto de la
ronda activa en las primeras proyecciones estacionales siguientes, creando
tantas como necesite el resto. En la cohorte actual pueden ser dos rondas; el
número se deriva, no se codifica.

Reparto exige al menos dos personas elegibles distintas. La persona ayudante es
quien figura como encargada efectiva del siguiente reparto materializado en orden
cronológico, conservando el contrato de HU-063 y los cambios de HU-016. En la
generación inicial coinciden propietaria y asignada efectiva, por lo que al añadir
el primer reparto nuevo esa persona pasa también a ser ayudante del reparto
anterior; normalmente es la siguiente propietaria justa al cruzar ronda o
temporada. Un cambio o cobertura aprobada modifica la cadena de ayudantes sin
reescribir `rotationOwnerUserId` solo mientras el reparto anterior no esté completo.
Completion congela UID de ayudante real, revisión de asignación origen y momento;
un cambio posterior del siguiente lead nunca reescribe esa historia. El último
reparto materializado muestra ayudante planificada pendiente hasta añadir el
siguiente. Menos de dos personas elegibles falla atómicamente.

Dos repartos materializados adyacentes deben tener encargadas efectivas distintas,
por lo que encargada y ayudante planificada nunca son la misma persona. Append,
swap, import Sheets, asignación manual, crédito y cobertura validan atómicamente
asignación, completion y revisión de anterior/actual/siguiente. Si completion compite
con un cambio del siguiente lead, quien pierde reintenta contra la historia congelada;
un resultado adyacente igual u obsoleto no produce efectos.

Mercado tiene diez eventos en el tercer sábado de septiembre a junio y
exactamente tres personas distintas por evento. Sus 30 posiciones consumen la
misma cola continua: cohortes menores empiezan rondas posteriores solo después
de terminar la actual y cohortes mayores arrastran el resto no servido a la
temporada siguiente. Menos de tres personas elegibles es un estado no
planificable que falla atómicamente.

Después de llenar las 30 posiciones de la temporada solicitada, mercado también
materializa todo el resto de la ronda activa en ese límite dentro de los primeros
eventos futuros, creando tantas proyecciones estacionales como sean necesarias.
Si ese resto termina dentro de un evento de tres personas, las posiciones
siguientes de la cola completan el evento; entonces la generación se detiene en
lugar de planificar recursivamente para siempre. Con N=29 coloca en la temporada
siguiente a las personas 2 a 29 de la segunda ronda y completa el grupo final con
las personas 1 y 2 de la tercera. Con N=31 coloca a la persona 31 en la temporada
siguiente y completa ese primer grupo con las personas 1 y 2 de la segunda ronda.

Cada rotación mantiene como frontera de planificación la primera temporada
incompleta después de contar el arrastre heredado. Una frontera parcialmente
rellena se completa tras sus filas existentes; si el arrastre ya llenó una o más
temporadas futuras, la frontera avanza a través de ellas. Una petición solo acepta
esa frontera o un replay idempotente exacto. Temporadas arbitrariamente pasadas,
saltadas o fuera de orden fallan antes de escribir. Una reparación/backfill
auditada de HU-083 puede restaurar proyecciones históricas, pero no avanzar el
cursor ni la frontera vivos.

### La elegibilidad tiene un único predicado canónico

Una persona elegible está activa y no es productora real. En el modelo actual:

`realProducer = roles contiene producer && !isCommonPurchaseManager`

Los responsables de compras comunes representados como productores para
`Compras Regüerta` siguen siendo elegibles. Los flags de visibilidad de catálogo
no definen la elegibilidad para turnos.

Este ADR no decide cambios de membresía dentro de una ronda activa/pública.
HU-084 sigue bloqueada hasta que la asamblea ratifique altas, bajas, suplencias,
cobertura, selección y créditos. Su propuesta segura solo regenera miembros en
una ronda no congelada. Una baja en ronda congelada conserva cohorte/owner: las
posiciones publicadas abren cobertura y una posición owner no publicada recibe un
tombstone/skip auditado `excusedDeparture`, sin turno, completion, crédito ni owner
sustituto. La asamblea solo puede elegir cobertura para esa posición no publicada
tras definir hueco, cursor, cierre de ronda, fallo y contabilidad de créditos exactos.

Ese tombstone propuesto queda provisional hasta que una activación pueda confirmarlo
atómicamente con cursor/cierre de ronda y una unidad física completa de reparto/
mercado. Si falla staffing, adyacencia lead/helper o distinción de mercado, no cambia
tombstone ni cursor; se aplica el fallback ratificado o la planificación queda bloqueada.

HU-084 también debe ratificar cambios de elegibilidad sin baja de membresía. Una
ronda no congelada puede quitar/añadir determinísticamente tras invalidar preview/
stage; una ronda congelada conserva cohorte/owner y usa cobertura por motivo o
`excusedIneligible`. La vuelta a elegible entra en reserva/siguiente ronda no
congelada y nunca revive una posición antigua. El predicado HU-082 mantiene elegibles
a responsables de compras comunes y excluye a productores reales.

Hasta que se acepte esa política, una discrepancia entre la cohorte congelada de
la ronda y la elegibilidad viva hace fallar atómicamente cualquier activación
nueva antes de escribir rotación, turnos, Sheets o notificaciones. Las filas ya
publicadas no cambian y una persona administradora debe resolver explícitamente
la transición de membresía.

### La propiedad de rotación es distinta de la asignación efectiva

Cada posición planificada registra su propietaria inmutable de rotación separada
de su persona asignada efectiva. La generación inicial las iguala. Intercambios,
ediciones gobernadas de Sheets o una futura cobertura aprobada solo pueden
cambiar la asignación efectiva; no reconstruyen ni avanzan el cursor.

Esta separación es necesaria ahora porque los intercambios recíprocos existentes
ya convierten la asignación efectiva en una fuente no fiable para recuperar el
orden justo; no acepta la política de cobertura pendiente de HU-084.

### Las pestañas estacionales son proyecciones, no reinicios

Cada turno pertenece a una proyección estacional según su fecha empresarial real
en `Europe/Madrid`. Una pestaña de la temporada siguiente que falte se crea de
forma idempotente. Una pestaña existente se combina por identidad lógica estable
de fila; no se borra para añadir el arrastre o una ronda posterior.

Se usa un libro estable de Google por entorno, con pestañas por tipo de turno y
temporada. La identidad/configuración del libro es su ID, no su nombre visible,
por lo que renombrar el archivo no crea otra integración. Crear un libro nuevo
cada temporada no es el comportamiento por defecto.

Sheets es una proyección sincronizada y legible por personas, y una entrada
gobernada para asignaciones efectivas. No posee cohorte, ronda, cursor ni
propietaria de rotación. La importación/reconciliación se particiona por pestañas
estacionales explícitas y el fallo al leer una no autoriza borrar otra partición.

### Firestore es la fuente móvil

Android e iOS continúan leyendo turnos de Firestore, no nombres de pestañas ni
datos del libro. El planificador usa el origen canónico existente `source = app`;
metadata separada como `origin = planner` y `planningRequestId` conserva la
procedencia. Los clientes siguen aceptando solo orígenes canónicos.

La petición estacional estándar es un único bundle con subplanes explícitos de
`delivery` y `market`, cada uno con su propia temporada objetivo en la frontera de
planificación, además de un ID estable de bundle/petición. Sus rotaciones/cursor
siguen siendo independientes, pero preview/stage/activate tienen éxito para ambos
o para ninguno; un subplan fallido u obsoleto no puede dejar una temporada a
medias. Los clientes observan el bundle/modo exacto hasta `completed` o `failed` y
hacen una lectura del servidor tras activar.

`preview` calcula el plan determinista y su digest sin mutar rotación, turnos
candidatos/públicos, Sheets, outbox de notificaciones ni un ledger de créditos
habilitado. Solo puede escribir el estado privado del ciclo de vida de
petición/operación y su artefacto inmutable de bundle/recibo. `stage` solo acepta ese
snapshot/digest combinado y guarda una candidata versionada del bundle de ambos
tipos en una partición separada propiedad del backend, oculta para las consultas
normales de socios, la exportación Sheets y los consumidores de notificaciones;
no avanza ningún cursor activo ni congela ninguna cohorte. `activate` solo acepta
esa revisión/digest y promociona atómicamente ambas rotaciones/proyecciones
activas. Como el bundle inmutable de preview es anterior a la activación, el
recovery inverse lo retiene fuera de su write-set y nunca lo actualiza, restaura
ni clasifica como una ruta creada por la activación que se deba borrar. La
frontera de inmutabilidad del candidato staged es la misma: activacion/recovery
nunca lo actualizan ni restauran y nunca lo capturan como before-image. Stage no
puede poseer una medicion exacta de una transaccion futura porque aun no existen
los IDs de activacion/recovery, before-images, precondiciones, payloads ni el token
opaco de la transaccion Firestore. Por ello, el serializador exacto acepta el
`WriteBatch` real propiedad de cada intento transaccional completamente resuelto y
se ejecuta antes de las escrituras publicas; liga el digest de su write-set ordenado
y el digest/conteo de bytes del `CommitRequest` protobuf completo. El adaptador local
de intento exige que hayan terminado las lecturas autoritativas, que el batch
interno pertenezca a ese `Transaction` exacto del SDK y este vacio, y que exista su
token opaco real. Puebla, mide y sella canonicamente ese batch una vez por callback;
el reset del SDK borra la autoridad y obliga al retry a reconstruir y medir de nuevo.
Una medicion correcta sustituye las operaciones por copias separadas de los protos
`Write` medidos, hace que el almacenamiento de operaciones pertenezca al adaptador
y reserializa la peticion completa justo antes del transporte. Otro token o una
secuencia de bytes distinta falla en cerrado. La medicion permanece en memoria
mientras esa peticion hace commit porque incluir su propio digest dentro de la
peticion medida seria circular. Cuando la transaccion medida devuelve exito, un
protocolo backend separado crea un outcome inmutable `transactionReturned` bajo
la operacion confirmada. Direccion y digest exacto del `CommitRequest` forman su
clave estable; liga intent, bundle, epoch, manifest, medicion completa, timestamp
posterior al retorno y digests derivados. El repositorio crea sin sobrescribir,
valida el terminal forward o inverse que lo autoriza, hace converger el replay
exacto y realiza una relectura independiente. No persiste el token opaco ni
afirma un acknowledgement de transporte de nivel inferior. Su digest de
configuracion de indices registra la autoridad auditada, pero no sustituye al
ensayo en clon aislado necesario para contabilizar las entradas de indice del backend. La
materializacion semantica queda precedida por un codec de publicacion v1 que fija
el payload publico plano, el marcador de mutacion backend, el tombstone de
activacion y el sobre de before-image. Las filas nuevas conservan los campos que
leen las apps instaladas y publican `source = app`; linaje del planner, propiedad
de rotacion, revisiones de asignacion/finalizacion/documento y epoch monotono son
metadata aditiva. Reparto tiene exactamente un asignado y mercado exactamente
tres. Una escritura controlada cambia `lastBackendMutation`, ligado a destino,
digest del payload sin marcador, revision documental, intent de operacion,
bundle y epoch. Solo un evento cuyo marcador cambia debe coincidir con el payload
actual; una edicion ordinaria posterior puede conservar el marcador historico y
no debe silenciarse.

La misma transaccion de activacion crea un tombstone inmutable
`state = committed` que liga sus mutaciones publicas ordenadas y referencias de
before-image. Las before-images conservan un subconjunto Firestore taggeado
exacto (mapas, arrays, escalares, timestamps, bytes y geopoints), el update-time
original como evidencia, digest del contrato de captura, ruta, digest del payload
y digest del sobre. Todo valor no soportado o con perdida falla cerrado. Estos
codecs puros fijan la entrada de los materializadores forward/inverse.

El materializador forward local exige ahora que un recalculo live completo
reproduzca exactamente el artefacto staged inmutable antes de crear una sola
escritura. Resuelve todas las posiciones publicas, la actualizacion protegida del
helper predecesor cuando existe, ambas transiciones de rotacion/lease, estado
activo, terminal de request, comandos de Sheets, intenciones retenidas,
before-images y tombstone de activacion. Cada update lleva el `lastUpdateTime`
leido por la transaccion y el conjunto exacto debe coincidir con el presupuesto
forward y el manifest de creates inverse. Despues lo entrega al adaptador real
del intento; un vector de emulador prueba que el mismo batch medido del SDK hace
commit atomicamente. Los creditos no nulos siguen cerrados hasta HU-084.

El materializador inverse local consume solo ese bundle persistido, tombstone de
activacion, request completada, documentos actuales de activacion y before-images
revalidadas. Rechaza creates cambiados, bundle/epoch activo obsoleto o cualquiera
de los dos release leases que ya no siga sellado por esa activacion. Un unico
batch inverse medido borra solo creates de activacion sin cambios y restaura
targets protegidos. Vuelve el lineage de negocio anterior, pero `writeEpoch` de
mantenimiento y revisiones de rotacion/estado avanzan monotonicamente y ambos
leases se limpian. Los mapas conservados se reescriben completos y los campos
top-level que solo existen despues usan sentinels de borrado explicitos. El
registro de activacion se reemplaza exactamente por un tombstone de recovery
ligado por digest; before-images y request historica completada quedan como
evidencia de auditoria. Un vector de emulador Firestore prueba borrado,
restauracion, epoch superior y reemplazo exacto del terminal de forma atomica.

El runtime CAS local invoca su resolver dentro de cada callback Firestore
reintentado, entrega solo el read-set de ese intento al materializador real
forward/inverse y persiste outcome unicamente para el intento devuelto por
`runTransaction`. Un outcome direccional exacto ya retenido se reproduce sin otro
CAS. Un terminal de activacion o recovery confirmado que haya perdido ese outcome
falla cerrado, porque repetir una mutacion despues de perder su acknowledgement
no es una reparacion segura. El resolver local concreto ya lee en cada retry la
envolvente ligada por digest `shiftPlanningState/fairness`, el paquete staged
inmutable, estado/rotaciones autoritativos y todos los targets de before-image.
Su par inverse lee tombstone, bundle, request, before-images y todos los targets
actuales de delete/restore. El emulador prueba drift valido sin escrituras
publicas, activacion exacta y recovery con epoch superior. El productor gobernado
local ya reconstruye la
envolvente live transaccionalmente desde proyecciones acotadas de miembros/
dispositivos y calendario, config canonica, estado/rotaciones autoritativos y
`shiftPlanningState/sourcePolicy` backend-only exacto. Hashea los destinos de
notificacion, ignora metadatos de miembro exclusivos de autenticacion, no escribe
en un replay exacto y conserva la ultima envolvente valida si una fuente esta
mal formada o supera su limite. El resolver forward concreto ya exige reconstruir
y comparar por digest ese read-set dentro de cada retry de activacion, por lo que
una envolvente cacheada obsoleta no puede autorizar escrituras. El trigger local
de `index.ts` mantiene los documentos sin version en el handler legacy sin cambios
y enruta preview/stage/activate schema v2 por el runtime gobernado. Una version
declarada desconocida falla cerrado y nunca cae al escritor legacy. Recovery se
exporta localmente solo mediante un adaptador HTTP de cuerpo exacto fijado al email
de la futura cuenta de servicio dedicada del operador. El adaptador añade auditoria
sanitizada y correlacionada de peticion/respuesta y sigue exigiendo la allowlist de
mantenimiento backend separada. HU-085 conserva el aprovisionamiento del principal,
el IAM de invocacion exacto y su prueba negativa, ensayo, despliegue y ejecucion live.
La activación es el límite reconocido de visibilidad pública y encola
sync de Sheets e intenciones de notificación retenidas.

El primer despliegue conserva las apps instaladas que leen la colección plana
`shifts` existente. Por ello, la promoción pública debe escribir toda la
proyección plana acotada de reparto y mercado, ambas transiciones de rotación/
cursor, comandos de sync e intenciones retenidas en una sola transacción
Firestore. El preflight debe demostrar que el manifiesto combinado cabe en todos
los límites; en caso contrario, se bloquea la activación hasta que versiones
móviles soportadas sigan un contrato de revisión activa. Un cambio de puntero por
sí solo no sirve y una promoción parcial por tipo o en varios lotes no es atómica.

Las notificaciones se liberan por separado tras reconciliar. La liberación crea
cada evento canónico idempotentemente con una clave estable de deduplicación; la
escritura posterior del inbox de la app es idempotente por esa clave. El
transporte FCM es al menos una vez y puede mostrar un push duplicado; lleva el ID
estable del evento y metadata de colapso para un tratamiento best effort, pero
este ADR no promete presentación exactamente una vez por el sistema operativo.
Los mensajes entregados no se pueden revertir.

Para eventos de turno, evento canónico, proyección inbox y push solo persisten copy/
referencia genérica no sensible y metadatos de ciclo de vida: nunca nombres, fecha
del turno ni asignación efectiva. Android/iOS obtiene detalle de revisión actual con
autorización al abrir push o inbox. La caché duradera/offline sigue genérica y el
detalle efímero se invalida ante cambios de sesión, membresía, revisión o entorno.

Las intenciones de notificación retenidas usan un outbox/ruta propiedad del
backend que ningún trigger normal actual observa. Solo la liberación explícita
crea eventos canónicos consumibles con claves de idempotencia estables; un flag de
estado dentro de una colección ya consumida no protege revisiones mezcladas.

La transacción de activación también crea comandos explícitos pendientes de sync de
Sheets vinculados al digest. Tras el commit, un worker invocado/consultado de forma
explícita los reclama y reintenta idempotentemente, redescubre pendientes y nunca
depende de activar Eventarc después del evento de creación. Los eventos por fila de
activación, reparación o recuperación
nunca poseen los efectos de exportación/notificación: un trigger candidato valida
el marcador/manifiesto de mutación backend específico del evento y lo audita como
no-op. Conservar procedencia en una edición ordinaria posterior no suprime esa
edición. Los tombstones de operación y ledgers de evento sobreviven a todas las
ventanas de reintento configuradas.

Los comandos Sheets se serializan con epoch monotónico y lease por libro/partición.
El worker valida comando y revisión/digest activos antes de cada batch y registra
read-back. Recovery sustituye y drena primero worker/llamada externa de activación;
si no se demuestra, falla cerrado sin intercalar. Un reintento de epoch antiguo no
puede sobrescribir valores recuperados.

Un drenaje Sheets ambiguo tiene residual propio con plazo: Firestore sigue activo y
autoritativo, outbox sellado, integración/rangos Sheets afectados cercados y tráfico
móvil/no relacionado reanudado. Recovery espera terminalidad/read-back de la llamada;
la incertidumbre no mantiene toda producción fuera de servicio indefinidamente. El
vencimiento obliga a decidir: revocar la autoridad exacta del worker/libro, esperar
el horizonte conservador de la llamada externa y demostrar estabilidad de actividad/
revisión de Drive antes de reconciliar. Si sigue siendo imposible, se autoriza por
separado cuarentena del libro y una proyección nueva controlada—sin afirmar que
conserva el enlace anterior—o se renueva un incidente nominal y el cerco acotado. Un
TTL nunca vence en silencio.

El lote de notificaciones mantiene leases sobre ambas rotaciones hasta quedar
terminal. Una transacción/CAS lee versiones de asignación/membresía al reclamar
cada intent y crear evento/inbox; un dato obsoleto no escribe nada. Cada envío FCM
mantiene un lease breve respetado por todos los escritores de asignación/socio/token
mientras revalida. Cada evento canónico conserva intentos inmutables con `attemptId`,
epoch/deadline del lease, digest de validación, inicio autenticado y resultado; el
estado agregado se deriva. Timeout/expiración pasa a `unknown` posiblemente entregado
y el retry añade otro intento revalidado sin sustituir evidencia. Evento canónico,
inbox y push son genéricos y el detalle se autoriza con frescura al abrir. El inicio
de submission autenticada es el límite. Solo se puede cancelar como no liberada una
intención que se demuestre que nunca inició submission en ningún epoch. Un resultado
`unknown` puede haberse entregado, queda como historial inmutable y se trata mediante
reconciliación/corrección; nunca vuelve a clasificarse como no liberado. El SO puede
mostrar después de otro estado. Safe-resume sigue teniendo plazo y no permite otra
activación que lo sustituya.

### Límites de entrega

- HU-082 entrega estado de rotación, planificadores, ciclo de petición y lectura
  móvil, incluido el vínculo preview/stage/activate y retención/liberación de
  notificaciones. Posee la emisión atómica de comandos Sheets/marcadores de
  operación y el protocolo del consumidor, validado con fixtures, pero no el
  consumidor Sheets real. Valida localmente/emuladores sin despliegue compartido.
- HU-083 entrega Sheets multi-temporada y reparación/ensayo auditados en develop
  mediante scripts directos acotados. Posee el consumidor real de comandos, la
  supresión del trigger candidato y el handoff de baseline de migración. No
  despliega Functions ni Rules al proyecto Firebase compartido.
- HU-084 registra la propuesta de coberturas/créditos bloqueada por asamblea y es
  independiente de la activación del planificador base.
- HU-085 posee quiescencia/drenaje, el primer despliegue compartido de
  Functions/Rules, incluida una barrera bootstrap explícitamente autorizada con
  Rules temporales restrictivas y bloqueo de ingress, identidad/acceso/parámetros
  de producción, reparación y migración diferidas, preview sin efectos de
  dominio, stage no público, activación pública explícita,
  reconciliación/liberación de notificaciones retenidas y
  reanudación/recuperación bajo autorización separada.

## Opciones consideradas

### Reiniciar y barajar de forma independiente cada temporada

Rechazada. Puede repetir a la última persona anterior, rompe la continuidad de
ayudantes, no explica la justicia y no es reproducible.

### Exigir un número fijo de turnos por persona en cada temporada

Rechazada como invariante principal. La longitud del calendario, el tamaño de
cohorte, el arrastre heredado y las 30 posiciones fijas de mercado no dividen
siempre de forma exacta. Una cuota estacional fija deja fechas vacías o repite a
alguien antes de completar la ronda. La justicia por rondas completas produce
las dos rondas pretendidas en el caso actual sin codificar una constante frágil.

### Hacer de Sheets la autoridad de la rotación

Rechazada. Las ediciones manuales de asignación y los intercambios recíprocos no
permiten distinguir quién poseía una posición justa de quién la realiza. Las
lecturas parciales y pestañas renombradas/añadidas harían insegura la recuperación
del cursor. Las apps ya consumen Firestore.

### Crear un libro nuevo cada temporada

Rechazada. Repite permisos, parámetros, validación, enlaces y migración cada año,
y dificulta reconciliar ayudantes/arrastre entre temporadas. Las pestañas
estacionales dentro de un libro estable conservan la organización humana sin
cambiar la identidad de integración.

### Usar un solo libro para develop y producción

Rechazada. Debilita el aislamiento de entornos y permite que las pruebas muten
proyecciones productivas. Cada entorno tiene un libro estable explícito sin
fallback al otro.

## Consecuencias

### Positivas

- Justicia y continuidad de ayudantes quedan explícitas y comprobables entre
  años.
- N=29/N=30/N=31 en mercado siguen una regla sin calculadora ni excepción anual.
- Replay idempotente y concurrencia se protegen con un agregado autoritativo.
- Las apps reciben el resultado mediante su contrato Firestore/origen existente.
- Enlaces/configuración del libro permanecen estables al crecer por pestañas.
- Intercambios y una futura cobertura aprobada no corrompen la propiedad histórica.
- Reparación develop y activación productiva tienen riesgos revisables por separado.

### Negativas

- Se necesitan un nuevo agregado de rotación persistido, versionado, migración y
  superficie de Rules.
- El único proyecto Firebase hace global el despliegue de Functions y Rules entre
  las rutas lógicas develop/producción; un despliegue solo para develop no es un
  ensayo aislado.
- Los datos de prueba existentes pueden no bastar para reconstruir la propiedad;
  casos ambiguos exigen un mapeo administrador explícito y no una reparación
  automática.
- Sheets requiere sincronización por particiones y combinación/reconciliación en
  lugar de reemplazar toda la pestaña.
- La UI móvil de planificación debe observar el terminal backend en vez de tratar
  el envío como éxito.
- El número de rondas por temporada de calendario deja de ser constante y debe
  explicarse con la invariante de ronda completa.

## Migración y compatibilidad

- Conservar lectores existentes al añadir campos de rotación/procedencia.
- No inferir la propietaria histórica desde una asignada efectiva tras un
  intercambio/edición cuando la evidencia sea ambigua.
- Auditar y ejecutar dry-run antes de reparar develop; vincular apply al snapshot,
  digest revisado y backup verificado.
- Construir la normalización productiva de origen/rotación/proyección solo en una
  partición oculta de migración/candidata. Las filas públicas existentes no
  cambian hasta la activación atómica. El bootstrap inicial de rotación/cursor se
  confirma en esa activación; un backfill histórico de HU-083 no puede avanzar
  por separado un cursor/frontera live ya activo.
- Conservar `source = app|google_sheets`; reparar `source = planner` como origen
  canónico más procedencia.
- Sustituir rangos fijos/reemplazo total antes de producir arrastre entre
  temporadas.
- Validar código y Rules de HU-082/HU-083 localmente/emuladores; cualquier
  reparación live develop de HU-083 usa solo un script directo acotado,
  compatible y seguro frente a triggers; nunca un despliegue compartido. Exige el
  mismo fence efectivo de todos los escritores Firestore/libro, rehash inmediato,
  CAS documental, guard de revisión Sheets y prueba de ediciones offline que
  producción; en caso contrario usa el handoff HU-085 sin escritura.
  Cualquier impacto de control plane/fence sobre producción o todo el proyecto
  obliga a ese handoff y no puede aprobarse dentro de HU-083. Un script live exige
  principal/workload keyless y temporal manifestado, radio IAM de base explícito,
  guards develop, prueba de escritor único y revocación/read-back de auditoría final.
- Ensayar con commit los manifiestos forward e inverso exactos de HU-083 en un clon
  aislado restaurado antes de cualquier apply live develop. Un apply live correcto
  termina con develop reparado y su baseline inmutable de ambos tipos; el inverso
  solo se ejecuta live para recuperar un apply fallido/inconsistente. Un handoff
  diferido entrega planes/digests, nunca el principal ni credencial del script HU-083.
- Los backups HU-083 usan otro auditor de evidencia keyless y temporal con acceso
  exacto de lectura/export de origen y salida create-only cifrada con ACL/retención.
  No puede mutar origen ni invocar apply y se revoca/read-back antes de habilitar el
  principal de reparación.
- Ejecutar producción solo mediante identidad, backups, allowlists, plan de
  Rules/índices, preview sin efectos de dominio, stage no público vinculado al digest,
  activación explícita, notificaciones retenidas, read-back y recuperación de
  HU-085.
- Como los despliegues son compartidos, establecer primero una barrera bootstrap
  autorizada desplegando Rules temporales probadas que denieguen las escrituras
  directas afectadas y deshabilitando los productores programados y los ingress
  callable/HTTP exactos. Tratar los eventos ya aceptados y sus cascadas como
  trabajo en curso, drenarlos mientras las entregas existentes siguen activas y,
  después, deshabilitar los triggers/entregas exactos y verificar colas vacías.
  Si no se puede demostrar esta secuencia, detenerse antes de mutar acceso,
  configuración o datos.
- HU-082 implementa un epoch monotónico backend de mantenimiento/escritura y la
  precondición de revisión activa para toda escritura afectada de app/admin, cambio,
  override, calendario, import Sheets y comando. Una escritura offline obsoleta o
  sin precondición falla. Las rutas directas legacy siguen cerradas o migran a un
  comando versionado; HU-085 solo lo verifica en vivo.
- Las Rules no limitan a escritores Admin SDK/servidor/IAM. Inventariar y cercar
  o revocar de forma recuperable cada principal, clave, workload, job, CI/script y
  acceso de consola. Tras cerrar todo intake y escritor independiente, las entregas
  existentes solo drenan el conjunto causal ya aceptado; se prueban ledgers vacíos y
  horizonte de calma. No se finge que revisiones legacy filtran IDs. Si no se puede
  demostrar aislamiento causal, HU-085 aborta para una historia bridge separada.
  Revocar/deshabilitar el drenaje antes de migrar y permitir después solo al runtime
  candidato. El operador solo invoca: sin Firestore/Sheets, impersonación ni tokens.
- Toda mutación HU-085 posterior al baseline—reparación, migración/bootstrap,
  ciclo de preview, stage, activación, corrección de sync, recovery y cleanup
  manifestado—es un comando ligado a ID de operación/revisión/digest. Solo escribe
  el runtime candidato o su revisión de recovery epoch-aware ensayada bajo la misma
  identidad de datos gobernada; operador, deployer, controlador Drive, auditor de
  evidencia y scripts nunca escriben esos datos directamente.
- Revalidar en cada gate un manifiesto de autoridad efectiva, no un único etag:
  herencia/condiciones/deny IAM, IAM de cuentas, WIF, grupos transitivos, claves/
  workloads, autoridad Drive/Workspace/DWD, Audit Logs y datos. Encadenar cada
  resultado y abortar ante cualquier cambio de acceso efectivo aunque no cambie el etag.
- Una cuenta runtime dedicada reduce quién usa acceso servidor, pero Admin/server
  Firestore evita Rules y su rol de datos abarca en la práctica base/proyecto, no
  rutas. Autorizar ese radio, negar Auth/Storage/IAM/Secret/tokens no necesarios,
  imponer guards auditados de ruta/entorno/operación en código y documentar proyecto/
  base separados o un escritor mediado como aislamiento más fuerte.
- Usar otro deployer temporal de control plane con mínimo privilegio para las
  acciones exactas Functions/Rules/Eventarc/config/IAM y sin datos/libro/tokens.
  Preferir rollback ensayado por tráfico a la revisión previa sin redeploy; si no,
  limitar `actAs` al candidato y runtime previo exacto para deploy/rollback
  allowlisted. El controlador Drive necesita capacidad
  temporal de edición para el fence ACL/protección: auditar acciones exactas y
  digest de celdas sin cambios, y revocarlo. Recovery usa reautorización sellada y
  exacta. Otra acción sellada concede solo al runtime candidato tras aprobar el
  baseline; la restauración ACL terminal sigue el mismo patrón. Revocar ambas
  autoridades en toda salida terminal.
- Usar un auditor de evidencia/backup keyless, separado y temporal, con acciones
  exactas de lectura/export de origen y acceso create-only a un destino cifrado con
  ACL y retención. No puede mutar datos de aplicación ni el libro origen, sobrescribir/
  borrar artefactos retenidos, invocar el rollout ni impersonar otra autoridad.
  Registrar revisión/read time de origen, digest, prueba de restore, revocación y
  read-back en cada ventana de evidencia.
- Medir y ensayar con commit por separado las transacciones exactas de activación y
  recuperación inversa en emulador/clon aislado restaurado. En producción solo se
  revalidan digest/presupuesto sin escribir; no cruzar visibilidad si cualquiera
  de los manifiestos no confirma atómicamente para los lectores planos instalados.
- Cada salida terminal del rollout caduca los IDs de operación, cierra el estado de
  mantenimiento y revoca el IAM temporal del operador; cualquier endpoint que se
  conserve queda inerte hasta una nueva autorización con plazo.
- Cercar temporalmente todo escritor del libro: personas, triggers/deployments de
  Apps Script, add-ons, clientes API/OAuth, cuentas de servicio, automatizaciones
  Shared Drive, grupos/dominio transitivos, DWD y vías de administrador Workspace.
  Cercar/digestea o probar ausencia, leer actividad Drive/Workspace y verificar
  revisión/digest por escritura. Probar cero escritores y luego runtime único; si no,
  abortar.
- Las personas editoras confirman estar online, haber cerrado y no tener cambios
  offline pendientes. Los rangos siguen protegidos hasta reautorización controlada,
  reload de servidor/revisión base actual y observación/read-back posterior. Quien
  no confirme queda read-only o usa un canal de cambios versionado.
- Resolver My Drive frente a Shared Drive, `driveId`, propietarios, roles y
  capacidades. Si no existe fence reversible del propietario, detenerse para una
  decisión separada de transferencia/movimiento que pruebe mismo ID/enlace e
  integraciones; nunca crear silenciosamente otro libro.
- Tras drenar, revocar escritores del drenaje acotado y capturar mediante ese auditor
  nuevos backups Firestore/libro quiescentes, manifiestos de presencia/ausencia, digests y presupuestos
  forward/inverso. Los backups previos solo sirven para recuperación. Cualquier
  cambio del paquete requiere nueva autorización antes de acceso/config/deploy/
  migración.
- El epoch de seguridad/escritura nunca retrocede. Recovery puede restaurar la
  revisión activa de negocio anterior, pero incrementa epoch, conserva Rules
  endurecidas y solo sirve una revisión compatible con epoch; escritores servidor
  legacy siguen deshabilitados. Este residual de seguridad intencional queda fuera
  de la igualdad byte a byte y se prueba.
- Preconstruir índices aditivos y esperar `READY` antes de la ventana principal
  de mantenimiento. Mantener un resultado con plazo y rollback/reanudación para
  cada gate posterior, de modo que una aprobación de notificaciones retrasada no
  deje producción indisponible indefinidamente.

## Estado de aprobación e implementación

El mantenedor aceptó este ADR el 2026-08-24 para implementar HU-082 y validarla
localmente/en emuladores. La aceptación no autoriza despliegues en el proyecto
compartido, mutaciones reales de Firebase/Sheets, permisos de producción ni
configuración productiva. La política HU-084 bloqueada por la asamblea sigue
siendo independiente y no está aprobada.

## Trabajo relacionado

- HU-017 / issue #4
- HU-020 / issue #19
- HU-082 / issue #266
- HU-083 / issue #267
- HU-084 / issue #268
- HU-085 / issue #269
- ADR-0003: Usar Firebase como backend
