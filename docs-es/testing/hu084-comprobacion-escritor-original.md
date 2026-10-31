# HU-084 — Comprobación del escritor sobre develop original

Estado: el segundo intento autorizado se detuvo antes de escribir en la aserción
de la carpeta visible para el escritor (proveedor, línea57 en `930959bd`). Limpieza
correcta y verificada independientemente. Corrección local de visibilidad pendiente
de publicar y comprobar en otro ensayo autorizado. Sin admisión de migración ni mantenimiento.

## Alcance y entrada

`functions/scripts/prepare-develop-original-writer-check.cjs` genera una preparación
inerte al recibir una ruta nueva de salida. La CLI no lee credenciales ni hace red.
`runWithExplicitCredentials` compone explícitamente los proveedores reales: token
IAM inyectado, token separado del propietario de solo metadatos, acciones revisadas
en Compartir de Drive y lector independiente de controles actuales. Ningún token se
pasa a la interfaz del propietario. Sin ADC, renovación, subproceso, cliente Firestore,
notificaciones ni entrada de despliegue.

Único destino: develop original
`1O7VKs7S4wZHVvTfNBehAd5EzF3Mgw2q9LweK68Gm76A`. Única escritura: un lote con un solo
`updateCells` en sheet 673721152/A1, reenviando `Fecha`, limitado a `userEnteredValue`.
No pide cambiar fechas/orden, notas ni formato; la versión de Drive puede aumentar.
Las identidades de las seis pestañas y las capturas acotadas (`A1:Z100`, o `A1:Y100` en TORRE 2025-26, de25 columnas) de valores
tipados, notas y formato introducido deben coincidir con la base revisada antes y
después. No garantiza toda la cuadrícula ni la historia inmutable. Sin escritura
inversa ni reintento automático.

El proveedor/ejecutor de copias conserva su exclusión de la hoja original. Se reutilizan
transporte IAM, comprobaciones de identidad, scopes/duración y retirada de la concesión
condicional exacta. El proveedor original añade solo lecturas de archivo/carpeta fijos,
paginación acotada de permisos y el lote fijo. Sin redirecciones ni reintentos. El
escritor lee solo el archivo: el lector independiente del propietario comprueba Mi
unidad, sin conceder acceso a esa carpeta al escritor.

## Canal del propietario revisable

Antes de ejecutar, inspeccionar Compartir en Drive con **testplusprojects@gmail.com**
en el archivo exacto y comprobar que están disponibles Añadir y Quitar acceso.
Registrar observación y digest del código de las acciones en la revisión privada;
vincularlo a `ownerChannel.reviewDigest` y a la nueva autorización. Son acciones del
operador de confianza: no entradas arbitrarias ni prueba de que OAuth permita editar.
Solo deben finalizar cuando su acción en la interfaz haya terminado.

1. `grant(action)`: comprobar archivo/cuenta, propietario y cuatro lectores. Añadir
   únicamente `reguerta-develop-sheets-writer@reguerta-9f27f.iam.gserviceaccount.com`
   como Editor de este archivo. Conservar carpeta, restricciones y lectores. El
   controlador exige el permiso directo `06575248221544440100` y relee toda la ACL.
   Un resultado ausente o incierto detiene el avance.
2. `remove(action)`: en ese archivo/cuenta, seleccionar solo el escritor añadido,
   quitar su acceso y guardar. No modificar otro permiso. El controlador inspecciona
   incluso una concesión cuya respuesta se perdió; retira solo el permiso exacto
   que se intentó crear. Un escritor preexistente impide actuar desde el inicio.
3. La lectura completa del propietario confirma la restauración. Con el mismo token
   del escritor todavía vigente, un GET del archivo debe devolver 403/404 tras su
   lectura positiva. Token caducado/401 no prueba retirada. Sin segundo lote ni token.

Estas acciones requieren autorización separada de ejecución. OAuth de metadatos no
crea/retira permisos; no se propone un scope más amplio. La sesión anterior revocada
no se reutiliza. La nueva sesión del propietario debe ser Online, sin renovación;
la limpieza revoca OAuth y verifica 401 con el mismo token. Después hay que limpiar
campos/referencias de Playground y cerrar la pestaña.

