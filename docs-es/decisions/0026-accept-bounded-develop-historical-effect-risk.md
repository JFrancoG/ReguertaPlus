# ADR-0026: Aceptar un riesgo histórico acotado en develop

## Estado

Aceptado para implementación y ensayo local — 2026-10-30. El mantenedor acepta
expresamente el riesgo acotado solo en develop, sin abrir mantenimiento ni tocar
producción. El mantenimiento compartido sigue en NOT_READY. Modifica el requisito de terminación de efectos históricos de
[ADR-0025](0025-separate-contained-deliveries-from-business-drain.md) solo para una
migración inicial de develop. Su aceptación autoriza implementación/ensayo local,
no despliegue, ventana real, escrituras compartidas ni activación de producción.

## Contexto y conciliación terminada

La captura conservada de develop de `2026-10-29T20:03:40.358Z` contiene 117 avisos:
55 resultados guardados `no_tokens`, 34 `partial_success`, 25 `success` y tres sin
resultado de envío, creados el 1 de abril. Doce de los 59 resúmenes de envío tienen
además registros correlacionados de aplicación/fin de petición: seis tokens aceptados
por FCM y seis rechazados. No se acredita recepción en dispositivos ni historial
completo de reintentos. Los otros 105 avisos contienen 102 resúmenes guardados y tres
resultados desconocidos; no son 105 envíos pendientes. Los 117 siguen sin reenviarse.

Tres importaciones de 62 filas y dos pruebas de calendario sin efectos tienen sus
terminaciones conciliadas por separado. Retirada de revisiones, cierres de entrada
cliente/servidor y permisos de lector de la hoja son observaciones diferentes;
ninguna prueba que terminaran todas las operaciones enviadas antes a Firestore,
Sheets o FCM. Repetir consultas a logs no disponibles no reconstruye el historial.
Tampoco el flujo nuevo de incidencias puede inventar comandos/reservas/recibos que
vinculen esas operaciones antiguas.

Evidencia privada: `2026-10-29-historical-effect-disposition`, con clasificación por
documento, hashes exactos de fuente/versión y comprobaciones de correlación sobre
registros conservados del proveedor. No renueva observaciones de controles actuales.

## Decisión

Permitir una alternativa versionada de admisión con **riesgo histórico aceptado**
solo para migrar inicialmente `reguerta-9f27f`, base predeterminada,
`develop/plus-collections` y la hoja de develop existente. La incertidumbre abarca
efectos enviados antes de los cierres de entrada revisados de develop, incluidos
intentos antiguos no identificados. Se acota por entorno, fuentes anteriores,
evidencia de cierre y una operación, **no** por un número total de intentos probado.

- Vincular la aceptación explícita del operador al censo, imágenes de la hoja,
  fuentes anteriores/actuales revisadas, instantes de cierre y plan de migración y
  reversión exactos. La fecha de este documento o un intervalo sin actividad no
  sustituyen la evidencia del cierre.
- Conservar `legacyUntracked=true`, contadores desconocidos y recibos originales.
  La nueva alternativa no puede afirmar cero operaciones en curso, entrega antigua
  correcta, terminación técnica ni cumplimiento de la alternativa estricta ADR-0025.
- Conservar todos los avisos históricos sin reenviarlos ni generar a partir de ellos
  compensaciones, asignaciones o notificaciones nuevas. Mantener cerrados los
  callbacks de negocio antiguos y las rutas revisadas que solo guardan evidencia.
- Mantener los demás controles actuales: escritores automáticos conocidos, autoridad
  efectiva de hoja/carpeta, acuerdos nominativos de propietario/administradores,
  comprobaciones de fuentes/versiones y CAS, verificación Sheets y recuperación
  existentes. Un escritor nuevo, cambios o evidencia de trabajo antiguo aún activo
  bloquean esta alternativa.
- Durante la operación, un cambio inesperado en fuentes/celdas detiene el avance y
  conserva el cierre para conciliarlo. La recuperación debe inspeccionar ese estado;
  no sobrescribir un cambio tardío sin explicar ni reabrir automáticamente escritores.

