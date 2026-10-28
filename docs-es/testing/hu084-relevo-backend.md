# HU-084: diseño y ensayo local del relevo al backend

Estado: cuatro colectores de develop y seis wrappers desplegados; las Rules
autorizadas por separado deniegan las escrituras directas de clientes en Firestore
de develop. Faltan admisiones de servidor y efectos históricos, por lo que el
mantenimiento compartido sigue en **`canApply:false`**.
El mantenedor aceptó la colaboración del propietario identificado el 28-10-2026
en el [ADR-0021](../decisions/0021-usar-mantenimiento-acordado-con-el-propietario-en-hojas-de-turnos.md).
Esa decisión no autoriza cambios de custodia, despliegues ni mantenimiento real.
La cooperación de administradores humanos de Firebase solo para develop está
aceptada por separado en [ADR-0022](../decisions/0022-cooperate-with-develop-firebase-administrators.md);
siguen haciendo falta su contrato versionado y confirmaciones por ventana.

[English version](../../docs/testing/hu084-backend-handoff-rehearsal.md).

## Base local conservada

El commit `f5c3b5db` entrega el [ensayo de pausa selectiva y bloqueo en copia](hu084-pausa-selectiva-develop.md).
Sus 20 casos aceptados de emulador ejecutan los seis callbacks del ejecutable
desplegado exacto auditado, con resultados positivos de producción y sin acceso
desde producción al registro de pausa de develop. Aquí se repiten esos casos sin
cambios; no demuestran un puente desplegado ni el vaciado del trabajo anterior.

El ensayo autorizado en copia demostró la denegación de escritura al propietario
y a una cuenta de servicio durante el bloqueo, la retirada exclusiva por el
propietario, la recuperación de ambas vías y la restitución de las imágenes
seleccionadas de siete pestañas. Se retiraron los accesos temporales. También
demostró el límite principal: el bloqueo global impide escribir al runtime
previsto y el propietario conserva la autoridad para retirarlo. No se tocaron
las hojas reales de develop ni de producción.

## Tres vías separadas

La propuesta mantiene tres obligaciones independientes. Completar una no
sustituye a ninguna de las otras.

| Vía | Resultado exigido | Límite local |
| --- | --- | --- |
| Entregas nuevas | Guardar la identidad del evento, su contenido original completo y su vinculación antes de confirmar la retención; conservar duplicados exactos y rechazar los distintos | Ensayar la captura duradera y la pérdida de confirmación; falta demostrar la entrega duradera del proveedor |
| Operaciones y efectos anteriores | Conciliar cada operación admitida, efecto externo enviado y consecuencia causal con un resultado demostrado | El trabajo pendiente, incierto o desconocido impide cerrar; el tiempo transcurrido no lo resuelve |
| Admisión del mantenimiento de la hoja | Cerrar las demás vías, vincular el acuerdo acotado del propietario y admitir solo los comandos revisados del backend | La entrada de versión 2 se ensaya localmente más abajo; no demuestra relevo físico ni admisión real; la evaluación anterior conserva `physicalHandoffReady:false` |

La inspección de configuración de solo lectura confirma las mismas seis
Functions/revisiones antiguas auditadas: timeout de 60 segundos, máximo de 20
instancias, concurrencia uno y todo el tráfico en la última revisión. Los mínimos
omitidos siguen siendo desconocidos. Los cuatro triggers compartidos usan
Functions `DO_NOT_RETRY`; sus suscripciones de transporte activas tienen un plazo
de confirmación de 600 segundos, retención de 24 horas y reintentos entre 10 y
600 segundos. Son capas distintas: desactivar el reintento de la función no
implica una entrega de transporte sin duplicados. Esta configuración no es un
censo de colas/invocaciones ni demuestra su vaciado.

Lanzar un error cuando falla la retención no demuestra una política de entrega
diferida duradera; activar reintentos de aplicación globales cambia la ruta no
idempotente de producción. El puente real debe conseguir entrega duradera para
develop sin cambiar ese comportamiento. Un registro por sí solo no la garantiza.

Cerrar la admisión, retirar un permiso o bloquear Drive no demuestra que una
petición externa enviada antes haya terminado o se haya cancelado. Puede acabar
después del cierre o perder su confirmación. Su resultado sigue pendiente hasta
conciliarlo; no basta con que no haya operaciones nuevas activas.

## Reutilizar los contratos existentes

Se utiliza el [adaptador de barrera de confianza](../../functions/src/shift-planning-trusted-intake-barrier-adapter.ts)
y su [ámbito de admisión cerrada](../../functions/src/shift-planning-intake-barrier.ts).
Se vinculan el entorno, la transición, el inventario de escritores, la época de
escritura, la revisión/digest activos, el conjunto causal, las reglas y el estado
exacto del archivo. Se conserva el mismo cierre tanto al terminar como al fallar;
la reapertura sigue siendo otra transición gobernada. Este ensayo no añade un
controlador de producción.

El [registro de pausa actual](../../functions/src/develop-legacy-pause-rehearsal.ts)
mantiene deliberadamente `legacyUntracked:true` y no emite un cierre por vaciado.
El nuevo ensayo no puede borrar esa incertidumbre copiando sus contadores ni
inventando pruebas de operaciones antiguas que nunca observó.

La [barrera del escritor externo](../../functions/src/shift-planning-external-writer-fence.ts)
revalida la autoridad capturada antes de cada escritura y después de la última;
detecta cambios, pero no convierte Drive en transaccional. El [adaptador de Sheets](../../functions/src/shift-sheets.ts)
usa un lote atómico de Sheets, pero no ofrece CAS ni impide que un editor actúe
entre la lectura y la escritura. Un arrendamiento o varias comprobaciones de
versión no producen exclusión física. La política aceptada registra esa carrera
residual con el propietario en lugar de afirmar exclusión. Un envío incierto sigue
permitiendo solo lecturas de recuperación.

La versión 1 conserva la exclusión técnica de editores humanos/sin conexión y el
adaptador predeterminado. El contrato explícito de versión 2 descrito más abajo
representa la colaboración por separado; no sustituye la versión 1 ni se deduce
de una bandera o de una prueba local.

## Ensayo local finito

El [ayudante exclusivo de pruebas](../../functions/test/develop-backend-handoff-helper.cjs)
y la [suite del emulador de Firestore](../../functions/test/develop-backend-handoff.emulator.test.cjs)
modelan un universo finito declarado sin exportar una Function ni contactar con
Drive/FCM. Los ocho casos nuevos aceptados comprueban:

