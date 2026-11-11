# HU-084 — Evidencia inicial y propuesta de ventana de develop

## Preparación interactiva de veinte minutos — local, 2026-11-02

El segundo intento detenido y la corrección privada del arranque están publicados
en `d7d11eaf`; se verificó la cabecera remota antes de este trabajo. El mantenedor
ofrece 20 o 30 minutos. **Veinte minutos es el máximo revisado de la nueva variante
explícita de develop original; treinta no está admitido.** No hay ventana real
fechada ni autorización nueva de ejecución.

[ADR-0027](../decisions/0027-recoger-observaciones-coherentes-de-develop-antes-del-token-escritor.md)
recoge la corrección local. Una observación completa de fase proporciona juntas
sus proyecciones de propietario y administradores, con fases nuevas e independientes
antes/después del callback. La entrada ya retenida lee por separado su checkpoint
inmutable. Adquisición, admisión y ejecución usan 3 + 3 + 2 observaciones completas
en vez de 7 + 8 + 7. `original-develop-deferred-writer-v1` se vincula a la operación
y al diario exactos y coloca adquisición/admisión antes del único token escritor.
El modo por defecto y las copias conservan diez minutos. La preparación dispone de
780 s y la recogida inicial de 750 s; IAM espera allí al menos 120 s. Se conservan
token de 300 s, trabajo de 150 s, limpieza de 60/90/120 s, manifiesto de 60 s y
evidencias de diez minutos. Una pregunta humana sin responder vence con su etapa,
no al final de la ventana exterior.

El operador privado nuevo utiliza arranque y respuesta atendidos. Cada respuesta
humana real conserva su identidad de petición/respuesta y hora propias; los hechos
administrativos sin cambios conservan una revisión estable. Así una confirmación
nueva no se confunde con una alteración de identidad administrativa. Se comprueban
los vínculos externos de paquete, preparación y planes de la plantilla técnica
contra el paquete regenerado.

La compatibilidad histórica es explícita: las 285 entradas de fuente del backend
reconstruyen el digest anterior sustituyendo solo el adaptador de barrera TS/JS
compilado. El presupuesto histórico por defecto se reconstruye cambiando únicamente
su hash de fuente revisado; no se alteran plazos ni recibos. Se mantienen fijados
los 17 archivos originales. El paquete `7201f1cf…f257715` sustituye al `9d528701…b8f`
solo por resúmenes de procedencia histórica; política, intenciones/digests forward
e inverse, operaciones, 203/140 escrituras Firestore, 53 celdas, dos marcadores y
fechas/orden publicados son idénticos. La preparación materializada es `373ee000…faced`.

La preparación local final está **READY_FOR_FRESH_AUTHORIZATION**, sin admisión
real. La regresión con observador real demostró primero que exigir las fuentes
congeladas rechazaba el commit propio de 62 a 72 filas antes de Sheets. La fase
final relee independientemente el recibo comprometido y verifica imágenes/versiones
exactas, filas ajenas intactas e historia de capturas sin alterar. Cada core nuevo
debe coincidir con una creación/borrado propio exacto. El digest de fuentes actuales
queda separado de la identidad causal histórica; las entregas desconocidas siguen
desconocidas y sin reejecutarse. La ruta estricta sigue rechazando diferencias. La
prueba y el modo de veinte minutos solo admiten avance, sin habilitar otra inversa.

Validación final Node 22.23.4: **328 regresiones del repositorio + 30 casos de
transición propia unitarios/SDK-emulador + 14 pruebas privadas**, cero fallos ni
omitidas. Build/lint completos de Functions, lint CJS focalizado y diff correctos.
El gate decisivo usa observador real, imágenes/versiones actuales de Firestore e
inspección retenida independiente. El ciclo positivo de 98,702 s incluye ocho
esperas reales de 12 s y comprueba trabajo posterior al token inferior a 150 s.
Cambios de campo, ABA de versión, fuente/captura ajena, emisión/respuesta lenta y
pregunta sin responder conservan parada y limpieza. Los 553 archivos de código,
scripts, pruebas y compilados permanecieron idénticos durante el gate SDK final.
Google, personas y ciclo IAM siguen siendo dobles explícitos: no se acredita
latencia real ni ejecución humana/de navegador. El recogedor inicial admite por
separado respuestas más lentas con veinte minutos y rechaza las mismas con los diez
por defecto. La discrepancia inicial de huella se corrigió con el materializador
público de producción y sus constructores reales; se conserva el gate fallido.

Evidencias privadas: `2026-11-02-interactive-window-preparation` y
`2026-11-02-interactive-window-local`. Se validan ambos diarios anteriores de 21
registros y su limpieza. El recibo nuevo `develop-original-20261102-interactive-03`
no está consumido; autorización, fechas y compromisos permanecen vacíos. Su control
local de preparación vincula la variante de avance validada y el paquete exacto;
siguen siendo obligatorias la autorización y la ventana real fechada. Esta preparación no ha realizado
acciones de Google/IAM/OAuth/Sheets/producción ni abierto mantenimiento. Sin cambios
ni diferencia nueva Android/iOS. No hacen falta builds de apps por este cambio exclusivo del backend.

## Segundo intento autorizado: detenido y limpiado — 2026-11-02

Tras renovar el acceso y comprobar de nuevo hoja, lote, controles y fuentes, el
usuario confirmó diez minutos desde el anuncio inmediato del inicio. El recibo
`develop-original-20261102-active-context-02` fija **09:37:55.386–09:47:55.386 UTC**
(**10:37:55–10:47:55 Europe/Madrid**). La declaración de hoja cerrada durante el día
no amplía esa ventana ni la vigencia de los permisos. El intento único está consumido.

El ejecutor reactivó el escritor y concedió su permiso IAM temporal. Dejó pendiente
la concesión nativa de edición, pero la llamada que lo arrancó devolvió el control
sin atenderla; venció la espera de 20 s. Los eventos conservados y el recorrido de
código identifican ese fallo de coordinación. El diario del intento solo conserva
el motivo terminal genérico; no se le atribuye un diagnóstico que no registró.
La acción nativa no llegó a despacharse. No hubo permiso de edición de la hoja,
token del escritor, confirmaciones posteriores al permiso, mantenimiento, escrituras
de negocio, FCM, inversa, repetición ni acceso a producción.

La limpieza terminó a las **09:39:03.593 UTC (10:39:03 Madrid)**: propietario/cuatro
lectores, permiso IAM retirado, escritor explícitamente deshabilitado y aislamiento
verificado. OAuth Online sin renovación fue revocado; el mismo token devolvió 401
en Drive y Sheets tras dos comprobaciones. El diario íntegro contiene 21 registros,
ningún archivo pendiente, cero llamadas en curso y cero incumplimientos del presupuesto
de etapas. La expiración de la acción nativa es el fallo de preparación, no un éxito
de migración. La exclusión local quedó liberada y la ventana del usuario terminada.
La migración de develop sigue pendiente; HU-084/HU-085 abiertas y PR #278 en borrador.

La composición ejecutada se conserva íntegra y por SHA-256 en el directorio privado
`2026-11-02-native-context-retry-preparation`, junto a eventos, lectura previa,
captura visual y recibos. Se validó la cadena del diario con el lector real. El
paquete sigue idéntico: 17 entradas fijadas, 203 escrituras Firestore, 53 celdas y dos
marcadores. La hoja estaba en versión 287 antes del arranque; esta sesión no la escribió.

La corrección local posterior incorpora el bucle de atención a la interfaz real:
`startAndAttend` arranca y atiende las acciones en la misma llamada activa;
`answerAndAttend` resuelve una respuesta humana real y atiende la continuación.
Se elimina la exposición separada de `run`/`answer`. `attend` reanuda una espera de
proveedor. Devuelve una petición humana, estado terminal o espera explícita tras
hasta 45 s entre acciones; una acción ya iniciada termina antes de devolver control,
bajo el plazo existente de su etapa. La expiración sin despacho guarda ahora su
propio diagnóstico. No amplía plazos, inventa respuestas ni repite acciones.