## Intento único y limpieza

La nueva autorización vincula digests de preparación/código/petición, canal del
propietario, metadatos/contenido base revisados, controles independientes y ventana
máxima de diez minutos: propietario en línea, archivo cerrado, sin cambios pendientes
sin conexión ni otras escrituras/emisiones de tokens. `readIndependentControls` es
una integración de lectura de confianza: usar los observadores reales existentes de
controles y aislamiento del runtime, sin inferir booleanos de evidencias antiguas.
Cada respuesta exige digest coincidente, observación de hace como máximo 60s y
verificación del aislamiento del escritor y barreras de develop. Las incertidumbres
de fuentes/colas conservan su clasificación y no autorizan mantenimiento.

Usar una raíz privada de registro única para todos los intentos sobre este archivo.
Antes de llamar a proveedores se crean un bloqueo exclusivo por archivo y el directorio
de autorización consumida. Las intenciones se guardan y vacían a disco antes de activar,
conceder, emitir token o enviar lote. Solo hashes/estados acotados: sin tokens, errores
SDK completos ni celdas en el registro. Conservar aparte evidencias privadas de base y
controles. No borrar registros/bloqueos para reintentar: inspeccionar y conciliar la
limpieza interrumpida, con una autorización nueva si procede.

La cuenta debe empezar deshabilitada, con UID exacto, sin claves/concesiones directas
y autoridad de proyecto permitida sin cambios. Activar una vez; conceder IAM condicional
exacto por como máximo 600s; observar estado y disponibilidad orientativa para emisión
con antigüedad mínima 120s y espera máxima 180s. Solicitar un único token de 300s. Reservar
120s de su vigencia antes de escribir para limpieza independiente. Volver a comprobar
código, identidad, controles, propietario/archivo, token/ventana y base antes del lote.

Si se pierde la respuesta de escritura, solo se lee la imagen posterior acotada y se
limpia; contenido coincidente no inventa acuse satisfactorio. Retirada del permiso de
archivo, retirada CAS del miembro/condición IAM exactos, desactivación explícita,
lectura independiente de identidad y revocación OAuth son pasos separados. Se conservan
concesiones ajenas concurrentes y se informa la deriva pendiente. Un fallo no reabre
develop. Limpieza no probada mantiene bloqueo local y resultado de inspección. Si el
proceso/interfaz se bloquea o cierra, usar las intenciones para inspeccionar/retirar el
permiso creado, quitar IAM exacto y desactivar explícitamente; caducidad del token no
es limpieza comprobada. Sin reanudación ni segundo intento automáticos.

## Validación y siguiente paso

Node 22.23.4: build/lint de Functions correctos;83 casos focalizados pasan, cero fallos
u omitidos (34 nuevos y 49 regresiones IAM/copia sin cambios). Apps y comportamiento
Firestore intactos: no corresponde repetir suites nativas ni emulador. Los CJS nuevos
pasan comprobación de sintaxis; el lint estándar cubre el JS/TS configurado y las
pruebas focalizadas validan el comportamiento CJS.

Siguiente: revisar interfaz/acciones reales del propietario y controles independientes
actuales, vincular base/digests actuales, obtener autorización única de IAM/archivo/
token/escritura/limpieza, preparar OAuth Online y pedir después la ventana de diez
minutos. Las pruebas locales no demuestran acceso del escritor a la hoja original.
La migración posterior sigue necesitando nueva vinculación ACL/versión, censo vigente,
autoridad Firestore separada y autorización de mantenimiento propietario/admin/riesgo.

