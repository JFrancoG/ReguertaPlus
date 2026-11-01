# HU-084 — Preparación de permisos y ventana de develop

Estado: **solo preparación; sin fecha ni autorización de ejecución**. La evidencia
del escritor original y su integración en admisión están publicadas en `d42ce7fe`.
Este plan no concede acceso, abre mantenimiento, migra datos ni activa las apps.


## Recibos de recuperación incorporados a la preparación de admisión — 2026-11-01

La documentación del resultado está commiteada y pusheada como `82029bf8`. El código
nuevo revisa autorización, fuentes exactas, intención inversa, lectura íntegra,
marcadores/conservación, única emisión, tiempos y limpieza independiente. Reutiliza
paquete, materializador e inspección de admisión; no añade otro ejecutor ni cliente
real. El manifiesto fija la huella de la evidencia. Rechaza contenido alterado,
accesos residuales, fuentes distintas o tiempos incoherentes; el éxito histórico
no acredita permisos ni controles actuales.

Paquete privado: `2026-11-01-helper-recovery-admission`. Huella de evidencia terminada
en `247e0f75b4d41`, paquete de revisión
`fc6baf6f6a5502a2376f117151c10eccc18423a1818fc78bf4e97e4ec55db4ee`, preparación
`50a4e1bc48d27cb9e1e7800bf31b9c21bbb601c7c4452ccd3c9ba7c196e06471`.
Regeneración sin conexión sobre fuentes conservadas: política, cambios de ida/inversa,
identidades de operación y antigüedad de las observaciones originales sin cambios.
Se mantienen `canApply:false` y `canEnterMaintenance:false`.

La primera regeneración rechazó correctamente las pruebas antiguas de diez filas
y A1 original: su vínculo abarca todos los bytes src/lib del backend, anteriores
a la corrección del validador de marcadores. Sus archivos, huellas y paquete previo
se conservan en `retained-prior-evidence-private.json`, indexado junto al paquete nuevo.
**No se certifican de nuevo para el código actual** ni se sustituyen sus huellas.
La evidencia compatible con la ejecución actual es la recuperación de 53 celdas.
Queda pendiente revisar la compatibilidad histórica de esas fuentes; la copia
sintética no acredita permisos de la hoja original ni controles actuales.

### Revisión de tiempos y controles pendientes

| Fase | Recibo real de recuperación | Límite o evidencia pendiente |
| --- | --- | --- |
| Propagación IAM | 122.346ms, antes del token | Mínimo120s / máximo180s actuales, sin ampliación implícita |
| Inversa verificada | 142.992ms desde el arranque | Solo inversa; no mide ida y vuelta juntas |
| Ejecución y limpieza | 194.571ms | Incluye IAM y OAuth; sumar otros intentos no prueba una sola ventana |
| Limpieza OAuth | 42.288ms | El proveedor admite hasta120s; una lectura anterior necesitó unos89s |
| Token del escritor | Una solicitud de300s | Antes de cada lote deben quedar más de150s de token y ventana |
| Barrera, lecturas frescas, Firestore y Sheets | Sin medida real conjunta | Emulador/dobles no acreditan latencias de Google |

**Hallazgo:** los120s reservados no garantizan el peor caso de toda la limpieza.
Solo OAuth puede consumir120s, además de retirada/lectura del permiso, denegación
con el token aún válido, retirada IAM, desactivación/lectura de identidad e inventario.
El control previo de150s (30s de petición +120s de reserva) no demuestra que todo ello
quepa. No se han ampliado tiempos, alcance del token ni concesiones.

Siguiente bloque agrupado: revisar la compatibilidad histórica y fijar un presupuesto
de tiempo de extremo a extremo, separando la denegación del token del escritor,
OAuth del propietario y el fin de la ventana. Ensayar localmente lentitud, fallos y
ciclo de dos lotes antes de pedir otro ensayo real en copia. Mantener un solo token
y detener antes de escribir si no queda margen. El mantenimiento original necesitará
después observaciones frescas, admisión y una ventana autorizada por separado.

Validación: build/lint, lint CJS focalizado y **152 pruebas**, sin fallos ni omisiones;
21 casos nuevos generan recibos con ejecutor/adaptador reales y proveedores en memoria.
La evidencia real retenida pasa la revisión sin conexión; se rechazan alteraciones,
segunda emisión, limpieza incompleta y tiempos falsos. Sin nuevas llamadas a Google,
IAM, Sheets, Firestore ni producción; sin cambios nativos ni diferencia de paridad.
Integración local, sin commit. No se repiten los emuladores de migración sin cambios.

