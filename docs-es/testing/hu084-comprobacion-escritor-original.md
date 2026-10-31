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
