# HU-084 — Preparación de permisos y ventana de develop

## Preparación actual — 2026-11-01

Las conexiones de la ventana original están publicadas en `5b24be80`. La nueva
[preparación concreta local](hu084-invocacion-concreta-develop.md) renueva evidencias
reales de Firestore, Cloud, escritor y propietario y regenera el paquete exacto.
No cambian los datos publicados, sus versiones ni las operaciones de negocio; sí
cambian los identificadores de operación al actualizar las evidencias. La inspección
real rechaza `window_scope_missing`. OAuth está revocado con negativa del mismo token
en Drive y Sheets. Sin mantenimiento, permiso al escritor, migración ni producción.
Quedan agrupadas la composición real de observaciones de la barrera y la conexión
nativa de permisos antes de solicitar ventana; las lecturas aisladas no son una barrera.


Estado: **solo preparación; sin fecha ni autorización de ejecución**. La evidencia
del escritor original y su integración en admisión están publicadas en `d42ce7fe`.
Este plan no concede acceso, abre mantenimiento, migra datos ni activa las apps.



## Conectadas observación, lote original y recuperación de sesiones — 2026-11-01

Validación terminada: Node 22.23.4, build, lint completo y CJS; **397 pruebas locales y 90 casos de emulador correctos**, sin omisiones. Cinco registros concretos releídos correctamente. Las tres últimas comprobaciones de rechazo en el constructor se añadieron después del emulador y se probaron en la suite local final, incluida la ida/inversa y recuperación correctas. Paquete y preparación exactamente iguales.

La revisión de adaptadores está publicada en `559e6b20`. Esta implementación queda
local. `createOriginalWindowSessions` proporciona las sesiones normal y de recuperación
al ciclo persistente existente, reutilizando IAM, Sheets, ejecutor/barrera Firestore y
presupuesto temporal. No crea otro planificador, credenciales por defecto, CLI,
despliegue ni operación para abrir mantenimiento.

- **Observación:** valida la hoja original de develop, carpeta, propietario y cuatro
  lectores exactos, con el escritor propio durante el trabajo y sin él al limpiar.
  Lee dos veces las seis pestañas completas entre lecturas de metadatos y permisos;
  conserva valores, formatos, notas, validaciones, combinaciones y metadatos. No se
  relaja el observador de solo lectura ni la exclusión de originales en las copias.
- **Permiso y versión:** comprueba la imagen revisada antes de conceder acceso. Si
  cambia la versión de Drive por el permiso, conserva la transición antes/después y
  exige celdas idénticas y ningún otro cambio de autoridad. El plan registra la versión
  real posterior y el digest de la transición. Relecturas del propietario y controles
  IAM/runtime protegen el lote exacto; un cambio inexplicado detiene la ejecución.
- **Un lote original:** el transporte fija la hoja original y las 53 celdas de ayudantes
  más dos marcadores revisados. El adaptador existente aplica ida o inversa admitida
  por separado. Consume el intento antes de suspender/enviar, incluso ante concurrencia
  o respuesta perdida. La relectura independiente puede comprobar lo aplicado, pero
  nunca autoriza un segundo envío.
- **Titularidad y credenciales:** registra antes de los efectos el intento exacto,
  vínculo al paquete, identidad fija, permisos iniciales e intención de concesión.
  Rechaza un escritor ya activo o con otro permiso. Emite como máximo un token de 300
  segundos tras la espera mínima IAM. Persiste identificadores, huellas y caducidades
  de sesión; nunca tokens ni credenciales de renovación. Todo HTTP Google, incluidos
  los cuerpos de respuesta, comparte el presupuesto de la ventana.
