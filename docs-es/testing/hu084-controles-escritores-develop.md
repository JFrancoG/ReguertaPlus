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
