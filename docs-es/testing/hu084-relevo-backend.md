# HU-084: diseño y ensayo local del relevo al backend

Estado: ensayo local y política de mantenimiento aceptada; **`canApply:false`**.
El mantenedor aceptó la colaboración del propietario identificado el 28-10-2026
en el [ADR-0021](../decisions/0021-usar-mantenimiento-acordado-con-el-propietario-en-hojas-de-turnos.md).
Esa decisión no autoriza cambios de custodia, despliegues ni mantenimiento real.

[English version](../../docs/testing/hu084-backend-handoff-rehearsal.md).

## Base actual

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