Esto corrige el arranque concreto que falló; una interrupción arbitraria entre
llamadas aún puede hacer expirar la operación, que conserva su contención. Antes de
otro intento hay que preparar un recibo/autorización nuevos y utilizar directamente
la interfaz atendida. La aprobación consumida no permite ejecutarlo ahora. No se
necesita mantener cerrada la hoja para la preparación local.

Las ocho pruebas anteriores precedían a esta ejecución y no acreditaban el arranque
real. La validación local posterior pasa **16 pruebas sin fallos ni omitidas**, con lint
focalizado sin avisos. La revisión independiente detectó y se corrigió que un fallo
al guardar el diagnóstico pudiera interrumpir la limpieza; ambos caminos tienen
regresión. Las pruebas privadas se ejecutaron con Node 23.11.0; no se presentan
como un nuevo gate del runtime desplegado Node 22. Una lectura real de navegador
a través del nuevo driver terminó correctamente, sin concesión ni escritura. Usa el
mismo driver que la interfaz concreta e incluye concesión/retirada correctas y
fallidas, expiración sin UI, límite entre
llamadas, respuesta humana y espera hasta finalizar la acción. Builds de apps y
emuladores no se repiten por documentación y composición privada; no hay cambios ni
nueva diferencia Android/iOS. La documentación nueva queda local tras `874146e3`.

Preparación histórica: el usuario autorizó un solo intento nuevo; una primera sesión
de lectura se cerró mientras se esperaba la confirmación de ventana. Otra sesión
previa cuya credencial apareció por error en un diagnóstico fue revocada y comprobada
con 401 en ambos servicios antes de renovarla. No se conservan credenciales en los
recibos. Ninguna de esas lecturas previas concedió acceso al escritor ni abrió
mantenimiento. La autorización posterior sí quedó consumida por el intento descrito.

## Intento autorizado del 2 de noviembre: detenido y limpiado

La revisión anterior está publicada en `86af466b`. El usuario autorizó el avance y
los permisos temporales y confirmó la hoja cerrada, en línea y sin intervenciones
hasta las 10:15 Europe/Madrid. La comprobación previa real conservó versión 287,
propietario/cuatro lectores, controles coincidentes y fuentes Firestore coincidentes;
la admisión de lectura seguía rechazando únicamente `window_scope_missing`.

El único intento empezó a las **09:05:11.669 UTC**. Reactivó la cuenta dedicada y
concedió su permiso IAM temporal, pero se detuvo antes del envío nativo de Compartir.
No se concedió edición de Sheets, emitió token del escritor, recogió consentimiento
posterior al permiso, abrió mantenimiento ni escribió datos de negocio. Sin FCM,
reintento, inversa ni acceso a producción. El estado terminal es `inspection-required`.

Limpieza terminada a las **09:06:23.770 UTC**, sin incumplimientos de tiempos ni llamadas
pendientes: archivo con propietario/cuatro lectores, permiso IAM retirado, escritor
explícitamente deshabilitado y aislamiento verificado. OAuth Online del propietario,
sin renovación, revocado; el mismo token devuelve 401 tanto en Drive como en Sheets
tras cuatro comprobaciones (32,837 s). El usuario puede volver a utilizar la hoja.

El error original de preparación no quedó detallado en el recibo. Una reproducción
posterior de solo lectura demuestra que invocar el navegador después de terminar la
llamada de `cua_repl` falla con `node_repl exec context not found`; la misma lectura
funciona dentro de una llamada activa. Esto identifica una incompatibilidad concreta
de la composición privada, sin atribuir retrospectivamente un error no conservado.
La composición local se ajustó para dejar pendiente la acción nativa y atenderla con
una llamada activa que espera su finalización. Expira antes de despachar si no se
atiende en 20 s, conserva el diagnóstico de fallo y no reintenta. Se conserva aparte
el archivo exacto usado en el intento. No cambia código desplegado ni el paquete.

Validación: cuatro pruebas locales nuevas (despacho único, expiración sin UI, fallo
con diagnóstico y espera de la acción en curso), lint focalizado y lectura real desde
la conexión corregida. No se probó otro permiso ni escritura. Evidencia privada:
`2026-11-02-authorized-develop-window`, con diario de 21 registros, capturas y recibos.
No se repiten builds nativos/emuladores: solo cambia documentación en el repositorio
y la composición privada. Sin diferencia entre apps.

Siguiente: revisar la composición corregida y preparar otro intento con horario e
identidad de recibo nuevos; la autorización consumida no permite repetir esta ventana.
Las confirmaciones posteriores a la concesión siguen pendientes; no se reutiliza la
confirmación inicial como si acreditase hechos posteriores. HU abiertas y PR en borrador.

## Renovación de autoridad y propietario; revisión fechada — 2026-11-02

El bloque de recibos y entradas humanas tiene commit y push `8edfc7df`; coinciden
la rama remota y la cabecera de la PR #278 en borrador. Se reutilizaron las 126 pruebas
locales, tres comprobaciones privadas y build/lint tras verificar los 346 hashes de
archivos de ejecución/paquete. Esta renovación de lecturas y documentación queda
local, pendiente de commit.

Evidencia privada: `2026-11-02-authority-owner-refresh`. Horas reales UTC:
Cloud `2026-11-02T08:07:46.878Z`, censo atómico de develop `2026-11-02T08:07:40.706Z`,
propietario/Sheets `2026-11-02T08:11:33.635Z` (Madrid es UTC+1 en esta fecha).

- Coinciden las 24 configuraciones de Functions y los 24 servicios Run con sus
  nombres, revisiones e identidades; también Rules, IAM del proyecto/invocador,
  tres jobs pausados y seis índices READY. Inventarios globales de jobs, worker pools
  e instancias Run vacíos. Scheduler cubre 34 regiones; las 88 consultas de triggers/
  builds activos en 44 ubicaciones explícitas tienen éxito y están vacías.
  Sin servicios App Engine, Extensions ni pools de identidad de cargas de trabajo.
- Diez cuentas de servicio, cuatro deshabilitadas, cero claves de usuario y cero
  concesiones IAM propias. La única añadida desde las nueve de octubre es el escritor
  de Sheets de develop ya revisado: deshabilitado y ausente de los runtimes.
  Cloud Asset sigue deshabilitado; se consultan las APIs individuales. La enumeración
  de ubicaciones de Cloud Build no está disponible: la cobertura son las 44 ubicaciones
  indicadas, sin interpretar el fallo de descubrimiento como ausencia de recursos.
- Coinciden exactamente contenido y versiones de todas las colecciones/singletons
  revisadas de Firestore y del registro privado: 12 eventos y 16 entregas. El ejecutor
  real realiza una transacción de lectura, cero llamadas a controles/escrituras y
  rechaza la admisión únicamente por `window_scope_missing`. No prueba drenaje histórico.
- La hoja original de develop conserva versión 287, propietario y cuatro lectores;
  su carpeta solo tiene propietario. Dos lecturas directas completas de conservación
  y dos de las seis zonas acotadas coinciden entre sí y con la evidencia anterior.
  Fechas, orden, valores y formato revisado permanecen iguales; escritor sin permiso.
- OAuth del propietario autorizado expresamente, solo metadatos/Sheets de lectura,
  Online y sin token de renovación. Revocación aceptada y 401 en Drive y Sheets con
  el mismo token tras seis comprobaciones (53,492 s); credencial temporal local retirada.

La vinculación renovada de 23 controles usa las horas reales y fija 25 archivos de
recibos/fuentes, incluidos diez archivos de código desplegado conservados y verificados.
Los cierres históricos mantienen sus fechas originales. Siguen desconocidos los 23
contadores de trabajo anterior. Declaración de automatizaciones, observaciones y
consentimiento futuro son independientes. El paquete se reproduce exactamente con sus
17 entradas fijadas; no cambian identidades de paquete/preparado/avance/inversa ni las
203 escrituras Firestore de avance / 140 de inversa, 53 celdas de ayudantes y dos
marcadores. No se añade algoritmo ni control de proveedor.

### Propuesta concreta para revisar, sin autorización

**2 de noviembre de 2026, 10:00–10:15 Europe/Madrid (09:00–09:15 UTC).**
OAuth y el canal nativo de permisos deben estar preparados antes. La comprobación
previa de cinco minutos es independiente del presupuesto de diez minutos del escritor.

