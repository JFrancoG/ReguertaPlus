# HU-084 — Evidencia inicial y propuesta de ventana de develop

Corrección del arranque con commit y push en `25109ad4`. El recogedor concreto de
evidencia inicial está **ensayado localmente, pendiente de commit** (2026-11-02).
No hay mantenimiento abierto. Las observaciones conservan sus horas reales; no se
han renovado con lecturas en vivo.

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
