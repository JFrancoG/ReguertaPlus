# HU-084: controles reversibles de escritores de develop

> **Política vigente — 2026-10-28:** [ADR-0021](../decisions/0021-usar-mantenimiento-acordado-con-el-propietario-en-hojas-de-turnos.md)
> acepta un compromiso acotado de no editar del propietario identificado, en vez
> de retirarle técnicamente esa capacidad manual. Los demás controles de
> escritores, entrega, vaciado y notificaciones, y `canApply:false`, siguen intactos.
> Los resultados históricos y límites del cierre físico descritos abajo conservan
> su validez; faltan la implementación y la autorización real.

Estado: **preparación histórica con inventario actualizado — `canApply:false`**.
La captura original descrita abajo es anterior a los cuatro colectores y seis
actualizaciones del puente. Su resultado real está en la [guía de relevo del backend](hu084-relevo-backend.md).
Las Rules de clientes ya están aplicadas y verificadas con la prueba Auth/documento
real autorizada. La autoridad de servidor conserva sus condiciones separadas;
`closeAndCollect` no ha admitido mantenimiento compartido. ADR-0022 acepta aparte
la cooperación de administradores humanos solo en develop; siguen siendo necesarios
su contrato versionado, confirmaciones vigentes y todos los controles de automatismos.

[English version](../../docs/testing/hu084-develop-writer-controls.md).

Continuación del 2026-10-28: pasa el [ensayo de pausa selectiva y del mecanismo
en copia aislada](hu084-pausa-selectiva-develop.md), incluido el bloqueo real de
la copia, su reversión y la limpieza. No aplica estos controles sobre develop.

Los cuatro puntos prácticos son:

1. Las fechas y el orden de participantes publicados se conservan. Preparamos cómo
   detener los cambios con seguridad; todavía no migramos ni regeneramos turnos.
2. El cambio de reglas de Firestore preparado detiene **todas las escrituras de las
   apps de develop**, incluidos usuarios y pedidos. Se mantiene la lectura.
   Producción conserva el comportamiento de las reglas observadas, aunque su
   despliegue compartido necesitaría una revisión posterior.
3. Varios servicios del servidor también atienden a producción. Detenerlos o quitar
   permisos a sus cuentas compartidas afectaría a producción. Falta resolver cómo
   pausarlos únicamente para develop.
4. El propietario de la Sheet de develop conserva el control del archivo. Podemos
   estudiar un bloqueo del contenido y ensayarlo en una copia nueva, si sus
   capacidades lo permiten. Todavía no es un control disponible y mantenido para
   la migración.

## Alcance y autoridad