| Hora de Madrid | Límite propuesto |
| --- | --- |
| 10:00–10:05 | Conciliación final de lectura y revisión expresa de operación/riesgo |
| 10:05–10:08 | Ciclo exacto de permisos, espera IAM mínima de 120 s y evidencia inicial; recogida terminada antes de 10:07:30 |
| 10:08–10:10:30 | Una dirección de avance, solo tras admisión correcta |
| 10:10:30–10:11:30 | Retirar acceso al archivo y comprobar denegación |
| 10:11:30–10:13 | Retirar IAM y deshabilitar expresamente el escritor |
| 10:13–10:15 | Revocar OAuth del propietario y comprobar denegación |

Fechas solo en `dated-inputs-private.json` / `dated-review-private.json`. No se inventa
recibo, aceptación de riesgo, confirmación ni informe del propietario/administradores.
Los formularios normales sin fechas siguen sin confirmar. No se concedió permiso ni
se emitió token del escritor. Se conserva un único token futuro de 300 s, límites de
180/150/60/90/120 s y 600 s totales. Son máximos, no esperas obligatorias ni garantías
para llamadas de proveedor/humanas no cancelables; el margen exigido puede rechazar antes.
Las capturas de esta mañana serán demasiado antiguas para la ventana propuesta:
recoger evidencia inicial nueva y 30 s de quietud después del cierre real de permisos,
junto a compromisos/informes nuevos del propietario y administradores. Antigüedad
máxima de 600 s. Si pasa el horario, hay que fechar/revisar de nuevo y confirmar otra
ventana; nunca empezar tarde ni ampliar sus límites.

Validación: tres comprobaciones privadas renovadas correctas, plan fechado aceptado
por el validador real, presupuesto válido y expiración rechazada, plantilla sin
confirmar rechazada por la barrera real. Reproducción del paquete y 17 entradas correctas.
Lectura Cloud 1,113 s, captura del propietario 8,246 s; estas medidas aisladas y los
53,492 s de revocación no certifican la duración del ciclo completo Google/humano.
Sin cambios de código ejecutable ni apps: build/lint y 126 pruebas reutilizados con
hashes coincidentes; no se repiten emuladores ni pruebas nativas para evidencias/docs.
Sin diferencia de paridad entre apps.

Siguiente: revisar propuesta, autorizar operación/permisos temporales/riesgo exactos,
preparar el canal y después pedir la ventana real al propietario/administradores.
No se abrió mantenimiento ni hubo migración, escritura Sheets, FCM, despliegue, cambio
IAM/ACL ni acceso a producción. No hace falta cerrar la hoja. HU abiertas y PR en borrador.

## Hitos anteriores (historial conservado)

Recogedor concreto con commit y push en `4dd7bb54` (2026-11-02). La vinculación de
recibos y las entradas humanas siguientes están **locales, pendientes de commit**.
No hay mantenimiento abierto. Las observaciones conservan sus horas reales.

## Evidencias y operación exactas

Directorio privado: `2026-11-02-initial-evidence-window`.
`initial-evidence-draft-private.json` fija el paquete revisado, las lecturas nuevas
Cloud/censo, la imagen anterior del propietario, la inspección de fuentes y la
revisión del canal nativo. Enumera los 25 controles de escritores y las ocho rutas
de entrega contenida. Paquete de barrera, ámbito, acuerdos, aceptación de riesgo
histórico de la operación, recibo de cierre del permiso e intervalo real de quietud
siguen nulos. El constructor real rechaza el borrador antes de acceder a proveedores.

Se conserva el paquete `9d5287014d6ac4ff82b62841f164aeb3137e6545bbf72ad729e04e5d617d1b8f`,
la ida `request-hu084-initial-68e09b87cef3ef75a357` y la inversa
`hu084-inverse-68e09b87cef3ef75a357`. Las lecturas nuevas coinciden con las fuentes
fijadas; adjuntarlas no exige regenerar el paquete. La intención revisada conserva
203 escrituras Firestore, 53 celdas de ayudantes y dos marcadores, protegiendo fechas,
orden y avisos históricos. La inversa requiere admisión propia y nunca es un reintento
automático.

Lecturas nuevas de solo lectura (Europe/Madrid, 2 de noviembre):

- Censo a las 00:17:55: las 14 colecciones revisadas, documentos individuales y registros
  de captura conservan exactamente contenidos y versiones del servicio. Hay 62 turnos,
  48 usuarios proyectados, cuatro calendarios, tres documentos de configuración,
  117 avisos, 12 eventos capturados y 16 registros de entrega. La autoridad inicial
  del planificador sigue ausente.
- Cloud a las 00:18:02: coinciden las 24 configuraciones de Functions, tres jobs
  pausados, Rules, IAM de proyecto/invocador y seis índices READY. El escritor sigue
  deshabilitado, sin claves de usuario ni bindings propios y fuera del inventario
  de ejecución comprobado.
- Cambió un hash del inventario bruto. Dos respuestas completas nuevas difieren solo
  en el orden de los filtros de eventos y coinciden al normalizarlo. Los 24 nombres/
  configuraciones de Functions y los 24 nombres/revisiones/identidades de servicios
  coinciden con lo revisado. No se conservó la respuesta bruta anterior; su hash solo
  no se presenta como prueba de igualdad de toda aquella respuesta histórica.
- El ejecutor real realiza una transacción de lectura de fuentes y cero adquisiciones
  de controles/escrituras. Las fuentes coinciden; rechaza con `window_scope_missing`.
- La evidencia del propietario de Sheets es **anterior**, del 1 de noviembre a las
  21:50:39 de Madrid. No es una observación nueva de ventana. Su OAuth ya se revocó.

La lectura Cloud duró 1,072s y el censo 3,709s. No acreditan la duración conjunta de
permisos, admisión, Sheets y limpieza. Trabajo histórico y entregas desconocidos
siguen desconocidos; no se reenvía ningún aviso.

## Horario propuesto, todavía sin iniciar

Reservar **hasta 15 minutos** desde una confirmación futura: hasta cinco para entradas
iniciales de solo lectura y diez para el ciclo existente del escritor. OAuth debe
estar preparado antes de esa confirmación. No se rellenan ahora inicio, fin ni
condición IAM reales.

| Desde la futura confirmación | Finalidad máxima |
| --- | --- |
| 0–5 minutos | Conciliación de lectura, plan revisado y compromisos preliminares; sin permisos ni mantenimiento |
| 5–8 minutos | Permisos exactos, propagación IAM mínima de 120s, completar evidencia inicial real y un token |
| 8–10:30 minutos | Barrera/admisión y una dirección de ida |
| 10:30–11:30 minutos | Retirar permiso de hoja y comprobar negativa con el mismo token |
| 11:30–13 minutos | Retirar IAM y deshabilitar explícitamente al escritor |
| 13–15 minutos | Revocar OAuth y verificar negativas de Drive y Sheets |

Son límites máximos, no esperas obligatorias. Se mantienen 180/150/60/90/120s dentro
de los 600s operativos, sin ampliar la duración de los permisos. Las comprobaciones
estrictas de margen pueden rechazar antes del límite de la tabla. Incumplir un límite
de preparación o ejecución detiene el avance; nunca amplía la ventana en silencio.

Valores propuestos del comando: 30s de quietud observada, antigüedad máxima de evidencia
de 600s. La captura inicial y la quietud pasan a ocurrir después del cierre real de
permisos y de las confirmaciones finales, dentro del presupuesto de preparación.
Queda sustituida la propuesta anterior de terminar la quietud antes de iniciar
el ciclo del escritor.
Ese fin de quietud sigue siendo inmutable para comprobar antigüedad; las relecturas
no pueden cambiarle la fecha. Son propuestas, no valores desplegados ni prueba de
terminación histórica. El horario no genera consentimientos ni fechas del proveedor.

## Arranque y recuperación corregidos

El registro guarda primero la operación/paquete, ventana, ámbito previsto, intención
del propietario y administradores, aceptación del riesgo histórico y entradas
revisadas. Solo quedan nulos cuatro hashes derivados: acuerdo del propietario,
acuerdo administrativo, controles conjuntos y evaluación histórica. No pueden cambiar
participantes, autoridad, fuentes, operaciones, plazos, fecha de aceptación del riesgo
ni su identificador de confirmación. El último hash solo admite completar la hora
real de evaluación.

