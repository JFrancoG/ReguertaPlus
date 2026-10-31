# HU-084 — Comprobación del escritor sobre develop original

Estado: ejecutor preparado y probado localmente, **sin autorización ni ejecución real**.
La preparación anterior de propietario/controles está publicada en `ac24e5ce`; este
ejecutor es local. Comprueba permisos; no admite migración ni abre mantenimiento.

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
Las identidades de las seis pestañas y las capturas acotadas `A1:Z100` de valores
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
