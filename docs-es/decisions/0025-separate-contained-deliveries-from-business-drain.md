# ADR-0025: Separar las entregas contenidas del drenaje de operaciones

## Estado

Aceptado para implementación y ensayo local aislado el 2026-10-29 tras elegir el
mantenedor «Aceptar la corrección acotada (recomendado)». Modifica solo la exigencia
de contadores de entrega de captura exclusiva de ADR-0024 en develop. Esta decisión
no autoriza despliegues compartidos ni mantenimiento/migración reales.

## Contexto

ADR-0024 admite receptores revisados que solo capturan evidencia, pero sigue exigiendo
que todos los contadores de escritores y los ocho de drenaje sean cero numérico.
El adaptador real no puede acreditar el número actual de invocaciones; la ausencia
de muestras de Pub/Sub sigue siendo desconocida. Repetir consultas no completa la
prueba. Además, entregar al receptor revisado solo conserva evidencia: no invoca su
operación de negocio original. Es distinto de una invocación anterior de código
capaz de escribir o enviar un aviso.

La [evaluación de 31 escritores](../testing/hu084-develop-old-work-boundary.md) separa
ambos casos. El tráfico hacia versiones revisadas y la retirada de versiones antiguas
son observaciones útiles, no prueba de que acabaran todos los efectos externos ya enviados.

## Decisión

Para las cuatro parejas exactas de receptores compartidos/privados de develop ya
vinculadas por ADR-0024, admitir **entrega de transporte contenida** como alternativa
a demostrar que el transporte está vacío. Las vinculaciones existentes de código
inmutable, configuración y versión, con lecturas iniciales/finales, deben demostrar
que todas las rutas actualmente alcanzables solo añaden evidencia. Una fuente
distinta, una ruta alternativa sin revisar o una caída a la operación original
rechaza la alternativa. No se deduce de logs, porcentajes de tráfico, nombres de
funciones ni de una captura satisfactoria aislada.

Conservar los contadores observados, incluidos valores desconocidos o no nulos.
Nunca serializarlos como cero. Separarlos de los contadores de operaciones de negocio
mediante una alternativa explícita y versionada de evidencia. El modo estricto,
producción y los escritores sin prueba completa mantienen sus requisitos actuales.

La alternativa **no** cubre invocaciones admitidas por código de negocio anterior,
escritores automáticos desconocidos ni efectos ya enviados a Firestore/Sheets/FCM.
Siguen necesitando prueba independiente de terminación o aislamiento efectivo del
destino afectado. Plazos vencidos, versiones retiradas, capturas estables y acuerdos
humanos no sustituyen esa prueba. Los casos sin resolver bloquean la admisión;
se utiliza el proceso existente de incidencia/residual acotado, sin reenviar avisos
antiguos ni borrar `legacyUntracked` para poder continuar.

Fijar el conjunto revisado de fuentes de negocio separado de los metadatos de
entrega. La llegada tardía de un evento ya clasificado puede ampliar el historial
de captura; una fuente nueva, modificada o sin clasificar invalida la propuesta.
Conservar las revisiones exactas de captura utilizadas en cada recibo. No ignorar
cambios para hacer coincidir el sobre anterior. La implementación debe definir y
probar esta separación antes de proponer una ventana real.

Reutilizar adaptador, barrera, repositorio de evidencia, CAS y recuperación actuales.
No se propone otro registro, worker, motor de migración ni reapertura automática.

## Alternativas y consecuencias

- Mantener la regla actual evita cambiar el contrato, pero deja bloqueada esta vía
  hasta disponer de una prueba actual de cero respaldada por el proveedor.
- Desactivar el transporte compartido afecta a producción y tampoco resuelve los
  efectos externos antiguos. No se propone para este paso de develop.
- La alternativa elimina una exigencia innecesaria de transporte vacío; añade una
  rama acotada de evidencia y requiere pruebas de compatibilidad y rechazo. No
  habilita por sí sola el mantenimiento ni resuelve los efectos antiguos inciertos.

## Implementación y aceptación

1. Añadir la alternativa explícita de evidencia; conservar lectura de recibos antiguos
   y modo estricto. No relajar todos los contadores ni incluir operaciones desconocidas.
2. Probar entregas contenidas no nulas/desconocidas, pruebas incompletas/mezcladas,
   cambios de fuentes, invocaciones antiguas, envíos inciertos y rechazo en producción.
3. Ensayar duplicados tardíos y eventos nuevos mediante el recorrido existente de
   creación/recuperación en emulador local. Fijar fuentes de negocio estables sin
   ocultar historial de capturas ni incidencias de acuse perdido.
4. Reevaluar los bloqueos concretos de efectos antiguos y autoridad externa. Solicitar
   la ventana real solo al cumplir también esos requisitos independientes.

## Referencias

- [ADR-0024](0024-admit-source-scoped-develop-capture-controls.md)
- [ADR-0022](0022-cooperate-with-develop-firebase-administrators.md)
- [Ausencia de métricas de Pub/Sub](https://docs.cloud.google.com/pubsub/docs/metrics-autoscaling-best-practices)
- [Ciclo de vida de contenedores Cloud Run](https://docs.cloud.google.com/run/docs/container-contract)

## Implementación local — 2026-10-29

Cada uno de los cuatro controles de captura debe seleccionar expresamente
`develop-contained-delivery-v1`; la elección entra en el digest del manifiesto
autorizado, incluidos los acuerdos cooperativos. La evidencia conserva las ocho
rutas de Functions, cantidades exactas nulas/no negativas y sus agregados, digests
de fuentes y eventos clasificados/capturados, y ambas revisiones/digests del historial.
Los contadores de operaciones antiguas y todos los de modificaciones de negocio,
Sheets y entregas durante la quietud siguen exigiendo cero numérico. Los metadatos
del registro se representan por separado mediante las revisiones de captura; no
son modificaciones de negocio ni prueba de terminación de una operación antigua.

La proyección sin conexión reutiliza el inspector completo del censo, comprueba
clasificación revisada e historial inmutable y no habilita canEnterMaintenance/canApply.
Versiones nuevas de fuentes o eventos sin clasificar se rechazan. Se mantienen las
comprobaciones de sobre/repositorio y de igualdad del recibo retenido: no se reescriben
observaciones ya fijadas. Un recibo posterior distinto detiene la operación y exige
revisión renovada; no se actualiza automáticamente para absorber nuevas entregas.
El ensayo de duplicados tardíos cubre el intervalo inicial/final de observación de
admisión, no la sustitución arbitraria del recibo durante una escritura gobernada.

Node22.23.4: build/lint completo/lint CJS pasan;174 pruebas locales y37 en emulador
Firestore pasan, sin omitidas. El emulador utiliza solo
`demo-reguerta-hu084-migration` en `127.0.0.1:8798` (la suite del repositorio tiene su
propio espacio demo). Se prueban transporte desconocido/no nulo, pruebas parciales/
mezcladas, operaciones antiguas, escrituras humanas inciertas, rechazo en producción,
duplicado clasificado frente a evento nuevo, creación/reversión, evidencia retenida
y reinicio tras perder el acuse. Sin cambios nativos ni brecha entre plataformas.
Código/evidencia locales y sin commit; no se modifican servicios compartidos.
Persisten los requisitos independientes de efectos antiguos, autoridad y ventana real.
