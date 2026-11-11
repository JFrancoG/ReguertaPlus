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
