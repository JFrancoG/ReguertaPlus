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