- **Recuperación:** devuelve solo inspección y limpieza de archivo/IAM/OAuth. Retira
  únicamente el permiso propio y su miembro/condición IAM, conserva autoridad ajena,
  deshabilita el UID fijo y comprueba el resultado. Un token anterior suministrado
  explícitamente puede probar la negativa solo si sigue vigente y coinciden huella,
  caducidad y lectura positiva registrada. No se emite ni renueva durante recuperación.
  Una credencial nueva del propietario solo cierra su sesión; las anteriores requieren
  su credencial correspondiente o un recibo de cierre ya verificado. Si falta prueba,
  conserva el bloqueo aunque haya retirado permisos. No convierte automáticamente la
  caducidad en prueba de revocación.
- **Interrupción:** la apertura parcial devuelve sus operaciones de limpieza. Fallar
  al escribir el registro no impide retirar el permiso exacto, deshabilitar ni revocar
  OAuth; la falta de recibos sigue impidiendo declarar cierre correcto. Las acciones
  nativas de Compartir son callbacks explícitos revisados: reciben `assertActive` para
  la última mutación y deben terminar antes de limpiar. No se deduce edición de
  permisos a partir de OAuth de lectura. El operador aporta explícitamente credenciales
  de recuperación y control de la UI; no salen de variables de entorno ni del registro.

El ciclo permite inyectar HTTP para pruebas. Las dependencias Firestore/barrera
conservan sus controles de proyecto, fuentes y autoridad. La UI de permisos y Google
se simulan aquí; Firestore utiliza exclusivamente el emulador local. Esta conexión y
los indicadores de preparación no autorizan una ejecución real.

Validación final, hashes, equivalencia del paquete y registros retenidos en
`2026-11-01-original-window-integration/validation-summary.json`. La primera ejecución
emulada coincidió con el ajuste final del vínculo al intento y tuvo cuatro fallos por
mezcla de versiones: se conserva como diagnóstico y no cuenta como validación final.
No cambian los proveedores cuyos hashes están ligados a los ensayos históricos.
Sin renovar observaciones, pedir credenciales, cambiar permisos ni escribir en
Sheets/Firestore/FCM reales; sin mantenimiento, producción ni cambios nativos.

**Siguiente:** preparar la invocación concreta con estos adaptadores, observaciones
actuales de fuentes/controles/propietario y permisos acotados; después obtener la
ventana real específica. Las tres conexiones de código anteriores quedan resueltas;
el tiempo y cierre del ciclo real conjunto siguen sin certificar. Perder la única
credencial antes de su recibo de cierre deja ese punto pendiente de inspección y no
reanuda la ejecución. Ahora no hace falta renovar OAuth ni cerrar hojas. HU-084 y
HU-085 abiertas; PR #278 borrador.


## Verificación de adaptadores reales de sesión y recuperación — 2026-11-01

Revisión histórica: las conexiones pendientes descritas aquí se implementan en la sección anterior.

La composición persistente está publicada en `d8b99067` (remoto comprobado). Esta
revisión es local y **no** certifica una ventana real. Se han contrastado los
adaptadores concretos con el plan de la prueba del escritor original, el paquete
retenido y los puertos de la ventana. Solo cambian pruebas, su comando y documentación;
el código de los proveedores y sus hashes históricos permanecen iguales.