Tras conceder el permiso exacto, el canal nativo cierra el diálogo de Compartir,
comprueba que ha desaparecido, relee los permisos de forma independiente y devuelve
el recibo de cierre. La capacidad de conceder se consume una sola vez y el adaptador
no crea credenciales temporales de escritura del propietario. Su sesión personal
sigue siendo una capacidad humana conservada bajo ADR-0021; cerrar el diálogo no
revoca la propiedad ni acredita el cierre de otras automatizaciones del propietario.
Una respuesta perdida o un diálogo que continúa abierto no produce recibo válido.

La sesión vincula el recibo a este intento, al plan previo y a la transición completa
de permisos. El puerto explícito `readInitialReview` aporta entonces confirmaciones
finales reales y evidencia inicial; recibe el mismo transporte/reloj acotados, la
captura del propietario y el control de autoridad. Debe esperar todas las lecturas.
El sellador no inventa confirmaciones, horas, quietud ni hechos de cierre. Las
confirmaciones deben vincular la intención completa después de cerrar esta concesión;
la captura y la quietud siguen a esas confirmaciones. Se rechazan recibos anteriores,
fechas futuras, participantes/plazos/fuentes cambiados, entradas sustituidas y caducidad.

`google-initial-evidence-sealed` se guarda de forma persistente antes de solicitar
el único token del escritor. Los servicios se construyen después de disponer de ese
recibo. La espera mínima IAM comienza en la concesión real e incluye el tiempo usado
para completar la evidencia; no se añaden otros 120s ni se amplía la ventana. Después
de la propagación se vuelve a comprobar la hoja y la vigencia de la evidencia antes
de pedir el token. La admisión recibe exclusivamente el ámbito sellado y validado,
nunca el plan con campos nulos.

La recuperación relee ese mismo sello como evidencia histórica: no recoge nuevas
confirmaciones, concede permisos, emite tokens ni reanuda la ejecución. Si el arranque
se interrumpió antes del sello, la inspección de barrera/negocio queda no disponible
y siguen las limpiezas independientes de hoja/IAM/OAuth. Un fallo al guardar conserva
el estado de inspección pendiente. Cancelar durante la recogida espera su terminación
y limpia sin pedir token. No se relajan validadores de negocio, rutas de producción,
formato del registro ni límites de permisos/tokens; tampoco se añade inversa automática.

## Validación de la corrección del arranque (publicada en `25109ad4`)

Validación: **115 casos locales distintos** (91 regresiones sin cambios de la ejecución de 113 casos y los 15 casos finales del sello y nueve del canal nativo), **90 casos de emulador**, cero fallos/omisiones. Pasan build, lint completo, lint CJS específico y comprobación del diff.

Evidencia privada: `2026-11-02-startup-seal`. Pasan build/lint completos de Functions
y lint CJS específico. Las pruebas locales cubren sellado correcto, la fábrica real
de servicios, recibos cambiados/antiguos/ausentes, confirmaciones anteriores, caducidad
durante propagación IAM, interrupciones de recogida/disco y reinicio solo para limpiar.
Las respuestas Google y la interfaz nativa de estas pruebas son sintéticas; la regresión
con emulador usa Firestore local real. No certifican los tiempos conjuntos de Google/UI
ni el cierre real del diálogo español. Las apps Android/iOS no cambian.

Siguiente paso: preparar el plan previo exacto y la recogida concreta de evidencia
inicial para la ventana propuesta, conservando el paquete y renovando solo las
observaciones necesarias. Comprobar que las confirmaciones finales, captura y quietud
caben en el mismo plazo antes de pedir ejecutar. Hay que regenerar los hashes de
revisión para este código cambiado. El borrador histórico incompleto sigue sin ser
ejecutable; este ensayo no genera recibos ni una ventana reales.

Sin cambios IAM/ACL, renovación OAuth, escrituras Sheets, FCM, despliegues,
mantenimiento ni acceso a producción en esta corrección. HU-084/HU-085 siguen
abiertas y PR #278 en borrador. No necesitas cerrar la hoja ni hacer nada ahora.

## Recogida concreta y ensayo de tiempos — 2026-11-02

`develop-initial-review-collector.cjs` conecta la recogida inicial con los lectores
existentes. Su plantilla revisada debe contener ya los recibos técnicos de cierre
y el manifiesto; las fechas dinámicas de lectura, acuerdos humanos e intervalo de
quietud deben estar vacíos. La composición comprueba el paquete preparado/revisado
exacto antes de llamar a proveedores. No descubre credenciales ni inicia ejecución real.

Tras el recibo nativo de permisos verificado, recoge la confirmación del propietario
para ese acuerdo completo y después la administrativa, vinculada al acuerdo del
propietario. Lee controles Cloud/autoridad, el censo de cuatro rutas, todas las fuentes
mediante una transacción SDK de solo lectura y la captura directa de la hoja. Tras
el intervalo mínimo de quietud repite las observaciones y obtiene informes humanos
finales explícitos. La igualdad de contenido no sustituye un informe humano. El
comparador causal admite solo las adiciones revisadas al registro de capturas y
conserva los contadores desconocidos. El validador real debe aceptar el resultado
antes del sellado. Cada grupo espera todas sus operaciones antes de avanzar o limpiar.

La recogida debe terminar antes de **inicio de ventana +150 segundos**, reservando
30 segundos dentro de los 180 existentes para las comprobaciones restantes. La
concesión nativa y ambas confirmaciones consumen ese mismo plazo. Los dos minutos
mínimos de IAM siguen contando desde la concesión real e incluyen la recogida; no
se añaden otra espera ni más duración a permisos o token. HTTP recibe el límite más
estricto. La cancelación se propaga a la recogida y a la espera de quietud.

| Escenario simulado | Duración de recogida | Resultado |
| --- | ---: | --- |
| Normal: dos confirmaciones de 10 s, dos lecturas de fuente de 3 s, dos de hoja de 2 s y 30 s de quietud | 60,400 s | Aceptado; quedan 79,470 s hasta el límite de recogida |
| Dos confirmaciones de 60 s | 125,200 s | Rechazado: no cabe el intervalo de quietud |
| Lecturas de fuente de 80 s | 212,200 s | Rechazado al terminar la lectura SDK pendiente; supera el límite en 72,330 s |
| Concesión tarda 145 s | 10,000 s | Rechazado tras confirmar; supera el límite en 5,130 s |

Son tiempos deterministas **simulados, no latencias medidas de Google o la interfaz**.
Una petición SDK o confirmación humana iniciada puede no admitir cancelación. Se espera
su terminación y se impide emitir el token; no se garantiza terminar la limpieza en
diez minutos ante cualquier demora externa. Los callbacks reciben plazo y comprobador
de cancelación. Un intento vencido exige inspección/contención; no demuestra limpieza
correcta ni autoriza repetir escrituras.

El archivo privado `2026-11-02-initial-collection/collection-preparation-private.json`
vincula siete entradas conservadas sin cambios, paquete/operaciones exactos, orden de
lectores, mapa de 25 controles, recibos de tiempos y campos pendientes. Las 23 filas
técnicas del borrador anterior siguen sin fechas/huellas de cierre revisadas; esta
preparación no las convierte en hechos verificados. Las otras dos filas requieren
confirmaciones humanas de la ventana real. No se copian datos de las pruebas a esa
preparación real, que sigue sin permitir ejecución.

Validación actual: 106 pruebas locales y 90 con Firestore local, cero fallos/omitidas;
build/lint completos de Functions, lint CJS focalizado y diff correctos. El caso nuevo
de composición verifica rechazo de paquete distinto antes de proveedores y fallo de
inspección SDK de solo lectura antes del sellado; el caso positivo del recogedor usa
fuentes/Google/personas simulados. La regresión del emulador no certifica el ciclo
completo real del recogedor y migración. Android/iOS sin cambios ni nueva diferencia.

Siguiente: completar la plantilla técnica revisada y la conexión final de lecturas/
confirmaciones con los recibos conservados, renovar solo evidencias/credenciales que
requieran actualidad y comprobar el mismo presupuesto antes de pedir ventana real.
No hay mantenimiento ni autorización de esa ejecución. No debes hacer nada ni cerrar
la hoja ahora.

