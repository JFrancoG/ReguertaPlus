# HU-084 — Preparación de la invocación concreta de develop

Estado a 2026-11-01: **preparado, no ejecutable ni listo para autorizar la ventana**.
Los adaptadores anteriores están publicados en `5b24be80`. Este documento y la nueva
preparación privada constituyen el siguiente bloque local. No cambia el código de
ejecución, los permisos, el mantenimiento ni los datos de producción.

## Preparación exacta

Evidencias privadas: `2026-11-01-concrete-develop-preparation`.
`packet/manifest-private.json` fija los archivos de entrada;
`operator-invocation-private.json` fija 333 archivos de código, ejecutables y paquetes,
los puntos de entrada existentes, el escritor, los permisos y las obligaciones de
recuperación. No contiene credenciales. Ámbito, vinculación, identificador de intento,
ventana y autorización de ejecución siguen siendo nulos.

| Vinculación | Valor |
| --- | --- |
| Proyecto/base/espacio | `reguerta-9f27f` / `(default)` / `develop/plus-collections` |
| Hoja | `1O7VKs7S4wZHVvTfNBehAd5EzF3Mgw2q9LweK68Gm76A`, versión `287` |
| Sufijo del digest del paquete | `729e04e5d617d1b8f` |
| Sufijo del digest de la preparación | `b3ab962549d061b` |
| Operación de ida | `request-hu084-initial-68e09b87cef3ef75a357` |
| Operación inversa | `hu084-inverse-68e09b87cef3ef75a357` |
| Efectos propuestos | 203 escrituras Firestore de ida; 53 celdas de ayudantes y dos marcadores; inversa admitida por separado de 140 escrituras Firestore |

El paquete privado conserva los digests completos y las escrituras exactas.
Actualizar evidencias regenera los identificadores según el algoritmo existente,
aunque las operaciones de negocio no cambien. No se pueden mezclar las antiguas
operaciones `e4d3844bd0b26308f126`, sus vinculaciones o recibos de prueba con este paquete.
Los ensayos históricos del escritor, ciclo en copia e inversa conservan sus fechas:
son evidencia de apoyo, no autorización de las nuevas operaciones.

## Observaciones renovadas

- Censo Firestore a `2026-11-01T20:47:54.110Z`: las 14 colecciones revisadas, documentos
  únicos y registros de capturas, entregas y fragmentos coinciden exactamente con la
  captura anterior, incluidas las versiones de servicio. Hay 62 turnos, 48 usuarios
  proyectados, cuatro calendarios, tres documentos de configuración y 117 avisos.
  Sigue ausente el estado inicial del planificador, socios, reservas y compensaciones.
  No se leyeron documentos de producción ni del espacio clásico `collections`.
- Controles Cloud a `2026-11-01T20:49:27.767Z`: coinciden las 24 Functions, tres jobs
  pausados, Rules, IAM del proyecto y política del invocador con la referencia completa
  revisada. Los seis índices están READY. Escritor deshabilitado, sin claves de usuario
  ni concesiones propias y ausente del inventario completo de servicios comprobado.
- Lectura del propietario a `2026-11-01T20:50:39.677Z`: coinciden dos capturas completas
  independientes de las seis pestañas y dos acotadas; se conservan celdas, formatos,
  notas, metadatos y versión de Drive. Propietario y cuatro lectores, sin escritor;
  carpeta con permiso exclusivo del propietario. Solo su nombre legible se conserva
  de la observación anterior; identidad, propietario y permisos se consultaron de nuevo.
- OAuth Online sin renovación. Revocación 200 y negativa 401 del mismo token en Drive
  y Sheets tras 62,383 segundos. Se conservaron las respuestas 200 intermedias de
  Sheets; no se dieron por cierre verificado. Se eliminó el archivo temporal de la
  credencial antes de leer y se limpiaron los campos del navegador.
- La inspección real del ejecutor hizo una transacción Firestore de solo lectura,
  cero adquisiciones de controles y cero escrituras. Reconoce las fuentes y rechaza
  con `window_scope_missing`, como corresponde. No es una admisión real aprobada.

La primera comparación Cloud eligió una referencia antigua cuya lectura de política
del invocador había fallado. Se rechazó. La comparación válida utiliza la referencia
posterior completa ya revisada; no se modificó la configuración remota. Cada observación
conserva su propia fecha: no garantiza vigencia para una ejecución futura.

## Composición concreta y conexiones pendientes

Utilizar las implementaciones existentes, una vez revisadas todas las entradas:

1. Cargar y verificar manifiesto, preparación materializada y hashes del código.
2. Entregar el cliente Firestore explícitamente autenticado y limitado al proyecto a
   `createControlledDevelopBarrier`, junto a `openObservationSession` real y el reloj.
3. Entregar su `controlPlane` y `failurePersistence` a
   `createControlledDevelopMigrationExecutor`, con el mismo cliente y preparación.