| Frontera | Comportamiento comprobado | Conexión pendiente |
| --- | --- | --- |
| Observación del propietario | `createOwnerReader` lee la hoja y su carpeta exactas con el escritor temporal presente. `createDevelopOwnerObservationSession.capture` exige propietario/cuatro lectores y rechaza ese permiso antes de leer celdas. | La observación del ciclo debe validar el permiso exacto durante su vigencia y su ausencia tras retirarlo, conservando todos los demás permisos y la captura completa independiente. No se debe relajar globalmente la captura de solo lectura. |
| Escritura en la hoja original | `createWorkbookAccess` solo permite una prueba con el mismo valor «Fecha». Los transportes de copia rechazan la hoja original; el ensayo de lote no amplía ese alcance. | Vincular destino original y lote exacto revisado de ida/inversa al transporte concreto, reutilizando adaptador de Sheets y presupuesto. No reutilizar la prueba de cabecera ni eliminar la exclusión de originales. |
| Limpieza IAM | El adaptador HTTP real permite leer la política, retirar solo el permiso condicional retenido con su etag actual, deshabilitar explícitamente el UID fijo y releerlo sin activar ni emitir tokens. Un conflicto CAS sigue pendiente aunque se consiga deshabilitar. | La recuperación necesita una credencial de limpieza suministrada explícitamente, comprobar la titularidad registrada y conservar la limpieza incompleta. Deshabilitar no demuestra retirada del permiso. |
| Pérdida de sesión OAuth | El contrato del adaptador revoca solo la credencial suministrada al cerrar la sesión de sustitución. Su recibo satisfactorio no certifica el cierre de la anterior. | Registrar identidad/caducidad de sesión sin secretos y recibos antes de los efectos. Si falta la credencial anterior o un recibo verificado correspondiente, OAuth queda sin verificar; sin emitir/renovar tokens, repetir operaciones ni dar por demostrada la contención por caducidad. |
| HTTP pendiente | Con `timeBudget.fetch`, las lecturas IAM paralelas reales, incluidos sus cuerpos, terminan antes de entrar en limpieza aunque otra falle. | Todos los transportes concretos de Google deben recibir ese mismo envoltorio; `fetch` directo elude su contabilidad. |
| Firestore y sesión | Ejecutor y barrera reciben dependencias explícitas acotadas; `openSession` y `openRecoverySession` de la ventana completa solo existen como puertos inyectados/composiciones de prueba. | Conectar Firestore/controles, el canal nativo de concesión/retirada del propietario y el ciclo Google. La recuperación solo expone inspección/limpieza, nunca adquisición/ejecución/inversa. |

Las cinco pruebas nuevas usan **implementaciones reales de los adaptadores con
respuestas HTTP sintéticas**: rechazo con escritor presente, distinción entre OAuth
anterior/nuevo, retirada IAM exacta conservando otro permiso, conflicto de política
con deshabilitación independiente y espera del cuerpo HTTP pendiente. Verifican
límites además de capacidades; pasarlas no significa activación. No se solicitaron
ni consultaron credenciales, no hubo llamadas Google ni renovación de observaciones.

**Conclusión de admisión:** falta la conexión real de sesión/recuperación. Completarla
en un bloque agrupado: (1) observación y transporte del lote exacto en la original,
(2) titularidad persistente y limpieza de cada sesión, (3) composición normal y de
recuperación con presupuesto único. Validarlo con HTTP sintético y emulador Firestore,
incluidas respuestas perdidas e interrupción del proceso. Solo después renovar las
observaciones reales y solicitar la ventana concreta. Ahora no hace falta reabrir
OAuth ni pedir al propietario que cierre una hoja.

Evidencias en `2026-11-01-window-provider-review`; resultados en el resumen de
validación privado: Node 22.23.4, build, lint completo, lint CJS y **150 pruebas
correctas, sin fallos ni omisiones**. Se reutilizan los 86 casos previos de emulador porque no cambian
fuentes de ejecución. Sin cambios nativos ni diferencia entre plataformas. HU-084 y
HU-085 abiertas, PR #278 borrador; esta verificación queda local/sin commit.

## Ventana controlada con registro persistente — 2026-11-01

El control conjunto de tiempos y respuestas inciertas está publicado como `4dfa4946`.
El nuevo `runControlledWindow` local une preparación de sesión, adquisición persistente
de la barrera, admisión, una dirección ya autorizada y limpieza independiente de
permisos de archivo/IAM/OAuth. Reutiliza ejecutor y presupuesto; no crea cliente SDK,
CLI, despliegue, elección de permisos ni apertura de mantenimiento. Ida e inversa
siguen siendo invocaciones admitidas por separado, sin compensación automática.

