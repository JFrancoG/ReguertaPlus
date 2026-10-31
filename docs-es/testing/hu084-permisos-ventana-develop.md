# HU-084 — Preparación de permisos y ventana de develop

Estado: **solo preparación; sin fecha ni autorización de ejecución**. La evidencia
del escritor original y su integración en admisión están publicadas en `d42ce7fe`.
Este plan no concede acceso, abre mantenimiento, migra datos ni activa las apps.

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
2. Completar la composición real del plano de control que adquiere y conserva la
   barrera, relee observaciones del propietario/administradores y registra fallos y
   recuperación. `controlled-develop-migration.cjs` solo consume una barrera ya
   adquirida; su inspección pasiva debe seguir rechazando la ausencia de ventana.
3. Ensayar localmente esa composición con el paquete regenerado exacto y su reversión,
   incluidas interrupciones y limpieza. Revisar aparte el lote de la hoja original:
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

Validación: build y 50 pruebas de emulador correctas, sin fallos/omisiones, con el
paquete regenerado; 203 escrituras de ida/140 de vuelta, 62 originales restaurados y
117 avisos conservados. Coinciden las ocho huellas de código/pruebas aceptadas; se
reutilizan las 146 pruebas focalizadas y lint. Sintaxis privada y diff correctos. Este bloque solo cambia documentación y preparación privada,
sin cambios nativos ni diferencia entre plataformas. Mantenimiento y aplicación
siguen en falso.