## Inversa autorizada completada y accesos retirados — 2026-11-01

El ejecutor está commiteado y pusheado como `a2a0b963`; rama, remoto y PR #278 en
borrador coinciden. Tras la autorización expresa y una nueva ventana de diez minutos
con la copia cerrada, un único lote restauró **53 celdas de ayudantes** y actualizó
**dos marcadores existentes** en `HU-084 — ENSAYO LOTE COMPLETO — 20261101-full-batch`.
No se reenvió la ida. La lectura completa del propietario y una comprobación independiente
sin conexión de los recibos confirman conservación de fechas, nombres, orden, notas,
fórmulas, formato y estructura. Los dos marcadores quedan como recibos de la inversa;
los metadatos no son idénticos byte a byte al original. Versión previa revisada **14**;
versión de la lectura posterior al lote **16**.

Se esperaron **122.346ms** de propagación IAM antes del único token de **300s**.
La inversa quedó verificada a los **142.992ms**; ejecución y limpieza duraron **194.571ms**.
Se retiró el permiso creado y el mismo token del escritor todavía válido recibió **404**.
La lectura independiente confirma cuenta deshabilitada, sin concesiones IAM temporales
ni claves de usuario. OAuth quedó denegado en Drive y Sheets tras la limpieza
(**42.288ms**); se liberó el bloqueo local y se detuvo el servidor privado de ejecución.
No hubo fallos de ejecución ni de limpieza. La revisión visual confirma los ayudantes
restaurados en las dos pestañas afectadas y acceso privado del propietario; la prueba
de conservación completa procede de la captura íntegra, no solo de las imágenes.

Evidencia privada: `2026-11-01-copy-inverse-execution`, con autorización consumida,
confirmación de ventana, intención/lectura inversa, comprobaciones independientes,
resultado final y capturas visuales. La solicitud de preparación se conserva como
plantilla histórica sin autorizar; la autorización real está en un recibo separado.
No se accedió a hojas originales, mantenimiento compartido, Firestore de negocio,
despliegues, FCM ni producción. Sin cambios nativos ni diferencias de paridad.

Queda probada la recuperación tras la ida interrumpida, pero **no** el ciclo real de
ida/vuelta sin interrupciones ni los tiempos conjuntos de mantenimiento. El siguiente
paso es incorporar estos recibos a la preparación de admisión de develop y revisar
esos controles de tiempo pendientes antes de proponer otra ejecución. La autorización
está consumida (`canRetry:false`, `canEnterMaintenance:false`). Se reutilizan build/lint
y las 133 pruebas aprobadas del código exacto publicado: esta actualización solo cambia
documentación. HU-084/HU-085 siguen abiertas y PR #278 en borrador. Los documentos del
resultado quedan locales, sin commit.

## Preparación histórica de la recuperación mediante inversa — 2026-11-01

La corrección y la conciliación anteriores están commiteadas y pusheadas como
`eae86a89` y `61fe86e9`, con HEAD remoto comprobado. Esta nueva preparación es local
posterior a esa entrega. Aquí no se ha ejecutado ninguna operación de Google, IAM o Sheets.

`prepareCopyRecovery` reutiliza el ejecutor de copia y el adaptador de Sheets.
Comprueba la preparación consumida, la petición/manifiesto de ida, su limpieza final
y la imagen completa conservada. Regenera la receta con el código actual y mantiene
la identidad histórica del código como evidencia. Rechaza cambios en la receta,
limpieza incompleta, marcadores incorrectos o cambios ajenos de celdas/formato.
El paquete vincula código actual, peticiones exactas, imagen y versión revisada.

La versión revisada de esta copia es **14**. El único lote inverso incluye
**53 restauraciones de ayudantes y dos actualizaciones de marcadores existentes**
(55 peticiones). Conserva fechas, orden, nombres, notas, fórmulas y formato; los dos
marcadores permanecen como constancia de la inversa. El modo nuevo no ejecuta la ida
y el transporte concreto permite como máximo un intento.