4. Vincular ámbito completo verificado, ventana real y dirección mediante `bindWindow`.
   El digest de fuentes autoritativas observado por el ejecutor no es intercambiable
   con el digest de fuentes antiguas de la preparación. Tampoco el hash de preservación
   completa de Sheets es automáticamente el digest del libro para la barrera.
5. Entregar vinculación y autorización del intento, credenciales explícitas solo en
   memoria, canal nativo del propietario revisado, barrera y ejecutor a
   `createOriginalWindowSessions`. Invocar una sola vez `runControlledWindow`: gestiona
   permisos, activación, token, adquisición, admisión, una dirección y limpieza.
   El lote calculado antes del permiso no evita verificar la versión y autoridad
   posteriores a concederlo.
6. Ante interrupción, usar `recoverControlledWindow` con la vinculación conservada y
   una sesión de limpieza revisada por separado. Solo inspecciona y retira accesos
   propios; no repite escrituras, emite otro token ni ejecuta la inversa. La falta de
   credencial o prueba de cierre conserva el bloqueo. La inversa exige su propio ámbito
   admitido, fuentes actuales y recibo/plan exactos de ida.

**Conexión técnica pendiente:** el ciclo Google ya tiene adaptadores concretos, pero
`openObservationSession` de la barrera todavía recibe evidencias completas simuladas
en la composición del emulador. Los lectores reales aislados de Cloud y del propietario
devuelven observaciones, no toda la evidencia del acuerdo administrativo. Hay que
conectar esas lecturas, el paquete causal/riesgo histórico revisado y los acuerdos
humanos reales con el verificador existente. No copiar una fixture, fechar de nuevo
lecturas antiguas, deducir colas vacías por muestras ni sustituir incógnitas por ceros.
Cada sesión debe finalizar sin revocar la credencial de otra sesión todavía necesaria.
Todas las lecturas HTTP deben usar el mismo presupuesto al abrir la sesión, sin crear
un segundo reloj o presupuesto.

**Vinculación operativa pendiente:** los callbacks nativos de Compartir deben identificar
esta hoja y escritor exactos, llamar a `assertActive` justo antes de la acción final,
esperar su conclusión y conservar el resultado. OAuth de lectura no permite cambiar
permisos mediante la API de Drive. La interfaz está implementada y ensayada; aún no
está fijada su conexión concreta al navegador.

Agrupar ambas conexiones y su comprobación temporal en el próximo bloque. Después se
podrá fijar el ámbito completo y solicitar la autorización, los compromisos del
propietario/operador/administradores y la aceptación de riesgo vinculada a la operación
según ADR-0026. Que ambas cuentas administradoras pertenezcan al usuario identifica
participantes; no confirma una ventana futura.

## Límites temporales y permisos

Usar el presupuesto existente de diez minutos, no la antigua reserva provisional de
20+20 minutos: hasta 180 segundos de preparación, incluidos al menos 120 de propagación
IAM; hasta 150 de trabajo **incluyendo adquisición y admisión**; reservas de limpieza
archivo/IAM/OAuth de 60/90/120 segundos. Un token de 300 segundos. El envío mantiene sus
márgenes de trabajo/token. No hay ampliación implícita. El ensayo real en copia y el
emulador no demuestran la latencia conjunta de todos los servicios reales.

Se propone únicamente Editor directo en esta hoja de develop, reactivar al escritor
UID `110752956317536684858` y una concesión condicional de
`roles/iam.workloadIdentityUser` a `user:drpuerk@gmail.com` en esa cuenta. Sin claves,
roles de proyecto, asignación de identidad a servicios, cambios de Rules/Functions/jobs
ni FCM. Retirada, desactivación explícita, relecturas y negativa del mismo token forman
parte obligatoria del futuro intento autorizado por separado.

## Validación y entrega

Validación terminada: **82 pruebas locales y 90 casos de emulador correctos, sin fallos ni omisiones**. Se releyeron cinco registros concretos; el caso de cierre del proceso conserva correctamente su bloqueo pendiente de inspección.

El resumen privado conserva los resultados finales sobre este paquete renovado.
Se reutilizan build/lint y las 397 pruebas anteriores únicamente tras verificar los
hashes exactos; este bloque cambia documentación y preparación privada, no código.
Se reconstruyen el paquete y el lote original sin red y se ensaya el paquete renovado
con la suite existente del emulador. Se protegen fechas, orden, los 117 avisos y los
documentos de guarda. Sin cambios nativos ni desfase entre plataformas.

HU-084/HU-085 siguen abiertas y la PR #278 en borrador. No hace falta cerrar la hoja ni
hacer nada más ahora. Siguiente: completar y verificar juntas la composición real de
observaciones de la barrera y las acciones nativas de permisos; después solicitar la
ventana concreta.
