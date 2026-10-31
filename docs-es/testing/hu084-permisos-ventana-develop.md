# HU-084 — Preparación de permisos y ventana de develop

Estado: **solo preparación; sin fecha ni autorización de ejecución**. La evidencia
del escritor original y su integración en admisión están publicadas en `d42ce7fe`.
Este plan no concede acceso, abre mantenimiento, migra datos ni activa las apps.

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
