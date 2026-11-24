# ADR-0024: Admitir controles de captura por origen en develop

## Estado

Aceptada para implementación local y ensayo aislado el 2026-10-29, tras autorizar
el mantenedor la integración del control de develop en la barrera y el ensayo de
creación inicial/recuperación. No admite mantenimiento ni migración reales.

## Contexto

Cuatro disparadores antiguos de Firestore atienden develop y producción. Su puente
revisado captura eventos de develop sin ejecutar callbacks de negocio; cuatro
receptores privados conservan evidencia de entrega con reintentos. Apagar el transporte
compartido afectaría a producción. La barrera anterior solo reconocía entrega
desactivada/aislada; la preparación sin conexión no podía sustituir ese control.

## Decisión

Añadir la variante explícita `capture-only`, con vínculo obligatorio `developCapture`
y revisión `hu084-develop-source-capture-v1`. Exigir las cuatro parejas exactas de
función compartida/privada, un solo proyecto/base predeterminada y origen develop.
Exigir identidades de función y patrones de documento exactos, transporte ACTIVE,
sin reintentos en las compartidas y con reintentos en las privadas. Vincular generación
inmutable, revisión de ejecución y huellas observadas de fuente/configuración con
las revisadas. El adaptador de control fiable debe obtener esas observaciones; una
huella aportada por el solicitante, la preparación o un GET correcto no acreditan
por sí solos el comportamiento del código revisado.

La huella del vínculo completo entra en el manifiesto autorizado y en la evidencia
inmutable. Las lecturas inicial/final deben seguir coincidiendo. Se conservan
identidades y huellas de inventario y lectura de versiones estricta/cooperativas:
es una extensión explícita de evidencia de control, no una reescritura histórica.
Sin la variante y su prueba completa, no cambian los estados exigidos. Se rechaza
en producción. El acuerdo administrativo debe vincular el mismo proyecto. Solo se
admiten el proyecto compartido y el proyecto demo fijo del ensayo. Este último sirve
para evidencia inyectada en pruebas; no autoriza contactar servicios compartidos ni
fabricar sus observaciones.

Siguen siendo obligatorios, numéricos y cero los contadores pendientes/en curso y
los ocho contadores de drenaje causal. Se mantienen por separado cronología, vigencia,
Rules, hoja, IAM y observaciones de propietario/administradores. Nunca se representa
ACTIVE como desactivado. Capturar no acredita que terminaran callbacks anteriores
ni permite repetir avisos posiblemente entregados. No cambian los acuerdos humanos
de ADR-0022.

Reutilizar el adaptador fiable, repositorio de evidencia/incidentes y migración/
recuperación limitada a loopback. La transacción comprueba ausencia de todos los
documentos iniciales y del puntero de envío de Sheets antes de crear revisión1 /
writeEpoch1, política y ambos cursores conservados. El predecesor cero del comando
sintético queda vinculado a ausencia real; no inventa una época0 persistida.
La recuperación restaura exactamente las filas antiguas y elimina rotaciones/política
introducidas, conservando auditoría cerrada con época superior. Las confirmaciones
perdidas registran un incidente y bloquean repetición automática incluso tras reiniciar
el servicio. No significan reversión ni autorizan borrar el incidente. No se añade
reapertura automática.

## Alternativas y consecuencias

Apagar todos los disparadores afecta a producción. Llamar desactivado al transporte
que solo captura falsearía el control. Otro motor de migración u otra versión completa
de política duplicaría las reglas de admisión, participantes y recuperación que no
cambian. La extensión acotada reutiliza esas reglas y conserva la nueva capacidad
explícitamente en cada manifiesto.

Los binarios anteriores no admiten la variante: hay que desplegar su verificador antes
del uso real. La preparación sigue sin ser ejecutable y carece de admisión fiable de
controles, drenaje causal, política real y participantes/ventana. Esta implementación
aporta verificador y pruebas; no despliega otro servicio de control. La composición
real pendiente debe obtener evidencia por el puerto fiable existente, sin reutilizar
los controles sintéticos del ensayo.

## Validación

Build/lint de Functions y lint CJS focal correctos. Pasan72 pruebas locales de control,
barrera y acuerdos;33 pruebas con Firestore emulado, incluidas17 de migración y16 del
repositorio de evidencia/incidentes. Sin omisiones. Se usa
`demo-reguerta-hu084-migration` en `127.0.0.1:8798`; la regresión del repositorio usa
su proyecto demo separado en ese mismo emulador. Sin cambios en exports desplegados,
apps nativas, documentos de Firebase compartido, Sheets ni FCM.