La ejecución exige nueva autorización explícita de la inversa y una confirmación
separada de diez minutos del propietario. Antes de permisos se releen acceso exclusivo
del propietario, imagen, versión, identidad deshabilitada y aislamiento de ejecución.
Cualquier diferencia detiene para conciliar. Tras conceder acceso se comprueba otra
vez la imagen antes del único token de 300s, con espera IAM mínima de 120s y margen
de 150s para envío/limpieza antes de escribir. Se verifica el lote/manifiesto exacto y
se guarda la lectura completa antes de validarla. La incertidumbre detiene sin repetir.
Se retira el permiso creado, se prueba denegación con el mismo token todavía válido,
se retira solo la condición IAM propia, se deshabilita/relee la cuenta y se revoca
OAuth comprobando las dos APIs. No se reutilizan permisos ni ventanas anteriores.

Se ejecutará en un proceso Node nuevo, sin módulos antiguos en caché. El paquete
privado `2026-11-01-copy-inverse-preparation` contiene el plan exacto y una solicitud
de ejecución **sin autorizar**, sin credenciales. El ensayo local, con la red bloqueada,
aplica la inversa a la imagen real guardada, simula pérdida de respuesta, verifica
lectura/restauración y limpieza con dobles. Cero llamadas a Google; no restaura la copia real.

Validación: build/lint, sintaxis/diff y **133 pruebas focalizadas**, sin fallos ni omisiones,
más el ensayo sin conexión sobre la captura real. Nueve casos nuevos cubren alcance
solo inversa, recibos consumidos, cambios antes/después de permisos, versión/marcadores,
resultado incierto y límite de un intento. Sin cambios nativos ni diferencia de paridad.
Las nueve pruebas anteriores de emulador Firestore no cambian y no se repiten para
esta preparación exclusiva de Sheets. En ese momento seguían pendientes la inversa
real, el ciclo sin interrupciones, mantenimiento y activación. La ejecución posterior
y sus límites figuran arriba; este registro no autoriza otra ejecución.

## Ciclo completo de permisos en copia sintética — 2026-11-01

El bloque de lecturas/lote está publicado como `a2ba5dfa`. La nueva composición
explícita reutiliza proveedor y comprobaciones IAM, espera mínima de 120s, un único
token de 300s, adaptador Sheets y manifiesto de conservación. Prepara 53 ayudantes
ficticios de reparto en seis pestañas de una nueva copia de la plantilla sintética;
no copia datos personales de develop. Los dos identificadores de hojas originales
están prohibidos en los transportes de propietario y escritor antes de acceder a red.

La autorización consumida y un bloqueo local exclusivo vinculan código, copia,
imagen inicial, operaciones y ventana confirmada de diez minutos como máximo.
El operador habilita solo la cuenta dedicada existente, concede IAM condicionado y
Editor solo de la copia, y espera antes de la única emisión. Dos lotes como máximo
aplican y revierten 53 valores F y dos marcadores. Cada lote verifica identidad,
inventario de ejecución aislado, imagen/versión completa del propietario y margen
de 150s justo antes de enviar. Las respuestas perdidas se comprueban por lectura;
la incertidumbre detiene sin inversa ni reenvío automático. La inversa forma parte
de la receta autorizada y solo sigue a una ida verificada.

La limpieza intenta por separado retirar el permiso creado en la copia, demostrar
su denegación con el mismo token todavía válido, retirar la condición IAM propia,
deshabilitar explícitamente y releer la identidad, y revocar la única sesión OAuth
del propietario. Exige denegación tanto en Drive como en Sheets; no renueva OAuth en
cada observación. Un fallo de limpieza conserva el bloqueo y el recibo de inspección.
Un cierre abrupto exige conciliar las intenciones guardadas; no se garantiza finally.

La copia se prepara antes de confirmar los diez minutos, con una sesión Online
`drive.file` del propietario. El controlador limita ese permiso a la plantilla sintética
existente y la copia nueva. La preparación permite inicializar únicamente la copia;
la plantilla se conserva. La ventana se confirma por separado antes de permisos IAM
o de archivo. El ejecutor no tiene operaciones reales de Firestore, mantenimiento,
despliegue o avisos. El emulador anterior cubre la migración conjunta; este ensayo
mide por separado el ciclo real de copia y permisos.

Las pruebas locales cubren ida/vuelta, fallos al habilitar/conceder/emitir/escribir/limpiar,
agotamiento del tiempo tras la ida, límites de token/lotes, pérdida de respuesta al
compartir, destinos prohibidos, normalización completa e inventario incompleto.
La comprobación real de solo lectura encuentra la cuenta deshabilitada, sin claves
ni concesiones temporales y sin asignación en el inventario global revisado de
Functions/Cloud Run.