## Recibos conservados y entradas humanas explícitas — 2026-11-02

La plantilla estática vincula ya los **23 controles técnicos**, las dos filas humanas
futuras, paquete/operaciones/fuentes/hoja exactos y las cuentas de propietario,
operador y ambos administradores. El directorio privado `2026-11-02-technical-receipts`
conserva el preparador reproducible, 25 archivos fijados por huella,
`technical-receipts-private.json`, `initial-template-private.json` y
`confirmation-inputs-private.json`. Diez archivos de código desplegado coinciden con
las huellas del proveedor conservadas y la configuración retenida actual. La respuesta
antigua de Rules carece de metadatos añadidos en otra lectura: nombre, fuente y fecha
de creación coinciden exactamente. El lector conserva la respuesta nueva completa
como referencia, sin relajar la comparación.

`bind-develop-technical-receipts.cjs` rechaza controles/recibos ausentes, bytes cambiados,
fechas sin el campo original citado, discrepancias Rules/captura y ceros de trabajo
inventados. Distingue lecturas verificadas de cierre, observaciones de registros
ausentes y evidencia compuesta condicionada de autoridad. Vincula procedencia; no
prueba que todos los escritores actuales estén técnicamente bloqueados. Los nuevos
workers son factorías lógicas sin registro en la composición inspeccionada; la ruta
HTTP es `shiftCoverage`, no un endpoint inventado del worker. Los 23 contadores de
trabajo anterior siguen desconocidos y deben vincularse a la aceptación específica
del riesgo histórico. El mantenedor confirma ahora que no hay automatización externa
adicional a las apps/Functions conocidas. Esa declaración no prueba terminación
histórica ni sustituye el inventario técnico actualizado.

`createDevelopHumanInputs` proporciona las tres entradas del recogedor: confirmaciones
de propietario/administradores, informes iniciales e informes posteriores nuevos.
Su transporte `exchange` debe mostrar la petición exacta; no abre navegador ni pregunta
ahora. Incluye cuentas/funciones, intervalo UTC, operaciones, acuerdo inmutable y
secuencia única. Las plantillas dejan a null consentimiento, tiempos y estado; no
traen aceptación marcada. Cada respuesta lleva huella de petición, identificador
único y hora realmente observada. Los validadores de dominio comprueban participantes
y compromisos completos. Peticiones/respuestas se guardan en el diario existente.
Respuestas vacías, negativas, antiguas, futuras, sustituidas, reutilizadas, retiradas
o con actividad detienen el avance. Cada informe posterior exige una respuesta nueva.
El contador inicial de cambios sin conexión sigue null hasta validar las confirmaciones
explícitas de cierre/conexión. Se espera la terminación de una entrada pendiente al
cancelar; no se amplía ningún plazo ni garantía de limpieza.

Los formularios completan los campos estáticos de ámbito/acuerdos/riesgo. Siguen
vacíos el identificador del intento, ventana, aceptación concreta del riesgo y su
fecha, cierre real de permisos, confirmaciones e informes observados. La aceptación
previa de ADR-0026 no se copia como autorización de otra ejecución. Antes de dar por
actuales las filas condicionadas hay que renovar el inventario completo de autoridad
automática, la ausencia de entradas no desplegadas y las observaciones directas de
propietario/hoja/carpeta. Son renovaciones de evidencia pendientes; no requieren otro
algoritmo ni regenerar el paquete, que no ha cambiado.

Validación: **126 pruebas locales distintas y tres comprobaciones privadas sin red**,
sin fallos ni omitidas; build/lint completos y lint CJS correctos. La comprobación
positiva privada completa una copia con tiempos/consentimientos expresamente simulados
y pasa el validador real; no guarda aceptación operativa. Los formularios reales sin
confirmar se rechazan por separado. Las 90 pruebas previas de emulador se conservan
como evidencia histórica, no repetida ni presentada como nueva aceptación en vivo.
Android/iOS sin cambios ni diferencia nueva. Siguiente: renovar las observaciones
identificadas y revisar el paquete con fechas concretas antes de pedir ejecución.
Sin mantenimiento, llamadas a proveedores, permisos, token, escritura Sheets, FCM ni
producción en este bloque. No necesitas cerrar la hoja ahora.
## Intento interactivo detenido antes de la concesión — 2026-11-02

El intento autorizado `develop-original-20261102-interactive-03` empezó a las
11:22:03 UTC y se detuvo al preparar la concesión de edición en el cuadro de
Compartir: el adaptador no encontró de forma inequívoca un control nativo. El
diario no identifica cuál de sus selectores falló. La pantalla observada después
mostraba la invitación sin enviar; se canceló y no se concedió acceso a la hoja.
No se emitió token del escritor ni se inició el lote de Sheets o la migración.

La limpieza verificó la retirada de la concesión IAM temporal, la desactivación
del escritor y la revocación de OAuth. Una lectura posterior confirmó la cuenta
deshabilitada, sin claves ni bindings; Drive y Sheets devolvieron 401 al mismo
token de lectura revocado. El cuadro de Compartir mostró de nuevo al propietario
y cuatro lectores, sin el escritor. La inspección posterior de Firestore encontró
la fuente esperada y únicamente el bloqueo de ventana ausente. La reversión no se
ejecutó y este intento no autoriza otro. Evidencia privada: diario
`2026-11-02-authorized-develop-window/journal/develop-original-20261102-interactive-03`.

La corrección local espera de forma acotada la aparición de los controles y
registra cuál falta o es ambiguo. Solo repite lecturas de accesibilidad; no repite
la entrada, la confirmación del destinatario ni el envío de permisos. Doce pruebas
del adaptador, el lint y el build de Functions pasan. El formulario demorado es una
simulación: la corrección todavía no se ha ensayado en Google y no demuestra la
causa exacta. Para otro intento hay que revisar de nuevo la huella del canal,
renovar las observaciones y obtener una autorización concreta.

## Formulario real verificado sin envío — 2026-11-11

Con la corrección `caefdcf7`, el mismo adaptador reconoció el destinatario, el rol
Editor y la casilla de notificación en el formulario real de Google. Llegó al
punto anterior a compartir a las 16:09:59 UTC; el ensayo bloqueó expresamente el
envío y canceló la invitación. La lista volvió a mostrar al propietario y cuatro
lectores, sin el escritor. No se concedió edición ni se abrió mantenimiento.

El ensayo usó metadatos sintéticos para atravesar los controles locales del
adaptador, con la interfaz real y dos bloqueos independientes del envío. Valida
el reconocimiento del formulario, no la concesión/retirada efectiva de permisos
ni la admisión de migración. La evidencia privada `2026-11-11-native-form-unsent`
conserva nueve lecturas AX, el resultado, la captura tras cancelar y la nueva
revisión del canal ligada a su SHA-256 `8f8e48ae…9e3cb`. No se modifica el
expediente consumido del 2 de noviembre.

Los 17 archivos fijados siguen íntegros y se reproducen exactamente el paquete
`7201f1cf…f257715` y su materialización `373ee000…faced`: 203 escrituras Firestore,
53 celdas y dos marcadores. Para el siguiente intento hay que renovar las lecturas
de autoridad, fuentes y hoja/carpeta y preparar autorización/ventana nuevas; el
resultado del formulario no sustituye esas lecturas.

La renovación real de solo lectura (`2026-11-11-readonly-refresh`) verifica los
controles de Cloud, los seis índices y el escritor deshabilitado, sin claves ni
bindings temporales y aislado. El paquete antiguo se rechaza porque cambió solo
`versions.ios.min` en `config/global` y `config/public`; `config/member` conserva
su imagen. Un nuevo censo atómico confirma que las demás fuentes revisadas siguen
idénticas. La configuración no se escribe en ninguna dirección de la migración.

El candidato privado `41d3109d…05fd`, preparación `1175a90e…bbea`, conserva las
intenciones públicas, imágenes antiguas y 53 celdas idénticas, con 203/140
escrituras forward/inverse. Renueva los enlaces de procedencia, operación,
archivos y marcadores; sus rutas físicas de auditoría no son byte-idénticas.
No reutiliza la autorización del intento anterior. Mantiene las observaciones históricas de
Drive/Sheets identificadas como tales y **no es ejecutable**: faltan su renovación
directa, manifiestos/controles de la ventana y autorización nueva. El conector
actual sigue omitiendo versión/permisos completos; no se consideran verificados
por el resultado parcial de metadatos.

