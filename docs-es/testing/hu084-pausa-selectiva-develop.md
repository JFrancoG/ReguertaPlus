# HU-084: ensayo de la pausa selectiva de develop

> **Política vigente — 2026-10-28:** [ADR-0021](../decisions/0021-usar-mantenimiento-acordado-con-el-propietario-en-hojas-de-turnos.md)
> acepta un compromiso acotado de no editar del propietario identificado, en vez
> de retirarle técnicamente esa capacidad manual. Los demás controles de
> escritores, entrega, vaciado y notificaciones, y `canApply:false`, siguen intactos.
> Los resultados históricos y límites del cierre físico descritos abajo conservan
> su validez; faltan la implementación y la autorización real.

Estado: diseño y ensayo local; **`canApply:false`**. No es una pausa desplegada
ni un punto de control que admita la migración.

[English version](../../docs/testing/hu084-selective-develop-pause.md).

## Fuente exacta y alcance

La preparación de controles reversibles está entregada en `f105ca5c`. Este bloque
mantiene abiertas #268/#269 y el borrador PR #278. Ejecuta los seis callbacks del
código desplegado exacto, sin sustituirlos por la implementación de esta rama.
El SHA-256 de su ejecutable es
`405d00ce204f64565d553649e1786fb968818024bf437c250c73514f1ffc1883`;
la procedencia y el hash del archivo inmutable constan en la
[guía de controles](hu084-controles-escritores-develop.md).

La fuente privada, los identificadores de las hojas y las observaciones del
proveedor quedan fuera de Git. No se modifican la configuración de despliegue ni
las exportaciones normales de Functions. Firestore se limita a un proyecto demo
fijo y un emulador local. En la suite de pausa, Sheets y FCM son puertos que
registran efectos; no se envían mensajes reales. El ensayo real de Sheets descrito
más abajo actúa únicamente sobre su copia.

## Comportamiento exigido

- Solo el entorno resuelto exactamente como `production` ejecuta el callback
  capturado sin acceder al registro de pausa. Sus efectos positivos se comparan
  con los del original.
- Solo `develop` pasa por la admisión persistente. La ausencia de estado deniega
  la entrada; otros entornos o variantes de mayúsculas fallan antes de acceder a
  datos. La configuración antigua convierte claves a minúsculas, por lo que no
  sirve aproximar su resolución del entorno.
- El cierre rechaza nuevas peticiones HTTP de develop. Los eventos solo se dan
  por retenidos tras guardar persistentemente su identidad y contenido. Una
  entrega duplicada no puede borrar incertidumbre ni sustituir otro contenido.
- Una operación admitida sigue activa hasta poder justificar sus efectos. Un
  envío sin confirmación conserva incertidumbre aunque el callback antiguo
  capture el error. Descontar siempre en `finally` no demuestra el vaciado.
- Cero operaciones nuevas activas no demuestra qué ocurrió con las admitidas
  antes del puente. El trabajo antiguo desconocido y los eventos retenidos o
  inciertos impiden emitir un cierre válido. El tiempo transcurrido no los borra.

El ensayo no tiene reproducción ni reapertura automáticas y no se conecta a
`closeAndCollect`. La reanudación y la conciliación requieren otra operación
gobernada.

## Validación local aceptada

Con Node 22.23.4 pasan build/lint de Functions y las dos comprobaciones de sintaxis
CJS. La suite aislada de Firestore tiene **20 aciertos, cero fallos ni saltos**.
Cada uno de los seis callbacks originales de producción comprueba un resultado
funcional positivo, trazas e imágenes guardadas iguales y ningún acceso a la
admisión o al registro de pausa, incluso desde un contexto anidado de develop.
También se prueban cambios en los bytes de la fuente, el resolver desplegado,
estado ausente, pausa/admisión concurrentes, eventos retenidos y duplicados
modificados, errores capturados, pérdida de confirmación tras un commit real y
efectos pendientes o tardíos.