El registro local publica JSON numerados e inmutables, sincroniza archivo y directorio,
usa creación exclusiva, encadena huellas y limita tamaños. Vincula paquete, alcance,
dirección, ventana y pruebas de ida antes de abrir sesión. El preparador recibe el
mismo registro para las intenciones de permisos/token; no se guardan credenciales.
Un bloqueo común impide empezar otra ventana mientras la limpieza siga sin verificar.
Los identificadores de intento no se reutilizan. El adaptador de sesión debe registrar
antes de cada cambio externo y limitar su limpieza a lo que le pertenece; en este
bloque esos adaptadores solo se han probado con dobles locales, sin IAM/OAuth real.

La cancelación espera las llamadas pendientes. Se intenta retirar archivo, IAM y
OAuth de forma independiente, también tras un alta parcial o un fallo de escritura
del registro. El éxito exige ejecución comprobada, todos los recibos de limpieza y
el informe de tiempos. Los archivos parciales/corruptos no habilitan repeticiones ni
un cierre correcto. Si falla el registro, se propaga el error; una limpieza incierta
mantiene el bloqueo para su inspección.

`recoverControlledWindow` comprueba cadena y vinculación y toma un bloqueo separado.
Rechaza una invocación activa o un proceso externo todavía vivo, aunque acabe de
publicar un resultado. Una llamada terminada e inactiva del mismo proceso sí puede
inspeccionarse. La recuperación lee barrera/Firestore/Sheets y repite únicamente la
limpieza exacta: no adquiere otra barrera, ejecuta migraciones, emite tokens del escritor
ni revierte datos. La falta de evidencia nunca autoriza una repetición. Un bloqueo de
recuperación abandonado o un registro corrupto/incompleto exige inspección específica;
no se elimina automáticamente. El disco local es evidencia de confianza, no una firma
ni un sustituto de la autoridad técnica, del propietario o del administrador.

Los ensayos cubren ida e inversa admitidas por separado, interrupción después de
Firestore y antes de Sheets, limpieza fallida y recuperación explícita, alta parcial,
fallo de escritura, exclusión de ventanas y un **SIGKILL real de un proceso hijo tras
confirmar en el emulador Firestore**. La recuperación lee el recibo persistido, verifica
las imágenes confirmadas y retira accesos ficticios sin cambiar documentos de negocio.
Se conservan usuarios/configuración/calendarios/117 avisos; mantenimiento cerrado.
El SIGKILL ocurre antes de Sheets: no acredita durabilidad de Google ni un apagón del disco.

Evidencias privadas: `2026-11-01-persistent-controlled-window`, con copia de los registros
de los cuatro escenarios finales. Permisos, tokens, transporte Sheets y duración siguen
simulados; las transacciones y la barrera usan Firestore local real. Sin llamadas reales
a Google/Firestore, producción, hojas originales, IAM, FCM o despliegues. Sin cambios en
las apps ni diferencias entre plataformas. Trabajo nuevo local; issues abiertas y PR
#278 en borrador.

Validación: build/lint completo y lint CJS focalizado correctos con Node22.23.4;
**270 pruebas locales distintas** (batería de 267 más los 14 casos finales de ventana)
y **86 casos distintos de emulador** (batería de 85 más los cuatro casos persistentes
finales), sin omitidas. La unicidad del identificador de recuperación se comprobó en
la repetición local y no cambia los caminos correctos del emulador. Se releyeron los
cinco registros retenidos: cadenas válidas, sin archivos parciales, llamadas terminadas
y sin permiso de reanudar escrituras. Paquete de admisión intacto; observaciones sin
renovar. No hacen falta controles nativos para este bloque.

**Siguiente:** comprobar los adaptadores concretos de sesión y recuperación contra el
plan retenido de identidad/permisos/fuentes, incluido cómo obtiene un proceso nuevo
acceso exclusivo de limpieza. Después se renovarán observaciones y se preparará la
ventana exacta para autorizarla. Ahora no hace falta cerrar hojas ni ninguna otra acción.


## Control conjunto conectado al ejecutor — 2026-11-01