### Intento real autorizado y parada contenida

Se inicializó la copia de seis pestañas y se comprobó su imagen completa, con solo
el propietario de pruebas. La sesión del propietario caducó mientras se esperaba la
respuesta: la admisión rechazó antes de IAM o del token del escritor. Se renovó el
mismo permiso Online y se confirmó una nueva ventana explícita de diez minutos.
El intento autorizado esperó **121.616ms** desde la concesión IAM, emitió **un token
de 300s** y envió el lote de 53 ayudantes y dos marcadores. La lectura del adaptador
pasó, pero la observación/conservación completa posterior del propietario rechazó
en la línea 121 registrada de la fase de ida. No se envió la inversa.
`completedBatches: 0` indica cero lotes con conservación completamente verificada,
no cero escrituras. La copia conserva los datos de ida; no está restaurada ni se debe
repetir el envío. La revisión visual posterior confirma ayudantes visibles y acceso
privado del propietario, pero no demuestra la conservación completa de la captura.

La limpieza terminó correctamente: permiso de la copia retirado, **404 con el mismo
token del escritor todavía válido**, condición IAM retirada y cuenta deshabilitada,
con comprobación independiente de cero concesiones e inventario revisado sin uso.
OAuth se revocó; Drive denegó inmediatamente y Sheets tras **41.937ms**, usando el
mismo token. El intento duró **197.363ms**, incluida la limpieza. Se liberó el bloqueo
local, se cerraron transportes y se limpiaron los campos y pestañas del navegador.
Sin hojas originales, escrituras reales de Firestore, mantenimiento, despliegue,
FCM ni acceso a producción.