1. Una transacción real de captura en Firestore confirma la escritura y pierde
   su respuesta al SDK. Un cliente nuevo conserva el primer contenido, distingue
   versiones de origen, ID de entrega y hora de lectura, deduplica y rechaza
   conflictos. Se conservan campos JSON/Timestamp y extensiones de metadatos; se
   rechazan tipos no admitidos. No es un serializador general de CloudEvent/SDK.
2. Un callback antiguo exacto comienza antes del registro de pausa, espera antes
   del trabajo externo y termina después. Cero operaciones nuevas activas no
   borra ese trabajo ni demuestra que no hubiera otras operaciones anteriores.
3. Un proveedor de registro acepta los argumentos exactos del puerto de la VM
   antigua. El callback termina con un error de respuesta perdida; una escritura
   real diferida en Firestore termina después y crea un aviso descendiente
   capturado. Ambos siguen sin resolver.
4. Un envío FCM incierto queda como posiblemente entregado, sin reintento
   automático ni aviso sustitutivo. La ausencia de registro no demuestra no envío.
5. El conjunto finito conocido se concilia con el origen actual mediante el CAS
   existente de época/revisión inicializado. Los comandos obsoletos no sustituyen
   la autoridad nueva. La barrera real rechaza el paquete del ensayo.
6. Un evento nuevo invalida el manifiesto congelado antes de escribir la proyección.
7. La autoridad ausente no aprovecha la compatibilidad antigua de ambos valores nulos.
8. El aviso terminado se vincula al contenido original y a su imagen/versión final;
   cambiar después su contenido invalida la conciliación.

Solo `knownFixtureReconciliationReady` puede pasar a verdadero para el universo
finito declarado. Cada evaluación conserva `legacyUntracked:true`,
`physicalHandoffReady:false`, `canApply:false` y `canClaimClosure:false`.
El comando de proyección usa transacciones reales del emulador; no es el escritor
de Sheets de producción. El proveedor de registro no demuestra el comportamiento
real de aceptación o cancelación de Drive/FCM.

Esta suite no demuestra la entrega duradera del broker, la política de fallo de
persistencia/ACK, el censo completo del trabajo antiguo, las transiciones al
vencer un arrendamiento ni la exclusión externa mantenida. Perder la respuesta
del SDK comprueba el estado conservado, no la durabilidad del broker. El bloqueo
anterior en copia se reutiliza como límite; no se simula como una prueba nueva.

La época de escritura monótona y las comprobaciones de revisión activa siguen
siendo obligatorias al reabrir de forma controlada. La recuperación puede
restaurar datos de negocio, pero no reglas permisivas ni un escritor antiguo que
evite esas comprobaciones.

## Política aceptada y alternativas de custodia no seleccionadas

[HU-085](../../spec/shifts/hu-085-production-shift-workbook-activation/spec.md)
exigía primero cero escritores continuados del archivo y después el runtime como
único escritor físico. El ADR-0021 sustituye solo la exclusión absoluta del
propietario identificado por un acuerdo acotado. Se mantienen los demás controles
de escritores/efectos; no permite sustituir el archivo de forma silenciosa.

| Alternativa | Condición pendiente o contrapartida |
| --- | --- |
| Conservar el ID y la exclusión absoluta del propietario | No seleccionado; exigiría un control real mantenido del propietario, hoy desconocido |
| Custodia gobernada, traslado o transferencia | Decisión separada y prueba real en un archivo de ensayo que conserve ID/enlace, contenido e integraciones; aquí no se elige destino ni transferencia |
| Nueva proyección controlada | Cambia expresamente el destino/enlace y la custodia; el archivo anterior se conserva según lo acordado, sin sustitución automática |
| Ventana operativa sobre el archivo personal actual | Aceptada en ADR-0021/HU-085; entrada de versión 2 probada localmente; pendientes proveedor real, operaciones de Sheets y ensayo del procedimiento en copia |

No se presupone que una cuenta de servicio pueda ser propietaria del archivo.
Hay que verificar aparte la custodia, el almacenamiento, los permisos y la
recuperación reales. La consulta de solo lectura del conector no encontró
unidades compartidas para la cuenta conectada. No demuestra que la asociación
carezca de Workspace ni que otra cuenta no tenga acceso. El mantenedor cree que
solo se usan cuentas personales, aunque no tiene certeza completa. Es una
hipótesis provisional, no una ausencia de Workspace verificada ni una aprobación
de cambios de custodia.

### Decisión aceptada si se usan cuentas personales

No exigir contratar Workspace ni transferir la propiedad para este trabajo.
Se usa una ventana de mantenimiento acotada sobre el mismo archivo: confirmar
que propietario y editores han cerrado la hoja sin cambios sin conexión pendientes,
restringir temporalmente a los demás editores, admitir solo los comandos revisados
del backend y comparar revisión/contenido antes y después de cada lote. Se
conservan las fechas y el orden publicados; se restituyen los permisos acordados
después de conciliar. Sigue haciendo falta inventariar los escritores y sus
credenciales; los efectos antiguos de Admin y los avisos posiblemente entregados
siguen bloqueando el avance.

El propietario conserva la capacidad técnica de editar. Por eso esta propuesta
depende de su colaboración y detecta algunos cambios; no elimina la carrera
entre lectura y escritura, no garantiza detectar cambios transitorios ni demuestra
un escritor único físico. Un cambio observado o una incertidumbre detiene el
avance automático y exige conciliación, sin reintentar ni deshacer a ciegas una
escritura incierta.

**El mantenedor ha aceptado expresamente cambiar solo la garantía absoluta de
exclusión del propietario de HU-085.** Se mantienen las demás condiciones de
admisión, conciliación de eventos/efectos, época/revisión y notificaciones. La
especificación y el ADR alineados registran la política, no la disponibilidad
operativa. La adaptación local del contrato descrita más abajo precede al ensayo
del procedimiento en copia, autorizado aparte, y a cualquier petición de permisos
de mantenimiento real.