La integración de recibos y el ensayo conjunto anterior están publicados como
`f01c40c0`. El nuevo `executeJoint` local conecta la admisión y el motor transaccional
existentes con `planBatch` y el adaptador de Sheets. No crea Function, CLI, credenciales,
permisos ni entrada de mantenimiento. La ida escribe Firestore y después Sheets;
la inversa restaura Sheets y después Firestore. Antes de modificar Sheets en la
inversa se valida de nuevo la admisión y el recibo de ida. Los datos del llamante
se copian antes de la primera suspensión.

El controlador de tiempos se comprueba antes/después de las llamadas, antes de
escribir en Firestore, después de las últimas lecturas de bloqueos, en cada mutación
y al terminar el callback transaccional. Se limita a un intento de transacción del
SDK. Sheets conserva su lote exacto, la captura/versión actual del propietario y la
comprobación justo antes del envío. Cada dirección se consume una vez por ejecutor;
no admite llamadas conjuntas simultáneas ni repetidas. El registro inyectado recibe
intención, recibos y capturas independientes. Si no puede guardar un resultado
incierto, propaga el fallo y no afirma haberlo conservado.

`inspectUncertain` solo lee, también en las opciones de transacción de Firestore,
y puede comprobar una confirmación aunque exista un incidente de barrera. En la
ida verifica imágenes posteriores y versiones exactas. Un recibo de inversa prueba
su confirmación, pero se informa como **solo terminal**, sin asegurar que todas las
filas recuperadas sigan intactas. Un recibo ausente o inaccesible nunca habilita una
repetición. Ante un fallo incierto se detiene el ciclo, se inspeccionan ambos servicios
y se registra el resultado, sin reintento ni reversión automática. Una respuesta
perdida de Sheets solo permite continuar si el adaptador comprueba la imagen exacta
y aún queda tiempo. Los cambios ajenos en notas/celdas impiden esa conclusión.

**Límite temporal:** son controles antes de admitir/enviar escrituras, no cancelación
remota. Las opciones públicas de transacción del SDK instalado ofrecen `maxAttempts`,
pero no cancelación ni timeout por transacción. Una confirmación/lectura ya enviada
se espera; no hay Promise.race ni escritura abandonada. Un exceso de tiempo detiene
lo siguiente y puede invalidar el plazo de limpieza; no acredita limpieza puntual.
El llamante sigue siendo responsable de retirar permisos y ejecutar `budget.complete()`.
El paso verificado devuelve expresamente `cleanupVerified:false`. Los ensayos usan
un reloj de duración separado del reloj de autorización ficticio; no miden todavía
la latencia real conjunta de Google y Firestore.

Evidencias en `2026-11-01-joint-controlled-execution`. Sin llamadas a Google/Firestore
reales, IAM, FCM, despliegues, hojas originales o producción. Sin cambios nativos ni
diferencias entre plataformas. Se conservan el paquete y los recibos históricos;
no se renuevan controles actuales. Implementación nueva local, sin commit.

Validación: build/lint completo y lint CJS focalizado correctos con Node22.23.4.
**256 pruebas locales distintas** (batería de 255 más repetición final de 18) y
**82 casos distintos de emulador**, tras repetir los nueve casos conjuntos. Se corrigieron
dos expectativas de prueba: el rechazo previo por plazo agotado y el resultado
`ambiguous` del adaptador al fallar la lectura; no se relajó ningún control. La vía
antigua de ejecución compartida ahora rechaza llamadas sin el control conjunto.
Esta última condición exclusiva de develop compartido no modifica la rama de emulador.
No se repiten las validaciones nativas porque no hay cambios en las apps.

**Siguiente:** montar la invocación concreta de la ventana con los adaptadores ya
existentes de adquisición, ejecución conjunta y limpieza, y ensayar interrupción y
reinicio con su registro persistente. Solo después se renovarán controles y se pedirá
la ventana real. No hace falta ninguna acción del usuario para el trabajo local;
HU-084/HU-085 siguen abiertas y PR #278 en borrador.


## Recibos del ciclo completo y ensayo conjunto local — 2026-11-01