Se acepta explícitamente que una operación externa antigua no identificada pueda
producir un efecto tardío. Las comprobaciones anteriores/posteriores detectan algunos
cambios, pero no impiden todas las carreras ni cancelan una notificación ya aceptada.
Ese es el riesgo aceptado; no se afirma ejecución exclusiva en el proveedor.

## Alternativas y consecuencias

Recomendado para develop: aceptar este riesgo limitado tras pruebas locales de
rechazo/recuperación. Evita búsquedas históricas indefinidas y afectar identidades
compartidas de producción. Requiere una alternativa explícita pequeña en los contratos
de evidencia/admisión existentes, no otro worker, registro o motor de migración.

Mantener ADR-0025 es válido: el mantenimiento seguirá bloqueado hasta obtener prueba
independiente de terminación o aislamiento efectivo del destino. Un proyecto/destino
separado necesitaría diseño, evaluación de datos/enlaces y autorización propios;
esta propuesta no lo incluye.

La aceptación no elimina los requisitos de descubrimiento/control automático actual,
no autoriza reabrir `develop/collections` clásico, no extiende el acuerdo humano a
credenciales automatizadas y no cambia ninguna política de producción.

## Implementación y validación

Reutilizar barrera/evidencia/CAS, conservando los valores estrictos por defecto.
Ensayar rechazo de producción, aceptación ausente/cambiada, eventos nuevos, controles
caducados, acuerdos ausentes, trabajo antiguo activo observado y escrituras tardías
sin explicar; comprobar conservación de desconocidos, ausencia de reenvío, parada y
recuperación solo por inspección. No vincular eventos antiguos a incidencias de aviso
inventadas. Solo después del ensayo y los controles de autoridad reales pendientes
se podrá proponer una ventana concreta.


## Implementación local — 2026-10-30

Implementada localmente tras aceptación expresa, sin cambiar la configuración
compartida ni abrir mantenimiento. El registro versionado `develop-historical-risk-v1`
queda vinculado por hash al comando/checkpoint v3 autorizado independientemente.
Vincula operador, aceptación, evidencia de fuentes/cierres anteriores, controles
actuales, fuentes/hoja exactas y planes de migración/reversión. La aceptación debe
ser posterior a los cierres observados. El avance exige revisión/época inicial cero
sin estado activo; la reversión exige la primera revisión/época inicializada con
estado activo. El ejecutor existente verifica además ambos planes preparados exactos.

Solo los predecesores técnicos enumerados pueden conservar contadores nulos. Acuerdos
humanos, trabajo positivo observado y desconocidos de escritores no revisados siguen
rechazando. Se conservan `legacyUntracked=true`, ausencia de reenvío y
`drainedAtMillis=null` en evidencia inmutable; el instante de evaluación no afirma
terminación. No cambia el comportamiento estricto/por defecto ni de producción.
Se reutilizan lectores humanos actuales, caducidad, igualdad del checkpoint y los
flujos CAS/incidencias/recuperación.

El ejecutor de migración de bucle local admite una selección explícita: traduce la
identidad lógica de la hoja de develop a la hoja sintética existente y usa solamente
`demo-reguerta-hu084-migration` en `127.0.0.1:8798`. El conjunto transaccional incluye
ahora los avisos históricos; insertar/cambiar uno invalida la aceptación. No añade
escritor Google/FCM ni entrada compartida. El preparador real sigue en NOT_READY;
los controles simulados no acreditan autoridad real.

Validación Node22.23.4: build/lint completos, sintaxis CJS y diff correctos;
**137 pruebas locales y 26 con emulador Firestore, sin fallos ni saltos**. El SDK
conserva los avisos y restaura 62 filas originales desde 72 canónicas. Rechaza avisos
nuevos, planes sustituidos y cambios manuales tardíos; un fallo posterior al commit
conserva las 72 filas confirmadas y el cierre, sin afirmar reversión. Un checkpoint
cambiado no permite inventar un recibo durable de incidencia. Evidencia privada:
`2026-10-30-historical-risk-local`. Sin cambios nativos ni brecha de paridad.
Implementación/documentación locales tras `d3ae12d9`; este paso no pidió commit/push.
Siguiente: vincular autoridad/observaciones reales actuales y aceptación de la operación
exacta antes de solicitar una ventana de mantenimiento autorizada por separado.