Google documenta que [proteger rangos no permite retirar permisos al propietario](https://support.google.com/docs/answer/1218656?hl=es),
que [el bloqueo de contenido es global y modificable](https://developers.google.com/workspace/drive/api/guides/content-restrictions)
y que [no se puede transferir la propiedad a una cuenta de servicio](https://developers.google.com/workspace/drive/api/guides/transfer-file).
Cambiar a otro propietario personal solo traslada esa misma capacidad.

## Contrato de entrada operativa y ensayo local — 28-10-2026

La factoría explícita del propietario en el [adaptador existente](../../functions/src/shift-planning-trusted-intake-barrier-adapter.ts)
usa el [contrato de acuerdo](../../functions/src/shift-planning-owner-maintenance.ts),
el almacén de evidencias y el CAS de mantenimiento actuales. No añade otro
controlador, registro de operaciones, Function exportada ni ajuste de despliegue.

- El inventario estricto conserva 26 grupos y 20 controles de entrada. La variante
  del propietario tiene 27 grupos y 21 controles: mantiene la exclusión técnica
  de los demás editores y sus cambios sin conexión, y registra al propietario
  como `agreement-recorded`, con capacidad técnica retenida. Se conservan los
  otros 25 grupos y las seis comprobaciones de activación.
- La versión 2 vincula entorno, archivo, propietario, participantes, ventana/plazo,
  operación/manifiesto, autoridad, origen y época/revisión a las confirmaciones,
  ámbito, estado retenido, evidencia y recibo CAS. Propietario=controlador solo
  admite la acción exacta de permisos/protección sellada por separado y el cierre
  de sus credenciales; el operador con solo invocación no puede usar esa identidad.
- Antes y después del callback se consulta una observación nueva del propietario
  y el reloj real. El estado técnico inmutable conserva el acuerdo histórico;
  no afirma una exclusión ni vigencia actual del propietario. Su retirada,
  actividad comunicada aunque el contenido no cambie, escrituras inciertas,
  cambios de autoridad/participantes o vencimiento detienen el avance.
- El fallo vuelve a comprobar el cierre técnico y conserva un incidente tipado
  en el registro existente, vinculando acuerdo, fase, motivo y digest observado.
  Si no puede demostrar cierre o retención duradera, falla de forma cerrada sin
  afirmar que guardó el incidente. No reintenta, revierte ni reabre automáticamente.
- Repetir una entrada terminada de versión 2 lee el recibo CAS exacto, comprueba
  su pertenencia actual y el registro de fallos antes y después, y no llama al CAS
  ni a los controles. Puede consultarse tras vencer; no renueva la admisión ni
  certifica que terminara la comprobación final de la llamada original. Las
  escrituras y avisos posteriores necesitan otra admisión vigente; el recibo no la da.

La [nueva suite de emulador](../../functions/test/shift-planning-owner-maintenance.emulator.test.cjs)
usa evidencias, recibos, imágenes finales y testigos reales de Firestore en
proyectos demo fijos. Los puertos locales representan cierre técnico y avisos del
propietario; no demuestran IAM/Drive reales, entrega desplegada ni vaciado del
proveedor. Este contrato cubre la entrada a mantenimiento con la hoja inmutable.
No es el escritor de lotes de Sheets: las operaciones posteriores aún necesitan
su imagen final prevista y protección revisadas, además de autorización en copia/real.

Aceptación sobre la base entregada `3aafe4e8`: Node 22.23.4, build de Functions
y lint completo correctos. La ejecución conjunta con emulador aislado pasa
**438 pruebas, cero fallos ni saltos**, incluidos seis casos nuevos de contrato,
18 de entrada/persistencia, los repositorios anteriores de barrera/estado, todos
los casos del planificador y los 28 de pausa/relevo previos. Las 51 pruebas que
se omitían sin emulador se ejecutan en esta pasada final. La revisión independiente
de fuente no encontró bloqueantes pendientes.

La primera pasada ampliada se conserva como diagnóstico: detectó una expectativa
21/27 incorrecta, un dato antiguo de prueba inversa sin su apartado explícito de
espaciado y un error de política de compensaciones que escapaba al rechazo duradero
del origen. Se corrigen esas causas: el bloqueo de publicación de compensaciones
sigue cerrado; solo su indisponibilidad tipada concreta pasa al fallo existente
`fairness_input_drift`. Los errores de red/programación siguen propagándose.
Los comandos exactos, hashes, TAP y registros inicial/final están en el paquete
privado `2026-10-28-owner-maintenance`. El contrato se validó sobre `3aafe4e8`;
no cambia recursos compartidos, código nativo ni ajustes de despliegue.

## Lecturas reales y lotes de Sheets protegidos — 28-10-2026

El contrato de entrada está entregado en `2690528e`. El bloque local actual
conecta [la composición concreta](../../functions/src/shift-planning-owner-sheets-composition.ts)
con el SDK público de Google y los registros existentes de comando, autorización,
envío y exclusión del archivo en Firestore. No añade una Function, un cambio de
despliegue, un registro paralelo ni otro controlador de reintentos.

El lector directo fija archivo e identidad de permisos del proceso, pagina los
permisos y observa propietario, capacidades, restricciones, protecciones,
metadatos y cuadrículas seleccionadas con límites. Los datos ausentes, denegados
o incompletos siguen siendo desconocidos. Leer solo metadatos de una pestaña no
demuestra sus celdas. La omisión de `contentRestrictions` vacío se normaliza solo
en el colector directo de confianza; el resumen del conector no es esa prueba.
Se sustituye la capacidad obsoleta por los
[campos actuales de editor, propietario y retirada](https://developers.google.com/workspace/drive/api/reference/rest/v3/files).

La autorización revisada vincula el manifiesto completo de preservación y los
digests del lote y proyección con acuerdo, comando, linaje, época y reclamación.
El [compilador de preservación](../../functions/src/shift-sheets-owner-manifest.ts)
solo admite las cinco peticiones del adaptador: `addSheet`, ampliaciones con
`updateSheetProperties`, `updateCells` acotado a `userEnteredValue` y creación o
actualización de su marcador. Comprueba valores y borrados esperados, conserva
valores no afectados, formatos, notas, texto enriquecido y validaciones observados
y rechaza cambios de pestañas o controles no revisados. Solo se modifican
cuadrículas observadas completamente. Siguen vigentes los presupuestos de
peticiones, lectura, dimensiones y persistencia.

Se leen controles frescos antes de enviar, verificar y completar, incluso si ya
hay prueba física guardada. La última transacción de Firestore compara versión
exacta de la autorización fijada, digest del informe del propietario, acuerdo
inmutable y ausencia de incidencia, además de comando, época y plazo actuales.
Justo antes de llamar al SDK se comprueba el plazo sin suspensión. Una retirada
o deriva observada se conserva en la misma autorización o recibo; restaurar
contenido o permisos no borra la incidencia. La exclusión del archivo dura hasta
completar el comando entre particiones; los consumidores antiguos lo rechazan.

La llamada física sigue siendo un único `batchUpdate` sin reintentos del SDK.
Si se pierde la respuesta solo se inspecciona: la imagen final exacta y controles
vigentes pueden resolver el resultado; la incertidumbre conserva incidencia y
exclusión. La [atomicidad de Google](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets/batchUpdate)
no ofrece compare-and-swap frente a colaboradores. No elimina carreras del
propietario, prueba cancelación ni garantiza que el servidor termine antes del
plazo local. La evidencia técnica histórica no acredita una pausa actual: el
lector independiente de controles vigentes es obligatorio y, si falta, bloquea.
El drenaje real de escritores antiguos y su autoridad efectiva siguen pendientes.

### Paquete del ensayo en copia

La preparación de solo lectura encontró la copia nativa aislada anterior y sus
siete pestañas. El conector omitió versión, capacidades y restricciones directas
de Drive; siguen siendo desconocidas. No se cambiaron celdas, permisos,
identidades ni originales. Identidad, lecturas y propuesta de acceso y ventana
quedan en el paquete privado `2026-10-28-sheets-maintenance-controls`.

`prepareCopyRehearsal` deriva lote y manifiesto mediante el adaptador real, filas
sintéticas del emulador y lecturas del SDK. No tiene vía de envío físico, no
reclama comandos ni escribe recibos o incidencias y siempre devuelve
`canApply:false`. Su prueba local no es un ensayo con el proveedor real.
El escenario preparado es una pestaña canónica de reparto con nombre único y
filas sintéticas, conservando las siete existentes y dejándola para revisión.
Borrar pestañas a ciegas no es una recuperación admitida.

Antes de una ejecución autorizada por separado:

1. Revisar copia exacta, identificadores protegidos de originales, manifiesto
   sintético, imágenes anterior/final y ventana (máximo propuesto: 20 minutos).
   Aún no se han recogido fechas ni confirmación del propietario.
2. Autorizar nueva identidad sin claves y permisos temporales exactos de token
   y copia; comprobar autoridad efectiva y lectura directa. Compartir solo esta
   copia. La identidad anterior sigue deshabilitada; no se reutiliza OAuth
   revocado ni datos reales. Firestore permanece en el emulador local y `demo-`.
3. Confirmar que el propietario está en línea, ha cerrado la copia, no tiene
   cambios sin conexión pendientes y no editará durante la ventana. Recoger
   controles reales frescos; una pausa del emulador no autoriza activar develop.
4. Ejecutar solo el lote revisado. Ante ambigüedad, conservar recibo e inspeccionar;
   no reenviar, borrar pestañas, restaurar permisos ni deshabilitar el proceso
   hasta reconciliar resultado y contención.
5. Tras un resultado terminal conocido, comprobar preservación y permisos,
   retirar y comprobar los permisos temporales exactos de token y copia,
   deshabilitar la identidad y conservar resultados sin secretos en privado.

Este paquete no autoriza esas acciones. No hace falta una acción del usuario
para la implementación local. El ensayo en copia, despliegue compartido, cambios
en originales/develop/producción, migración y notificaciones siguen separados.

Aceptación local sobre `2690528e` entregado: Node 22.23.4, build y lint completo
de Functions y cinco comprobaciones de sintaxis CJS correctos. La ejecución
conjunta en Firestore aislado pasa **622 pruebas, cero fallos/omisiones**,
incluidos 29 casos nuevos de composición concreta, la lista completa del
planificador, los repositorios de barrera/estado/Sheets y los casos anteriores de
relevo/pausa. El protocolo de Google registrado ejercita el adaptador real; no
demuestra IAM del proveedor, entrega/drenaje real ni escrituras físicas.
La revisión independiente no encontró bloqueantes para este alcance local.
Los cinco fallos iniciales al comparar huecos de array con `null` de JSON se
corrigieron conservando las comprobaciones de celdas y contenido. Logs iniciales
y finales, comandos, hashes y lecturas de la copia quedan en privado. El emulador
está detenido. Este bloque sigue local y sin commit; no cambia código nativo ni
exportaciones de despliegue, por lo que no requiere nuevas pruebas Android/iOS
ni introduce una diferencia funcional entre plataformas.

## Validación y condición pendiente

Este ensayo se validó sobre la base `f5c3b5db`. Con Node
22.23.4 pasan `npm run build`, `npm run lint` y la comprobación de sintaxis de ambos
archivos CJS. El emulador aislado de Firestore `demo-reguerta-writer-controls`,
puerto 8897, ejecutó ambas suites juntas: **28 correctas, cero fallos ni saltos**
(ocho casos nuevos y 20 anteriores sin cambios). Después se detuvo el emulador.
Los comandos exactos, la vinculación al ejecutable desplegado auditado, los hashes
y el TAP completo están en el paquete privado `2026-10-28-backend-handoff`.
La revisión independiente de fuente y evidencias no encontró bloqueantes para
este alcance local. No cambian las apps; no hace falta otro build ni ensayo físico.

Antes del relevo operativo hay que establecer la entrega duradera real y el
control efectivo de los escritores antiguos de develop y sus efectos enviados.
Las vías compartidas con Admin SDK eluden las reglas de cliente; un registro
nuevo no puede contar su trabajo anterior. Hay que demostrar el aislamiento
selectivo o la vía de mantenimiento compartido acotado con autorización separada.
Aquí no se elige un proyecto nuevo ni un cierre general; ningún timeout o periodo
sin actividad sustituye esa prueba.

Este documento no autoriza escrituras en archivos reales, permisos, despliegues
ni activaciones. Un resultado local correcto no certifica la entrega duradera
del proveedor, el vaciado del runtime anterior, los controles de otros escritores
ni un acuerdo operativo vigente del propietario. El paquete real sigue necesitando pruebas actuales del proveedor,
vinculaciones exactas de fuente/autoridad y operaciones de aplicación/recuperación
autorizadas por separado; **se mantiene obligatoriamente `canApply:false`**.


## Ensayo autorizado en la copia real — 28-10-2026

Este punto sustituye el estado anterior de copia solo preparada; se conserva sin
cambios el resultado histórico de 622 pruebas locales. La ejecución autorizada
por separado utilizó la copia aislada existente, datos sintéticos de mercado y
un token real del SDK de Google. Envió **un único `batchUpdate` físico: 45
peticiones para diez filas de mercado en una pestaña nueva**. Los digests
completos de las siete pestañas anteriores fueron idénticos antes y después,
comprobados antes de completar el comando. La pestaña nueva queda para revisión.

La variante explícita `isolated-copy-runtime` usa un acuerdo de copia de esquema
2 y autoridad vinculada a esa copia. Su operador es la instancia real del proceso
local, sin inventar una segunda persona ni un principal IAM con permiso exclusivo
de invocación. Identidad, permisos y scopes exactos, vencimiento del token, bloqueo
del proceso, contadores reales del SDK y el recibo/puntero de envío existentes
limitaron la ejecución a esta copia y su proyecto demo de Firestore en localhost.
No se construyó una barrera ficticia de los 27 grupos de develop. La barrera
compartida por defecto y los requisitos de escritores antiguos no cambian.

La identidad de copia sin claves recibió un permiso temporal acotado y un token
de 300 segundos con solo los scopes de Sheets y lectura de metadatos de Drive.
El cliente del SDK que recibe únicamente ese token fija un umbral de refresco
anticipado de 1 ms y `forceRefreshOnFailure:false`: en el SDK instalado, cero
activa el valor por defecto de cinco minutos e intenta refrescar un token corto
aún válido. Las pruebas focales y la llamada real comprobaron esta configuración;
el escritor no usa ADC ni renueva automáticamente el token. Otro desajuste real
se corrigió solo para la copia: el propietario exacto del archivo y del acuerdo
puede tener también un permiso heredado de escritura, porque no añade otro actor
a su capacidad ya reconocida. Siguen rechazados el escritor técnico heredado, los
grupos con escritura y los escritores adicionales.

El proceso comprobó propiedad, contenido e inode del bloqueo y los plazos antes
del envío, contó la llamada real del SDK y conservó su intención duradera antes
de enviarla. Los controles actuales del proveedor y la comparación completa de
preservación precedieron a la verificación y finalización. El comando real del
emulador quedó en `completed`, liberó la exclusión de mercado y creó cero eventos
de notificación; los contadores finales fueron un envío, cero en curso y cero
inciertos. Los intentos bloqueados anteriores enviaron cero lotes del SDK; sus
incidencias se conservaron, sin borrarlas para reutilizar una autorización.

Tras una primera lectura IAM aún desactualizada, la limpieza idempotente repetida
y una lectura actual confirmaron: copia compartida solo con su propietario,
nueva identidad de ensayo deshabilitada, sin claves propias, roles
del proyecto ni permisos temporales, rechazo del bearer original todavía vigente
y rechazo de una nueva emisión de token (ambos observados como 404). Recibos,
imágenes completas, diagnósticos y limpieza quedan en el paquete privado
`2026-10-28-isolated-copy-rehearsal`; aquí no se incluyen cuentas, identificadores
de archivos, credenciales ni datos de negocio.

Esto demuestra la vía física acotada de la copia. No acredita la entrada duradera
de develop compartido, el control efectivo de escritores antiguos y sus efectos
ni la autoridad operativa. No hubo acceso a archivos originales o de producción,
operaciones sobre datos compartidos de Firebase, liberación de avisos ni
despliegues. La admisión compartida mantiene `canApply:false`. La validación final
pasa build/lint completo de Functions y **661 pruebas conjuntas de emulador y
regresión, cero fallos ni saltos**. Ambos bloques revisados se incluyen en este
punto de entrega; el commit exacto y la comprobación remota quedan registrados
en #268/#269 y la PR borrador #278. Sigue abordar la entrada, los escritores
antiguos y la autoridad de develop compartido; HU-084 y HU-085 siguen abiertas.

## Entrada duradera de develop y puente sobre el baseline — 28-10-2026

Este es el siguiente bloque de implementación tras aceptar el ensayo en copia.
Prepara código de captura y contención; no acredita un despliegue compartido,
la captura completa del historial ni el vaciado de operaciones antiguas. La
aceptación anterior de 661 pruebas pertenece a los bloques previos. La validación
de este bloque debe registrarse por separado tras comprobar su código y paquete.

### Una captura común, sin reejecutar callbacks antiguos

La [entrada duradera](../../functions/src/develop-shift-intake.ts) solo escribe
bajo `shiftPlanningDevelopIntake/current`, fuera del permiso amplio por
entorno/dataset de las Rules desplegadas. Los clientes de socios, administradores
y sin autenticar deben tener denegadas todas las lecturas y escrituras ahí.
Una transacción de
Firestore conserva metadatos originales, imágenes anterior y posterior con tipos
en fragmentos acotados, identidad lógica del evento e identidad de su entrega,
y avanza `captureRevision`. Solo después confirma la recepción. Una entrega
repetida no sustituye el contenido original; las entregas con distinto ID de una
misma versión del documento comparten una captura lógica. Los tiempos del origen
conservan nanosegundos; los tiempos de entrega y lectura se distinguen de la
identidad de la versión del documento.

El formato admite mapas/listas simples, timestamps, geopuntos, bytes, vectores
y todos los valores numéricos. Rechaza expresamente referencias a documentos,
objetos SDK no admitidos, getters, contenido superior a 4 MiB o metadatos de más
de 256 KiB. No recorta ni confirma contenido que no haya guardado. Es un formato
acotado de inspección, no un serializador general del SDK. Una entrega antigua
sin reintentos que se rechace sigue siendo un hueco histórico; antes de admitir
el relevo compartido hay que verificar los tipos usados y observar los fallos.

La captura no tiene puerto de Sheets/FCM, ejecución de negocio, reproducción de
callbacks ni vía de activación. Cada captura nueva cambia la revisión que debe
vincular un futuro manifiesto causal; el anterior no describe ese conjunto más
reciente. Esta entrada aún no está conectada a un lector operativo de confianza
que demuestre vaciado y autoridad. Sus contadores son diagnósticos,
`legacyUntracked` sigue siendo true y la inspección devuelve
`canClaimClosure:false` y `canApply:false`. Ni una colección vacía ni la ausencia
del estado del planificador demuestran que no existiera trabajo anterior.

El [puente](../../functions/src/develop-shift-intake-bridge.ts) envuelve los
callbacks desplegados y auditados, conservando su registro y opciones del SDK.
Sus cuatro callbacks de eventos originales capturan las entregas de develop
antes de terminar, incluidas las generadas antes de existir los colectores nuevos.
Sus dos callbacks HTTP originales resuelven el entorno con el mismo resolvedor
del baseline y rechazan develop con HTTP 503 antes de ejecutar trabajo antiguo.
La ruta exacta de producción invoca el callback original sin construir ni leer
la entrada; los valores de entorno no admitidos bloquean la operación.

Cuatro exportaciones adicionales solo capturan, con rutas fijas de develop y
`retry:true`: `captureDevelopShiftPlanningRequest`, `captureDevelopShiftWritten`,
`captureDevelopDeliveryCalendarWritten` y `captureDevelopNotificationCreated`.
Usan el mismo repositorio de captura que los callbacks originales. Así pueden
solaparse durante la transición sin ejecutar dos veces los efectos de negocio.

### Paquete reproducible y propuesta de despliegue ordenado

El [constructor del paquete](../../functions/scripts/prepare-develop-intake-bridge.cjs)
exige los digests auditados del ZIP y JavaScript desplegados. Empaqueta ese
baseline junto con la entrada y el puente, sin desplegar el `index.ts` actual
de la aplicación. Conserva exactamente el lockfile; el único cambio del paquete es
`scripts.gcp-build = ""`, para que el buildpack no ejecute el antiguo `tsc` ni
sobrescriba la entrada preparada. Las versiones siguen siendo:
`firebase-admin` 13.4.0, `firebase-functions` 6.3.2,
`@google-cloud/firestore` 7.11.1 y `googleapis` 144. El runtime preparado, los
manifiestos de fases y la configuración de Firebase quedan en el paquete privado
de evidencias; no se copian secretos, archivos de entorno ni exportaciones ajenas
de la aplicación. Construir el paquete no lo despliega.

La opción global auditada `preserveExternalChanges:true` evita que los valores
de reinicio del SDK sustituyan la identidad, los límites o el ingreso del runtime
actual. Los cuatro colectores nuevos fijan un máximo de 20 instancias. La CLI
instalada conserva las variables de entorno existentes si no se aporta un
archivo dotenv; sus valores siguen en privado y el plan vincula sus hashes.
Los seis constructores y cuerpos originales se conservan, con sus envolturas
explícitas de callback. El despliegue aún exige verificar la configuración antes
y después. Ambas configuraciones descubren las diez exportaciones: cada fase
requiere el selector `--only` exacto de cuatro o seis del manifiesto; el nombre
del archivo de configuración no limita por sí solo las Functions desplegadas.

La operación compartida propuesta mantiene este orden y autorización separada:

1. Crear solo los cuatro colectores nuevos. Comprobar sus filtros exactos de
   develop, destinos y reintentos, y verificar captura duradera por las cuatro
   rutas antes de modificar ningún callback original.
2. Actualizar solo los seis callbacks del baseline con el puente, conservando
   el comportamiento de producción. Mantener ambas vías de captura durante la
   transición; no borrar un destino solo porque ya esté desplegado su sustituto.
3. Reconciliar invocaciones antiguas, eventos causales retrasados y efectos ya
   enviados al proveedor; establecer controles efectivos de escritores y
   autoridad con comprobaciones actuales. Solo esa evidencia posterior puede
   sustentar una barrera de confianza y la entrada en mantenimiento.

La [guía de migración de Functions](https://firebase.google.com/docs/functions/manage-functions)
exige desplegar el sustituto antes de retirar el original e idempotencia durante
el solapamiento. El paquete aporta esa captura común; no decide por sí mismo
despliegues, reversiones ni cierres del proyecto compartido.

### Límites de entrega e historial que siguen bloqueando

Firestore entrega sin orden garantizado y al menos una vez; el orden de llegada
no es una secuencia de negocio. Las [limitaciones de sus triggers](https://firebase.google.com/docs/firestore/extend-with-functions-2nd-gen)
también indican que las escrituras del Admin SDK eluden las reglas de cliente.
Por tanto, la captura y el cierre de Rules no revocan por sí solos las
invocaciones privilegiadas anteriores.

Los cuatro triggers originales desplegados tienen
`RETRY_POLICY_DO_NOT_RETRY`. Una captura fallida allí puede perderse; añadir
colectores con reintentos no modifica retroactivamente los destinos antiguos ni
recupera su cola previa. El [contrato de reintentos de Firebase](https://firebase.google.com/docs/functions/retries)
fija una ventana finita de 24 horas para segunda generación.
[Eventarc Standard](https://docs.cloud.google.com/eventarc/standard/docs/overview)
documenta una retención por defecto de 24 horas y advierte que los eventos
generados antes de actualizar un trigger pueden seguir el filtro y destino
anteriores durante tres días. Estos límites de transporte no certifican el
vaciado ni permiten borrar una operación desconocida por haber esperado.

Una captura complementaria del estado actual, identificada como tal, puede
describir los documentos que aún existen. No reconstruye documentos borrados,
versiones intermedias sobrescritas, entregas históricas ausentes ni avisos que
FCM ya aceptó sin un recibo terminal fiable. Esos huecos y avisos posiblemente
entregados siguen sin resolver; no se reenvían automáticamente. Un callback
antiguo interrumpido, una exclusión vencida, un error absorbido o una respuesta
externa ambigua no pueden convertirse en un resultado terminal satisfactorio.

La siguiente condición operativa sigue siendo controlar y reconciliar los
escritores antiguos de develop y sus efectos. Este bloque de código no borra
`legacyUntracked` ni activa develop compartido, migraciones, producción o
notificaciones. HU-084 y HU-085 siguen abiertas.

La validación acotada se ejecuta desde `functions` con
`npm run test:shift-planning:develop-intake:emulator`, indicando los archivos
privados auditados en `HU084_DEPLOYED_LEGACY_JS` y
`HU084_DEPLOYED_LEGACY_ZIP`. `HU084_LEGACY_RUNTIME_METADATA` puede vincular la
lectura de configuración de las seis Functions al manifiesto de preparación.
La ausencia de esos metadatos no autoriza un despliegue. El archivo fuente, los
valores de entorno y el paquete generado se conservan fuera de Git.

### Validación local aceptada antes del ensayo real

Con Node 22.23.4 pasan build y lint completos de Functions y **695 pruebas
conjuntas**, sin fallos ni omisiones. Ocho casos de producción ejecutan el
JavaScript transformado por el generador tras verificar el hash original: las
trazas y los datos finales de los seis callbacks positivos coinciden, incluidos
dos casos HTTP adicionales sin entorno explícito que resuelven a producción.
La ruta privada deniega get/list/create/update/delete a socios, administradores
y clientes sin autenticar con las Rules capturadas y con las preparadas.

El paquete instalado por separado carga los SDK reales fijados de Admin 13.4.0,
Functions 6.3.2 y Firestore 7.11.1. Sus diez exportaciones conservan los filtros,
reintentos y metadatos previstos; ocho callbacks locales retienen cuatro eventos
y cuatro entregas sin enviar nada a Sheets/FCM. Los hashes ejecutables no cambian
durante la validación. Logs, paquete, configuración privada y recibos quedan en
`2026-10-28-durable-develop-intake`, fuera de Git.

En el proyecto compartido solo se ha leído la configuración y procedencia de
las seis Functions: sus fuentes siguen iguales. No se han modificado datos
compartidos, desplegado cambios, accedido a hojas ni enviado avisos reales.
Android/iOS no cambian y se reutilizan sus pruebas físicas aceptadas. Siguen
pendientes el despliegue, la conciliación de efectos antiguos y la autoridad
vigente; se mantiene `canApply:false`.

### Primera fase compartida autorizada y corrección del proveedor

El mantenedor autorizó únicamente los cuatro colectores nuevos de develop en
`reguerta-9f27f`, con la cuenta de ejecución existente, y cuatro registros
temporales de creación exclusiva y borrado condicionado. La CLI 15.15.0 se limitó
a sus nombres exactos tras descartar colisiones de prefijo en ambas generaciones
y todas las regiones. Las seis Functions antiguas conservan fuente, configuración
y comportamiento; su puente está preparado, pero no desplegado.

Las primeras entregas protobuf reales revelaron un caso que no cubría el ensayo
anterior con snapshots de consulta: el SDK lanza una excepción al leer `readTime`
en las imágenes locales de los eventos. Al vencer esa primera comprobación se
borraron los cuatro registros verificando su contenido y versión exactos.
La corrección admite la ausencia de hora de lectura solo para un
`DocumentSnapshot` real que lance el error exacto del SDK fijado; sigue rechazando
los demás errores y exigiendo la versión original de documentos existentes.

La validación final pasa build/lint completos y **697 pruebas conjuntas**, con
protobuf y decodificadores públicos del trigger. El paquete instalado con los SDK
reales 6.3.2/Firestore 7.11.1 ejecuta **20 callbacks**, incluidas creación y
eliminación protobuf sin proyección, y conserva diez capturas/entregas sin enviar
nada a Sheets/FCM. La fixture local 7.3.2 excluye expresamente solo sus getters
derivados de compatibilidad V1 al proyectar la forma CloudEvent del baseline 6;
producción no relaja así los metadatos. Se conservan ambos archivos desplegados
y coinciden los seis ficheros del paquete aceptado en las cuatro Functions reparadas.

Las mismas suscripciones de Eventarc volvieron a entregar las **cuatro creaciones
originales y los dos borrados**, sin recrear registros, reproducir eventos a mano
ni hacer pull/seek/ACK. Coinciden contenido, versiones y hashes; los cuatro
documentos temporales siguen ausentes. El registro privado queda con seis eventos,
seis entregas y revisión seis, manteniendo `legacyUntracked:true`. Esta evidencia
positiva no certifica todo el historial del broker ni el vaciado antiguo; una
página parcial de stderr no demuestra ausencia total de errores. Las lecturas
actuales verifican invocación autenticada por IAM, filtros exclusivos de develop,
reintentos y máximo de 20 instancias. El broker conserva plazo de ACK de 600
segundos, retención de 24 horas e intervalos de reintento de 10–600 segundos.

No se ha accedido a las hojas originales/de producción, cambiado datos de
producción ni enviado avisos del ensayo. Queda autorizar y controlar la pausa de
los escritores antiguos de develop, sus efectos pendientes y su autoridad.
Mantenimiento, migración y coberturas siguen bloqueados. El commit y su referencia
remota exactos se verifican en #268/#269; las pruebas quedan en el paquete privado
`2026-10-28-durable-develop-intake`.

### Pausa selectiva autorizada y conciliación de solo lectura

Tras la entrega `76a96826`, el mantenedor autorizó por separado las seis Functions
antiguas de `reguerta-9f27f` y cuatro registros ficticios de develop. Se utilizó
el mismo paquete aceptado: primero el emisor y después los otros cinco destinos
exactos. Las seis fuentes coinciden con los seis archivos permitidos. Se conservan
identidad, valores de entorno, límites, ingreso/IAM, filtros y reintentos, con todo
el tráfico en las revisiones nuevas. Los cuatro colectores y las otras 14 Functions
siguen intactos. Los cuerpos de producción son idénticos byte a byte; no se invocó
negocio de producción para probarlos. Esto no acredita ausencia total de
interrupciones durante el despliegue.

Las dos rutas de importación/exportación de develop responden HTTP 503 antes de
ejecutar negocio. Los cuatro registros de creación exclusiva generan cuatro
capturas de creación y dos de borrado; se verifican contenido/versión/hashes y se
limpian comprobando imagen y updateTime exactos. Una ventana paginada completa de
logs muestra los dos 503 y seis peticiones de eventos correctas en las cuatro
revisiones antiguas actualizadas. El registro pasa de seis a doce eventos,
entregas y revisiones y conserva `legacyUntracked:true`. Esto acredita las rutas
nuevas, no el fin del trabajo admitido por revisiones anteriores. **Se retienen
todos los avisos de develop**, incluidos pedidos; clientes, escritores de
usuarios/configuración, ediciones manuales y otros servicios quedan fuera de estas
seis protecciones. Ante fallos se conservan captura/cierre y se corrige hacia
delante. No se restauran callbacks sin protección ni se reabre por transcurso de tiempo.

Los censos anterior y posterior, cada uno con una readTime común, conservan los
mismos 183 documentos de negocio y versiones: cero solicitudes de planificación,
62 turnos planificados, cuatro ajustes de calendario y 117 avisos históricos.
Hay 55 no_tokens, 34 partial_success, 25 success y tres sin resumen de envío.
Estos últimos son comunicados administrativos creados el 01/04/2026, no fallos
nuevos de turnos. Ninguno queda autorizado para reenvío automático. Un resultado
mutable/no_tokens no acredita todo el historial de envíos; un fallo de planificación
puede producirse después de escribir en Sheets.

`functions/scripts/inspect-develop-legacy-census.cjs` inspecciona fuera de línea
un censo REST privado: rutas exactas de develop, conjuntos completos de
capturas/entregas/fragmentos, hashes, identidades y relación de versiones/contenido
actuales. Vincula huella y revisión, mantiene desconocidos los efectos externos y
deniega reproducción/aplicación/cierre. La atomicidad es la declarada por el lector,
no una certificación independiente. Un prefijo de prueba no otorga exención.
Se ejecuta con `--input <censo-privado.json> --output <informe-privado-nuevo.json>`
y solo crea un archivo local nuevo con permisos 0600. Datos, recibos y fuentes
quedan fuera de Git. La inspección no modifica negocio ni el registro de eventos.

No hubo acceso a las hojas originales/de producción ni envío FCM del ensayo.
Mantenimiento y migración compartidos siguen cerrados hasta evaluar por el cauce
previsto efectos históricos y autoridad vigente. Contener estos seis puntos de
entrada no cierra los demás escritores ni borra `legacyUntracked`.

### Controles restantes de clientes y administración

El bloque anterior está entregado en `f141a902`. La continuación añade
`stableSetDigest` al censo completo sin cambiar su huella de procedencia. Dos
lecturas reales de los mismos 183 documentos y doce capturas conservan esa huella
estable y cambian la vinculada a readTime. Sirve para ligar el conjunto causal
existente; ninguna huella acredita vaciado, fuentes canónicas, autoridad vigente
ni cierre de confianza.

`prepare-develop-rules-pause.cjs` recibe rutas absolutas con `--capture`,
`--candidate` y `--output`. Fija baseline/release reales y candidato revisado,
crea un paquete privado nuevo limitado a Rules y no accede a la red ni despliega.
El ejecutor real aún exige consentimiento, un único publicador, comparación
inmediata antes de publicar y lectura posterior exacta de su resultado. El PATCH
de la release no ofrece CAS. El candidato cierra **todas** las escrituras de
clientes develop, incluidos productos/pedidos/configuración/dispositivos, y
conserva lecturas y condiciones de producción. Admin SDK/IAM eluden este cierre.

El censo real acotado observa 27 permisos directos, ninguno condicionado, dos
cuentas de usuario propietarias y 23 de las 24 Functions compartiendo Compute
con Editor. Las cuatro cuentas de servicio inspeccionadas no tienen claves
creadas por usuarios, pero el proyecto permite administración y suplantación.
No se devuelve parent. No se inspeccionaron políticas deny, límites de acceso de
principales, sesiones ni procesos externos. No se cambió ningún permiso y este
censo no certifica exclusividad.

La prueba preparada utiliza una identidad Auth temporal con contraseña, sin socio
ni permisos especiales, su ID token solo en memoria y un documento ficticio fuera
de los cuatro filtros de triggers. Comprueba admisión del cliente en baseline y,
tras el candidato, denegación de crear/actualizar/borrar y conservación de lectura.
La limpieza exige creación confirmada, identidad de creación y updateTime exacto;
los resultados ambiguos se conservan para conciliación. Se revoca/borra la cuenta
y descarta el token, sin afirmar invalidez instantánea de un ID token ya emitido.
Un único recibo exclusivo y el directorio privado de la CLI protegen frente a
repeticiones. No se permite cambiar negocio de producción, hojas, FCM, IAM o Functions.

Pasan build/lint completos y 159 pruebas conjuntas, incluida la matriz ampliada,
la huella estable y las negativas con la barrera existente. Reenvolver/recalcular
un censo no lo convierte en cierre de confianza; retained no equivale a disabled
o isolated. [ADR-0022](../decisions/0022-cooperate-with-develop-firebase-administrators.md)
propone cooperación de administradores humanos solo en develop. Hasta su decisión
e implementación expresas se mantienen las garantías estrictas/de propietario;
automatismos y efectos anteriores necesitan controles técnicos en ambos casos.
La ejecución real de Rules/Auth/prueba sigue pendiente de autorización separada.

La auditoría posterior confirma que ocho HTTP restantes coinciden con el archivo
antiguo; el resolvedor de acceso tiene una versión desplegada más reciente y debe
conservarse por separado. Hay tres jobs de recordatorios habilitados que hoy solo
apuntan a develop. El inventario v4 ya los exige con entrada deshabilitada antes de
capturar el conjunto causal, además de conciliar trabajo pendiente/en curso. Una
evidencia v3 que los omita no admite un cierre nuevo. No se ha pausado ni cambiado
el entorno de ningún job. Tras la corrección pasan 394 casos de planificación y
una tanda separada de 155 casos de controles/regresión, sin fallos/omisiones,
además de build/lint completos.

### Aplicación autorizada de Rules de clientes — 2026-10-28

El mantenedor autorizó expresamente la release limitada a Rules, una identidad
Auth temporal sin privilegios con contraseña y un documento ficticio de develop.
La confirmación de veinte minutos vincula proyecto, hashes, ejecutor y ventana.
El único intento terminó dentro del plazo. La CLI seleccionó solo `firestore:rules`;
las lecturas posteriores de fuentes inmutables coinciden con baseline y candidato
fijados de 7.389 bytes. No se seleccionó ninguna acción de Functions/Storage/índices.

Se verificó el ID token de Firebase contra el proyecto y UID temporal exactos.
La creación inicial del cliente devuelve 200; tras publicar, el primer intento
de actualizar, borrar y crear devuelve 403, y la lectura del mismo documento
conserva 200. La limpieza comprueba identidad/contenido/versión del documento;
la cuenta Auth se revoca/borra y se comprueba ausente. No hay credenciales/JWT
en recibos/logs conservados. Borrar la cuenta no afirma revocación instantánea de
todo ID token ya emitido; estas credenciales solo estuvieron en memoria y se
descartaron.

El censo real posterior conserva la huella estable completa: 183 documentos de
negocio sin cambios y doce eventos/entregas/revisión doce. El documento temporal
estaba fuera de los cuatro filtros de triggers y no produjo capturas de negocio.
No hubo llamadas a las hojas originales/de producción ni a FCM.

Esto cierra **escrituras directas de clientes en Firestore**. Las Rules no limitan
Functions, otros escritores Admin/IAM ni los jobs de recordatorios aún habilitados.
Aceptar ADR-0022 no declara esos controles bloqueados, no demuestra vaciado antiguo
ni admite mantenimiento compartido; se mantienen `legacyUntracked:true` y
`canEnterMaintenance:false`.