Desde `functions`, se proporciona el ejecutable privado auditado en
`HU084_DEPLOYED_LEGACY_JS` y se usa la configuración aislada existente:

```sh
firebase emulators:exec --config ../firebase.develop-writer-controls-emulator.json \
  --project demo-reguerta-writer-controls --only firestore \
  'GCLOUD_PROJECT=demo-reguerta-writer-controls METADATA_SERVER_DETECTION=none node --test --test-concurrency=1 test/develop-legacy-pause-rehearsal.emulator.test.cjs'
```

La ejecución final queda en evidencia privada con fuente, comandos y registros
de build/lint/TAP. El emulador está detenido. Una primera prueba positiva esperaba
doce meses de mercado, pero el algoritmo antiguo exacto define diez; se conserva
el registro fallido y pasa la comprobación corregida. Es evidencia de compatibilidad
con el comportamiento antiguo, sin modificar ni aprobar los requisitos del futuro
planificador. Las apps no cambian y se reutilizan sus validaciones aceptadas.
Ejecutar el JS exacto con SDK local y puertos controlados no demuestra todas las
ramas ni el binario del runtime desplegado.

## Límites del diseño real pendientes

Los triggers desplegados usan `DO_NOT_RETRY`. Si falla la propia retención
persistente, lanzar un error puede perder el evento. Activar reintentos globales
también cambiaría el despachador no idempotente de producción. El puente real
necesita una entrega duradera para develop y conciliar las operaciones antiguas
antes de desplegarse; el ensayo local no demuestra ninguna de las dos cosas.

El inventario compilado v3 contiene cuatro escritores cliente públicos, pero las
reglas capturadas permiten también escrituras privadas de planificación,
coberturas y del árbol legacy. La denegación total de develop es físicamente más
amplia; no concilia por sí sola la revisión ni el digest aceptados. Esa tarea
sigue siendo requisito de admisión de la barrera.

## Ensayo aceptado del mecanismo de bloqueo de Sheets