Este trabajo continúa HU-084 (#268) y las garantías de activación de HU-085 (#269).
Prepara controles para `develop` dentro del proyecto Firebase compartido existente.
No autoriza despliegues, cambios de IAM o permisos de Drive, bloquear contenido,
transferir propiedad, entrar en mantenimiento, migrar, reabrir ni escribir en
producción.

Se conservan las 72 fechas publicadas, 108 puestos ordenados y 62 turnos heredados
en bruto. Las 53 sugerencias de ayudantes siguen sin aplicar y no se generan las
fechas de mercado que faltan en julio/agosto de 2027. Los controles no cambian la
disponibilidad del planificador ni inicializan coberturas. Las identidades, los
identificadores de permisos y de la Sheet, y las respuestas originales de los
proveedores permanecen en evidencias restringidas fuera de Git.

La autoridad es el inventario compilado
[`hu082-affected-writers-v4`](../../functions/src/shift-planning-writer-inventory.ts):
esquema 1, **29 escritores lógicos**, con 23 controles de barrera de entrada y seis
revalidaciones de versión para la equidad. El número de Functions no equivale al
de escritores. La inspección privada es de lectura y no añade un escritor.

El inventario compilado v4 describe los escritores lógicos del código; todavía
no reconcilia toda la autoridad desplegada. Sus cuatro IDs públicos de clientes
no cubren implícitamente la escritura sobre privados de planificación/coberturas
admitida por el catch-all actual. El candidato más amplio sí la cierra, pero
antes de admitir una barrera habrá que reconciliar ese grupo y sus destinos con
la revisión/huella aceptada del inventario. La cooperación expresa del propietario
añade un participante: 30 escritores y 24 controles de entrada. V4 incorpora los
tres jobs de recordatorios del domingo omitidos en V3; cada uno exige cerrar su
entrada y conciliar por separado trabajo pendiente/en curso antes de capturar el
conjunto causal. Recalcular una evidencia V3 sin ellos no admite una transición
nueva. Los jobs reales siguen habilitados y solo resuelven develop; configurarlos
para producción cambiaría su comportamiento.

## Evidencias actuales y sus límites

La captura de controles de solo lectura del **27 de octubre de 2026** registra:

- 20 Functions activas: los 19 servicios anteriores y el inspector privado con
  identidad propia.
- `syncShiftsFromGoogleSheets` y `exportShiftsToGoogleSheets` están desplegados como
  servicios HTTP, con permisos `roles/run.invoker` de Cloud Run. El IAM de invocación
  no demuestra que estén cerradas las escrituras de develop ni que hayan terminado
  las llamadas en curso.
- Cuatro filtros relevantes de Firestore usan `{env}`:
  `shiftPlanningRequests/{requestId}`, `shifts/{shiftId}`,
  `deliveryCalendar/{weekKey}` y `notificationEvents/{eventId}`, bajo
  `{env}/plus-collections`. Sus servicios se comparten con producción.
- Las dos cuentas de servicio con permisos visibles de escritura en el archivo de
  develop están activas y tienen cero claves gestionadas por usuarios. La cuenta
  de Compute tiene `roles/editor`, `roles/eventarc.eventReceiver` y
  `roles/run.invoker` en el proyecto. La otra tiene
  `roles/firebase.sdkAdminServiceAgent`, `roles/firebaseauth.admin`,
  `roles/storage.admin` y `roles/iam.serviceAccountTokenCreator`. Son autoridades
  amplias y compartidas; no tener claves no implica ausencia de ejecuciones,
  tokens o permisos efectivos de escritura.
- El conector del propietario muestra un propietario, dos cuentas de servicio
  editoras y el inspector lector. Omite los identificadores de permisos y los
  detalles de herencia. No permite preparar aún un cambio de ACL completo y
  ejecutable ni demostrar que no existe otra autoridad.

Las **63 pruebas correctas** del inspector, su lectura de las seis pestañas y la
versión de Drive **259** antes/después son evidencias conservadas. **No se han
renovado** en esta preparación. El permiso temporal para crear OIDC sigue retirado;
no se ha vuelto a conceder para actualizar esas observaciones. La versión 259 no
puede usarse como condición actual para aplicar cambios. La captura nueva observa
metadatos; no es un punto de control de mantenimiento, una nueva base completa de
la Sheet ni una prueba de que han terminado las entregas pendientes.

## Auditoría de la fuente desplegada exacta

Se revisaron las seis entradas antiguas desde su procedencia GCS con generación
inmutable, sin deducir su comportamiento de esta rama:
`syncShiftsFromGoogleSheets`, `exportShiftsToGoogleSheets`,
`onShiftPlanningRequestCreated`, `onShiftWritten`,
`onDeliveryCalendarOverrideWritten` y `onNotificationEventCreated`.
Los seis archivos tienen el mismo contenido: 152.987 bytes, SHA-256
`07cd231c91df1e7bd31ab6a9f6a711559536aca3e7de697e641628d6c8216b49`.
El paquete ejecuta `lib/index.js`; se comprobó ese JS y su fuente TS. Las fuentes,
revisiones, referencias de generación y huellas por declaración quedan privadas.

Ninguno de esos manejadores contiene pausa de develop, comprobación de
mantenimiento/época/revisión activa ni control de llamadas en curso antes de sus
efectos. La planificación reemplaza la Sheet de temporada, guarda turnos y crea
trabajo de notificación; las rutas de turnos/calendario también tienen efectos
externos. El envío de notificaciones ocurre antes de registrar el resultado y
carece de registro causal/idempotente de envíos.
La configuración de Sheets recurre a una clave genérica si falta la específica
del entorno: eliminar parámetros de develop no es una pausa segura. La rama
local actual difiere de esa fuente desplegada.

El puente compatible que pause solo develop debe diseñarse y ensayarse sobre esa
base exacta antes de cambiar revisiones compartidas. `DO_NOT_RETRY`, concurrencia
uno y un timeout de 60 segundos no demuestran por sí solos finalización causal
ni reapertura segura. La auditoría aporta procedencia, no un cierre efectivo ni
autorización de despliegue.

## Candidato preparado de Firestore

[`firestore.develop-writer-controls.rules`](../../firestore.develop-writer-controls.rules)
deriva de las reglas desplegadas capturadas, no de la política estricta más amplia
del repositorio. La base exacta capturada tiene **6.712 bytes** y este SHA-256:

```text
bb87cdacc63dc4e285ac24d50b8f2f8c64eff3def1e4fcf24265030059591dfa
```

Añade `env != "develop"` a cada permiso de escritura aplicable. Detiene las altas,
modificaciones y borrados de clientes de develop, incluidas las colecciones
heredadas, las colecciones privadas de planificación/coberturas, pedidos, usuarios
y configuración. Conserva las lecturas, la excepción anónima de configuración
pública y los permisos de producción. Añadir otra coincidencia que deniegue no
anularía un permiso concedido por una coincidencia existente.

La pausa amplia de develop evita dejar colecciones privadas abiertas mediante el
permiso genérico observado. Es un control temporal de clientes; los escritores con
Admin SDK/IAM no pasan por estas reglas. El emulador no demuestra comportamiento
en un móvil físico ni en producción.

La configuración aislada
[`firebase.develop-writer-controls-emulator.json`](../../firebase.develop-writer-controls-emulator.json)
y la [suite local de reglas](../../functions/test/firestore/develop-writer-controls.rules.test.cjs)
comparan la base exacta, el candidato y su restitución anterior a cualquier
escritura usando datos sintéticos. Los 12 casos pasan sin fallos ni omisiones:
verifican el cierre de escrituras de develop, las lecturas y la paridad de
producción, la conservación de imágenes publicadas y época, y que el acceso
privilegiado del servidor queda fuera de esta barrera. El ensayo aceptado compara
imágenes reales del emulador; no usa el retorno de callbacks como capturas.
La configuración de emulador no es una vía de despliegue.

También se leyó la release actual de Firestore y su ruleset previo inmutable
mediante la API de Rules: su fuente coincide con la base fijada. Sus referencias
quedan en el paquete privado. Restituir esa referencia exige mantener el control
de publicación y comprobar el estado posterior propio durante todo el intervalo;
una secuencia de lectura/comparación/actualización no garantiza exclusión.

## Estado previo y condiciones de reversión

Cada control futuro debe vincular el recurso exacto, el estado anterior capturado,
el estado posterior esperado, el responsable de la operación, la hora de
observación, la huella y la acción de restitución. Un valor anterior desconocido
bloquea la acción; nunca se sustituye por un valor vacío. Los códigos siguientes
se aplican a la matriz y no autorizan ejecutar nada.

| Código | Estado previo necesario | Condición de reversión y límite actual |
| --- | --- | --- |
| R | Fuente y publicación exactas de las reglas desplegadas, y estado posterior completo del propio candidato | Restituir las reglas permisivas anteriores solo antes de cualquier escritura autoritativa de negocio, cambio de época o incertidumbre, y si las reglas actuales aún coinciden con el estado posterior de esta operación. En otro caso, mantener la barrera y usar recuperación gobernada. |
| H | Fuente/revisión HTTP desplegadas, identidad de ejecución, entrada y política IAM exactas | Falta preparar la admisión exclusiva de develop. Su reversión debe conservar producción y coincidir con el estado posterior propio; cerrar globalmente el servicio o IAM compartido queda fuera de alcance. |
| T | Fuente/revisión, filtro de eventos, entrega y trabajo causal exactos del disparador desplegado | No están demostradas la pausa selectiva de develop ni la finalización de sus trabajos. Borrar/recrear disparadores o vencer arrendamientos no demuestra una pausa reversible segura; hay que resolver pérdida, repetición e incertidumbre retenida. |
| N | Identificadores causales de notificaciones, estado de trabajo y contrato de entrega exactos | Aislar solo la entrega causada por los turnos incluidos en el manifiesto. No detener todas las notificaciones de producción. Un disparador genérico activo no demuestra el cierre de entregas de turnos. |
| A | IAM efectivo, accesos heredados/condicionales, procedencia de tokens/ejecuciones y todas las entradas de servidor relevantes | Las reglas no cierran Admin. No revocar roles ni credenciales de cuentas compartidas para develop. La falta de visibilidad de herencia, delegaciones o ejecuciones sigue bloqueando. |
| W | Ubicación exacta del archivo de develop, capacidades del propietario, restricciones/ACL anteriores completas, versión estable y huella del contenido | El control del archivo es solo un candidato. Restituir únicamente el estado posterior exacto de la restricción/ACL propia y con el contenido aún vinculado; un dato desconocido o una variación detiene la reversión. Falta resolver el desbloqueo del propietario y la transición sin intervalo abierto. |
| V | Fuente/versión del candidato de activación, proyecciones de equidad capturadas y autoridad del planificador vinculada | Revalidar la versión de activación y las entradas reales. No se propone desactivar/reactivar globalmente; las comprobaciones locales no demuestran que las implemente el código antiguo desplegado. |

Tras cualquier escritura/migración autoritativa, avance de época o envío incierto,
**los controles permanecen cerrados**. Se usa la operación inversa gobernada y la
recuperación que respeta la época. Restituir un control antes de escribir no es
revertir una migración; nunca se recupera disponibilidad abriendo las reglas
permisivas antiguas sin cumplir esas condiciones.

## Situación exacta de los 26 escritores

«No observado» significa que esta captura no acredita una implementación
desplegada. No equivale a un control `disabled`, a una cola vacía ni a ausencia de
autoridad aceptados. Cada trabajador lógico debe vincularse a la ejecución
exportada real cuando se identifique.

| ID del escritor | Superficie actual y alcance preparado | Estado previo/reversión | Bloqueador o evidencia necesaria |
| --- | --- | --- | --- |
| `firestore-client-shifts` | Reglas compartidas; el candidato deniega escrituras de clientes de develop | R | Solo candidato local; no hay cierre desplegado |
| `firestore-client-delivery-calendar` | Reglas compartidas; el candidato deniega escrituras de clientes de develop | R | Igual; no cierra al servidor |
| `firestore-client-shift-planning-requests` | Reglas compartidas; el candidato deniega escrituras de clientes de develop | R | Igual; aún hay que resolver causalmente las peticiones antiguas admitidas |
| `firestore-client-shift-swap-requests` | Reglas compartidas; el candidato deniega escrituras de clientes de develop | R | Igual; falta inspeccionar transiciones retenidas |
| `https-sync-shifts-from-google-sheets` | `syncShiftsFromGoogleSheets` desplegada; HTTP/IAM compartidos | H | Sin puente selectivo de develop ni finalización de llamadas demostrados |
| `https-export-shifts-to-google-sheets` | `exportShiftsToGoogleSheets` desplegada; HTTP/IAM compartidos | H, W | Sin puente selectivo; el bloqueo de la Sheet también impide exportaciones gobernadas |
| `https-transition-shift-swap` | No se ha observado una implementación desplegada | H | Acreditar despliegue, admisión y trabajo reales; ausencia no equivale a cierre |
| `https-shift-coverage` | No se ha observado una implementación desplegada; la disponibilidad local sigue desactivada | H | La disponibilidad del candidato no demuestra el cierre real |
| `worker-shift-coverage-effects` | Trabajador en código; sin Function desplegada independiente observada | T, W, N | Identificar su ejecución y demostrar finalización o retención segura del trabajo admitido |
| `worker-shift-coverage-push` | Trabajador en código; sin Function desplegada independiente observada | T, N | Igual; no inventar un interruptor de Function |
| `trigger-on-shift-planning-request-created` | `onShiftPlanningRequestCreated` desplegada, `{env}` compartido | T | Fuente auditada sin guarda de develop; finalización causal aún no demostrada |
| `trigger-on-versioned-shift-planning-request-created` | No se ha observado una implementación desplegada | T | El candidato no certifica el código compartido antiguo |
| `trigger-on-shift-written` | `onShiftWritten` desplegada, `{env}` compartido | T, W, N | Pausa exclusiva de exportaciones/notificaciones de develop sin demostrar |
| `trigger-on-delivery-calendar-override-written` | `onDeliveryCalendarOverrideWritten` desplegada, `{env}` compartido | T, W | Pausa exclusiva de develop y finalización de escrituras de la Sheet sin demostrar |
| `trigger-on-notification-event-created` | `onNotificationEventCreated` desplegada, `{env}` compartido | N | Aislamiento causal pendiente; se excluye detener todas las notificaciones |
| `firestore-client-membership-fairness` | El candidato también deniega usuarios de develop; sigue siendo necesaria la revalidación de equidad | R, V | Cerrar clientes no certifica escrituras de servidor ni la versión de activación |
| `firestore-client-planning-config` | El candidato también deniega configuración de develop; sigue siendo necesaria su revalidación | R, V | Igual; se conserva la lectura pública |
| `https-resolve-authorized-member` | Entrada compartida de socios desplegada | V, A | Revalidar proyección/versión de equidad en la activación real |
| `https-upsert-member-by-admin` | Entrada compartida de administración desplegada | V, A | Igual; no se propone cierre global |
| `https-clone-global-config` | Entrada compartida de configuración desplegada | V, A | Igual; no se propone cierre global |
| `https-config-maintenance-writers` | Validadores y disparadores compartidos de productos/envases/medidas/usuarios/pedidos | V, A | Comprobar fuente/proyección reales; las entregas ajenas de producción siguen activas |
| `iam-firestore-admin-and-server-writers` | Admin/IAM compartidos, consola, tareas, CI y otras ejecuciones | A | Los roles amplios no se limitan a rutas; no está demostrada su barrera |
| `workbook-human-and-offline-editors` | Propietario/editores del archivo de develop y cambios sin conexión pendientes | W | La ACL no degrada al propietario de Mi unidad; falta probar capacidades y control sin intervalo abierto |
| `workbook-apps-script-and-addons` | Scripts vinculados/independientes, disparadores y complementos | W | El mantenedor declara solo la app y las acciones de aquí; los disparadores de otras cuentas pueden ser invisibles |
| `workbook-api-oauth-and-service-accounts` | Dos cuentas de servicio editoras activas visibles y posibles clientes OAuth | W, A | Faltan identificadores/herencia de permisos; el cambio limitado al archivo no está listo |
| `workbook-shared-drive-and-admin-authority` | Ubicación, grupos/dominio transitivos, delegación y vías de administración | W, A | Los campos omitidos por el conector no demuestran ausencia |

## Ensayo condicionado del bloqueo de contenido

Drive documenta `contentRestrictions.readOnly` y `ownerRestricted`: pueden impedir
cambios de scripts/complementos, pero el propietario puede retirarlos. No crean
inmutabilidad ni congelan cálculos con datos externos. Establecer una restricción
sobrescribe la anterior. Véase [restricciones de contenido de Drive](https://developers.google.com/workspace/drive/api/guides/content-restrictions).

Solo se prepara un **ensayo autorizado expresamente sobre una copia nueva**,
después de verificar que sea una Google Sheet, `ownedByMe`, tenga las capacidades
necesarias para restricciones del propietario y no tenga restricciones previas.
Primero deben funcionar las escrituras de prueba del propietario y de la cuenta
de servicio editora con los mismos principales y vías usados después del bloqueo.
Se restituyen las celdas de prueba a su valor base y se capturan versión, estado
anterior completo de restricciones y huella del contenido. Una cuenta de servicio
sin acceso de escritura a la copia nueva no permite demostrar que deniega el
bloqueo de contenido.

Se usarían `readOnly:true`, `ownerRestricted:true` y un motivo único de operación.
Se captura la restricción posterior completa, incluidos autor/hora devueltos, y
se comprueba la capacidad efectiva de desbloqueo del propietario. Ambas escrituras
de prueba deben denegarse sin quitar el bloqueo, los datos deben seguir intactos y
también debe denegarse que la cuenta de servicio lo retire. Solo se restituye si
la restricción actual completa coincide con el estado posterior propio capturado
y la huella del contenido sigue coincidiendo; cualquier diferencia obliga a parar.
Nunca enviar un `readOnly:false` genérico con una restricción anterior desconocida.
Tras retirar solo el bloqueo propio, se comprueba que ambas vías de escritura
vuelven a funcionar, se restituyen las celdas de prueba y se compara la huella
final del contenido.

El bloqueo global de contenido también impide escribir al backend candidato: no
hay excepción para su ejecución. Superar el ensayo en copia tampoco demostraría
que esté controlada la capacidad de desbloqueo del propietario ni una transición
mantenida y sin huecos hacia el escritor gobernado exclusivo. No se compra
Workspace, transfiere propiedad ni mueve el archivo real automáticamente. Si el
candidato no puede cumplir la barrera mantenida de HU-085, se presenta la decisión
separada de traslado/transferencia y se ensaya sin sustituir el archivo/enlace
original. Los [roles](https://developers.google.com/workspace/drive/api/guides/ref-roles)
y las [reglas de transferencia de propiedad](https://developers.google.com/workspace/drive/api/guides/transfer-file)
de Drive deben contrastarse con las capacidades reales de las cuentas.

Cerrar el navegador o confirmar «no tengo cambios pendientes sin conexión» aporta
evidencia, pero no cierra técnicamente al propietario. Los disparadores instalables
de Apps Script actúan con la autoridad de quien los creó y no todos son visibles
desde otra cuenta; una lista vacía de una cuenta no demuestra que no existan.
Véase [disparadores instalables](https://developers.google.com/apps-script/guides/triggers/installable).

## Siguiente grupo finito y dependencia del usuario

1. Conservar el resultado aceptado de los 12 casos de reglas y renovar las
   observaciones exactas antes de cualquier aplicación posterior. Durante la
   preparación se conservan los controles reales y `canApply:false`.
2. Usar la **fuente y revisión exactas desplegadas**, ya auditadas, para diseñar
   y ensayar un puente compatible exclusivo de develop. Debe conservar la ruta
   de producción y controlar efectos admitidos/en curso y su finalización; no
   basta comprobar una bandera al entrar. Copiar la implementación más amplia
   de la rama actual no demuestra equivalencia con producción.
3. El mantenedor confirma que no conoce Apps Script, complementos, tareas
   programadas ni escritores externos aparte de la app y las acciones de aquí.
   Se registra como declaración operativa, no como exclusión técnica de todos
   los escritores. Preparar el ensayo en copia nueva cuando haya capacidades y
   autorización suficientes.

Esta preparación no requiere más acciones manuales. Cualquier ensayo posterior
en copia o aplicación real de controles se presentará
con alcance exacto y condiciones de restitución para autorización separada. Esta
preparación no necesita otro controlador genérico de múltiples servicios.

El [adaptador de barrera existente](../../functions/src/shift-planning-trusted-intake-barrier-adapter.ts)
exige cierre duradero tanto al terminar bien **como al fallar**, con lectura de
comprobación inicial/final y evidencia causal de finalización. Una lista de
controles propuestos no cumple ese contrato. No conectar este documento ni el
resultado del emulador a `closeAndCollect`, restablecer el permiso OIDC del inspector
ni declarar admitida la migración antes de demostrar esas condiciones reales.

## Escritores efectivos de la hoja develop y autoridad automática — 2026-10-29

La conciliación anterior está entregada como
`713c09020b46d0317399a1dd3fb0d60f8e952286`, comprobado contra el remoto.
Esta inspección nueva es de solo lectura. No interpreta los anteriores permisos
desconocidos del inspector como lista vacía: los metadatos Drive desde el acceso
conectado del propietario devuelven ahora permisos y canShare=true de la hoja exacta.

| Clase de cuenta observada | Permiso en hoja | Capacidad actual relevante |
| --- | --- | --- |
| Propietario humano identificado | owner | Conserva capacidad bajo ADR-0021; sin acuerdo de ventana vigente. |
| Cuenta Compute predeterminada | writer | Ejecuta23 de24 Functions, incluidas rutas compartidas de producción; Editor del proyecto y receptor Eventarc/invocador Run. |
| Cuenta Firebase Admin SDK | writer | No ejecuta ninguna de las24 Functions; conserva roles SDK-admin/datos, Auth, Storage y Token Creator del proyecto. No figurar en las Functions no significa que esté sin uso. |
| Inspector dedicado | reader | No se observa permiso de escritura en la hoja. |

La hoja está directamente en Mi unidad; el padre muestra solo al propietario.
La lista devuelta contiene un propietario, dos editores y un lector, sin entradas
de grupo/dominio/públicas. El conector omite IDs de permisos y detalles de herencia:
antes de modificar hay que obtener registros exactos restaurables. No se han leído
ni cambiado permisos de la hoja de producción.

### Identidades automáticas y ámbito de cargas

- Las24 fuentes inmutables e identidades/revisiones de Functions coinciden con el
  despliegue verificado de recordatorios. Los24 servicios Cloud Run de europe-west1
  corresponden a esas Functions; no se observa allí otro servicio ni Run Job.
  Los tres jobs Scheduler siguen PAUSED.
- No hay triggers Cloud Build en global/europe-west1 ni servicios App Engine.
  El inventario Compute devuelve403 SERVICE_DISABLED: no es una lista vacía de
  máquinas. No se ha habilitado esa API.
- No aparecen claves USER_MANAGED en las dos cuentas editoras, el runtime de turnos
  preparado ni la cuenta App Engine. No se descargaron claves, emitieron tokens de
  esas cuentas, suplantaron identidades ni cambiaron permisos. Refrescar la sesión
  OAuth ya configurada no concede una nueva credencial de cuenta de servicio.
- Las lecturas POST correctas de getIamPolicy muestran cero asignaciones directas
  en esas cuatro cuentas. Los GET404 iniciales fueron errores de protocolo, no
  evidencia de permisos ausentes. Los roles de proyecto conservan capacidades de
  suplantación/despliegue/datos para humanos y agentes gestionados. En particular,
  SDK conserva Token Creator del proyecto: cero claves propias no implica cero
  autoridad automática.
- Dos Owners humanos del proyecto quedan identificados en la evidencia privada
  para el acuerdo posterior ADR-0022. Esta captura no devuelve grupos ni padre de
  organización/carpeta. No equivale a un inventario de tokens emitidos.

El adaptador Sheets original usa GoogleAuth/ADC. La identidad compartida en ejecución
y su permiso de edición de develop importan independientemente de las Rules de
Firestore. No se afirma cobertura de cargas Run de otras regiones, clientes externos,
tokens existentes o delegaciones OAuth del propietario. Las operaciones anteriores
siguen siendo una comprobación separada.

### Plan reversible concreto de permisos (preparado, sin aplicar)

Solo en **la hoja exacta de develop**, pasar de writer a reader los dos permisos de
cuentas de servicio identificados; conservar propietario, inspector, carpeta, permisos
de producción y todos los roles/estados de las cuentas del proyecto. Así no se revoca
una identidad compartida con producción. Se restringe la escritura directa bajo
ambas identidades con independencia de quién obtenga su token; no se revoca autoridad
Firestore ni se prueba la terminación de llamadas externas anteriores.

Antes de aplicar, releer ACL exacta con IDs, guardar originales, rechazar nuevos
escritores/herencia y fijar autorización/recuperación. Después verificar los dos
lectores y las entradas intactas; restaurar exactamente los dos roles writer cuando
lo requiera la recuperación aprobada. No conceder un nuevo escritor backend en esta
operación de dos permisos. El cambio por sí solo no admite mantenimiento/migración
ni sustituye acuerdos nuevos, política de fuentes y evidencia de operaciones antiguas.
Esta auditoría no autoriza modificaciones.

Evidencia privada en `2026-10-29-writer-authority`: permisos de hoja/padre, roles,
metadatos de claves, cargas acotadas, comparación de fuentes y plan de permisos con
cuentas exactas. La documentación pública omite IDs de permisos/hoja y correos humanos.
Sin cambios de aplicación: bastan comprobaciones de diff/paridad documental, sin
repetir builds nativos o emuladores. Documentación nueva local tras el commit entregado.
Mantener legacyUntracked y mantenimiento/migración NOT_READY.

Releer la ACL modificada no demuestra por sí solo que el bloqueo ya se haya
propagado: hay que verificar su aplicación efectiva antes de usarlo para admitir mantenimiento.

### Registros exactos obtenidos; cambio de roles solo preparado — 2026-10-29

La auditoría anterior está commiteada/pusheada en `048497d2`; este seguimiento es local.
Tras autorización expresa, una sesión Online de OAuth Playground solicitó únicamente
`drive.metadata.readonly`. Dos GET `permissions.list` de Google Drive devolvieron200
para la hoja exacta de develop y su padre, sin nextPageToken. La evidencia privada
conserva semánticamente el JSON mostrado, no un archivo HTTP idéntico byte a byte.

Los dos permisos objetivo son user/writer, sin baja ni transferencia pendiente,
con concesión directa (`inherited:false`) e identificadores capturados. El inspector
es lector directo. El propietario tiene propiedad directa **y un detalle writer
heredado**; el padre contiene solo ese mismo propietario. Conservar ambos detalles:
no constituyen otro escritor ajeno al propietario. No se devuelve expirationTime.

El plan privado fija exactamente dos PATCH que cambian solo el rol y su recuperación
al writer original, ligados a los IDs observados de archivo/permiso. Aplicar en serie,
comparando toda la ACL actual antes de cada cambio y releyéndola después: Google no
admite modificaciones concurrentes de permisos sobre un archivo. Ante resultado
incierto o éxito de solo un cambio, inspeccionar y conservar el estado parcial; nunca
reintentar ni restaurar a ciegas. La recuperación requiere condición autorizada y
registros ajenos intactos. Véase [Drive permissions.update](https://developers.google.com/workspace/drive/api/reference/rest/v3/permissions/update).

Se mantienen `authorized:false` y `canApply:false`. El permiso OAuth de lectura no
puede aplicar estos cambios; la ejecución posterior requiere acceso de escritura
autorizado aparte o la interfaz Compartir del propietario. Sin cambios de permisos
o contenido de la hoja, IAM, producción ni mantenimiento. Esta preparación solo
documental no requiere builds ni nuevas pruebas de software; comprobar manifiesto
y diff bilingüe.

Limpieza verificada: no se emitió refresh token; se retiró la conexión temporal de
Playground y el mismo token devolvió401 UNAUTHENTICATED/invalid_token en el mismo GET
del padre. Se vaciaron código/tokens y se reinició Playground. Pasan la comprobación
del manifiesto de dos objetivos y el diff documental. No hace falta acción del usuario
hasta autorizar por separado el cambio real de roles y su recuperación.

### Bloqueo por lectores aplicado y probado en develop — 2026-10-29

La preparación de permisos exactos está entregada en `25ed6f63`. El mantenedor
autorizó por separado los dos cambios exclusivos de develop y su recuperación
condicionada, y después la prueba acotada de identidades. El propietario cambió
primero Compute y después Firebase Admin SDK desde Compartir. Las ACL completas
actuales de la API coincidían con los originales antes del primer cambio y con
el estado intermedio esperado de un lector/un editor antes del segundo. No se
recrearon permisos; se conservaron propietario, inspector y carpeta padre.

Ambas identidades superaron el control positivo aún como editoras: el mismo
`spreadsheets.batchUpdate` reenvió el literal existente **Fecha** a A1 de la hoja
de reparto actual, con máscara limitada a `userEnteredValue`. Tras los cambios,
los dos tokens originales aún válidos mantuvieron GET200, mostraron
`canEdit:false` y recibieron403 PERMISSION_DENIED para ese mismo lote válido.
Son negativas de escritura autenticadas, no credenciales caducadas ni peticiones
incorrectas. Los seis rangos A1:Z200, con 742 valores poblados, coinciden antes/después,
incluidas fechas y orden publicados. Las escrituras del mismo valor y los cambios de
ACL avanzan metadatos Drive: no afirmar modifiedTime/version o historial intactos.

La lectura final desde el propietario confirma un propietario y tres lectores en
la misma hoja; la carpeta conserva solo al propietario. Enumerar la ACL completa se deniega a la cuenta de servicio
tras pasar a lector; la comprobación final del propietario aporta las cuatro entradas
normalizadas, no nuevos campos de herencia crudos. Las ACL previas completas y las
acciones dirigidas de la interfaz conservan la trazabilidad. No hizo falta recuperar;
mantener ambas cuentas como lectoras. La recuperación se limita a sus dos roles writer
originales y exige nueva comprobación de cambios ajenos.

El flujo IAM autorizado aparte usó concesiones condicionales de
`roles/iam.workloadIdentityUser` sobre cada cuenta, todas sujetas al límite original
de diez minutos. La propagación IAM provocó intentos denegados y un intento incompleto
con dos cuentas; cada intento retiró sus concesiones exactas. Se emitieron tres tokens
Drive de cinco minutos en total (dos Compute, uno SDK); el anterior se descartó de
memoria, sin guardar credenciales. Las concesiones del par exitoso se retiraron antes
de cambiar la hoja, preservando las demás entradas. El `testIamPermissions` posterior
no devuelve getAccessToken para ninguna cuenta. Sin claves, concesiones de proyecto,
lecturas/escrituras de producción, cambios de Functions ni envíos FCM.

Evidencia privada: `2026-10-29-develop-reader-fence` conserva manifiestos/ACL exactas,
capturas de742 valores, resultados positivos/negativos, retirada de concesiones,
metadatos sin credenciales y hashes de fuentes. Sin cambios de código/apps; las
comprobaciones operativas y documentales sustituyen builds ajenos a este alcance.
Se prueban nuevas escrituras bajo esas dos identidades, no la terminación de llamadas
externas ya enviadas, todos los escritores OAuth del propietario ni la admisión del
mantenimiento. Mantener controles de operaciones antiguas/fuentes/ventana y NOT_READY.

Limpieza final de credenciales: ambos tokens exitosos caducaron y el GET de la misma
hoja devolvió401 UNAUTHENTICATED para cada uno. Se descartaron y se cerró el proceso
local; los metadatos del token anterior indican caducidad previa. Las dos políticas
vacías originales están restauradas. Pasan las comprobaciones de evidencia operativa
y diff bilingüe; este seguimiento sigue local tras `25ed6f63`.


### Bloqueo integrado en la preparación del mantenimiento — 2026-10-29

El bloqueo efectivo de las dos cuentas está commiteado y pusheado en `e6d02cc2`.
El nuevo script local `functions/scripts/prepare-develop-fenced-maintenance.cjs`
une las pruebas positivas/negativas revisadas y la limpieza de credenciales con los
roles de archivo/carpeta y dos censos de Firestore validados. No tiene SDK, red,
mutaciones ni admisión. Rechaza pruebas incompletas o inválidas, credenciales
caducadas usadas como denegaciones de permiso, valores cambiados, escritores
restaurados/heredados y observaciones fuera de orden. Si cambia el censo, exige
revisar la conciliación. Si coincide, conserva desconocidas las operaciones
pendientes/en curso, `legacyUntracked:true` y la prohibición de reenvío.
El resultado solo prepara: `NOT_READY`, `startAt:null`, sin controles de escritores
ni declaración de drenaje. La barrera de ejecución no lo acepta como evidencia.

Lecturas posteriores al bloqueo: las24 configuraciones de Functions coinciden con
la referencia revisada tras actualizar recordatorios; los tres jobs siguen PAUSED.
Se conservan183 fuentes (62 turnos,4 calendarios,117 avisos),12 eventos y16 entregas.
Las cinco rutas de autoridad inicial siguen ausentes. Los 742 valores tipados de
los seis rangos coinciden con la conciliación anterior; no se alteraron fechas ni
orden. Los permisos normalizados siguen mostrando las dos cuentas y el inspector
como lectores y al mismo propietario; la carpeta solo muestra al propietario.

**Límite de metadatos:** dos lecturas del conector devuelven modifiedTime
`2026-10-29T17:47:48.221Z`, anterior al `2026-10-29T17:48:31.491Z` observado por la
prueba directa, y omiten la versión solicitada. La preparación señala la discrepancia;
la hora de la consulta y la coincidencia de celdas no renuevan la evidencia de
versión ni la prueba. No inventar una versión actual ni pedir otra suplantación
solo para rellenar ese campo.

Antes de proponer una hora de inicio:

1. Resolver la terminación o el aislamiento efectivo de llamadas externas anteriores,
   separado de los117 avisos conservados (105 fuera de la retención de logs).
   No reenviarlos ni repetir búsquedas fuera de la retención.
2. Completar los accesos automáticos, incluidos OAuth/delegación del propietario y
   otros accesos de servidor; las dos cuentas no representan a todo el grupo.
3. Obtener una versión/contenido actual coherente y renovar los controles completos,
   fuentes y evidencia causal. Conservar los lectores; no reabrir escrituras al abortar.
4. Vincular los acuerdos del propietario y los dos administradores de Firebase a esa
   evidencia y después proponer la ventana acotada, sus comprobaciones y recuperación.

El paquete privado `2026-10-29-fence-window-integration` conserva los recibos
originales, tiempos, huellas, comparaciones y condiciones pendientes explícitas.
`npm run test:shift-planning:fenced-maintenance` pasa114 pruebas (19 nuevas);
build/lint de Functions correctos. Node comprueba el CJS y las pruebas lo ejecutan;
el ESLint del repositorio cubre JS/TS, no CJS. Esta integración no despliega, concede
IAM, escribe datos/Sheets, envía FCM ni accede a datos de producción. Ambas apps y
su aceptación previa siguen iguales. Código/docs nuevos locales sin commit después
de `e6d02cc2`; mantenimiento y migración siguen cerrados.


### Aislamiento de ejecuciones antiguas y OAuth del propietario — 2026-10-29

La preparación anterior está commiteada/pusheada en `9f01bae8`. La inspección de
solo lectura enumera las revisiones de los24 servicios Cloud Run revisados: las288
anteriores indican `Active/CONDITION_FAILED/RETIRED`. Cada servicio dirige el100%
a la revisión actual revisada, sin etiquetas de tráfico. Generaciones, tráfico y
revisiones creadas/listas coinciden antes y después de cada enumeración acotada.
No se ha eliminado, detenido ni desplegado ninguna revisión o servicio.

La preparación existente incorpora `inspectDevelopRetiredRuntimes`: rechaza
servicios/revisiones ausentes o duplicados, destinos no revisados, rutas etiquetadas,
cambios durante la lectura, generaciones no observadas, revisiones reconciliándose
y errores genéricos/timeouts utilizados como si fueran retirada. El paquete real
pasa. Esto cierra la ejecución en esos contenedores retirados; no prueba el resultado
de peticiones ya enviadas a Sheets/FCM, revoca credenciales ni cierra otros escritores.
Los contadores siguen desconocidos, legacyUntracked permanece true y no se admite
mantenimiento. Google define RETIRED como infraestructura retirada para esa revisión:
[ciclo de revisiones](https://docs.cloud.google.com/run/docs/managing/revisions).
Un timeout de Sheets a los180 segundos no es un recibo de éxito/reversión y no se
usa como prueba de drenaje: [límites de Sheets](https://developers.google.com/workspace/sheets/api/limits).

La interfaz de la cuenta propietaria muestra dos conexiones relevantes de Drive:
OpenAI puede escribir todas las Sheets; Google AI Studio puede ver/modificar/crear/
eliminar archivos de Drive. El detalle de OpenAI incluye explícitamente todas las Sheets. OAuth
Playground ya no aparece en la lista completa visible. Son permisos observados,
no actividad de escritura demostrada ni un inventario universal de tokens. Eliminar
todo el acceso de OpenAI también afectaría Gmail/Calendar y usos ajenos a develop.
No se revocó nada. La cuenta de pruebas proporcionada anteriormente está conectada
y su página de conexiones indica que no tiene aplicaciones vinculadas.

#### Aislamiento solo del archivo, preparado y pendiente de autorización

Recomendación: transferir únicamente la hoja de develop existente a la cuenta de
pruebas y después dejar a su anterior propietario como lector. Conservar ID/enlace,
datos, fechas, orden, tres lectores de servicio y acceso general restringido.
Comprobar que la carpeta anterior no mantenga escritura heredada; si es necesario,
mover solo este archivo a Mi unidad del nuevo propietario. Los clientes OAuth de
la cuenta anterior quedarían sujetos a su permiso de lector, sin desconectarlos de
otros archivos/servicios. Sigue siendo necesario el acuerdo humano de ADR-0021.

Entre cuentas personales el destinatario debe aceptar. El propietario anterior
queda inicialmente como editor: hay que cambiarlo explícitamente a lector; la
transferencia por sí sola no aísla. [Contrato de Google](https://developers.google.com/workspace/drive/api/guides/transfer-file).
El plan privado fija las cuentas, archivo y permisos originales. Incluye los avisos
de invitación/aceptación de Google; una prueba positiva que reenvía el mismo Fecha/A1
mediante el conector actual antes del cambio; su negativa idéntica y lectura posterior;
y comparación de los seis rangos. No se prevé nuevo OAuth/IAM. Parar ante cambios o
aceptación incompleta y no restaurar escritores automáticamente. Cancelar antes de
aceptar es distinto de recuperar después: esto exige transferencia inversa y
aceptación por el propietario original.

No cambiar el propietario/carpeta fijados en el comprobador actual ni aceptar la
nueva identidad antes de autorizar y verificar la transferencia. Después se vincula
la evidencia nueva. La operación no abre mantenimiento, migra, escribe producción
ni resuelve efectos externos anteriores. Los accesos restantes de servidor/delegación
y los efectos históricos mantienen sus condiciones independientes.

Evidencia privada: `2026-10-29-old-call-access-closure`, con revisiones, resultado
validado y plan de propiedad/recuperación. Build/lint de Functions y129 pruebas
correctos (15 casos nuevos). Sin cambios nativos ni desfase entre plataformas.
Código/docs nuevos locales después de `9f01bae8`.


### Transferencia autorizada y bloqueo del conector — 2026-10-29

El usuario autorizó el plan anterior para este único archivo. Google envió la
invitación, la cuenta de pruebas conectada la aceptó y después se cambió al propietario
anterior de editor a lector. El diálogo de compartir muestra a la cuenta de pruebas
como propietaria, al propietario anterior y las tres cuentas de servicio como lectores,
y acceso general restringido. Se conserva el ID/enlace original. No se modificaron
otros archivos, conexiones OAuth globales, concesiones IAM, despliegues ni producción.

El conector existente pudo reenviar el mismo literal `Fecha` a A1 antes de transferir.
La petición batchUpdate idéntica después devuelve HTTP 403 PERMISSION_DENIED; la lectura
de los seis rangos acotados sigue funcionando. Los 742 valores tipados, fechas y orden
son idénticos antes/después. No hizo falta mover el archivo para obtener esta denegación.
Como lector, el conector ya no expone permisos ni IDs de carpetas padre: los campos
nulos son **metadatos no disponibles**, no prueba de una ACL padre vacía. La admisión
del mantenimiento sigue requiriendo evidencia actual de autoridad padre y versión.

`inspectDevelopOwnerTransfer` vincula el diálogo observado, las peticiones positivas y
negativas exactas y la comparación de seis rangos, separados de las lecturas API
históricas del propietario/carpeta anteriores. Conserva ambas evidencias sin renovar
los censos ni observaciones de ejecución anteriores. No admite mantenimiento, reproduce
avisos, convierte trabajo desconocido en cero ni resuelve efectos ya enviados.
El paquete real pasa con 742 valores; 141 pruebas focalizadas (12 nuevas), build/lint
de Functions y comprobación del diff correctos. Sin cambios nativos ni brecha de
paridad. Código/documentación nuevos sin commit tras `9f01bae8`; esta autorización
no pidió otro commit.

Evidencia privada: `2026-10-29-develop-owner-transfer`, con captura/AX de permisos,
respuestas originales del conector, valores exactos y preparación conjunta NOT_READY.
La recuperación después de aceptar exige transferencia inversa y aceptación del
propietario anterior; no se ejecutó. Siguiente: completar autoridad de servidor/
delegación y conciliación de efectos anteriores; después, evidencia coherente actual
de hoja/controles y acuerdo de ventana del nuevo propietario/administradores.
HU-084/HU-085 siguen abiertas y PR #278 en borrador.


### Accesos configurados restantes y efectos anteriores — 2026-10-29

El aislamiento de ejecuciones/propietario está commiteado y pusheado como `b69dcf5b`
(remoto verificado). Esta inspección posterior es de solo lectura; este punto registra
su documentación.

| Área | Observación nueva | Límite |
| --- | --- | --- |
| Functions y Run | Las 24 Functions mantienen metadatos/fuentes revisados; el inventario global de Run contiene exactamente sus 24 servicios, cero jobs, worker pools o instancias independientes, sin regiones inaccesibles ni continuación. Tráfico 100% a revisiones revisadas, sin tags. | Los endpoints globales v1 usados por gcloud resuelven las denegaciones regionales de me-central2; las denegaciones por sí solas no son inventarios vacíos. |
| Programación/CI | Tres jobs PAUSED en 34 ubicaciones Scheduler. Sin disparadores ni builds activos/pendientes en global y 43 regiones Build documentadas. Sin servicios App Engine ni instancias Extensions. Este repo GitHub no tiene workflows, Actions ejecutándose ni nombres de secretos Actions del repositorio. | No inventaría automatizaciones ajenas al proyecto/repositorio ni lee valores secretos. |
| Credenciales | Las 9 cuentas de servicio del proyecto tienen cero claves USER_MANAGED y cero bindings IAM directos; tres identidades de prueba siguen deshabilitadas. Cero pools de identidades externas. Bindings de proyecto y Rules sin cambios. | Persisten roles compartidos Editor/Admin/Token Creator. Sin claves o políticas directas no equivale a inexistencia de tokens emitidos o automatización con credenciales humanas. |
| Censo fuente | Los mismos 62 turnos, cuatro calendarios y 117 avisos, 12 capturas/16 entregas; versiones fuente e historial retenido idénticos al censo anterior. | La estabilidad no es un registro completo de llamadas antiguas ni una barrera de mantenimiento retenida. |
| Efectos conocidos | Dos pruebas exactas de calendario correlacionadas con su revisión antigua revisada y sus respuestas HTTP 200; updatedCount 0 hace que el código omita escritura Sheets y creación de aviso. Se mantiene la evidencia previa de tres importaciones y 12 intentos FCM. | Solo cubre esas invocaciones identificadas; aceptación FCM no es recepción en el dispositivo. |

La consulta nueva filtrada a develop abarca únicamente desde 16:55:14 hasta 20:05:12
UTC. Agota las páginas sin efectos coincidentes nuevos. No extender esa negativa a
trabajo sin registrar ni repetir búsquedas caducadas. Los 105 avisos anteriores siguen
como posiblemente entregados y sin reproducción; no son 105 envíos pendientes.
Los efectos ya enviados sin recibo causal de terminación siguen como residuo: no se
convierten en cero operaciones en curso. Se mantienen `legacyUntracked=true` y NOT_READY.

Cloud Asset devolvió SERVICE_DISABLED y no se habilitó. Se conservaron como errores
las máscaras regionales iniciales inválidas, una ruta no admitida de ubicaciones Build
y el GET de política del SDK; después se sustituyeron por lecturas soportadas.
Las ubicaciones Build proceden del
[catálogo oficial](https://docs.cloud.google.com/build/docs/locations); los métodos
globales Run coinciden con la CLI instalada y su
[contrato de listado global](https://docs.cloud.google.com/sdk/gcloud/reference/run/jobs/list).
Sin privilegios nuevos, suplantación, lectura de datos de producción, despliegue ni
escrituras de negocio. Refrescar la sesión existente no concede acceso nuevo a una
cuenta de servicio.

#### Siguiente actuación acotada

1. El mantenedor identifica las apps vigentes y sus Functions como escritoras de
   `collections` en develop/production. La configuración local de iOS clásico confirma
   el mismo proyecto `reguerta-9f27f`, raíz ordinaria `collections` y endpoints HTTP
   compartidos. Las Rules desplegadas revisadas cierran escrituras de develop en
   **ambos** namespaces; las ramas de producción conservan sus permisos anteriores.
   No deducir aislamiento completo solo de nombres distintos: el callback antiguo de
   calendario consulta `collections/config` antes de `plus-collections/config`, y el
   checkout clásico incluye herramientas explícitas de copia hacia plus-collections.
   Su presencia local no prueba que estén en la versión publicada ni que se ejecuten;
   sus escrituras cliente hacia develop están cubiertas por las Rules actuales.
   La respuesta identifica clientes conocidos, no acredita ausencia universal de
   otros programas con credenciales. No requiere parar la app clásica de producción
   ni autoriza reabrir develop/collections. Evidencia: paquete privado
   `classic-namespace-clarification-private.json`.
2. Mantener explícito el residuo histórico de efectos externos. ADR-0025 exige cierre
   verificable, aislamiento efectivo del destino o la salida residual/incidente
   acotada existente; una incidencia no equivale a admisión correcta. No repetir logs
   caducados, reproducir avisos ni rebajar silenciosamente el contrato.
3. Después de resolver esos puntos: evidencia actual de carpeta/versión del nuevo
   propietario, controles actualizados y acuerdo de ventana de propietario/admins.
   Esta inspección no solicita ni abre una ventana.

Paquete privado: `2026-10-29-remaining-authority-effects`; `assess.py` comprueba las
comparaciones reales de proveedor/fuentes y conserva lecturas fallidas. Aserciones
correctas. Se reutilizan 141 pruebas/build/lint sin cambios de la implementación
pusheada; no se afirma otra ejecución de tests de aplicación. Los cambios nuevos son
solo documentación: diff/enlaces/paridad, sin build nativo ni brecha de paridad.
HU-084/HU-085 siguen abiertas; PR #278 en borrador.


### Clasificación de efectos históricos y decisión — 2026-10-29

La revisión anterior de accesos/namespaces está entregada en `d3ae12d9` (remoto
verificado). Este paso concilia evidencia conservada sin conexión, sin renovar
controles reales, consultar logs caducados, invocar Functions ni modificar proveedores.

| Evidencia de aviso | Cantidad | Tratamiento |
| --- | ---: | --- |
| `no_tokens` guardado | 55 | Conservar el resumen; no prueba ausencia de otros intentos. |
| `partial_success` guardado | 34 | Conservar; los tokens rechazados no justifican reenviar a los posiblemente aceptados. |
| `success` guardado | 25 | Conservar; no es un recibo de entrega por dispositivo. |
| Sin resultado de envío | 3 | Avisos administrativos del 1 de abril, sin cambios desde su creación; desconocidos, no trabajo activo recién identificado. |

Los 117 documentos quedan vinculados a hashes privados exactos de fuente/versión.
Doce de los 59 resúmenes de envío coinciden con registros conservados de aplicación/
fin de petición: seis tokens aceptados y seis rechazados. Los 105 sin esa correlación
son 55 sin tokens, 28 parciales, 19 correctos y tres sin resultado. No se reenvía
ninguno. Tres importaciones de 62 filas y dos pruebas de calendario sin efectos
conservan su prueba de terminación aparte. Estas 17 terminaciones conocidas no
acreditan el conjunto completo de invocaciones antiguas.

La conciliación de la evidencia disponible está terminada; no está acreditada toda
la terminación histórica. El contrato actual sigue rechazando mantenimiento. La
propuesta [ADR-0026](../decisions/0026-accept-bounded-develop-historical-effect-risk.md)
hace explícita la decisión: aceptar un riesgo histórico acotado solo para migración
inicial de develop, conservando desconocidos/controles actuales, o mantener bloqueada
la admisión estricta. No está aceptada ni implementada. Hace falta decidir la política,
no otra búsqueda de logs; la ventana real requerirá autorización separada tras
implementación/pruebas y controles de autoridad pendientes.

El script privado `2026-10-29-historical-effect-disposition/reconcile.py` comprueba
independientemente las 117 fuentes exactas, coherencia de resultados y las 12
correlaciones de terminación conservadas. Produce clasificación por documento y
hashes de fuentes con `legacyUntracked=true`, `canEnterMaintenance=false`,
`canApply=false`. Aserciones, enlaces bilingües y diff correctos. Cambios nuevos solo
documentales, locales sin commit; sin repetir build/tests de app ni cambiar paridad.


### ADR-0026 aceptado y ensayado localmente — 2026-10-30

El mantenedor acepta el riesgo histórico acotado solo en develop. Implementación y
ensayo local terminados: 137 pruebas locales + 26 de emulador, build/lint, sintaxis
CJS y diff correctos. Véase el [punto de implementación](../decisions/0026-accept-bounded-develop-historical-effect-risk.md#implementación-local--2026-10-30)
para vínculos exactos, desconocidos conservados, rechazo/recuperación y límites.
Sin reenviar avisos, modificar servicios compartidos ni admitir mantenimiento.
Preparación real en NOT_READY; faltan autoridad/aceptación exacta actuales y ventana
autorizada por separado. Cambios locales tras `d3ae12d9`, sin brecha de paridad nativa.


### Evidencias reales preparadas para mantenimiento — 2026-10-30

Implementación de ADR-0026 entregada en `0539ee40`, verificada en remoto y PR #278
abierta en borrador. Las siete huellas de implementación/pruebas coinciden con las
137 pruebas locales + 26 de emulador, build y lint ya validados; se reutilizan.

Lecturas nuevas conservadas en la evidencia privada
`2026-10-30-maintenance-evidence`, con informe de aserciones sin conexión:

- Las 24 Functions coinciden con las fuentes/configuración revisadas; Rules e IAM
  del proyecto no cambian; los tres jobs siguen pausados. La lectura de Run con
  comprobación antes/después confirma 288 revisiones retiradas en esos 24 servicios.
  No acredita la terminación de efectos externos ya enviados.
- La captura atómica de Firestore de `2026-10-30T06:48:26.324Z` conserva exactamente
  62 turnos, cuatro calendarios, 117 avisos, cero solicitudes y las mismas 12 capturas/
  16 entregas. Coinciden los cuatro campos consultados de los 48 socios y config/global.
  Reservas, compensaciones, situación de socios y las colecciones consultadas de casos,
  efectos, sincronización e intercambios están vacías. Los cinco documentos de autoridad
  del planificador siguen ausentes; no se interpreta como una autoridad con época cero.
- Coinciden las 742 celdas con contenido tipado/notas de seis rangos acotados, incluidas
  fechas y orden. La pantalla de compartir renovada desde el propietario muestra la
  cuenta de pruebas, cuatro lectores y acceso restringido. No se repite ninguna escritura.
- Los seis índices compuestos siguen READY, incluido el índice exacto de solicitudes;
  continúa disponible la indexación heredada de shifts/date.

El conector lector omitía la versión numérica, el padre y los permisos exactos.
El mantenedor autorizó después una sesión de Google OAuth Playground con acceso
Online y permiso `drive.metadata.readonly`, usando el propietario de pruebas. Las
lecturas de API antes/después coinciden en la **versión 278**, el propietario y la
raíz de Mi unidad de pruebas `0AK7v8_RQogQlUk9PVA`. Las listas completas contienen al
propietario y cuatro lectores directos en la hoja; en la raíz, únicamente al propietario.
No aparece otro editor efectivo en estas observaciones. La entrada heredada de escritura
pertenece al mismo propietario. La raíz del antiguo dueño queda como evidencia histórica.

Solo se consultaron la hoja indicada y su padre devuelto por Google. La autorización
se retiró al terminar: la cuenta muestra cero aplicaciones vinculadas y la misma lectura
GET devuelve HTTP 401. No se emitió refresh token ni se conserva ningún token en los
archivos de evidencia. Las lecturas de Cloud usaron la sesión existente de Firebase CLI;
sin cambios IAM. Metadatos y celdas se observaron por separado, no bajo una barrera tomada.

El paquete final sigue **NOT_READY**, sin aceptación de operación ni fechas de ventana,
con `canEnterMaintenance=false` y `canApply=false`. Ya está observada la autoridad exacta
de API; habrá que renovarla y vincularla al admitir, no tratarla como garantía permanente.
Las aserciones privadas comparan hoja/padre y comprueban la revocación; las huellas de
los archivos conservan la procedencia.

Después hay que vincular la política real de fuentes y los planes de migración/reversión,
renovar los controles restantes de autoridad automática/colas al admitir y obtener los
acuerdos nominativos de propietario/administradores y la aceptación de riesgo para la
operación y ventana concretas. El inventario global y las pruebas de denegación anteriores
se conservan como históricos. Este paquete no es una barrera tomada ni una captura completa
del bootstrap. Sin mutación compartida, FCM, datos de producción ni cambios nativos.
Aserciones/sintaxis/diff correctos; documentación y evidencia nueva locales, sin commit
tras `0539ee40`.


### Controles técnicos actualizados; escritor de Sheets pendiente — 2026-10-30

La corrección del censo está publicada en `27920b02`. Se reutilizan las 113 pruebas
unitarias y 50 de emulador tras comprobar los siete hashes de implementación/pruebas.
Este bloque solo actualiza documentación y evidencia privada de lectura. Paquete:
`2026-10-30-technical-sheets-review`; pasan las comprobaciones locales de evidencia.

Las 24 Functions conservan metadatos/configuración; no cambian Rules ni IAM del
proyecto. Los tres jobs siguen pausados y los seis índices READY coinciden con la
autoridad anterior. La lectura de Run antes/después confirma 288 revisiones retiradas
en 24 servicios. Se revisan otra vez los archivos de código desplegado inmutables de
los cuatro pares de receptores y sus ocho vínculos de trigger/topic/subscription.
Los cinco grupos de métricas muestreadas dan UNKNOWN: no equivalen a cero ni a drenaje
causal completado. Se mantienen los límites aceptados de ADR-0025/0026.

Hay nueve cuentas de servicio, cero claves USER_MANAGED/permisos IAM directos sobre
ellas, cero pools de identidad y 24 servicios Run globales; los listados completos
acotados no muestran jobs, worker pools ni instancias Run. Cloud Asset sigue
deshabilitado (403), sin activarlo. Otras regiones/servicios, automatización externa
y autoridad GitHub son evidencia retenida, no un inventario global nuevo completo.
La ausencia de claves no acredita la ausencia de tokens anteriores o automatización humana.

Coinciden el ID del archivo de develop, los IDs/títulos de sus seis pestañas y los
destinos configurados de importación/exportación antiguas e inspección privada.
Las 742 celdas y notas observadas en seis rangos acotados siguen idénticas. La interfaz
del propietario muestra testplusprojects como dueño, los mismos cuatro lectores y
acceso restringido. El conector lector no devuelve versión numérica de Drive, padre
ni permisos completos. La sesión Online de `drive.metadata.readonly`, expresamente
autorizada, confirma ahora la versión 278 con metadatos idénticos antes/después,
los cinco permisos completos de la hoja y el padre devuelto: Mi unidad, solo del
propietario testplusprojects. Se conservan cuatro lectores directos; el único detalle
de escritura heredada es del mismo propietario. Sin editor adicional, grupo, dominio,
acceso público ni restricción de contenido. La primera sesión se revocó tras bloquearse
la consulta; el reintento en pestaña limpia completó la lectura y también se revocó:
cero aplicaciones vinculadas y la misma consulta GET devuelve 401. No se emitió token
de renovación; se vaciaron los campos de Playground y se cerró su pestaña. La evidencia
privada no conserva tokens.

**Escritor:** ni `executeShiftPlanningSheetsSync` ni `executeShiftSheetsImport` están
desplegados. Compute, Firebase Admin SDK y el inspector figuran como lectores.
`reguerta-shifts-runtime` está habilitada, sin claves/permisos directos y sin asignar
a ninguna de las 24 Functions, pero tiene roles de proyecto Datastore User, Firebase
Auth Viewer, Firebase Cloud Messaging Admin, Eventarc Receiver y Run Invoker. No se
acredita como identidad exclusiva de Sheets/develop y no figura entre los accesos al
archivo. No hay escritor automático controlado efectivo verificado. No se habilitan,
deshabilitan o suplantan cuentas de servicio, ni se conceden permisos a estas o prueban escrituras.

La observación referencia el paquete exacto
`a2c6923715243faaace634f408520c155c0f9d392bc2719e1cf30a0767bdbf31`;
no sustituye controles retenidos ni cambia las identidades de operación. La lectura
de API del propietario y su revocación están completas. Sigue preparar una identidad
acotada de Sheets y su plan concreto de permisos/prueba para autorización separada. Se conservan
los roles generales existentes. Siguen sin admitir capacidades reales del escritor,
composición de controles externos y ventana propietario/administradores/riesgo.
Sin abrir mantenimiento, escrituras compartidas/Sheets, avisos ni acceso a datos de
producción. Sin cambios nativos/brecha de paridad; HU-084/HU-085 abiertas y PR #278 en borrador.

### Identidad propuesta y prueba de permisos de Sheets develop — 2026-10-30

La revisión anterior está publicada en `2a0836b0`. Esta propuesta no cambia las
excepciones de ADR-0021/0022/0025/0026. El [plan revisable, no ejecutable](../../spec/shifts/hu-084-stable-shift-coverage-and-credits/develop-sheets-writer-plan.json)
contiene nombres y límites propuestos, no identificadores reales, credenciales ni
una autorización. `canProvision`, `canApply` y `canEnterMaintenance` siguen a false.

Proponer una cuenta nueva `reguerta-develop-sheets-writer` en `reguerta-9f27f`.
No reutilizar `reguerta-shifts-runtime`, Compute, Firebase Admin SDK, inspector ni
identidades de ensayo deshabilitadas. No aparecía en el inventario retenido de nueve
cuentas: antes de crearla se repite la consulta exacta y se para si ya existe.
Conservar el unique ID devuelto y `about.user.permissionId` de Drive; no deducirlos
por el correo. Sin roles de proyecto, claves de usuario, delegación de dominio,
Functions/Run asociados ni permiso permanente de suplantación.

| Límite | Permiso propuesto | Evidencia antes de usarlo |
| --- | --- | --- |
| Archivo | Editor directo solo de una hoja sintética nueva de ensayo | Propietario, padre, ACL completa antes/después e ID del permiso devuelto |
| Emisión | `user:drpuerk@gmail.com`, `roles/iam.workloadIdentityUser` solo sobre esta cuenta, condición UTC de diez minutos como máximo | Política completa con versión/etag; conservar otros permisos y parar ante cambios |
| Token Google del hijo | Un token de 300 segundos, `spreadsheets` y `drive.metadata.readonly`, sin delegación ni renovación | Caducidad real, alcances exactos, IPC en memoria; nunca argumentos, logs o archivos |
| Datos Cloud | Sin roles de proyecto ni acceso a Firestore compartido/FCM | Lectura reciente de roles, claves, política de cuenta y servicios asociados |
| Develop original | Sin permiso en este primer ensayo | Destino excluido en el ejecutor, sin prueba negativa remota |
| Producción | Sin permiso, lectura, escritura ni prueba | ID protegido solo en local; ninguna petición a ese archivo |

Los dos alcances coinciden con la composición y el contrato de copia existentes.
No limitan el token a un ID de archivo: esa frontera depende de la ACL y del adaptador
SDK que fija el destino exacto. El rol IAM también permite emitir ID tokens y no
impone técnicamente esos alcances, cantidad de tokens o duración solicitada. Esos
límites pertenecen al controlador sellado y al operador identificado; la autorización
posterior debe explicar ese poder residual. No añadir Token Creator, Service Account
User, firmas, roles de datos ni roles personalizados para superar una prueba fallida.
El padre conserva su credencial existente; el hijo recibe solo el token corto.
Retirar IAM no demuestra por sí solo que un token emitido o una escritura en curso
hayan dejado de actuar.

**Condición del observador actual:** `observeShiftSheetsWorkbook` solo enumera toda
la ACL si `canShare` es true para ese observador. La guarda también exige `canEdit`,
`canModifyContent`, identidad/huella exactas, restricciones completas y que solo
propietario y ejecutor sean escritores. Un editor con `canShare=false` no pasa:
no ampliar alcances ni omitir esa comprobación. El token propuesto no puede cambiar
permisos de Drive, aunque el rol del archivo permita compartir usando otras
credenciales. Leer como propietario no acredita poder leer como la cuenta nueva;
esto debe probarse en la copia.

**Un ensayo completo en copia, tras autorización separada:** el propietario crea una
hoja nativa nueva con las siete pestañas BASE sintéticas del plan, sin datos reales
ni escritores heredados de terceros. El ejecutor existente exige siete pestañas
iniciales. No sirven el original de seis ni la copia anterior ya terminada de ocho:
no borrar sus pestañas ni relajar la guarda. Fijar los IDs reales de archivo/pestañas
y sus imágenes previas; después obtener confirmación reciente del propietario de
estar en línea, hoja cerrada, sin cambios pendientes sin conexión ni otra automatización,
y el compromiso del controlador de no emitir más tokens durante la sesión acotada.

Crear la identidad nueva y conceder solo el permiso de la copia y el binding IAM
condicionado exacto. Arrancar el ejecutor existente en un emulador nuevo
`demo-reguerta-copy-writer-v1`, `127.0.0.1:8897`; fijar fuentes de padre/hijo y adaptadores
de observación antes de emitir. El padre lee cuentas/claves/políticas reales: no
inyecta ceros declarativos. Emitir una vez tras arrancar el hijo y con caducidad dentro
del plazo restante del permiso/ventana. Mantener estable la política observada para
la huella del contrato y retirarla al limpiar. Si no queda tiempo, abortar sin ampliar
ni renovar automáticamente. La preparación y relectura vinculan identidad Google,
capacidades, ACL completa, lote exacto y las siete pestañas originales antes del único
lote SDK permitido.

| Prueba | Aceptación | Dónde |
| --- | --- | --- |
| Otro archivo/entorno, falta propietario, acción amplia u otra identidad | Rechazo antes del envío al proveedor | Pruebas locales existentes de contrato/ejecutor |
| Sin ADC implícitas, caducidad corta, sin renovación ante 401/403 | Sin otra credencial ni reintento automático | Pruebas locales existentes |
| Identidad y ACL del editor | Correo + permission ID exactos, ACL completa y capacidades exigidas | Hoja sintética autorizada |
| Proyección protegida correcta | Una pestaña nueva de mercado, diez turnos ficticios, un lote SDK; siete pestañas intactas | Copia autorizada y recibos de emulador |
| Pérdida de respuesta, cambio de datos o caducidad | Conservar incidente e inspeccionar, sin reintento/inversa ciegos | Pruebas locales existentes; sin inyectar fallos en Google real |
| Retirada del permiso | El mismo token aún vigente pierde acceso; 403/404 solo valen tras lectura positiva | Copia autorizada, inmediatamente después de quitar el permiso |
| Limpieza de identidad | Binding exacto retirado, cuenta deshabilitada, cero claves/roles de datos y política de proyecto intacta; sin segunda emisión | Solo la cuenta nueva autorizada |

Conservar el resultado sintético para revisarlo. Retirar únicamente permiso/binding
creados por este ensayo, con IDs exactos y mezcla de política usando etag tras lectura
reciente; nunca sustituir una política completa obsoleta. Deshabilitar la cuenta,
comprobar la pérdida efectiva de acceso, vaciar credenciales y conservar recibos.
Si la escritura queda incierta, conservar hoja y recibo para inspección: revocar no
demuestra que no se ejecutase. Un token caducado no demuestra denegación por ACL.
Rehabilitarla después requiere aprobación separada, caducidad/conciliación de las
credenciales previas y nueva observación; no reciclar recibos ni vaciar el registro.

**Paso posterior sobre develop original:** el permiso del archivo original y una
prueba efectiva de escritura son distintos del ensayo en copia. Renovar propietario,
padre, ACL y versión; vincular nueva identidad/ACL a manifiestos de Sheets regenerados,
conservar fechas/orden publicados y revisar el censo. No trasladar el paquete de
versión278 ni la autoridad de copia. Probar identidad no implementa el lector de
controles externos compartidos ni admite la ventana de propietario/administradores/
riesgo. La cuenta Sheets no tiene autoridad Firestore: la composición existente debe
recibir clientes Google y Firestore explícitos separados; usarla como única identidad
ADC del servicio fallaría. La composición/despliegue compartidos siguen pendientes,
sin añadir roles Firestore/FCM a esta cuenta. Aquí no se propone desplegar nada.

La preparación es documental y local. Para ejecutar faltan IDs y fechas exactos,
evidencia del controlador padre sellado y autorización expresa. Propuesta local tras
`2a0836b0`, no una ejecución preparada con todas sus credenciales.

Fuentes comprobadas el 2026-10-30: Google [permisos IAM](https://docs.cloud.google.com/iam/docs/service-account-permissions),
[petición de token](https://docs.cloud.google.com/iam/docs/reference/credentials/rest/v1/projects.serviceAccounts/generateAccessToken),
[alcances Sheets](https://developers.google.com/workspace/sheets/api/scopes),
[alcances Drive](https://developers.google.com/workspace/drive/api/guides/api-specific-auth),
[deshabilitación de cuentas](https://docs.cloud.google.com/iam/docs/service-accounts-disable-enable).

### Ejecución concreta del escritor en hoja sintética — 2026-10-30

La propuesta de identidad está entregada en `44e578d1`, con remoto y cabeza de la
PR #278 verificados. La implementación siguiente es local, pendiente de entrega.
No se han creado cuentas, hojas, permisos o tokens ni se ha abierto mantenimiento.

`functions/scripts/prepare-develop-writer-rehearsal.cjs` genera un paquete privado
sin conexión: peticiones de cuenta/hoja/permiso/token y plantilla de entrada. Su
huella vincula la propuesta, controlador, transporte y fuentes del ejecutor actual.
Se genera **después** de compilar Functions; si cambia el código hay que revisar y
regenerar, nunca sustituir la huella antigua para forzar la admisión:

```sh
cd functions
npm run build
node scripts/prepare-develop-writer-rehearsal.cjs /ruta/privada/paquete-nuevo.json
```

La única acción de consola es generar ese archivo (`wx`, permisos 0600). No hay
orden de ejecución real ni lectura de ADC o credenciales guardadas por la CLI.
La petición de hoja crea siete pestañas BASE de 20×6 con el mismo texto de ensayo;
no copia socios, turnos publicados ni contenido de producción.

#### Secuencia exacta tras una autorización independiente

1. Autorizar identidad y hoja nuevas, edición solo de la copia, permiso
   workloadIdentityUser sobre esa cuenta durante un máximo de diez minutos, un
   token solicitado de 300 segundos y limpieza. Usar las peticiones preparadas con
   el propietario indicado y conservar respuestas e ID inmutable de la cuenta.
   La creación queda fuera de `runSession`: si una respuesta se pierde, comprobar
   el recurso antes de repetir. No reutilizar la copia ni sesión anteriores.
2. Leer padre, único propietario, propiedades de las siete pestañas e imagen
   completa mediante `readRawOriginalTabs`, ahora exportado por el ejecutor, con
   clientes Google explícitos del propietario sin renovación. Comprobar que son
   exactamente las BASE sintéticas creadas y conservar la imagen privada. Rellenar
   `inputTemplate` con esas respuestas; incluir el ID de producción excluido solo
   como dato **local**, sin consultarlo. Vincular la autorización a la huella del
   paquete revisado; ningún valor pendiente permite ejecutar.
3. Obtener confirmación reciente del propietario: conectado, copia cerrada, sin
   cambios sin conexión, sin otras escrituras ni emisión adicional de tokens; fijar
   inicio/fin UTC. Usar directorio privado nuevo y emulador vacío
   `demo-reguerta-copy-writer-v1` en `127.0.0.1:8897`. No vaciar un registro anterior
   para repetirlo. Credencial IAM del operador y Drive del propietario permanecen
   separadas y únicamente en memoria del proceso padre.
4. Componer los puertos exportados según el ejemplo de la guía inglesa enlazada
   abajo. `bind` valida recursos y autorización antes de efectos. El puerto del
   propietario comprueba archivo/padre/propietario y permiso exacto del escritor.
   El puerto IAM usa el **ID inmutable de cuenta** en lecturas/cambios/tokens,
   política versión 3 y etag, rechaza claves de usuario, roles de proyecto y
   autoridad de un padre; emite un solo token y nunca cambia IAM del proyecto.
   La credencial del propietario solo consulta/cambia el recurso Drive de la copia.
5. El hijo recibe solo su token corto por IPC y una lista limitada de variables.
   Prepara el lote real y espera la revisión del padre: imagen inicial, propietario,
   escritor y presupuesto de 45 peticiones/diez filas con autoridad vigente.
   Un rechazo impide la escritura. El adaptador existente sigue comprobando lote
   único sobre pestaña nueva, ACL/capacidades completas y conservación de las siete
   originales. Un hijo atascado se termina a los cuatro minutos, forzosamente cinco
   segundos después, dejando tiempo de limpieza dentro de los cinco del token.
6. Tras terminar el hijo, también si falla: retirar el permiso exacto de la copia,
   probar negativa con el mismo token **aún vigente**, retirar mediante CAS solo el
   miembro/condición IAM de esta sesión, deshabilitar la cuenta y comprobar ausencia
   de claves/permisos directos y política de proyecto intacta, sin segunda emisión
   (contrato de intento único actualizado abajo el 2026-10-31). Las etapas continúan
   aunque otra falle. Un permiso concurrente ajeno se conserva y se comunica; no
   se elimina. Caducidad, retirada fallida o respuesta incierta no son éxito.

Composición exacta y nombres de parámetros en
[la guía inglesa](../../docs/testing/hu084-develop-writer-controls.md#concrete-synthetic-writer-session--2026-10-30).
La función de registro debe persistir cada cuerpo tipado antes de devolver, con
nombres nuevos y permisos 0600 dentro de un directorio 0700. No guardar tokens,
errores SDK sin filtrar, salida cruda del hijo ni cuerpos del proveedor. Conservar
paquete/autorización, respuestas de creación, imagen inicial, salida privada del
hijo y limpieza terminal; no borrar copia ni registro del emulador. Las credenciales
del padre deben durar lo suficiente para limpiar después de terminar el hijo.

Si cae el proceso, inspeccionar intención IAM y recursos exactos conservados: que
venza el permiso no prueba la limpieza. No rehabilitar la cuenta ni repetir una
posible escritura. Primero conciliar registro y copia bajo autorización específica
de inspección sin escritura. El controlador limita sus propias peticiones; no puede
impedir técnicamente que otro administrador emita tokens. IAM tampoco impone el
alcance, número o duración pedidos. Referencias de Google:
[emisión](https://docs.cloud.google.com/iam/docs/reference/credentials/rest/v1/projects.serviceAccounts/generateAccessToken),
[política y etag](https://docs.cloud.google.com/iam/docs/reference/rest/v1/projects.serviceAccounts/setIamPolicy)
y [deshabilitación](https://docs.cloud.google.com/iam/docs/reference/rest/v1/projects.serviceAccounts/disable).
La propagación y capacidades reales siguen pendientes; las pruebas locales no las
sustituyen.

Validación local: build/lint de Functions, análisis CJS dirigido y 30 pruebas sin
fallos ni omisiones: 16 nuevas del controlador/transporte/IPC, nueve del ejecutor
real (cuatro con emulador) y cinco del contrato del propietario. Google usa dobles;
Firestore usa SDK real contra emulador. Rechazar la revisión del ejecutor real
produce cero lotes. Sin cambios nativos ni nueva diferencia Android/iOS.
Siguiente paso: autorizar/aprovisionar esta sesión sintética y ejecutarla con su
limpieza. El permiso del escritor en develop original, la composición de controles
y la ventana de mantenimiento/migración siguen siendo pasos independientes.


### Intento real del escritor sintético y fallo contenido — 2026-10-30

El controlador preparado está entregado en `98840300`. La cuenta nueva y la hoja
nativa sintética autorizadas se crearon una sola vez. La primera sesión del
propietario caducó antes de conceder acceso a la copia, intentar emitir un token del
escritor o lanzar el hijo; se deshabilitó la cuenta y se retiró OAuth. Una recuperación
expresamente autorizada reutilizó las siete pestañas tras comprobar propietario e
igualdad exacta de la imagen inicial con una sesión nueva.

La recuperación concedió solo el permiso de la hoja sintética y el permiso temporal
de emisión sobre la cuenta. Se detuvo al abrir la sesión del controlador: el hijo
registra cero lotes enviados, en curso o inciertos. No existen recibos de revisión
del lote ni de token emitido. `mintAttempted:true` marca la admisión, no demuestra
que Google emitiera un token. La auditoría IAM disponible refleja activación,
concesión, retirada y desactivación; no identifica la operación fallida ni su estado
HTTP. No se deduce propagación, emisión, acceso correcto ni capacidad de Sheets.

La limpieza retiró el permiso exacto de la hoja y la concesión IAM temporal,
deshabilitó la misma cuenta y comprobó cero claves de usuario, permisos directos o
roles de proyecto y emisión posterior denegada. Revocar OAuth devolvió 200; usar
el mismo token devolvió 401 y Google mostró cero aplicaciones vinculadas. La prueba
de pérdida efectiva de acceso del escritor queda **sin demostrar**, al faltar una
lectura positiva anterior. El resultado sigue siendo `inspection_required`, con
`canRetry:false` y sin admisión de mantenimiento. Se conservan la hoja y los recibos.

Una corrección local del diagnóstico conserva la fase fallida y un estado HTTP
numérico acotado a través de IPC; no guarda errores originales, cuerpos ni tokens,
ni añade reintentos o permisos. Pasan build/lint, sintaxis CJS y **31 pruebas, cero
fallos u omisiones**, incluida propagación/redacción y contención. La preparación
revisada tiene otro digest; no se puede reutilizar la autorización anterior. Esta
corrección y sus evidencias siguen locales después de `98840300`.

Recibos privados: `2026-10-30-develop-writer-live` y
`2026-10-30-develop-writer-live-retry-1`; se conservan ambos y el emulador exportado.
Siguiente: revisar/entregar el diagnóstico y preparar otro intento expresamente
autorizado con observaciones actuales. El ensayo de copia no está aceptado.
Sin peticiones a las hojas originales de develop/producción, escrituras de negocio
compartidas, despliegues, FCM, mantenimiento ni cambios nativos. HU-084/HU-085 abiertas,
PR #278 en borrador.


### Nueva recuperación preparada tras entregar el diagnóstico — 2026-10-30

Diagnóstico commiteado y pusheado en `b8cebf6f`, con HEAD remoto verificado.
Los tres hashes de ejecutables/pruebas coinciden con los validados: se reutilizan
build/lint, 31 pruebas conjuntas y la repetición final de 17, sin fallos ni omisiones.
La lectura actual confirma la misma cuenta deshabilitada, cero claves/permisos
directos, IAM del proyecto sin cambios y ventana anterior vencida. No se pidió token.

El paquete privado `2026-10-30-develop-writer-live-retry-2` contiene preparación
nueva, hash exacto de la composición, plantilla de aprobación inerte y la imagen
sintética conservada. Arrancar sin aprobación nueva y coincidente falla antes de
abrir un servidor local o efectuar operaciones externas. Se conservan recibos y
exportación anteriores. La nueva sesión releerá propietario, ACL completa e imagen
antes de reactivar y guardará los permisos finales. OAuth Online/drive.file está
solo en la pantalla de consentimiento: sin token, renovación, cuenta/archivo nuevo,
sesión de ejecución ni mutaciones compartidas. Faltan autorización expresa de
reactivación/OAuth/ejecución y diez minutos nuevos del propietario. Mantenimiento y
producción excluidos; sin cambios de paridad nativa.


### Recuperación identifica denegación del token; espera acotada preparada — 2026-10-30

La segunda recuperación autorizada usó `b8cebf6f`. Pasaron las comprobaciones
actuales de propietario e imagen exacta de siete pestañas. El diagnóstico registra
**mint-token, HTTP 403**, antes de entregar un token al hijo, revisar el lote o
escribir en Sheets. Cero lotes enviados/en curso/inciertos; no se abrió el cliente
Firestore compartido. La ACL final exacta contiene solo al propietario. Cuenta
deshabilitada, cero claves/permisos directos, concesión temporal retirada y emisión
posterior denegada. OAuth revocado (200), mismo token denegado (401) y cero apps
vinculadas en Google. La prueba de pérdida efectiva de acceso sigue pendiente,
porque no hubo lectura positiva previa del escritor. No se reintentó.

La lectura confirma IAM Credentials habilitado y que el rol incluye
`iam.serviceAccounts.getAccessToken`. La auditoría de la ventana exacta muestra
activar/conceder/retirar/desactivar, sin detalle de la denegación del token. Se pidió
unos tres segundos después de conceder el permiso. [Google documenta propagación eventual](https://docs.cloud.google.com/iam/docs/access-change-propagation):
es una explicación plausible, **no una causa demostrada**. Sin ampliar roles,
habilitar APIs, crear claves ni investigar datos de producción.

La preparación local consulta solo ese permiso mediante
[testIamPermissions](https://docs.cloud.google.com/iam/docs/reference/rest/v1/projects.serviceAccounts/testIamPermissions)
sobre la cuenta exacta. Consulta cada cinco segundos durante un máximo de 180,
reservando siempre 360 segundos de la misma ventana para token/uso/limpieza. Cada
vuelta revisa fuentes, identidad/políticas y plazo; una respuesta positiva tardía
también aborta. Es una señal orientativa, no autorización: se mantienen la única
solicitud real del token y todas las comprobaciones, sin reintentar un 403. Si no
está listo o cambia la autoridad, limpia sin solicitar token y conserva concesiones
ajenas concurrentes.

Pasan build/lint, sintaxis CJS y **36 pruebas, cero fallos/omisiones**. Cinco casos
nuevos cubren propagación tardía, timeout, respuesta positiva fuera de plazo,
autoridad concurrente y transporte exacto de solo lectura. Nuevo digest del plan,
fuentes y preparación: cambios locales tras `b8cebf6f`, sin otra ejecución real
autorizada. Recibos en `2026-10-30-develop-writer-live-retry-2`; conservar resultado
original y emulador exportado. Siguiente: revisar/entregar antes de preparar otra
sesión expresamente autorizada. Sin mantenimiento, hojas originales de develop/
producción, negocio compartido, FCM, despliegues ni cambios nativos. HU-084/HU-085
abiertas y PR #278 en borrador.


### Permiso previo disponible; emisión denegada; limpieza terminada — 2026-10-30

La recuperación-3 autorizada usó `7d5bd6d6`, ya entregado. Coincidían propietario,
ACL completa y contenido original de las siete pestañas. La consulta orientativa
de permisos devolvió disponible en 747 ms, pero la única emisión real devolvió
HTTP 403 (`mint-token`). No hubo entrega de token al escritor, revisión del lote,
escritura en Sheets ni acceso a Firestore compartido; los contadores del hijo
(enviados/en curso/desconocidos) son cero. No queda demostrada la causa ni se
justifica ampliar permisos o cambiar de identidad.

Limpieza verificada: copia con solo su propietario, concesión IAM exacta retirada,
cuenta deshabilitada, cero claves de usuario/concesiones directas y emisión
posterior denegada. OAuth revocado (200), mismo token denegado (401) y Google sin
aplicaciones vinculadas. Se conservan recibo privado retry-3 y exportación del
emulador; puente local y emulador detenidos. Sigue sin probarse la lectura positiva
del escritor seguida de pérdida efectiva de acceso: `inspection_required`,
`canRetry:false`, `canEnterMaintenance:false`.

La corrección local conserva únicamente códigos reconocidos de Google ErrorInfo;
descarta mensajes, metadatos y valores desconocidos. Mantiene el primer código
reconocido aunque el hijo comunique después un fallo genérico. No permite recuperar
el motivo de este intento ya terminado. Build/lint y 38 pruebas focalizadas pasan,
sin fallos ni omisiones. Corrección y evidencias aún sin commit; no se ha ejecutado
otro intento con estas fuentes. Un futuro paquete necesita una huella nueva.

Siguiente paso: entregar el diagnóstico y preparar una comprobación exclusiva de
IAM, sin OAuth del propietario ni permisos o ventana sobre la hoja, antes de
proponer otro ensayo completo. Esa comprobación aún no está preparada ni autorizada.
Mantenimiento cerrado; sin tocar producción, hoja original de develop, datos
compartidos ni FCM. Sin cambios nativos ni brecha de paridad. HU-084/HU-085 abiertas;
PR #278 en borrador.


### Diagnóstico exclusivo de IAM preparado; sin ejecución real — 2026-10-30

Entregado `d7fb614a`, verificado en remoto: motivos seguros de denegación y evidencia
del fallo/limpieza de recovery-3. Lint/build y 24 pruebas de transporte/controlador
repetidas correctamente; se conserva la evidencia integrada anterior de 38 casos.

La preparación local aísla IAM sin OAuth del propietario, identificadores de hojas,
peticiones Drive/Sheets, proceso hijo ni emulador. El nuevo script
`prepare-develop-writer-iam-diagnostic.cjs` reutiliza las comprobaciones de autoridad
y limpieza con control de versión; el proveedor ofrece un transporte exclusivo de
IAM. Una autorización nueva vincula UID exacto, fuentes/composición y ventana máxima
de diez minutos. Un directorio exclusivo consume el recibo antes del proveedor.
La composición privada rechaza aprobación ausente/caducada antes de cargar
credenciales o acceder a la red; no reutiliza recibos anteriores.

La ejecución propuesta reactiva solo el escritor aislado existente, concede el mismo
`roles/iam.workloadIdentityUser` sobre esa cuenta al mismo usuario, comprueba durante
un máximo de 180s la disponibilidad y solicita un único token (300s, mismos ámbitos,
sin delegación). Son límites del controlador, no restricciones impuestas por el rol
IAM. Un token recibido no se registra, guarda ni utiliza. La limpieza retira solo
la concesión propia, deshabilita la cuenta y revisa identidad/claves/permisos/política
del proyecto. No solicita otro token para probar la limpieza. Conserva permisos
ajenos y los comunica como estado pendiente. Una caída o limpieza incierta exige
inspeccionar recibos e identidad exacta; nunca repetir la autorización consumida.

Solo admite motivos conocidos de ErrorInfo de Google, IAM o IAM Credentials;
descarta dominios/motivos desconocidos, mensajes y metadatos. Decide la API real,
no la consulta orientativa; referencia oficial:
[contrato generateAccessToken](https://docs.cloud.google.com/iam/docs/reference/credentials/rest/v1/projects.serviceAccounts/generateAccessToken).
El éxito no prueba acceso a Sheets, admisión de migración ni la causa del 403 previo.

Validación: lint/build; 38 pruebas de regresión de copia con emulador Firestore y
nueve exclusivas de IAM, todas correctas y sin omisiones. El paquete privado
`2026-10-30-develop-writer-iam-only` contiene aprobación inactiva, preparación y
composición vinculadas a fuentes y rechazo comprobado sin aprobación. La identidad
procede del recibo conservado, no de una consulta real nueva; se revisará antes de
los efectos. Preparación nueva sin commit, sin cargar credenciales ni contactar
Google. Siguiente paso: revisar/entregar y obtener autorización expresa para
reactivación, permiso, emisión única y limpieza de IAM. No hace falta actuar como
propietario ni mantener la hoja cerrada. Mantenimiento cerrado, producción intacta,
sin cambios de paridad nativa.


### Ejecución de IAM detenida antes del permiso; limpieza conciliada — 2026-10-30

Commit `43706b14` subido y verificado exactamente en remoto. Lint/build y 33 pruebas
focalizadas repetidas correctamente antes de la única ejecución expresamente
autorizada. Se conservó el plazo original de diez minutos y el paquete privado
coincidía con el código entregado. Sin OAuth del propietario, hojas ni datos.

Pasó la comprobación inicial y se reactivó la cuenta aislada. Después falló una
comprobación local en `grant-identity`, antes de registrar intención de concesión,
cambiar IAM, comprobar disponibilidad o solicitar un token. El recibo original
conserva `inspection_required`, `mintAttempted:false` y
`terminal_identity_unproven`. No se repitió la ejecución ni se alteró el recibo.

Una conciliación posterior de solo lectura verifica cuenta exacta deshabilitada,
cero claves de usuario/permisos directos, política del proyecto idéntica a la
evidencia conservada y comprobaciones de autoridad correctas. El registro
administrativo acotado muestra EnableServiceAccount y DisableServiceAccount
correctos a las 18:53:42 y 18:53:44 UTC. La limpieza queda conciliada en un recibo
separado. No se solicitó ni emitió token; no explica el 403 de intentos anteriores.

El recibo inicial no identificaba la aserción local fallida. No se pueden distinguir
retrospectivamente visibilidad tardía del estado y cambio de política; ninguna causa
está demostrada. La corrección local registra solo identificadores constantes de
comprobación (estado, autoridad, política), fase, booleanos de deshabilitación
esperada/observada y resultado, incluida la limpieza. No conserva aserciones,
políticas, credenciales ni respuestas originales. Una regresión distingue estado
incompatible de política cambiada sin conceder permisos ni emitir tokens.
Se conservan admisión, plazos, limpieza y límite de un intento.

Esta corrección de observación y sus evidencias siguen locales y sin commit.
Validar, revisar/entregar y preparar otra ejecución con autorización nueva; no
reutilizar el registro consumido ni el paquete anterior. Mantenimiento cerrado;
producción y hojas intactas; sin cambios nativos. Issues abiertas y PR #278 en
borrador. Evidencia privada: `2026-10-30-develop-writer-iam-only`, recibo original
y `cleanup-reconciliation.json` separado.

Validación de la corrección: lint/build y 34 pruebas focalizadas correctas, sin fallos ni omisiones.


### Oscilación de estado observada; contención explícita corregida — 2026-10-30

Entregado `dfaafc22`, subido y verificado exactamente en remoto; lint/build y 34
pruebas focalizadas repetidas correctamente. El nuevo intento autorizado usó un
registro nuevo, fuentes vinculadas y plazo original de diez minutos. Pasaron las
comprobaciones inicial y posterior a reactivar la cuenta. Se concedió el permiso
temporal y la lectura siguiente devolvió disabled=true en wait-token-permission.
Falló account-lifecycle; no hubo resultado de disponibilidad ni solicitud de token.
Se retiró el permiso. El cleanupFailures vacío del recibo automático **no basta
como evidencia de contención** de este intento.

Una lectura posterior encontró la cuenta habilitada. El transporte anterior había
omitido el POST de desactivación por una lectura disabled=true. El registro acotado
muestra reactivación, concesión y retirada, y únicamente la desactivación explícita
posterior: identifica un defecto concreto de limpieza ante lecturas contradictorias.
La desactivación incondicional del UID verificado respondió 200. Otra lectura
confirma deshabilitada, cero claves/permisos directos y política del proyecto sin
cambios. La conciliación separada sustituye la evaluación de contención, conservando
el recibo original. Sin otra reactivación, concesión ni emisión.

Corrección local: ordenar siempre desactivar tras comprobar identidad, aunque la
lectura indique deshabilitada. Google documenta que desactivar una cuenta ya
deshabilitada no produce otro efecto ([guía de activación/desactivación](https://docs.cloud.google.com/iam/docs/service-accounts-disable-enable)).
El controlador IAM espera el estado esperado con lecturas cada 5s, hasta 60s por
observación y sin superar el plazo existente de admisión/disponibilidad. Solo espera
ante discrepancias del estado; identidad, claves, permisos y política siguen siendo
fallos inmediatos. Sin reactivar/conceder otra vez, ampliar ventana ni repetir emisión.
La limpieza ordena desactivar antes de observar hasta 60s el estado final; si vence,
queda pendiente. Una lectura positiva o una espera limitada no prueban coherencia
de todas las réplicas; decide la emisión real. El 403 histórico sigue sin explicación.

Validación: lint/build, 37 pruebas focalizadas y 38 regresiones con emulador (51 casos
distintos), todas correctas y sin omisiones. Cubren lecturas alternantes, desactivación
aunque se lea disabled=true, vencimiento, respuesta positiva tardía y cambio de
autoridad durante la espera. Una aserción temporal nueva contaba un segundo retraso
simulado no previsto; se corrigió el doble y se repitió toda la suite focalizada.
Corrección/evidencia locales, sin commit ni ejecución real. Autorización consumida;
revisar/entregar antes de un nuevo intento autorizado con huella nueva. Evidencia:
`2026-10-30-develop-writer-iam-only-retry-1`.
Mantenimiento cerrado; producción y todas las hojas intactas; sin cambios nativos.


### Emisión única denegada por IAM; limpieza verificada; antigüedad mínima preparada — 2026-10-30

Entregado `7de7a19a`, verificado exactamente en remoto; lint/build y37 pruebas
focalizadas repetidas. El intento IAM-only retry-2 autorizado pasó las comprobaciones
de estado/autoridad, concedió el rol exacto y obtuvo disponibilidad orientativa en
649ms. La única emisión real respondió HTTP403, **IAM_PERMISSION_DENIED**. No se
emitió ni utilizó token. Desactivación explícita y retirada del permiso completadas
sin fallos de limpieza. Otra lectura verifica deshabilitada, cero claves/permisos
directos y política del proyecto sin cambios. El registro administrativo confirma
reactivación/concesión/retirada/desactivación por el usuario esperado. Sin segunda
emisión, OAuth del propietario, hojas ni datos de negocio.

Las lecturas confirman IAM Credentials habilitada y getAccessToken incluido en el
rol. La concesión conservada apunta al usuario y plazo esperados. La intención de
emisión fue aproximadamente1,4s después del registro de aplicación del permiso.
Userinfo respondió401 y no verifica por separado la identidad del token del usuario;
la cuenta CLI y el registro administrativo respaldan el solicitante esperado. La
consulta combinada IAM/Credentials no aportó evidencia; la consulta administrativa
acotada correcta registra las mutaciones, no el detalle interno de la denegación.

Google documenta propagación de políticas habitualmente en dos minutos, pudiendo
tardar siete o más ([propagación de acceso](https://docs.cloud.google.com/iam/docs/access-change-propagation)).
Es una hipótesis plausible, no demostrada por este403. No se justifican más permisos
ni otra identidad. La preparación local exige ahora120s desde la respuesta de
concesión antes de la única emisión. Relee estado/fuentes/autoridad y permiso
orientativo cada5s dentro del máximo180s y ventana original de diez minutos,
reservando360s. Una respuesta positiva inmediata no acorta ese mínimo. Si vence,
aborta y limpia; no repite reactivación, concesión ni emisión. Dos minutos no prueban
autorización ni garantizan que la propagación haya terminado.

Validación local: lint/build y39 pruebas correctas, sin fallos ni omisiones. Las
regresiones nuevas comprueban que una disponibilidad inmediata no adelanta la
emisión y que una ventana insuficiente aborta sin emitir. Corrección y evidencia
sin commit ni ejecución real; se conservan recibos y autorización consumida.
Siguiente paso: revisar/entregar y nuevo intento IAM autorizado. No hace falta
actuar como propietario ni cerrar hojas. Evidencia:2026-10-30-develop-writer-iam-only-retry-2.
Mantenimiento cerrado; producción y hojas intactas; sin cambios de paridad nativa.


### Emisión IAM correcta con antigüedad mínima; limpieza verificada — 2026-10-30

Entregado `ede1c71a`, subido y verificado exactamente en remoto y en la PR.
Lint/build y39 pruebas focalizadas repetidas correctamente antes de ejecutar.
El retry-3 autorizado usó paquete/registro nuevos vinculados a fuentes y la ventana
original de diez minutos. Tras124.975ms desde la concesión pasaron las comprobaciones
de estado/autoridad y se emitió el único token solicitado. Se validó su duración de
300s y se descartó sin registrarlo, guardarlo, usarlo ni entregarlo a otro proceso.
Resultado: `mint-observed-and-contained`, sin fallo ni incidencias de limpieza.
Sin otra reactivación, concesión o emisión.

La limpieza retiró el permiso exacto y ordenó la desactivación explícita. Otra
lectura independiente verifica cuenta exacta deshabilitada, cero claves/permisos
directos y política del proyecto sin cambios. El registro administrativo confirma
reactivación/concesión/retirada/desactivación por el usuario esperado; la última
ocurrió a las19:49:05 UTC. Recibo original, metadatos del descarte, lectura final y
conciliación separados en `2026-10-30-develop-writer-iam-only-retry-3`. Sin token guardado.

Esto valida emisión y contención de IAM para esta ejecución, con misma cuenta,
rol y ámbitos. Respalda la hipótesis de propagación, sin demostrar retrospectivamente
la causa de todos los403 anteriores. No valida acceso a Sheets, pérdida de acceso
con el mismo token, escritura sintética ni admisión de migración. Sin OAuth del
propietario, peticiones a hojas, datos compartidos, FCM ni despliegues. Mantenimiento
cerrado, producción intacta y sin cambios de paridad nativa.

Siguiente paso: trasladar la antigüedad mínima y observación acotada del estado al
controlador del ensayo completo en copia, validar localmente y preparar un ensayo
nuevo antes de pedir por separado OAuth del propietario, ventana de hoja cerrada y
autorización de ejecución. El controlador de copia todavía no incorpora esas esperas
exclusivas de IAM. Ahora no hace falta otra acción del usuario. Esta documentación
queda local y sin commit; no hay otra modificación funcional. HU-084/HU-085 abiertas
y PR #278 en borrador.


### Controles IAM integrados en el ensayo de la copia sintética — 2026-10-31

Commit de evidencias `a3b43fc7` publicado; rama remota y HEAD de la PR #278 draft
coinciden. El controlador, plan, pruebas y documentación siguientes son cambios
locales posteriores: todavía sin commit ni ejecución contra Google.

El controlador de la copia incorpora los 120 segundos mínimos desde la respuesta
de concesión IAM y la observación acotada del estado de la cuenta (60 segundos,
consultas cada cinco). Ambas preparaciones obtienen estos valores del mismo plan
sellado. Se conservan el máximo de 180 segundos para disponibilidad del permiso,
la reserva de 360 segundos y la ventana original de diez minutos. La espera mínima
ocurre antes de crear el hijo, fuera de sus cuatro minutos de ejecución. Que la
consulta previa vea el permiso no demuestra autorización para emitir. Si no queda
tiempo se aborta, sin ampliar ventana/permiso ni reintentar la emisión.

Identidad, claves, permisos exactos y política del proyecto se comprueban incluso
cuando la lectura del estado tarda en reflejar activación/desactivación. Después
de emitir, las observaciones también quedan limitadas por la caducidad del token y
la ventana. La limpieza envía siempre la desactivación y espera una lectura terminal
acotada: deshabilitada, sin claves ni permisos directos y política intacta. El padre
sigue siendo responsable de la activación inicial; el controlador no la repite.

**Corrección del intento único:** la limpieza antigua llamaba otra vez a
`generateAccessToken` para probar su rechazo y podía emitir durante la propagación.
Se elimina esa operación y `verifyNewTokenMintDenied` pasa a false. Hay como máximo
un intento de emisión, también ante respuesta incierta. Esto no demuestra una nueva
emisión rechazada. Se mantiene la lectura positiva de la copia seguida de negativa
con el **mismo token aún vigente**, la retirada exacta del permiso del archivo,
la retirada por CAS solo de nuestra concesión IAM, la desactivación explícita y
la comprobación terminal. Una limpieza no demostrada sigue en `inspection_required`.
Se conservan permisos ajenos y no se añaden reintentos, inversas, eliminación de
pestañas originales ni admisión de mantenimiento.

Validación: lint/build de Functions y sintaxis de los cuatro CJS modificados
correctos. **49 casos** focalizados de controlador/IAM y **48** en el emulador de
la copia, sin fallos ni omisiones. Comparten 34 casos del controlador: son **63
casos distintos**, diez nuevos sobre tiempos, estado y limpieza. Las pruebas del
runner conservan revisión del lote por el padre, una pestaña con diez turnos
ficticios, siete pestañas originales, token corto explícito, ausencia de credenciales
ambientales y tratamiento de escrituras inciertas. IAM/Drive/Sheets son dobles de
prueba; solo Firestore usa el emulador demo. No demuestra éxito real ni admisión
de la migración.

Preparación inerte nueva y logs privados en
`2026-10-31-develop-writer-copy-integration-local`. Los indicadores de aplicación,
provisión y mantenimiento siguen en false. Los paquetes anteriores ya no coinciden
con las fuentes y las autorizaciones previas siguen consumidas. Siguiente paso:
commit/push de la integración y regenerar/revisar la composición privada concreta
para la hoja sintética existente, con fuentes, imagen inicial y canales de limpieza
actualizados. Después se pedirá OAuth del propietario y una nueva ventana autorizada
con la hoja cerrada para el ensayo completo. Ahora no necesitas hacer nada.

Sin peticiones reales IAM/OAuth/ACL, acceso a hojas, escrituras compartidas, FCM,
despliegue, apertura de mantenimiento ni operaciones de producción. Sin cambios
nativos ni nueva diferencia entre plataformas. HU-084/HU-085 abiertas; PR #278 draft.


### Paquete preparado para la hoja sintética existente — 2026-10-31

Integración publicada en `3f88c846`, coincidente con rama remota y HEAD de PR #278
draft. Se reutilizan lint/build y los 63 casos distintos anteriores tras comprobar
igualdad exacta de los resúmenes de preparación, plan, controlador, proveedor y
runner. No cambia código ejecutable del repositorio; esta documentación es local.

El directorio privado `2026-10-31-develop-writer-copy-ready` contiene composición
regenerada, manifiesto de entradas sellado, plantillas inertes de autorización y
ventana, plan y revisión local. Destino: la misma hoja sintética de siete pestañas
y el UID exacto de la cuenta aislada. Las imágenes y política guardadas son
históricas, no autorización actual: se releerán cuenta/claves/permisos y propietario,
ACL completa e imagen de pestañas antes de activar la cuenta. No se crea otra hoja
ni se reutilizan autorizaciones o registros del emulador anteriores.

El ejecutor deja la propagación del estado al controlador validado, sin exigir una
lectura inmediata de activación. Los fallos anteriores al controlador también
provocan desactivación explícita. Cada etapa de limpieza conserva sus incidencias
sin impedir las siguientes. Una respuesta perdida al crear el permiso de la copia
requiere inspección, no adivinar qué permiso borrar. Al terminar se revoca OAuth y
se comprueba 401 con ese mismo token; el servidor también revoca/cierra al vencer
su admisión si está inactivo. No se solicita un segundo token del escritor.

La autorización permite preparar la sesión durante como máximo 30 minutos. La
confirmación posterior del propietario inicia una ventana aparte de 599 segundos,
con al menos 540 disponibles antes de activar la cuenta. Así OAuth no consume los
diez minutos con la hoja cerrada. La intención de ejecución de un solo uso y los
resúmenes de fuentes/manifiesto impiden reutilizar el paquete. Se conservan revisión
del lote, espera mínima de 120 segundos, retirada exacta, negativa con el mismo
token y conservación de las siete pestañas.

Ocho pruebas privadas locales pasan con el controlador real, reloj virtual y
servicios IAM/propietario/hijo simulados: autorización ausente/caducada/fuentes
alteradas, estado tardío, OAuth fuera de la ventana, segunda entrada, confirmación
antigua, cambios de política/imagen, activación incierta y fallo al conceder acceso.
También verifican que los recibos no guarden credenciales. Sintaxis correcta. No se
han solicitado tokens reales, autorizado OAuth, cambiado IAM/ACL, leído hojas,
usado Firestore compartido, enviado FCM ni desplegado. No hay autorización ejecutable
ni puente activo. No demuestra acceso real del escritor. Apps sin cambios ni nueva
brecha de paridad.

Siguiente intervención: autorizar este intento concreto sobre la copia, reactivando
solo la cuenta aislada, renovando OAuth Online drive.file del propietario para esa
hoja, concediendo los permisos temporales exactos, solicitando un token de 300s y
aplicando como máximo un lote de diez turnos con limpieza final. Después de preparar
OAuth se pedirá una nueva confirmación de diez minutos en línea, hoja cerrada, sin
ediciones, otras pruebas ni emisiones de tokens. Mantenimiento cerrado, originales
de develop y producción fuera del alcance. HU-084/HU-085 abiertas; PR #278 draft.
Las autorizaciones previas siguen consumidas.


### Ensayo real de la copia completado y accesos retirados — 2026-10-31

El mantenedor autorizó el intento preparado sobre la copia y después confirmó una
ventana aparte de diez minutos en línea, hoja cerrada, sin ediciones, otras pruebas
ni tokens. Se ejecutó el paquete sellado sin cambios sobre `3f88c846`: sin código
nuevo, despliegues ni reintentos. OAuth usó Online drive.file sin renovación; la
aplicación podía acceder a esa hoja sintética existente. Las lecturas actuales de
propietario, ACL, imagen inicial e IAM coincidieron con el alcance retenido; la
cuenta empezó deshabilitada, sin claves ni concesiones directas.

Tras 126.484ms desde la concesión se emitió el **único token del escritor, de 300s**,
entregado al hijo demo local. El padre aprobó 45 peticiones para una nueva pestaña
de mercado y diez turnos ficticios. Se completó **un único lote SDK**; el comando y
su recibo en el emulador quedaron completados, sin envíos en curso ni inciertos.
Una comprobación local independiente confirma un comando de mercado completado y
cero eventos de notificación. Las imágenes de los campos originales capturados en
las siete pestañas coinciden exactamente antes/después, con resúmenes recalculados.
La pestaña añadida es `ENSAYO HU084 Mercado develop-writer-identity-v1`; el resumen
de las originales sigue siendo d92e818d…c3578. El navegador confirma la pestaña
nueva, las siete BASE, el uso compartido privado y la cuenta del escritor como
última modificadora.

Resultado `completed-and-contained`, sin fallo principal ni de limpieza. Tras
retirar el permiso exacto del archivo, el **mismo token** recibió404 cuando aún le
quedaban273.626ms de vigencia. Se retiró por CAS la concesión IAM exacta y se envió
la desactivación explícita. Una lectura posterior independiente confirma cuenta
deshabilitada, cero claves/permisos directos y política de proyecto intacta. La ACL
del archivo contiene únicamente al propietario previsto. Revocar OAuth devolvió200
y usar después ese mismo token de propietario devolvió401. No hubo otra emisión
del escritor. Se limpiaron campos/referencias de Playground y se cerró su pestaña,
se detuvo el controlador y se exportaron las evidencias del emulador antes de
cerrarlo ordenadamente. Se conserva la pestaña de resultado.

Evidencia privada en `2026-10-31-develop-writer-copy-ready`: recibos originales,
imágenes inicial/final, comprobaciones independientes, exportación del emulador y
completed-copy.png. No se guardaron tokens. Autorizaciones consumidas: la copia ya
tiene ocho pestañas y **no permite repetir** el ensayo que exige siete. No borrar
pestañas ni reiniciar registros para aparentar un intento nuevo.

Esto demuestra emisión real, publicación sintética revisada, conservación y retirada
de accesos para esta ejecución. No autoriza la hoja original de develop ni admite
mantenimiento o migración compartidos. Sin peticiones a hojas originales develop/
producción, escrituras en Firestore compartido, FCM o despliegue. Apps sin cambios
ni diferencia de paridad. Siguen vigentes las 63 pruebas distintas del repositorio
y las ocho de composición; ahora solo cambia documentación, por lo que no se repiten
compilaciones ni pruebas nativas.

Siguiente: publicar estas evidencias y vincular el ensayo del escritor al paquete
de admisión de develop, actualizando controles independientes y destino exacto,
con permisos autorizados por separado. Mantenimiento cerrado y producción intacta.
HU-084/HU-085 abiertas; PR #278 draft. La documentación de preparación/resultado
permanece local y sin commit después de `3f88c846`.


### Resultado del escritor vinculado a la preparación de admisión — 2026-10-31

La preparación y el resultado real están publicados en `7d7a7da0`. La integración
local utiliza los recibos conservados, sin repetir el ensayo. El manifiesto existente
admite un archivo opcional de evidencia del escritor, revisado por separado y
vinculado por SHA-256 y digest de contenido. Se comprueban las fuentes ensayadas,
UID de la cuenta, destino sintético, único lote completado, diez filas, igualdad de
las capturas seleccionadas de las siete pestañas originales, ausencia de efectos en
curso/desconocidos, denegación con el mismo token vigente, cuenta deshabilitada sin
claves ni concesiones directas, política del proyecto sin cambios, ACL solo del
propietario, revocación de OAuth y limpieza sin fallos. Son recibos históricos
revisados por el operador; no son certificaciones criptográficas ni observaciones
nuevas del estado actual de Google. El paquete no conserva tokens.

El resumen atraviesa el paquete de revisión, el materializador y el informe de
admisión controlada existentes. Mantiene en false la autoridad sobre la hoja
original, los controles actuales y la capacidad de aplicar o abrir mantenimiento.
Cambia la vinculación del paquete/preparación; conserva idénticos la política de
fuentes, las instrucciones de migración/reversión, sus identificadores, fechas,
orden y plan de celdas de ayudantes. No cambia la admisión efectiva, comprobaciones
de fuentes/CAS, observaciones del propietario/administradores ni recuperación. Los
paquetes antiguos sin esta evidencia opcional conservan los mismos controles.

El directorio privado `2026-10-31-writer-admission-binding` conserva hashes de los
recibos originales, manifiesto, evidencia, paquete/preparación regenerados y ensayo
completo del emulador. Paquete: `67b0a3d0…f78093a`; preparación: `22f1c564…358b071`;
evidencia: `1db10f95…649af90`. Se conservan las observaciones anteriores de versión 278,
censo y controles: **no se han actualizado** ni presentado como actuales. La hoja
sintética sigue separada del destino original. Las autorizaciones consumidas no se
pueden reutilizar.

Validación: lint/build de Functions, 137 casos unitarios y 50 de emulador correctos,
sin omisiones ni fallos. La evidencia real conservada entra en la copia local:
migración de 203 escrituras y reversión de 140, restaurando 62 registros originales y
conservando 117 avisos. La admisión de lectura sigue rechazando falta de ventana,
controles ausentes, cambios de fuentes y actividad del propietario/administradores,
aunque el ensayo del escritor sea válido. Es un resultado de emulador, no una nueva
inspección del proyecto compartido. Sin cambios nativos ni brecha de paridad; sin
mutar recursos de Google, abrir mantenimiento, escribir datos compartidos, consultar
Sheets, enviar FCM ni acceder a producción durante este paso.

Siguiente: preparar la concesión concreta y la prueba de capacidades del escritor
sobre la hoja original de develop y renovar las observaciones independientes de
fuentes/ACL/controles, antes de solicitar los permisos y la ventana del propietario,
administradores y riesgo. Sigue pendiente la autoridad separada de Firestore. No
hace falta repetir el ensayo sintético con estas fuentes sin cambios. Implementación
y documentación locales pendientes de commit tras `7d7a7da0`; HU-084/HU-085 siguen
abiertas y PR #278 en borrador.