Referencias: [UpdateCellsRequest](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets/request#UpdateCellsRequest)
y [paginación completa de permisos](https://developers.google.com/workspace/drive/api/reference/rest/v3/permissions/list).


## Canal nativo y evidencias renovadas — 2026-10-31

Ejecutor publicado en `3e494fc8`, comprobado en remoto. La revisión nativa de lectura
confirma cuenta propietaria, archivo original exacto, propietario/cuatro lectores y
acceso restringido. El correo del escritor se resuelve a la cuenta esperada; el
formulario pendiente de Editor permite desmarcar notificaciones. Se canceló sin
Compartir/Enviar. El menú de un lector existente ofrece Quitar acceso; se cerró sin
seleccionar cambios. El escritor sigue ausente. Esto comprueba el recorrido de la
interfaz, no una concesión/retirada efectiva de un escritor todavía inexistente.
Las acciones futuras usarán estado visible nuevo, nunca índices AX conservados.
La confirmación final posterior a quitar acceso se inspeccionará durante el intento
autorizado.

Los metadatos renovados confirman 25 columnas en TORRE histórica. Leer hasta Z
superaría su cuadrícula: el proveedor original utiliza ahora Y allí y conserva Z en
las otras cinco pestañas. Una regresión reproduce los límites reales. Máscara de
captura, presupuesto de escritura, petición sin cambio de valor, IAM y exclusiones
de copias intactos. El conector de lectura aporta la nueva base de las seis pestañas;
sigue omitiendo versión/carpeta/ACL completas. La lectura OAuth autorizada terminó
a las 11:56:08Z: versión 278 estable, mismos cinco permisos completos y carpeta solo
del propietario. Revocación 200 y posterior 401 con el mismo token. Sin renovación;
campos borrados y Playground cerrado.

24 Functions sin cambios, tres jobs PAUSED y seis índices READY; Rules y políticas
IAM coinciden con las observaciones anteriores. Escritor deshabilitado, sin claves
ni concesiones directas, no asignado a las 24 Functions observadas ni a los 24 servicios
Run listados globalmente. Jobs/worker pools/instancias vacíos, sin continuación ni
ubicaciones inaccesibles. No se renuevan fuentes de negocio, colas causales ni
revisiones retiradas, ni se deduce su vaciado de estas comprobaciones.

Evidencias privadas: `2026-10-31-original-permission-channel`. Sin cambios de permisos,
token del escritor, escritura Sheets, notificaciones, mantenimiento ni datos de
producción. Apps intactas. Código/evidencias nuevos pendientes de commit después de
`3e494fc8`; la ejecución real sigue requiriendo autorización y ventana propias.

Validación de esta corrección: Node 22.23.4, 84 casos (35 del original y 49
regresiones IAM/copia), cero fallos/omisiones; build, lint y sintaxis CJS correctos.
Las pruebas nativas/emulador no se repiten: no cambia comportamiento de apps/Firestore.


## Intento autorizado sobre el original — 2026-10-31

El usuario autorizó un intento y confirmó diez minutos con la hoja cerrada. La
preparación de cuadrícula/controles está publicada en `b52e75a8`. Antes del ensayo,
se alineó la máscara de respuesta con los campos de libro/pestañas del conector
independiente; pasaron 84 casos, build y lint.

Se habilitó la identidad exacta, se concedieron el miembro IAM condicionado y un
permiso directo de Editor, se esperaron al menos 120 segundos y se emitió un único
token de 300s. La lectura positiva de Drive funcionó. Después falló una aserción en
la antigua fase `positive-read`, **antes de registrar una intención de escritura o
enviar un lote a Sheets**. El diagnóstico no conservaba la aserción concreta ni su
línea: la causa sigue sin determinarse. No se deduce un fallo de capacidades, ACL,
formatos o captura a partir de una fase tan amplia.

Se retiró el permiso exacto y se verificó la lista completa de propietario/cuatro
lectores. El mismo token del escritor, todavía válido, recibió404. Se comprobaron
independientemente la retirada IAM, deshabilitación explícita, cero claves/concesiones
directas y ausencia de asignaciones de ejecución. El ejecutor marcó inicialmente la
limpieza OAuth como no acreditada; una consulta independiente con el mismo token del
propietario recibió401. Repetir su revocación devolvió400 con el token ya inválido y
la siguiente consulta recibió401. No quedaron registrados los estados originales,
por lo que no se afirma una causa de propagación ni un HTTP200 inicial. Se borraron
campos, cerró Playground y descartaron referencias en memoria. El recibo original y
el bloqueo se conservan; una conciliación separada acredita limpieza y autorización
consumida.

Las capturas acotadas de las seis pestañas coinciden antes/después (3286 objetos de
celda seleccionados con valores, notas y formatos). Functions/jobs/Rules/IAM/Run e
índices mantienen el mismo hash de controles. Una lectura final no estuvo disponible;
la siguiente lectura completa y coincidente pasó. Sin escritura Sheets, FCM, datos
de negocio, mantenimiento ni datos de producción. No quedó registrada la versión de
Drive posterior a los cambios de permisos;278 es histórica, no una garantía actual.

El diagnóstico local separa fases previas a escribir y conserva solo booleanos de
capacidades, hashes comparados, ubicación en código verificado y estados HTTP de
limpieza OAuth, sin errores brutos ni secretos. No añade reintentos, tokens o escrituras.
Node22.23.4: **86 casos correctos**, cero fallos/omisiones; build/lint y sintaxis CJS
correctos. Apps/Firestore sin cambios; no se repiten sus suites.

Evidencias privadas: `2026-10-31-original-writer-live`; recibo canónico
`original-develop-writer-journal/original-writer-20261031-one-attempt`. La capacidad de
escritura sobre el original sigue sin probarse. Siguiente paso: revisar/publicar el
diagnóstico y conciliar explícitamente el bloqueo conservado antes de otro intento
con autorización y ventana nuevas. No borrar ni reutilizar este intento consumido.
Código/documentación nuevos locales tras `b52e75a8`; migración y mantenimiento cerrados.

## Preparación del nuevo intento con diagnóstico — 2026-10-31

Diagnóstico publicado como `930959bd`; las huellas de fuentes coinciden con la
validación de 86 casos/build/lint. La sesión privada
`2026-10-31-original-writer-diagnostic-retry` está inerte, con identificador nuevo y
autorización explícita vinculada a su huella de preparación. No se ha iniciado
sesión del propietario, cambio IAM, token del escritor ni petición a Sheets.

Fijar las huellas de todos los recibos anteriores, conservando el terminal fallido
y su conciliación separada. Solo tras nueva autorización de ejecución, comprobar
que no queda ningún proceso y renovar identidad/ACL del propietario/controles, el
operador podrá renombrar el bloqueo vacío conservado a
`original-develop-reconciled-20261031-one-attempt` en el mismo registro canónico.
Registrar la acción en las nuevas evidencias; no borrar recibos, cambiar la raíz
del registro ni reutilizar el intento consumido. El renombrado **no se ha realizado**.
La sesión nueva rechaza el bloqueo retenido, recibos cambiados e intentos inesperados.

Renovar captura de seis pestañas, revisión del canal del propietario y metadatos/
versión completos; la versión278 es histórica. Usar OAuth del propietario Online
con lectura de metadatos y autorización nueva. Preparar Compartir antes de pedir
otra ventana de diez minutos con la hoja cerrada. Mantener un token de300s, espera
IAM mínima120s, un lote sobre A1 con el mismo valor y reserva para limpieza.
Ante fallo, conservar fase/ubicación precisa y recibos seguros sin reintentar.
Verificar la limpieza de forma independiente. Migración y mantenimiento cerrados.


## Intento con diagnóstico y límite de la carpeta — 2026-10-31

Nueva autorización y ventana de diez minutos del propietario para un único intento.
Antes de empezar se archivó el bloqueo vacío anterior con el nombre revisado;
se conservaron todos sus recibos y el terminal fallido. En la preparación de solo
lectura hubo un fallo de conexión y una colisión de recibos; ambos precedieron al
intento, permisos y token del escritor. Se conservaron los recibos numerados.

Se emitió un token de300s tras esperar al menos120s desde el permiso IAM. La lectura
positiva de Drive pasó. El diagnóstico se detuvo en `writer-metadata-read`, línea57
del proveedor en `930959bd`: `parents` del escritor no coincidía con la carpeta
configurada del propietario. No hubo intención de escritura ni lote. No se retuvo
el valor bruto devuelto: el recibo no permite afirmar si faltaba o tenía otra forma.
La aserción concreta del primer intento sigue desconocida; no equipararla retroactivamente.

El controlador no registra fallos de limpieza: permisos exactos de archivo/IAM
retirados, mismo token todavía válido del escritor404, desactivación explícita y
mismo token OAuth del propietario401. Verificación independiente de identidad y
servicios: cuenta deshabilitada, sin claves de usuario, concesiones ni asignación
a servicios. ACL completa restaurada a propietario y cuatro lectores; carpeta
solo del propietario. Versión280 antes,282 tras los cambios de permisos. Coinciden
exactamente las seis capturas seleccionadas (3286 objetos de celda). Controles
independientes con la misma huella; sin acceso a datos de negocio de Firestore ni escrituras en Sheets,
mantenimiento, migración, FCM ni cambios de producción. Campos OAuth vacíos,
pestaña cerrada y referencias de sesión liberadas. Limpieza correcta libera el
bloqueo activo; ambos intentos siguen consumidos.

Corrección local: admitir únicamente `parents` omitido/vacío del escritor,
conservando comprobación estricta e independiente de carpeta/ACL con el propietario
y rechazo de campos malformados o carpetas visibles diferentes. Combinar archivo,
ACL y capacidades propios del escritor solo con la autoridad de carpeta verificada
del propietario, releyéndola antes de escribir. No se concede acceso a la carpeta.
Corrige un supuesto excesivo; no acredita éxito real. Google documenta restricciones
de visibilidad de padres en su [guía de diferencias de Drive](https://developers.google.com/workspace/drive/api/guides/shared-drives-diffs).
Esa referencia trata unidades compartidas; no es la respuesta capturada de Mi unidad.

Validación: Node22.23.4,93 casos correctos (44 original +49 IAM/copia), cero fallos/
omisiones; build/lint y sintaxis CJS correctos. Casos nuevos: padre omitido/vacío,
malformado/distinto, padre obligatorio del propietario y limpieza. Sin cambios de
apps/Firestore, no se repiten sus suites. Cambios locales tras `930959bd` pendientes
de publicar. Otro ensayo requiere autorización/ventana nuevas, observaciones frescas
y huella de preparación regenerada; no se reintenta en esta ventana.
Evidencia privada: `2026-10-31-original-writer-diagnostic-retry`, recibo canónico
`original-writer-20261031-diagnostic-attempt`.


## Corrección del padre comprobada; discrepancia de capturas contenida — 2026-10-31

La corrección y el resultado anterior están publicados en `44271c22`, con HEAD
remoto exacto verificado. Un nuevo intento autorizado y una ventana de diez minutos
con la hoja cerrada usaron un único token de300 segundos tras la espera IAM mínima
de120 segundos. La vista real del escritor omitió `parents`; pasaron la comprobación
estricta del padre/ACL por el propietario y la comparación de metadatos combinados.
Esta observación corresponde únicamente a este intento.

La siguiente barrera detuvo el ensayo en `baseline-snapshot-comparison`, línea192
del controlador en ese commit. El digest del conector `854e761f…` difiere del digest
de Sheets directo `07c74039…`. No hubo intención de escritura ni lote. Solo se
conservaron los dos digests, no la captura cruda del escritor: el campo distinto y
su causa siguen sin identificarse. No se puede deducir un cambio de contenido ni
una diferencia inocua de representación, ni sustituir la base por el digest del escritor.

Limpieza sin fallos del controlador y verificada independientemente: permisos
exactos de archivo/IAM retirados, cuenta deshabilitada, cero claves de usuario,
concesiones de cuenta o asignaciones de ejecución; mismo token del escritor aún
vigente denegado404 y token del propietario revocado y denegado401. ACL restaurada
a propietario/cuatro lectores y padre solo propietario; versión282 antes y284
después de cambiar permisos. Las seis capturas acotadas del conector coinciden
exactamente antes/después (3286 objetos de celda). Controles técnicos independientes
sin cambios. Campos OAuth vaciados, pestañas cerradas, referencias descartadas y
bloqueo activo liberado; se conservan los tres intentos consumidos y el bloqueo
histórico archivado. Sin escritura de Sheets, mantenimiento, migración, FCM ni
acceso a datos de producción.

Siguiente paso: localizar la diferencia exacta mediante diagnóstico de solo lectura
antes de otro ensayo de escritura. Se conserva la comparación completa de valores,
notas y formatos; todavía no procede normalizar ni ampliar permisos. La escritura
sobre la hoja original sigue sin demostrarse. Otro intento requiere regenerar la
preparación, autorización separada y ventana nueva. Apps y código del controlador/
proveedor sin cambios; este resultado solo actualiza evidencias, plan inerte y tareas.
Evidencias privadas: `2026-10-31-original-writer-owner-parent` y recibo canónico
`original-writer-20261031-owner-parent`.


## Diagnóstico de solo lectura: el conector omite objetos de formato vacíos — 2026-10-31

El resultado del ensayo contenido está publicado en `b890d722`. Después se autorizó
una sesión temporal Online con `spreadsheets.readonly` para la hoja exacta de develop.
Dos GET directos usan los mismos campos y seis rangos acotados del escritor: su JSON
crudo completo coincide y su digest `07c74039…` reproduce exactamente la observación
del escritor del ensayo consumido. Las capturas nuevas del conector antes/después
también coinciden y mantienen el digest `854e761f…`.

La diferencia está completamente localizada: Sheets directo devuelve284 objetos
vacíos de formato que el conector omite, en224 celdas (8 objetos en TORRE2025-26 y
276 en MERCADO2025-26). Son campos `color`/`colorStyle` de bordes y `foregroundColor`
de texto dentro de `userEnteredFormat`. Valores, notas y todos los demás campos
comparados coinciden. El conector también añade `spreadsheetUrl`, ya excluido del
snapshot. Añadir exclusivamente esos284 objetos a una copia local de la captura
del conector reproduce exactamente el JSON directo completo. Esta reconstrucción
solo sirve de diagnóstico: no es un normalizador de producción ni se envió a Sheets.
No se afirma que cualquier formato ausente y vacío sea semánticamente equivalente.

La próxima base debe proceder de un **GET crudo independiente y reciente de Sheets**,
con exactamente los mismos campos/rangos del escritor y conservando los objetos
vacíos. Se mantiene intacta la comparación estricta de digests y se usa el conector
como contraste complementario de contenido. Así se corrige la fidelidad de entrada
sin descartar formatos ni usar la propia observación del escritor para autorizar su
escritura. Esta captura es evidencia, no admisión futura: habrá que renovarla con
los controles y la ventana aprobados entonces. No hace falta cambiar el código del
controlador/proveedor ni introducir normalización de producción.

La revocación OAuth devolvió200; la prueba inmediata con el mismo token en Sheets
seguía devolviendo200 y una comprobación acotada posterior devolvió401. Se conservan
todos los estados. Google documenta que la revocación puede tardar en surtir efecto
en su [guía OAuth](https://developers.google.com/identity/protocols/oauth2/web-server#tokenrevoke).
Campos vaciados, pestaña cerrada y referencias al token descartadas. Sin reactivar
el escritor, modificar IAM/permisos del archivo, escribir en Sheets, abrir
mantenimiento/migración ni acceder a producción. Capturas crudas, diferencias y
recibos privados en `2026-10-31-snapshot-readonly-diagnostic`. Pasan44 pruebas del
plan; no se repiten build ni gates nativos al ser cambios exclusivos de evidencia.


## Preparación con captura cruda independiente — 2026-10-31

El diagnóstico está publicado en `fe08a9e0`. La nueva sesión privada, todavía inerte,
obtiene la base al vincular al propietario, antes de habilitar el escritor, conceder
permisos o emitir su token. El OAuth aprobado necesitará lectura de metadatos y
lectura de Sheets, Online sin renovación. El mismo token independiente realiza dos
GET con los campos/rangos exactos, entre lecturas completas de ACL de archivo/padre
y versión del propietario. Ambas respuestas crudas deben coincidir, conservando
los objetos vacíos. La captura dura menos de60s y tiene menos de10 minutos al iniciar
la ventana de propietario autorizada por separado. Un fallo no deja una base
admisible y obliga a cerrar la sesión del propietario.

Se mantienen los recibos y hashes anteriores, diario canónico, identificador nuevo,
fuentes preparadas, controles y revisión de Compartir. Ninguna captura histórica
se instala como base vigente. No cambian la petición A1 con el mismo valor, el único
token de300s, la espera IAM mínima de120s, el único lote y la limpieza completa.
El comentario del proveedor describe ahora el adaptador de lectura, sin afirmar
que el token no pueda tener otro alcance aprobado también de lectura. No hay cambio
funcional del controlador/proveedor.

Pasan5 casos privados con dobles: preservación cruda, cambios entre lecturas,
denegación HTTP, archivo distinto y captura caducada; cero peticiones reales.
Pasan los44 casos existentes de plan/controlador y las comprobaciones de sintaxis y
diff. No se repiten build ni gates nativos por el cambio público exclusivo de
comentario/evidencia. Falta la nueva autorización: no se ha iniciado OAuth, IAM,
permisos, token del escritor, mantenimiento ni acceso a producción. Siguiente paso:
autorizar el ensayo concreto y ambos alcances de lectura, renovar metadatos/captura/
controles y después pedir la ventana nueva de diez minutos con la hoja cerrada.
Preparación privada: `2026-10-31-original-writer-raw-baseline`. No demuestra todavía
escritura en el original ni admisión de migración.


## Ensayo correcto en el original con captura cruda independiente — 2026-10-31

Preparación publicada en `d6a2dae9`, con HEAD remoto exacto verificado. El mantenedor
autorizó un intento, renovó ambos alcances de lectura Online y confirmó diez minutos
con la hoja cerrada. El primer inicio se rechazó antes de conceder acceso al escritor
porque la captura superaba diez minutos. Se conserva esa evidencia; una sesión privada
sin cambios en `fresh-window` renovó controles, identidad, metadatos completos/versión
del propietario y dos GET crudos dentro de la misma ventana confirmada. Ambas lecturas
coinciden; versión284 y propietario/cuatro lectores intactos. No se relajaron la
vigencia ni la comparación, ni se repitió un intento de escritura fallido.

El recibo canónico `original-writer-20261031-raw-baseline` registra un único token
de300s tras la espera IAM mínima de120s, un lote A1 con el mismo valor y resultado
verificado. La base independiente y las lecturas del escritor antes/después comparten
el digest `07c74039…`. Se conservan valores, notas y formatos de3286 objetos de celda
seleccionados en seis pestañas, sin cambios de fechas ni orden. Las capturas recientes
del conector antes/después también coinciden exactamente, con su representación
separada. Sin normalización. Esto demuestra la petición acotada y el ciclo de acceso
en el archivo original de develop; no equivale a migración ni publicación completa.

Limpieza sin fallos del controlador: retirados los permisos exactos de archivo/IAM,
el mismo token del escritor aún vigente devuelve404 y el OAuth del propietario,
revocado, devuelve401 en la consulta de metadatos con el mismo token. Lecturas
independientes confirman cuenta deshabilitada, cero claves de usuario, concesiones
en la cuenta y asignaciones de ejecución. ACL completa restaurada al propietario
y cuatro lectores; carpeta solo del propietario. Versión Drive284→287 y digest de
controles técnicos intacto. Campos OAuth vaciados, pestañas cerradas, referencias a
tokens descartadas y bloqueo del diario liberado, conservando todos los recibos
anteriores. Sin mantenimiento, escrituras de negocio Firestore, FCM ni producción.
Evidencia privada: `2026-10-31-original-writer-raw-baseline/fresh-window`.

Siguiente paso: incorporar este resultado del destino original al paquete de admisión
controlada de develop y regenerar sus vínculos actuales de versión/ACL/fuentes/controles.
La admisión sigue cerrada: este éxito histórico no concede permisos futuros, autoridad,
fuentes de negocio vigentes ni ventana de mantenimiento del propietario/administradores.
Cambios locales solo de resultado tras `d6a2dae9`; pasan44 pruebas acotadas. No se
repiten build ni gates nativos por ser documentación/evidencia inerte; sin brecha nativa.