El resultado real anterior está commiteado y publicado como `2ef610b3`. La nueva
evidencia local `helperCopyCycle` pasa por el manifiesto revisado, el materializador
y el informe de admisión de solo lectura. Su validador comprueba los dos lotes exactos
de 55 peticiones, las capturas completas, la restauración, el único token, las cinco
fases de plazos, las negativas OAuth y la identidad aislada final. El éxito aislado
solo marca `uninterruptedRoundtripVerified`; siguen a falso los controles actuales,
la autoridad del escritor, los tiempos conjuntos y el permiso de ejecución.

La captura inicial de la ejecución tiene versión de Drive **9**, posterior a la
captura de preparación con versión 8. Ida e inversa devuelven ambas versión **11**:
la comparación exacta de celdas y marcadores acredita la restauración aunque no aumente
otra vez la versión. El recibo OAuth mide **31.668ms**; la fase completa que lo contiene,
**31.686ms**. Son dos mediciones distintas.

Paquete privado: `339726666096f37235087d0705ebcd6daee378face5ce0c13764c37488bfd8aa`;
preparación controlada: `c9adc4eae52fca6769fe95b97c217c6787679fb20cbd42204664d8e7f19ee653`;
evidencia del ciclo: `b6a57516f454204ecd44a71864afd44d99d3f687e9098407c39b291021582b23`.
Se conservan las tres evidencias anteriores, la política de fuentes, las operaciones,
sus identificadores y la antigüedad de las observaciones. Recibos completos privados
en `2026-11-01-full-cycle-admission`, sin credenciales.

El ensayo conjunto utiliza transacciones y registros de barrera del emulador real de
Firestore, el adaptador real de Sheets con un servicio en memoria y el controlador
real de plazos con tiempo transcurrido simulado. Cubre ida/inversa completas, agotamiento
antes de Firestore, agotamiento después de Firestore, inversa detenida con recuperación
posterior admitida por separado y exceso de tiempo durante la limpieza. Reserva tiempo
para Sheets y su verificación antes de la primera escritura en Firestore, conserva los
recibos ya confirmados cuando se detiene y no declara cierre limpio si se supera el
plazo. Ambos servicios recuperan sus celdas/filas originales; se conservan usuarios,
configuración, calendarios y los 117 avisos. No añade una entrada de ejecución real.

El reloj de duración está separado del reloj de las autorizaciones ficticias. La
retirada de permisos es simulada: se comprueba el orden, los límites y el estado
conservado, no la latencia de Google, la vigencia actual ni los tiempos conjuntos reales.
El mantenimiento compartido sigue cerrado. Este bloque no llama a Google, Firestore
real, IAM ni FCM; no despliega ni accede a las hojas originales o a producción.
Sin cambios nativos ni diferencias nuevas entre plataformas.

Validación: build/lint completo y lint CJS focalizado correctos con Node 22.23.4;
**252 pruebas locales distintas** (batería de 251 y repetición final de los 29 casos del
validador) y **73 pruebas del emulador**, sin omitidas. La primera ejecución solapó dos
compilaciones TypeScript y recibió una captura cruda incorrecta; con compilación
estabilizada y la captura normalizada retenida, ambas repeticiones pasan. No se han
relajado las pruebas. No se repiten los controles nativos porque no hay cambios iOS/Android.

**Siguiente:** conectar este orden conjunto al ejecutor controlado, incluidos los
plazos de Firestore y la inspección después de una confirmación incierta, antes de
renovar controles o pedir una ventana concreta. El recibo de la copia no autoriza esa
ventana. Implementación nueva local; HU-084/HU-085 abiertas y PR #278 en borrador.


## Ciclo completo en copia con presupuesto verificado — 2026-11-01