Una transacción real de solo lectura con ese candidato verifica la fuente y
devuelve únicamente `window_scope_missing`, con cero escrituras y sin abrir
mantenimiento. Esta admisión parcial no acredita las observaciones de Google
pendientes ni permite ejecutar el candidato.

### Renovación directa de la hoja y la carpeta

La sesión de lectura autorizada produjo una captura directa completa conservada
en `2026-11-11-owner-refresh`: dos imágenes de celdas idénticas, versión 287,
propietario y permisos de hoja/carpeta estables. La imagen de preservación sigue
siendo `2682cfb7…81b3`. El cierre agotó el tiempo de la sesión de herramientas
después de guardar la captura. La recuperación encontró el token inválido
(respuesta 400 a otra revocación) y comprobó 401 con el mismo token en Drive y
Sheets. No se conserva una respuesta 200 del cierre inicial y no se inventa.
No se solicitó otro token ni se concedió edición o abrió mantenimiento.

La composición final `2026-11-11-next-window-preparation` enlaza el paquete
renovado `bcb7d82a…2632f`, preparación `0926cf4b…39645` y operación
`request-hu084-initial-fd4a76de51ab9a9280cd` con los formularios y la nueva revisión
del canal. Los 17 archivos fijados, los tres diarios anteriores y la denegación
sin autorización validan. La construcción aislada y tres pruebas privadas del
codec/vínculo usan datos y respuestas expresamente sintéticos, sin proveedores.
El recibo nuevo `develop-original-20261111-interactive-04` conserva autorización
en false, ventana null y confirmaciones vacías. La preparación está lista para
solicitar autorización; los manifiestos y la evidencia vigente se obtendrán bajo
la barrera real, con el presupuesto revisado de 20 minutos y un único token de
300 segundos. Las observaciones históricas de efectos y autoridad no se convierten
en pruebas nuevas ni se elimina su aceptación de riesgo pendiente.

## Intento 04 detenido tras conceder el permiso — 2026-11-11

El intento único autorizado `develop-original-20261111-interactive-04` envió la
concesión a las 16:40:55 UTC. Google añadió al escritor como Editor, pero el
adaptador no reconoció el estado siguiente. La retirada automática también falló
al comprobar el diálogo recién reabierto. El terminal original conserva
`inspection-required` y `file-unverified`; no se emitió token del escritor ni se
inició mantenimiento, migración o lote de celdas. El ensayo previo sin envío no
ejercitaba estas transiciones posteriores a la concesión.

El operador retiró el acceso desde el cuadro de Compartir, guardó y reabrió el
diálogo: a las 16:42:46 UTC figuraban únicamente el propietario y cuatro lectores.
La verificación independiente posterior confirma escritor deshabilitado, cero
claves y bindings IAM, aislamiento y fuente Firestore intacta; el mismo token
OAuth devuelve 401 en Drive y Sheets. El diario recibió una recuperación manual
con referencias y huellas de esas pruebas y se liberó el bloqueo local mediante
su API. Los 23 registros originales permanecen intactos, incluido el fallo de
limpieza automática. La recuperación no permite reanudar ni repetir la migración.

Evidencia privada: el diario `develop-original-20261111-interactive-04`,
`2026-11-11-next-window-preparation/manual-file-cleanup-*`,
`2026-11-11-postflight04-164322` y el recibo OAuth posterior. La ventana terminó
anticipadamente y la autorización única quedó consumida.

La corrección local añade espera acotada de lecturas tras compartir, cerrar,
reabrir y guardar una retirada, sin repetir esos clics. Una acción ya enviada
debe observarse hasta un estado asentado incluso si vence su plazo; el error de
plazo se conserva y bloquea el avance. Si la concesión queda incierta, la sesión
no convierte una lectura de ACL ausente en prueba de cierre, también al recuperar.
Pasan 19 pruebas del canal y 25 de sesión con Node 22, lint/build de Functions y
lint CJS. La corrección se publicó después en `fcdab63e`; el ensayo real posterior
se recoge a continuación.

## Concesión y retirada con el escritor deshabilitado — 2026-11-11

El ensayo exclusivo autorizado pasó con el adaptador de `fcdab63e`: una concesión
y una retirada completas, con verificación independiente de ACL, sin resultado
incierto ni fallo de limpieza. Entre 17:02:17 y 17:02:45 UTC se comprobaron la cuenta
deshabilitada, cero claves de usuario y cero bindings IAM antes/después de ambas acciones.
No se activó el escritor ni se emitió su token; el ejecutor del ensayo excluye
mutaciones IAM, llamadas a Sheets, Firestore y migración.

La sesión del propietario solicitó únicamente `drive.metadata.readonly`, Online
sin renovación. Se revocó con respuesta 200 y el mismo token devolvió 401 en Drive.
El diálogo reabierto mostró al propietario y cuatro lectores, sin el escritor.
Evidencia privada: `2026-11-11-native-disabled-writer-rehearsal`, diez registros de
fase, resultado, revisión ligada al SHA actual, cierre OAuth y captura final.
Los cuatro casos locales del helper validan sus guardas, no sustituyen el ensayo
real ni prueban una migración completa.

Queda validado el ciclo nativo que había fallado. Otro intento de migración
requiere regenerar la revisión con el código publicado, renovar las observaciones
afectadas por los cambios de permisos y obtener su propia autorización/ventana.
Este ensayo no abre mantenimiento ni autoriza esa ejecución.

## Revisión renovada para el intento 05 — 2026-11-11

La nueva lectura directa autorizada observó la hoja y su carpeta entre 17:37:42
y 17:37:50 UTC: versión real **291**, propietario y cuatro lectores, sin acceso
del escritor. Las dos capturas completas de las seis pestañas son idénticas y
conservan la imagen `2682cfb7…81b3`, incluidas las fechas y el orden publicados.
Se hicieron trece GET acotados. OAuth Online sin renovación se revocó con respuesta
200; el mismo token devolvió primero 401 en Drive/200 en Sheets y, a las 17:38:44,
401 en ambos. Se conservan ambas sondas, sin ocultar la propagación del cierre.

El paquete regenerado `6177be45…9f73a81`, preparación `f3b5a9b0…faa2b5b8` y
operación `request-hu084-initial-6678cf8a7c2756773ef8` enlazan esa captura y los
controles Cloud/identidad renovados a las 17:08:24 UTC. Sus 17 archivos fijados
validan; mantiene las 203 escrituras forward y 140 inverse previstas, sin escribir
configuración, y las 53 peticiones de celdas más dos marcadores. Las peticiones de
celdas son exactas respecto al paquete previo; los identificadores y marcadores
de auditoría se regeneran. La inspección del paquete exacto a las 17:39:38 UTC usa
una transacción Firestore de solo lectura y cero escrituras: la fuente coincide y
el único bloqueo es `window_scope_missing`. No se presenta como admisión completa.

La plantilla nueva `develop-original-20261111-interactive-05` incorpora la revisión
del canal ligada al ciclo real de concesión/retirada y distingue los tres diarios
con cierre automático del fallo original y la recuperación manual del intento 04.
Las comprobaciones locales verifican los enlaces, el rechazo sin autorización,
la construcción aislada y tres pruebas del codec/formularios; los datos positivos
son sintéticos, sin proveedores. La preparación dejó autorización false, ventana
null y confirmaciones vacías; el intento posterior recoge su consumo. La propuesta
fue de veinte minutos, con un único token de 300 segundos; no fijó fechas ni
reutilizó compromisos.

La revisión independiente enlaza 337 hashes actuales con la revisión anterior y
las dos correcciones de canal/sesión ya validadas. La comparación histórica frente
al 1 de noviembre se conserva, incluidas sus diferencias; no se declara igualdad
literal. El operador privado fija el manifiesto y comprueba archivos y evidencias
al cargar, preparar e iniciar el intento. Cinco pruebas locales de alteración,
ausencia, manifiesto cambiado, archivo añadido y cambio antes de iniciar detienen
el avance con cero llamadas a proveedores. Antes de cargar el operador se requiere
un contexto Node nuevo o retirar solo su caché y la del worktree en la sesión CUA;
comprobar el disco no acredita los módulos ya cargados. No cambia el ejecutor del
repositorio.