El ensayo real autorizado utilizó una hoja nativa privada nueva con seis pestañas
copiadas y una pestaña dedicada a las comprobaciones. La hoja original de develop
y producción siguen intactas. Se aplicó la
[secuencia de comprobación y reversión de la copia](hu084-controles-escritores-develop.md#ensayo-condicionado-del-bloqueo-de-contenido):

1. La respuesta real de metadatos del propietario confirmó su titularidad, la
   capacidad de establecer una restricción exclusiva y la ausencia de una previa.
   El propietario y una cuenta de servicio escritora independiente consiguieron
   escribir sus celdas de comprobación mediante Sheets y restauraron los valores
   iniciales antes del bloqueo.
2. El propietario estableció `readOnly:true`, `ownerRestricted:true` y un motivo
   único de operación. Las respuestas reales de Drive recogieron la restricción
   completa y la capacidad efectiva del propietario para retirarla. Las dos vías
   de escritura que antes funcionaban devolvieron 403, sin cambiar sus celdas.
3. La cuenta de servicio completó una comprobación de autorización de Drive antes
   de intentar retirar el bloqueo. Se escribió el mismo valor del metadato
   personal `starred`; esto verifica la autorización de la aplicación, no
   demuestra el rol de editor. El intento de retirada aceptado como evidencia devolvió 403 con
   `insufficientFilePermissions`. Los errores anteriores `appNotAuthorizedToFile`
   quedaron excluidos de la evidencia de denegación del bloqueo.
4. Antes de revertir, las lecturas completas de la restricción coincidían con la
   imagen capturada para los mismos actores. El propietario retiró únicamente la
   restricción coincidente de esta operación; la respuesta devolvió cero
   restricciones. Ambas escrituras de comprobación volvieron a funcionar y se
   restauraron sus valores iniciales.

Las cuatro capturas —inicial, inmediatamente anterior al bloqueo, durante él y
tras restaurar— contienen los mismos metadatos seleccionados del archivo y sus
pestañas, así como los datos de celda `userEnteredValue` y `userEnteredFormat`, en
las siete pestañas. El cálculo canónico independiente coincide en las cuatro:
`6c41bce8243c01641b0a27bcc28a306946962d46a994bdfbc544c265fb25b95a`.
Esto verifica las imágenes capturadas, no todas las propiedades posibles de Drive
ni un historial inmutable del archivo. Las respuestas detalladas y los
identificadores quedan en evidencia privada.

El conector no devuelve todos los metadatos de las restricciones ni permite
cambiarlas. El mantenedor autorizó por separado el acceso temporal del propietario
con `drive.metadata` y después `drive.file` mediante Google OAuth Playground,
usando **Abrir con** para esta copia. El permiso de metadatos resultó insuficiente;
no se concedió a OAuth Playground el ámbito completo de Drive en la sesión del
propietario. La cuenta de servicio de ensayo, sin claves, necesitó el ámbito OAuth
completo `drive`, pero su permiso de archivo, la lista fija de peticiones
permitidas y las operaciones se limitaron a esta
copia; no tenía roles de datos del proyecto. Se retiró su permiso sobre la copia;
el permiso final del archivo sólo incluye al propietario y la lectura de la cuenta
de servicio devolvió 404. Se eliminó su vinculación IAM temporal exacta y se
inhabilitó la cuenta. La lectura final confirma cero vinculaciones directas,
claves de usuario y roles de datos del proyecto; una petición real de token nuevo
se deniega con 404 por cuenta deshabilitada. Se retiró la vinculación OAuth
temporal del propietario: las dos sesiones anteriores devuelven 401 y se vaciaron
los campos de tokens y peticiones de Playground. La evidencia del repositorio no
incluye credenciales reutilizables.

El mecanismo y su reversión pasan en la copia. Se mantiene `canApply:false`: el
propietario puede retirar la restricción y el bloqueo completo también impide
escribir al runtime previsto. No demuestra un control sostenido del propietario
ni una transferencia sin huecos al escritor gobernado, ni autoriza a aplicar el
control sobre el archivo real.

## Contrato administrativo y entradas restantes del servidor — 2026-10-28

El commit `e29b6bdd` entrega las Rules cliente de develop ya aceptadas y la
política ADR-0022. El bloque siguiente conserva los contratos estricto v1 y de
propietario v2. El v3 explícito incorpora el acuerdo con los administradores
identificados al CAS de admisión, los registros de evidencia/incidentes y los
recibos de lotes de Sheets existentes. Exige todas las confirmaciones, las
operaciones y huellas exactas de fuentes/IAM/controles y observaciones recientes;
retirada, actividad, caducidad o cambios impiden continuar. La capacidad humana
retenida se registra como cooperación, nunca como un bloqueo técnico de IAM.
Las credenciales y cargas automáticas siguen necesitando controles técnicos.
No se inventan confirmaciones reales ni una ventana de mantenimiento.

Las nueve entradas HTTP desplegadas restantes se preparan en dos paquetes de
fuente exacta: ocho antiguas y `resolveAuthorizedMember`, más reciente, por
separado. Los objetivos HTTP existentes revisados son `onProductWrite`,
`onContainerWrite`, `onMeasureWrite`, `onUserWrite`, `onOrderWrite`,
`upsertMemberByAdmin`, `validateGlobalVersionPolicy`,
`validateGlobalFreshnessConfig` y `resolveAuthorizedMember`, todos en
`europe-west1` de `reguerta-9f27f`. El paquete no crea/elimina Functions ni
cambia permisos. Se conservan sus locks, cuerpos de callback, identidad, opciones y
entorno. Las peticiones directas a develop se detienen antes de acceder a datos;
el acceso de revisores que acaba en develop se detiene después de la resolución
original de autenticación/configuración y antes de consultar o enlazar socios.
Las dos comprobaciones globales rechazan entera cualquier petición por defecto o
mixta que incluya develop; las peticiones solo a producción conservan su camino.
Ambos paquetes cargan con sus SDK originales, exportan exactamente ocho/una
funciones y enlazan las huellas de configuración/fuentes con los selectores
revisados. No se debe desplegar el índice de la app de esta rama sobre ellas.

El mantenedor autoriza pausar exactamente los tres jobs de recordatorio dominical,
que actualmente solo actúan en develop. La primera pausa funciona; Scheduler
cambia también `userUpdateTime`, que la comprobación original interpretaba como
cambio de configuración, y el ejecutor se detiene antes de los otros dos. La
conciliación conserva ese recibo y confirma la misma configuración funcional,
Functions/IAM y dos jobs habilitados sin tocar. Una continuación sellada permite
un único intento por job pendiente, mantiene el primero pausado y contrasta las
revisiones ajenas y la respuesta/imagen final del objetivo. Pausar jobs o cerrar
HTTP no demuestra que hayan terminado las operaciones anteriores ni sus efectos.

El gate final pasa build/lint completos de Functions, 400 pruebas de planificación
y una ejecución separada de 228 controles/regresiones, sin fallos ni omitidas. El
emulador está detenido. La segunda incluye admisión/Sheets/incidentes v3, modos
anteriores, equivalencia HTTP de producción y denegación de develop, Rules y
regresiones de admisión.

**Resultado aceptado de Scheduler:** los tres jobs están PAUSED, con tres intentos
en total (uno original y dos de continuación). Las lecturas anteriores/posteriores
verifican la misma configuración funcional, fuentes/opciones de Functions e IAM.
La continuación pasa revisión independiente y 9 pruebas locales/28 escenarios,
incluida la caducidad tras escribir el recibo y la expiración ausente/inválida de
credenciales. No hay reintentos/reanudación automáticos ni un segundo envío para
el primer job.

**Resultado HTTP aceptado:** el mantenedor autoriza por separado las nueve
actualizaciones existentes en `reguerta-9f27f`. Los selectores exactos de ocho/una
funciones se publican correctamente; los nueve archivos desplegados coinciden con
los conjuntos y huellas revisados. Se comprueban sus referencias de fuente,
opciones de ejecución, identidad, entorno/secretos, IAM y tráfico a la última
revisión. Las otras quince Functions conservan su configuración. El primer lote
conserva dieciséis Functions; el segundo conserva veintitrés, incluidas las ocho
revisiones ya aceptadas. No se crea/elimina ninguna Function ni se cambian permisos.

Las negativas reales devuelven siete 503 del código. `onContainerWrite` y
`onMeasureWrite` conservan su IAM privado anterior y devuelven 403 antes del
callback. La primera comprobación esperaba nueve 503 y se detiene en ese 403;
su recibo se conserva. La continuación acotada acepta únicamente esas dos
denegaciones anteriores de IAM, conserva las dos peticiones ya completadas sin
repetirlas y comprueba las otras siete entradas. No se conceden permisos ni se
suplantan identidades para forzar la prueba del callback. Esos dos callbacks se
verifican mediante bytes desplegados exactos y emulador, sin invocación real
autorizada del código.

La inspección final de lectura confirma los tres jobs PAUSED, sus fuentes/
configuración/IAM sin cambios, la huella aceptada de Rules y las mismas imágenes
de los 183 documentos y doce eventos retenidos. El mantenimiento y la migración
compartidos siguen cerrados, con `legacyUntracked:true`: faltan confirmaciones
reales de todos los participantes y evidencia de autoridad automática y efectos
anteriores. No hay operaciones de datos de producción, Sheets o FCM. Las apps no
cambian; el mantenedor autoriza entregar este código y documentación; la evidencia exacta
de commit/remoto queda registrada en #268/#269 y la PR en borrador #278.

La [conciliación posterior de operaciones anteriores](hu084-conciliacion-operaciones-develop.md)
clasifica el conjunto observado con recibos exactos y evidencia acotada del
proveedor. La incertidumbre histórica se separa del trabajo ejecutable actual;
terminar la investigación no admite el mantenimiento ni la migración.