La implementación del presupuesto y compatibilidad está publicada en `08b3098b`.
La copia sintética nueva ha completado una ejecución continua de `runBudgetedCopy`:
**201.376ms en total**, un único token de escritor de 300s y dos lotes de 55 peticiones
cada uno (53 celdas de ayudante y dos marcadores). Pasan ambos manifiestos de
conservación de ida/vuelta; una comparación independiente de las capturas confirma
que los datos de celda y propiedades de las seis pestañas coinciden con la base tras
la reversión. Se conservan intencionadamente los dos marcadores de la inversa;
no son cambios en las celdas del usuario.

| Fase | Duración medida |
| --- | --- |
| Preparación, incluida la espera IAM de 124.619ms | 141.418ms |
| Ida, vuelta y observaciones tras emitir el token | 19.661ms |
| Retirada del permiso de copia, relectura y denegación del mismo token | 4.491ms |
| Retirada IAM, desactivación explícita y comprobaciones | 4.254ms |
| Fase de limpieza OAuth | 31.686ms |

No quedan incumplimientos de plazo ni peticiones HTTP pendientes. El mismo token del
escritor, aún vigente, recibió 404 tras retirar su acceso a la copia. Drive y Sheets
respondieron 401 al token revocado del propietario. Las lecturas finales independientes
de IAM y servicios confirman el escritor deshabilitado, sin claves de usuario ni
concesiones temporales y sin uso por servicios. El bloqueo local se ha liberado.
El propietario ya puede volver a abrir la copia.

Antes de la ventana confirmada, se inicializó esta misma copia nueva, pero falló su
primera lectura de verificación; el recibo saneado no permite establecer la causa.
La sesión se revocó con denegación en ambas APIs. Una recuperación de la preparación,
registrada aparte y solo de lectura, verificó la base exacta en versión 8 sin repetir
la inicialización. No hubo token del escritor ni concesión IAM temporal antes de la
ejecución finalmente confirmada. Esta preparación queda fuera de los 201.376ms del ciclo.

Evidencia privada: `2026-11-01-budgeted-copy-execution`, recibo
`single-budgeted-copy-1793555719144`; preparación `ef471969…d80d5`, presupuesto
`dd44fd97…955d2`. Se conservan capturas completas, intenciones, informe de plazos y
verificación independiente sin credenciales. La revisión visual nativa conserva
los anchos fijos del fixture (las etiquetas sintéticas largas siguen recortadas).
Se reutilizan build/lint y 166 pruebas de las mismas huellas publicadas; este registro
solo cambia documentación. No añade validación nativa ni de emulador.

**Siguiente:** vincular el recibo del ciclo completo y su presupuesto al paquete de
admisión existente, y ensayar localmente los tiempos conjuntos de barrera/Firestore/Sheets.
El ciclo aislado de Google no mide esa ejecución conjunta ni renueva las fuentes y
controles de la hoja original. El mantenimiento compartido sigue cerrado y exige
observaciones actuales y autorización propias. No se han tocado hojas originales,
producción, FCM ni despliegues. HU-084/HU-085 siguen abiertas y PR #278 en borrador;
esta documentación de resultado queda local.


## Presupuesto completo de la copia y compatibilidad histórica — 2026-11-01

La integración de recibos está commiteada y pusheada como `3aa1b467`. El trabajo
nuevo conecta el ejecutor y los transportes de Google existentes mediante
`runBudgetedCopy`. Exige un `budgetDigest` exacto que vincula preparación de copia
y código del presupuesto. No añade CLI real, búsqueda de credenciales, renovación
de tokens ni otro motor de migración. El siguiente ensayo real debe usar esta entrada;
`runCopy` sigue siendo el núcleo para pruebas focalizadas e interpretación histórica,
pero por sí solo no acredita el presupuesto nuevo.

| Asignación de tiempo | Límite |
| --- | --- |
| Ventana confirmada del propietario | Máximo600s, sin ampliación |
| Preparación y disponibilidad IAM | Deben terminar cuando aún queden más de420s; se mantiene el mínimo IAM de120s |
| Trabajo tras emitir el token | Máximo150s compartidos entre ambos lotes y sus lecturas |
| Retirada de permiso, lectura del propietario y denegación del mismo token | Reserva60s, siempre antes de caducar el token |
| Retirada IAM, desactivación y lectura de identidad/inventario | Reserva90s |
| Revocación OAuth y denegación en ambas APIs | Reserva120s |
| Limpieza total | Reserva270s separada del trabajo; el margen anterior no gastado puede aprovecharse |
| Token del escritor | Uno de300s; sin ampliar token ni concesión |