Evidencia privada: `2026-11-11-interactive05-owner-refresh`,
`2026-11-11-interactive05-rebind` y `2026-11-11-interactive05-preparation`.
Durante esta preparación solo hubo lecturas y validación local, con el escritor
deshabilitado. La ejecución requería autorización propia y la ventana real, con
observaciones vigentes y
confirmaciones posteriores al permiso. Android/iOS no cambian y mantienen paridad;
las comprobaciones nativas y el build/lint se reutilizan por no cambiar código de
apps o Functions. El guion privado de arranque se valida por separado.

## Intento 05 detenido durante las confirmaciones — 2026-11-11

El intento único autorizado comenzó a las 18:19:26 UTC, con máximo hasta las
18:39:26. La concesión de edición quedó verificada y se recibió la confirmación
nueva del propietario. La recogida rechazó el paso de administradores 457 ms
después de publicar su pregunta, cuando quedaban más de diez minutos de plazo.
El terminal de las 18:21:40 conserva `inspection-required` y `file-unverified`:
la retirada automática esperó veinte segundos sin atención de la llamada CUA.
No hubo emisión de token del escritor, adquisición de barrera, lote de Sheets ni
escrituras de migración. La respuesta de administradores recibida después quedó
en el registro 31; es tardía y no se presenta como confirmación aceptada.

La retirada manual se guardó y verificó reabriendo Compartir a las 18:23:46 UTC:
propietario y cuatro lectores, sin escritor. El postflight independiente confirma
escritor deshabilitado, cero claves de usuario/bindings IAM, aislamiento y fuente
Firestore intacta. El cierre OAuth automático conserva respuesta 200 y 401 del mismo token
en Drive y Sheets. La ventana humana se liberó anticipadamente. El proceso CUA
se cerró después de guardar las pruebas; la recuperación del bloqueo local usa
la API existente: conserva los 32 registros originales, incluido el terminal y
la respuesta tardía, y añade dos recibos de recuperación; ambos bloqueos locales
quedan retirados. No se modifica la guarda de recuperación para liberar un
proceso vivo ni se autoriza reanudar la ejecución.

El montaje pasaba un `notify` que escribía mediante `nodeRepl.write`. Una prueba
local reproduce `node_repl exec context not found` al resolver desde otra llamada
una continuación asíncrona que usa ese aviso; la llamada síncrona sí funciona.
El orden del diario y el código apuntan a ese fallo de instrumentación, aunque la
excepción original no quedó guardada. La corrección debe mantener los avisos en
estado consultable, invalidar pregunta/temporizador al cerrar y rechazar respuestas
tardías antes de escribirlas. También debe atender la cola de retirada mientras
espera respuestas humanas. Aumentar el plazo no corrige este problema.

La corrección local `2026-11-11-coordinator-fix` conecta intercambio humano, cola
nativa y vigilancia en una plantilla sin paquete, credenciales ni autorización.
El rechazo de la recogida invalida la pregunta antes de registrar el evento; una
concesión atrasada se cancela al cerrar y una retirada puede atenderse durante
la limpieza. Acciones nativas aún en curso mantienen inspección pendiente. Pasan
12 pruebas con Node 22 y lint focalizado. En NodeREPL se comprobó una espera entre
dos llamadas: la respuesta resuelve sin error de contexto y una respuesta tras
cierre no añade registros. Es un ensayo sintético sin proveedores; la plantilla
rechaza ejecución y todavía debe vincularse a un nuevo paquete revisado.

Evidencia privada: `2026-11-11-interactive05-live`,
`2026-11-11-postflight05-182301` y el diario
`develop-original-20261111-interactive-05`. La autorización quedó consumida.
Las observaciones anteriores de versión 291 y la preparación del intento 05 son
históricas; otro intento requiere revisar el coordinador corregido y renovar los
enlaces afectados por los cambios de permisos. Producción y las apps no cambiaron.
Se reutilizan los gates de Functions y nativos: el repositorio solo cambia
documentación en este bloque; las comprobaciones del coordinador privado son las
indicadas arriba.

## Paquete actualizado y coordinador conectado — 2026-11-11

El cierre del intento 05 y su corrección local se publicaron en `5df19c52`.
La nueva preparación renueva Cloud/IAM/índices y el censo atómico de develop:
payloads y versiones de servicio coinciden con la fuente anterior. La captura
directa de la hoja y su carpeta observa la versión real **293**, propietario y
cuatro lectores. Las dos imágenes completas de las seis pestañas conservan
`2682cfb7…81b3`. OAuth Online sin renovación se revocó con respuesta 200; tras dos
sondas Drive401/Sheets200, el mismo token devuelve 401 en ambos a las 18:55:13 UTC.

El paquete `e97cf026…22377d1`, preparación `10cc98e4…e3ed760` y operación
`request-hu084-initial-1215bc534e8eba0f9007` fijan esas observaciones. Los 17 pins,
las 203/140 escrituras previstas y las 53 peticiones de celdas más dos marcadores
validan; las peticiones de celdas son idénticas y no se escribe configuración.
La inspección exacta de Firestore usa una transacción de lectura y cero escrituras;
la fuente coincide y queda solo `window_scope_missing`.

El operador privado 06 conecta el intercambio humano, la cola nativa y el driver
corregidos al ejecutor existente. Sus puertos de inspección, limpieza y recuperación
cierran la pregunta antes de actuar, incluso cuando la apertura devuelve
`setupFailed`. El registro de sesión invalida la pregunta antes de añadir un
rechazo de recogida. La vigilancia atiende retiradas, cancela concesiones atrasadas
y mantiene inspección pendiente si hay una acción nativa en curso. No hay callbacks
de herramientas en la continuación asíncrona. Conserva la guarda de 337 fuentes y
siete pruebas históricas, y fija también las huellas de los tres módulos nuevos.

Pasan **22 pruebas del operador y tres independientes**, con Node 22, más construcción
sintética y lint focalizado. Incluyen el `runControlledWindow` real con puertos
simulados, fallo de barrera, apertura `setupFailed`, respuesta tardía sin escritura,
retirada atendida una vez y negativa del operador sin acceder al proveedor cuando
falta autorización. Los cinco diarios anteriores y sus recuperaciones conservan
sus huellas. Esto valida la conexión local; no acredita un ciclo real de servicios.

El recibo `develop-original-20261111-interactive-06` deja autorización false,
ventana null y confirmaciones vacías. El máximo propuesto sigue en veinte minutos
y un token de 300 segundos. Antes de ejecutar hacen falta autorización nueva,
observaciones vigentes y confirmaciones reales; la vigilancia debe permanecer
atendida en las llamadas CUA y una interrupción no acredita limpieza.
El escritor sigue deshabilitado, sin concesiones nuevas de edición ni IAM.
No se abre mantenimiento ni se ejecutan migración, despliegues o FCM.
Producción y ambas apps no cambian.

Evidencia privada: `2026-11-11-package-coordinator-refresh-184922`,
`2026-11-11-interactive06-owner-refresh`, `2026-11-11-interactive06-preparation`
y `2026-11-11-interactive06-wiring-tests`. Se reutilizan los gates nativos/Functions
por no cambiar su código ni contratos; las comprobaciones nuevas son las locales
indicadas. La preparación nueva queda local, posterior al commit citado arriba.

## Intento 06 cerrado al vencer la confirmación — 2026-11-11

La preparación se publicó en `29ea717c`. El intento único autorizado comenzó a
las 19:50:36 UTC, con máximo hasta las 20:10:36. La concesión quedó verificada y
se pidió la confirmación posterior del propietario. La recogida terminó sin
respuesta registrada dos milisegundos después del plazo de las 20:03:06 UTC.
Ese orden coincide con el temporizador de respuesta; el diario no conserva el
texto de la excepción. El controlador se mantuvo atendido durante la espera.

