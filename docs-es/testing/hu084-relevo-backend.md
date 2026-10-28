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