Son límites aplicados, no predicciones de latencia. Antes de cada lote deben caber
75s en el tramo de trabajo (30s de petición y45s de lectura acotada), manteniendo
además el control previo de150s del token. El plazo HTTP incluye consumir el cuerpo
y se combina con el timeout propio del transporte. Si se agota el margen se rechaza
la siguiente escritura; tras una ida verificada puede quedar ese estado pendiente
de inspección, sin inversa ni repetición automáticas. Cancelar una petición tardía
no demuestra que Google no la haya ejecutado.

Las fases de limpieza tienen plazos absolutos y son independientes. Si `Promise.all`
rechaza antes de terminar otras lecturas HTTP, se espera a que estas concluyan antes
de cambiar de fase; no se abandona ninguna operación en curso. Exceder un plazo o no
poder verificar la limpieza produce `inspection_required` y conserva el bloqueo local.
También se limpia OAuth si falla la comprobación inicial después de construir la
sesión del propietario. Un cierre del proceso sigue exigiendo conciliar recibos y
recursos; no se garantiza ejecutar `finally` ante un cierre ni la respuesta de Google.

La compatibilidad histórica queda revisada. Reconstruir el validador de `eae86a89^`
con el compilador TypeScript instalado reproduce la huella antigua de todo el backend
`2c63c31b…ce669`; la actual es `049fe823…d741`. Solo difieren
`src/shift-sheets-owner-manifest.ts` y su `.js` compilado. Una transición acotada por
esas huellas conserva los resultados de diez filas y A1; cualquier otro cambio de
preparación o fuentes se rechaza. La transición específica del ejecutor de copia
conserva la inversa de53 celdas como **historial anterior al presupuesto**, no como
ensayo real del presupuesto nuevo. No se reescriben recibos ni se sustituyen sus
huellas. Los cambios futuros desconocidos exigirán otra revisión de compatibilidad.

Paquete privado `2026-11-01-complete-copy-budget`: incorpora de nuevo las tres huellas
originales. Paquete `1bb66f7931ee94184fc5b7e7ef6316126fcfa8bc00563defd87e5c4cc2df8dab`;
preparación `79e90ac1b26e386bc2dae27f40be92606ef34be2d211b703db9cfbbfd5d21074`.
Política, cambios de negocio, identidades de operación y antigüedad de observaciones
sin cambios; admisión bloqueada. La plantilla de presupuesto usa un identificador
local ficticio y no autoriza ninguna copia real.

Validación: Node22.23.4, build/lint completo, lint CJS focalizado y **166 pruebas**,
sin fallos ni omisiones. Catorce casos nuevos cubren compatibilidad, OAuth lento,
falta de margen antes de primer/segundo lote, excesos en cada limpieza, inversa con
respuesta perdida, vínculo exacto del presupuesto, respuestas HTTP tardías, espera de
lecturas paralelas y ciclo completo con transportes reales ante HTTP simulado.
Ese ciclo local restaura fechas, orden y contenido. Sin llamadas a proveedores reales.
Motores de emulador Firestore y apps sin cambios; no se atribuyen nuevas pruebas de
emulador ni pruebas físicas.

Siguiente paso: preparar y autorizar por separado un ciclo completo en una copia
sintética nueva con este presupuesto y medir tiempos reales sin interrupciones.
El mantenimiento compartido de develop seguirá necesitando controles/fuentes/lecturas
del propietario frescos, admisión y ventana conjunta de Firestore/Sheets. Estas pruebas
locales no lo autorizan. Sin mantenimiento, producción ni diferencia de paridad nativa.
Trabajo nuevo local, sin commit.

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