La lectura del propietario no se guardaba antes de validar su conservación, por lo
que no se puede reconstruir la diferencia exacta de este intento. Una regresión local
reproduce el rechazo del campo de solo lectura `locationType: SHEET` que Google
incluye en los metadatos nuevos. La corrección acepta solo ese tipo derivado para
el marcador y la hoja exactos; sigue rechazando otros tipos, ubicaciones, valores,
visibilidad, campos adicionales y cambios de metadatos ya existentes. Se ajusta al
[contrato de ubicación de metadatos de Google](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets.developerMetadata#DeveloperMetadataLocation).
Es un defecto demostrado del validador, no prueba de que fuera la única diferencia
real. El ejecutor guarda ahora la lectura completa antes de comprobarla; una prueba
de rechazo demuestra que no lanza inversa y sí limpia. El doble de ida/vuelta ya
incluye el tipo derivado de Google.

Validación tras la corrección local: build/lint, sintaxis/diff, **124 pruebas
focalizadas y 9 de emulador** correctas, sin fallos ni omisiones. La regresión fallaba
antes del arreglo. Una ejecución intermedia coincidió con un build y rechazó dos
comprobaciones ligadas al código; la suite completa pasó con el build ya estable.
Sin cambios nativos ni diferencia de paridad. Implementación nueva local tras `a2ba5dfa`.

### Conciliación de solo lectura de la copia conservada

La inspección autorizada del propietario capturó las seis cuadrículas completas con
versión de Drive **14** estable y únicamente el propietario de pruebas en los permisos.
El validador corregido acepta la captura sin modificarla contra el manifiesto de
conservación de ida; el adaptador verifica además los 53 ayudantes y los dos marcadores.
El validador anterior rechaza esta misma captura y la acepta al quitar únicamente los
dos campos derivados `locationType: SHEET`. Queda aislada la diferencia en la respuesta
real actual; la captura histórica posterior al envío sigue sin estar disponible.

El primer inspector privado falló antes de guardar la captura porque la sesión Node
persistente conservaba un módulo anterior sin `normalizePreservationSnapshot`.
La lectura de diagnóstico, con el mismo alcance autorizado, guardó cada respuesta;
un proceso Node nuevo verificó esas respuestas y el manifiesto original sin conexión.
Ambas sesiones quedaron revocadas y denegadas en Drive/Sheets (62.399ms y 63.176ms).
No se activó el escritor, concedió IAM, emitió token de servicio ni escribió en Sheets.
Se limpiaron los campos OAuth y se cerró la pestaña. La captura completa ya está
conservada: las comparaciones siguientes no necesitan otra sesión de Google.

Siguiente paso: preparar una recuperación explícita de esta copia mediante la inversa,
con comprobaciones actuales, permisos y ventana del escritor autorizados por separado.
No reenviar la ida. La inversa real y un ciclo completo sin interrupciones siguen
pendientes; esta lectura correcta no reabre el intento consumido ni admite mantenimiento.
Evidencia privada: `2026-11-01-helper-copy-lifecycle`, incluidas respuestas de Google,
imagen normalizada, comparación de validadores y los dos recibos de limpieza.
Esta inspección no cambia ejecutables del repositorio; siguen vigentes build/lint y
las 124 pruebas focalizadas + 9 de emulador anteriores; se repite la revisión del diff.

## Observaciones de Google y ensayo conjunto del lote — 2026-11-01

El bloque de barrera persistente está commiteado y pusheado como `9ed3a9ef`, con HEAD
remoto exacto comprobado. Los lectores, materializador y pruebas siguientes son locales
posteriores a ese commit. Reutilizan el adaptador de Sheets, el manifiesto de conservación
y los contratos de barrera/transacción de Firestore; no añaden otro registro ni CLI real.

`develop-google-observations.cjs` lee la hoja y carpeta fijas de develop con credenciales
explícitas. Compara dos capturas de las cuadrículas completas (valores, formatos escritos,
notas, tramos de texto, validaciones, protecciones, celdas combinadas y metadatos de operación)
y las dos capturas anteriores A1:Z100/Y100. Su proyección acotada debe coincidir con el
paquete revisado. Las listas vacías omitidas por Google se normalizan únicamente para
esa máscara completa; se conservan la captura original y los objetos vacíos de celda/formato.
El lector comprueba también las 24 Functions revisadas, tres jobs pausados, Rules, IAM del
proyecto y del invocador de inspección. Esto no aporta el inventario de ejecución/claves,
la conciliación actual de fuentes/efectos ni los compromisos humanos de la ventana.

La sesión de lectura autorizada observó la versión **287**, propietario y cuatro lectores,
sin permiso del escritor y sin cambios en los controles revisados. Muestras medidas:
captura del propietario **8.460ms**, lecturas Cloud **1.022ms**, limpieza OAuth **62.263ms**.
La revocación devolvió 200; Drive denegó el mismo token inmediatamente, pero Sheets devolvió
200 en seis consultas mínimas antes del 401. No se renovó ni solicitó otro token. Se revocó
el acceso, limpiaron los campos y cerró Playground. Son tiempos individuales de lectura y
limpieza, no una garantía del tiempo conjunto ni prueba de denegación al escritor.
Este bloque no cambió IAM, permisos del archivo ni celdas de Google.

`prepare-develop-helper-batch.cjs` materializa exactamente **53 cambios en F y dos
marcadores** mediante el adaptador existente. El identificador de ida usa el prefijo
`request-` existente de Firestore; la inversa usa su identificador revisado. Vincula paquete,
captura, versión, imágenes previas, notas conservadas y hash de peticiones. La inversa
verifica primero la imagen completa esperada. Rechaza fórmulas/protecciones gestionadas,
cambios en celdas publicadas, revisión alterada, cambios lejanos o marcadores incorrectos.
El control exclusivamente temporal exige más de **150s** antes de caducar token y ventana:
30s de petición del adaptador y 120s reservados para limpieza. No concede autoridad,
renueva credenciales ni amplía plazos implícitamente.

El ensayo conjunto usa las cuadrículas recién capturadas y el paquete retenido con
**transacciones del emulador Firestore y un doble de la API de Sheets con estado**.
Pasan adquisición/admisión persistente, 203/140 escrituras de documentos y 55/55 peticiones
Sheets, pérdida de respuesta y comprobación del resultado sin reenvío. Restaura los 62
originales y los datos de las celdas observadas, conserva 117 avisos y versiones de guardas.
Solo quedan actualizados los dos marcadores técnicos previstos. Cierran las 44 sesiones
simuladas. Si caduca el tiempo o se interrumpe después de Firestore y antes de enviar Sheets,
queda el recibo, Sheets no cambia y no se ejecuta inversa ni reintento automático.
Esto no convierte las dos plataformas en una transacción atómica.

Build/lint y comprobaciones de sintaxis/diff pasan: **247 pruebas focalizadas +68 de
emulador**, sin fallos ni omisiones. Evidencia privada: `2026-11-01-google-batch-integration`,
con capturas originales/normalizadas, consultas de revocación y
`joint-results/joint-sheets-roundtrip.json`. Se conserva el diagnóstico inicial de
normalización de marcadores; no se ejecutó ni falló una escritura real. Sin cambios
nativos ni diferencia de paridad entre plataformas.

Siguiente bloque pendiente: componer estos lectores con las observaciones restantes de
autoridad, fuentes/riesgo y participantes; dar a la credencial del propietario un único
ciclo de vida por ventana (no una autorización/revocación OAuth por cada lectura de la
barrera); vincular la concesión/retirada existente del escritor a este lote exacto y ensayar
los tiempos conjuntos en un destino aislado revisado explícitamente. Los ejecutores A1
y de diez turnos conservan sus límites; no se reutilizan silenciosamente para este lote.
Sus permisos anteriores no son concesiones vigentes. El ciclo real del lote completo,
la retirada del acceso del escritor y sus tiempos **no quedan probados por el emulador**.
Después, renovar/congelar el paquete y solicitar permisos/ventana concretos cuando pasen
esos controles. Sin mantenimiento, producción, FCM ni despliegue. Ahora no hace falta
cerrar la hoja ni realizar ninguna acción.


## Recursos y participantes exactos

La única hoja es `1O7VKs7S4wZHVvTfNBehAd5EzF3Mgw2q9LweK68Gm76A`,
«Regüerta — DEVELOP — Turnos de prueba», propiedad de la cuenta de pruebas. El
operador separado es la cuenta administradora de Firebase existente. El inventario
IAM conservado contiene dos identidades humanas Owner. El mantenedor confirma que
ambas cuentas son suyas y solo las utiliza él; por ello no hay otro administrador
al que contactar. Las identidades y confirmación quedan en evidencia privada. Esto
no constituye un compromiso para la futura ventana y hay que renovar el inventario IAM.

El alcance futuro es el paquete existente de migración inicial de develop y su
reversión, no activar el reparto anual. Se conservan fechas/orden publicados,
los 117 avisos y los 62 documentos originales al revertir. Se mantiene la clasificación
de efectos históricos de ADR-0026; no se reenvían avisos ni se convierten contadores
desconocidos en cero.

## Permisos que preparar, sin concederlos

| Recurso | Acción propuesta para una ejecución autorizada aparte | Evidencia de retirada |
| --- | --- | --- |
| Observaciones del propietario | Online `drive.metadata.readonly` y `spreadsheets.readonly`, sin renovación; metadatos de hoja/carpeta fijas y dos lecturas directas de seis zonas | Revocar OAuth, negativa con el mismo token, limpiar campos y referencias en memoria |
| Hoja original | Editor directo para `reguerta-develop-sheets-writer` solo en esta hoja; conservar propietario/cuatro lectores y ACL de la carpeta | Retirar el permiso exacto recién añadido; releer ACL completa y comprobar denegación con token del escritor aún válido |
| Identidad del escritor | Reactivar la cuenta de servicio existente exacta; sin claves, roles de proyecto ni asignación a servicios | Desactivar explícitamente y releer identidad, políticas y asignaciones de forma independiente |
| IAM del escritor | `roles/iam.workloadIdentityUser` condicionado para el operador exacto, solo sobre esa cuenta de servicio | Retirar el miembro/condición propios exactos conservando entradas ajenas |
| Firestore | Autoridad existente del operador, limitada por el ejecutor al alcance revisado de develop; sin nuevos permisos IAM | Comprobaciones atómicas de fuentes/versiones/manifiestos, recibos de ida/vuelta y controles cerrados |

IAM permite técnicamente más que la restricción de archivo. La autoridad Owner de
Firestore también excede develop; el límite depende de los adaptadores revisados y
del acuerdo administrativo aceptado, no de una supuesta restricción IAM por entorno.
No se reutiliza la autorización del ensayo del escritor ya terminado.

El ciclo probado del escritor admite como máximo 600s de IAM condicionado, espera
mínima 120s, un token 300s y 120s reservados para limpiar. Son **límites del ensayo**,
no prueba de que toda la secuencia de mantenimiento/migración quepa en ese tiempo.
No se amplían ni se solicita otro token implícitamente.

## Orden concreto antes de fijar la hora

1. Renovar las observaciones del propietario; comparar dos capturas directas exactas
   con la referencia conservada. Vincular versión, ACL completa y carpeta actuales
   al paquete. Mantener separadas las edades de Firestore/controles: estas lecturas
   del propietario no las renuevan.
2. Conectar las observaciones actuales de los proveedores a `controlled-develop-barrier.cjs`.
   La adquisición persistente y su conexión a admisión superan el ensayo local descrito
   abajo; todavía no se han ejercitado juntos los proveedores y una ventana real.
   `controlled-develop-migration.cjs` solo consume una barrera ya adquirida;
   su inspección pasiva rechaza la ausencia de ventana.
3. Ensayar el ciclo conjunto de proveedores/escritor y sus tiempos. El paquete exacto
   regenerado de ida/vuelta ya supera la adquisición persistente local, incluidas
   interrupciones y limpieza de sesiones de lectura. Revisar aparte el lote original:
   escribir el mismo valor en A1 demuestra acceso, no las 53 celdas de ayudantes y dos
   marcadores técnicos. No reutilizar para la original el ejecutor limitado a copias.
4. Renovar controles técnicos, censo y vínculos del riesgo causal conservado; verificar
   autoridad exacta del escritor/Firestore e igualdad de las mutaciones de negocio.
   Fijar paquete, identificadores, participantes y acciones de permisos resultantes.
   Una diferencia exige revisión, no sustitución silenciosa.
5. Presentar una autorización de ejecución que cubra esas acciones concretas y su
   recuperación. Solo entonces recoger los compromisos de propietario/operador/todos
   los administradores con inicio, fin y límite de recuperación explícitos. Ahora
   no hace falta cerrar la hoja para el trabajo de lectura.
6. Dentro de la ventana autorizada aparte, adquirir/releer la barrera, comprobar
   admisión y ejecutar únicamente el manifiesto correspondiente mientras esté vigente.
   Un alcance cambiado o caducado detiene el avance. Una escritura incierta se
   concilia con sus recibos; nunca se reintenta a ciegas ni se reenvían avisos o reabre develop.
7. Completar recuperación/limpieza aprobadas, verificar fechas/orden originales y
   retirada exacta de accesos, conservar recibos y dejar cerrados los controles
   operativos. La activación será una decisión posterior separada.

La propuesta anterior de 20 minutos de trabajo y 20 de recuperación sigue siendo una
**reserva provisional**, no una ventana ejecutable cronometrada. Inicio, fin, límite
de recuperación, confirmaciones y autorización quedan sin completar hasta validar
la composición y sus tiempos. Este documento no puede rellenarlos por sí mismo.

## Ensayo de adquisición persistente — 2026-10-31

`controlled-develop-barrier.cjs` conecta el repositorio Firestore de evidencias/fallos
y el adaptador administrativo existentes con el ejecutor controlado de migración.
Fija proyecto, entorno develop, política cerrada, huella del paquete, versión de la
hoja, identidades de ida/vuelta y vínculos del riesgo histórico. Las lecturas de
fuentes/versiones rodean la primera captura de evidencia. Las relecturas técnicas,
del propietario y de administradores comprueban el mismo alcance; la evidencia es
inmutable. No añade otro registro, despliegue, escritura de estado de mantenimiento
ni operación de reapertura.

La adquisición solo escribe los registros de evidencia/incidencia existentes. Al
reconstruir la composición, el comprobante se lee de Firestore, no de la memoria del
proceso. Una clave con evidencia conservada solo admite inspección, sin repetir
automáticamente la adquisición. La inspección histórica no concede admisión ni
renueva un acuerdo caducado. La admisión y la transacción de negocio siguen exigiendo
comprobaciones actuales independientes y CAS. El registro acredita controles ya
cerrados; no constituye un nuevo cerrojo distribuido.

Las sesiones de observación son dependencias confiables explícitas. Toda sesión
abierta alcanza `close`, incluso ante fallo de lectura o cancelación. Quien abre debe
limpiar una apertura parcial antes de rechazar; una limpieza no comprobada impide
adquirir. Cancelar antes de conservar evidencia no escribe nada. La respuesta perdida
y la cancelación posterior, incluidas las últimas comprobaciones humanas, conservan
una incidencia si aún puede acreditarse el cierre de forma independiente. Si falla
esa prueba o el registro, se rechaza sin afirmar que el cierre quedó documentado.
La última lectura administrativa marca el límite de cancelación; una posterior no
deshace una adquisición terminada. Un cierre abrupto del proceso no garantiza ejecutar
`finally`: hay que inspeccionar la evidencia y conciliar los recursos reales antes
de continuar con otra operación autorizada.

La validación usa el SDK/repositorio Firestore real contra el emulador local, con
**dobles de prueba para observaciones de Google/proveedores y limpieza de sesiones**.
No demuestra permisos reales, revocación OAuth, controles actuales de Google ni
tiempos conjuntos. La factoría prevista para develop exige Firestore, sesiones
confiables y reloj explícitos; no incorpora credenciales ni CLI de ejecución real.
Los compromisos del ensayo son sintéticos; nunca se presentan como consentimiento real.

Build/lint correctos; 166 pruebas focalizadas y 65 de emulador, sin fallos/omisiones.
Quince casos nuevos cubren adquisición/reconstrucción, ida/vuelta, interrupciones,
fallos de limpieza, caducidad, cambios de fuentes/controles y rechazo de otro paquete.
El paquete regenerado realiza 203/140 escrituras locales, restaura 62 originales y
conserva los 117 avisos y las versiones de los documentos protegidos. Evidencia privada:
`2026-10-31-durable-barrier-acquisition`. Código/pruebas nuevos locales tras `9e724da4`.
Sin cambios nativos ni diferencia entre plataformas. Sin mantenimiento real,
producción, Sheets, FCM ni despliegue.

## Límite de las evidencias actuales

Preparación privada: `2026-10-31-owner-window-preparation`; base publicada:
`2026-10-31-original-admission-binding`. El mantenedor autorizó los dos permisos de
lectura y confirmó el control exclusivo de ambas cuentas Owner de Firebase. Estas
respuestas no constituyen el compromiso para una ventana futura.

Observación del propietario a 2026-10-31T20:11:55.064Z: versión 287 estable en las
lecturas de metadatos que rodean dos capturas directas de Sheets; ACL completa de
propietario/cuatro lectores, carpeta Mi unidad solo del propietario y sin acceso del
escritor. Ambas respuestas son iguales entre sí y a la referencia directa conservada,
incluidos 3286 objetos de celda seleccionados, valores tipados, notas y formatos.
Se conservan los objetos vacíos de formato que omitía el conector. No se cambió
ningún permiso del archivo ni contenido.

OAuth se revocó correctamente y Drive devolvió 401 inmediatamente. La consulta mínima
adicional a Sheets devolvió 200 inicialmente; la comprobación acotada con el mismo
token devolvió 401 unos 89 segundos después de la revocación registrada. Se conservan
las observaciones intermedias, sin afirmar una denegación inmediata uniforme. No se
solicitó renovación ni un segundo token. Campos de Playground vacíos comprobados,
pestaña cerrada y referencias al token descartadas tras la negativa final.

El manifiesto incorpora estas observaciones nuevas. El paquete de revisión
`4b140ae7fb447fd3cc40c488d713f5021a0e2b352d5dbf6eaff32185c4488a52` y la preparación
`a8686633ddafb3962523816fe5172818bb1fb6c42638d800cf1141bfd4dec496` regeneran los
identificadores porque cambian las huellas de procedencia. La política de fuentes y
todos los campos exactos de las mutaciones de negocio siguen iguales. Una comparación
inicial de sobres completos rechazó correctamente las evidencias/identificadores
nuevos; la comprobación final separa los campos de negocio y conserva el diagnóstico.
No se modificó ningún validador de ejecución.

Las fuentes Firestore, controles técnicos y evidencias causales históricas siguen
expresamente conservados del paquete anterior; esta lectura del propietario no los
renueva. El plan identifica el nuevo paquete y sus operaciones, sin inicio, fin,
confirmaciones ni autorización de ejecución. Una ejecución posterior deberá renovar
las observaciones otra vez.

Bloque anterior de renovación del propietario: build y 50 pruebas de emulador correctas, sin fallos/omisiones, con el
paquete regenerado; 203 escrituras de ida/140 de vuelta, 62 originales restaurados y
117 avisos conservados. Coinciden las ocho huellas de código/pruebas aceptadas; se
reutilizan las 146 pruebas focalizadas y lint. Sintaxis privada y diff correctos. Este bloque solo cambia documentación y preparación privada,
sin cambios nativos ni diferencia entre plataformas. Mantenimiento y aplicación
siguen en falso.
