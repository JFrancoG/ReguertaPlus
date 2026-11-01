# HU-084 — Preparación de la invocación concreta de develop

Preparación actual (2026-11-02): [evidencia inicial y ventana propuesta](hu084-evidencia-inicial-ventana-develop.md). Adaptadores publicados en `658b7e9c`; se detecta una corrección del orden de cierre inicial antes de autorizar la ventana. Los apartados siguientes son hitos anteriores.

## Composición de observaciones y permisos nativos — 2026-11-01

La preparación anterior está publicada en `40e32c6c`. La nueva implementación
permanece local, pendiente de commit. No abre mantenimiento ni cambia producción.

`composeDevelopWindowServices` conecta el lector real de Google Cloud, el censo
atómico mediante GET, la imagen independiente del propietario, las comprobaciones
de autoridad del escritor, los informes humanos explícitos, la barrera persistente
y el ejecutor controlado. La sesión original aporta el mismo reloj, presupuesto HTTP
y sesión del propietario. Cerrar una lectura de la barrera espera sus peticiones
sin revocar el token del propietario; la limpieza exterior conserva esa obligación.
Los fallos de composición/cierre no impiden retirar ACL/IAM/OAuth y mantienen las
evidencias no resueltas pendientes de inspección.

La barrera inicial completa y su relación con las observaciones originales requieren
revisión explícita. El adaptador valida ese paquete y su ámbito exacto, conserva las
fechas de cierre, quietud, consentimiento y riesgo, y solo renueva campos respaldados
por lecturas nuevas. No crea acuerdos desde datos de prueba ni deduce inactividad
humana de IAM/ACL. Los contadores de entrega permanecen desconocidos en las ocho
rutas de captura revisadas; el censo completo verifica la identidad del negocio y
que el historial solo crezca. El ejecutor lee además toda la fuente del planificador
en su transacción. El cambio de versión de Drive debido al permiso queda vinculado
a las imágenes reales anterior/posterior de la sesión, sin sustituir a escondidas
la revisión o digest del dominio de la barrera.

`createNativeOwnerChannel` vincula las acciones nativas admitidas por CUA a la hoja
original, propietario, escritor y acción revisados. Resuelve índices de accesibilidad
nuevos, comprueba el plazo inmediatamente antes de Compartir/Guardar, espera la acción
y verifica la ACL independiente. No reenvía una concesión con respuesta perdida.
Exige autorización explícita de la acción mediante el callback suministrado; no añade
escrituras por API del navegador, notificaciones, credenciales por defecto ni una
autorización autónoma. Se inspeccionó el diálogo real en español hasta la selección
pendiente de Editor sin notificación y se canceló. No se concedió acceso. La retirada
y los clics finales están probados sobre una superficie nativa sintética; el adaptador
nuevo todavía no los ha ejecutado contra Google.

Los tiempos no cambian: 180s de preparación (incluidos al menos 120s de propagación
IAM), 150s de trabajo con adquisición/admisión, 60/90/120s de limpieza y un único
token de 300s. Todas las llamadas usan el presupuesto exterior. Las acciones nativas
se esperan, sin abandonarlas mediante una carrera de timeout; una respuesta tardía
impide admitir/verificar y conserva la limpieza. Una adquisición lenta bloquea el
lote de negocio. Las pruebas locales no certifican la duración conjunta real de
Google y la interfaz.

Validación: 175 casos locales correctos, cero fallos/omitidos; build, lint completo y
lint CJS focalizado correctos. Los 90 casos de regresión con Firestore emulado también pasan, sin fallos ni
omitidos; sus registros de sesiones concretas se han releído de forma independiente.
HTTP de Google y acciones nativas finales siguen siendo sintéticos en estas pruebas. Evidencias privadas: `2026-11-01-barrier-native-composition`.
Sin cambios iOS/Android ni brecha de paridad. Sin nueva sesión OAuth, concesión IAM,
despliegue, escritura en Sheets ni envío FCM.

Siguiente paso: fijar la revisión inicial completa de observaciones y el código de
la operación exacta, incluidos informes reales del propietario y de todos los
administradores y aceptación del riesgo histórico para esa operación. Las respuestas
anteriores identifican participantes, pero no autorizan una ventana futura. Los 333
hashes anteriores son históricos; la nueva receta privada fija 337 archivos y la
revisión del canal nativo, con revisión inicial de observaciones y autorización
de ejecución aún ausentes. Después, solicitar la ventana concreta de ejecución. No necesitas cerrar
la hoja ni intervenir durante este bloque local. HU-084/HU-085 siguen abiertas y la
PR #278 continúa en borrador.

## Preparación anterior (40e32c6c)

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