El terminal de las 20:03:35 UTC conserva `inspection-required` y limpieza sin
fallos: una retirada nativa verificada, IAM retirado, escritor deshabilitado y
OAuth revocado con respuesta 200 y 401 del mismo token en Drive y Sheets. No hay
acciones en vuelo, incumplimientos de presupuesto, archivos pendientes ni
bloqueos locales. Los 31 registros permanecen intactos, con terminal al final.
No hubo emisión del token del escritor, adquisición de barrera, lote de Sheets
ni migración; el postflight independiente confirma la fuente exacta sin cambios,
escritor deshabilitado, cero claves de usuario/bindings IAM y aislamiento.
Compartir vuelve a mostrar al propietario y cuatro lectores.

La respuesta «Sí, todo sigue vigente» llegó después del terminal y se conserva
separada del diario, sin aceptarla como consentimiento ni reanudar la operación.
La pregunta indicaba el compromiso hasta las 21:10:36 de Madrid, pero omitía en
su propio texto el límite de respuesta de las 21:03:06. Las futuras peticiones
deben indicar claramente **responder antes de** y **mantener el compromiso hasta**,
con las dos horas obtenidas del desafío real. La ventana humana se liberó tras
verificar el cierre; la autorización única está consumida.

Formato obligatorio al presentar cada desafío: «**Responde antes de [hora Madrid
de `deadlineMillis`]**. Mantén el compromiso hasta [hora Madrid de fin de ventana]».
La respuesta se aplica solo si `status().pending` conserva el mismo digest y sigue
dentro del plazo. Una respuesta posterior al terminal se guarda aparte; nunca se
llama a `answerAndAttend` para reabrir una pregunta cerrada.

Evidencia privada: diario `develop-original-20261111-interactive-06`,
`2026-11-11-interactive06-live`, `2026-11-11-postflight06-200456` y
`2026-11-11-interactive06-result`. Este resultado comprueba el cierre automático
real con la vigilancia corregida, no una migración en vivo. Se reutilizan las
25 pruebas locales del código sin cambios; no se repiten gates nativos/Functions
para este registro documental. Producción y las apps no cambian. Otro intento
requiere actualizar las observaciones afectadas por permisos, revisar el paquete
y recibir autorización y confirmaciones nuevas; esta respuesta tardía no las suple.

## Preparación del intento 07 — 2026-11-11

Tras el cierre del intento 06, publicado en `6c97de0e`, se renovaron las
observaciones de Develop. La hoja está en la versión 295 y conserva la imagen
completa, las fechas y el orden revisados. El paquete `7ef0b3f0…d1041c3`,
preparado `21bd0830…a1ef64aa` y operación `request-hu084-initial-0d45873f91ccf634adc1`
conservan 203 escrituras previstas en Firestore, 53 celdas y dos marcadores.
La admisión exacta efectuó una transacción de solo lectura y ninguna escritura;
su único impedimento registrado es la ausencia de una ventana concreta.

La revisión independiente comprobó los 17 archivos del paquete, la equivalencia
del contenido y las fuentes, y el rechazo del operador antes de acceder a
proveedores cuando faltan las confirmaciones. Pasaron 28 pruebas locales: 11 del
coordinador, una de conexión, siete de integridad de fuentes, tres de formularios,
dos de presentación de plazos y cuatro del fechado en copias temporales. No
son una prueba de migración real. El nuevo control rechaza fechar la ventana si
la sesión de lectura del propietario no cubre, de forma conservadora, los 20
minutos completos. Cada pregunta debe mostrar por separado el límite para
responder y la hora hasta la que se mantiene el compromiso, en hora de Madrid.

El usuario autorizó un único intento y confirmó la ventana. El fechador registró
el intervalo a partir de las 20:29:06 UTC, pero la composición del operador falló
antes de arrancarlo: nuestra llamada omitió `ownerCredential.sessionId`. Es un
fallo de preparación del operador, no de la respuesta del usuario. No se creó ni
arrancó el operador y la ventana no comenzó operativamente. No se concedieron
permisos, emitió token del escritor, abrió mantenimiento ni ejecutó migración; no
se hizo otro intento. La sesión de lectura OAuth se revocó con respuesta 200 y el
mismo token fue rechazado con 401 en Drive y Sheets. La comprobación independiente posterior confirmó que la fuente coincide con el
paquete 07, el escritor sigue deshabilitado y aislado, sin claves de usuario ni
bindings IAM: diez lecturas y una transacción de solo lectura, sin escrituras.
No existe diario del 07 ni bloqueo local de ejecución o recuperación. La pestaña
OAuth se cerró, el SDK terminó y se descartaron las referencias al token. La
ventana se liberó y el usuario puede volver a abrir la hoja. Antes de fechar otra
ventana hay que validar el descriptor completo y obtener una nueva autorización.

Se ha preparado una validación local previa al fechado que exige el descriptor
completo del propietario, duración suficiente de su sesión, acceso IAM, identidad
del SDK y los cuatro controles de la pestaña. Tres pruebas Node 22 pasaron: la
omisión del identificador se rechaza antes del fechador y de los proveedores; el
caso completo construye el operador 07 exacto en una copia con ventana y
confirmaciones simuladas y proveedores dobles. No es una ejecución real. Queda
pendiente incorporar esa misma entrada validada al próximo arranque y obtener una
nueva autorización; el expediente consumido del 07 no se modifica.

La respuesta tardía del 06 no se reutiliza. Evidencia privada:
`2026-11-11-interactive07-refresh`, `2026-11-11-interactive07-owner-refresh`,
`2026-11-11-interactive07-preparation`, `2026-11-11-interactive07-live` y
`2026-11-11-postflight07-202959` y `2026-11-11-operator-input-preflight`.

## Intento 08 detenido durante las confirmaciones — 2026-11-11

El cierre del intento 07 se publicó en `e106d4cd`. El paquete 08
`a21f4f0c…f54bce2` y la admisión exacta conservaron las 203 escrituras
previstas, 53 celdas y dos marcadores. La observación viva de la hoja confirmó
la versión 295, la autoridad y la imagen completa iguales a la referencia
retenida del 07; su revocación histórica corresponde solo a aquella sesión.
Pasaron 32 pruebas locales y la revisión independiente. El controlador también
validó los datos completos de arranque antes de fechar la ventana real.

El intento único autorizado comenzó a las 21:42:27 de Madrid, con fin máximo
a las 22:02:27. La confirmación del propietario se recibió y registró a las
21:54:17, dentro del plazo. La petición posterior para administradores comenzó a las 21:54:18, con
el mismo límite de las 21:54:57, por lo que quedaron unos 39 segundos para
responder. No consta respuesta antes de vencer y la recogida se rechazó. No se
atribuye el resultado al usuario: hay que acordar una ventana de respuesta
inicial viable antes de plantear otro intento, sin repeticiones silenciosas.
Antes de la primera pregunta se explicará que propietario, administradores e
informes son tres confirmaciones consecutivas dentro de un mismo plazo común.

El terminal a las 21:55:28 conserva `inspection-required`, limpieza sin fallos,
operaciones asentadas, ninguna acción en vuelo ni incumplimiento de plazos. Los
34 registros no tienen archivos pendientes. La retirada de la hoja y de IAM
consta verificada; el ejecutor revocó OAuth con 200 y recibió 401 con el mismo
token en Drive y Sheets. La pestaña OAuth se cerró y el proceso llamador descartó
las referencias. No se emitió token del escritor ni se inició barrera, lote de
Sheets o migración; tampoco se accedió a producción. La autorización única del
08 está cerrada. El postflight independiente de solo lectura confirmó la fuente
exacta, el escritor deshabilitado y aislado, sin claves ni bindings: diez lecturas
y una transacción, sin escrituras. El diario no tiene archivos pendientes y no
hay bloqueos locales de ejecución o recuperación.

Evidencia privada: diario `develop-original-20261111-interactive-08`,
`2026-11-11-interactive08-refresh`, `2026-11-11-interactive08-preparation` e
`2026-11-11-interactive08-live` y `2026-11-11-postflight08-205619`.

La confirmación de administradores recibida tras el cierre («Confirmo ambas
cuentas hasta las 22:30») se conserva en un recibo privado separado. No se añade
al diario, no amplía la ventana del 08 y no autoriza otro intento; los 34 registros
y su huella permanecen intactos.
