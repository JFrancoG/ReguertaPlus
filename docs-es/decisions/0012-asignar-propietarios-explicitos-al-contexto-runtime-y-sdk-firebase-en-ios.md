# ADR-0012: Asignar propietarios al contexto runtime y las referencias del SDK de Firebase en iOS

## Estado

Aceptada

## Fecha

2026-08-19

## Estado de implementación

Implementada y validada localmente mediante HU-076 / issue #251. La revisión
independiente final informa 0 hallazgos P0-P3, y el issue #251 está sincronizado
y permanece abierto. La instrucción posterior de entrega del mantenedor del
2026-08-19 se cita literalmente: "Haz commit y push. Antes no te dije de lanzar la PR porque no sabía si tenias una issue por fase, como veo que si, lanza la anterior y lanza esta para poder cerrar ramas y empezar la siguiente fase con todo limpio".
Commit, push y abrir las pull requests previa de HU-075 y actual de HU-076 están
autorizados y pendientes en este turno; HU-076 queda `ready_for_merge`. Este ADR
registra la arquitectura aceptada, pero no autoriza merge, cierre de issues,
borrado de ramas, despliegue Firebase, upgrades de paquetes, mutación de datos
live, integración, cambios Android ni adopción de iOS/Xcode 27.

## Contexto

El ADR-0011 cambió el proyecto iOS al aislamiento de actor por defecto
`nonisolated` a nivel de proyecto y exigió propietarios explícitos para el
estado mutable de infraestructura y las referencias de SDK. HU-074 recuperó la
compilación protegiendo el entorno runtime existente con un `Mutex` síncrono,
pero aplazó su arquitectura global a una historia posterior gobernada.

Ese global evita accesos simultáneos inseguros a memoria, pero no constituye un
contexto lógico estable. La autorización publica hoy un entorno candidato antes
de que tenga éxito la lectura del miembro exacto. Repositorios duraderos y
helpers con valores por defecto pueden volver a leer el global después de una
suspensión, permitiendo que una operación use paths de entornos distintos.
Varias instancias de router también comparten estado global pero poseen señales
separadas, por lo que estado y observación pueden divergir.

La lease de entorno exitosa no se conserva en la sesión autorizada; el cleanup
normal resetea incondicionalmente. El reloj de desarrollo global al proceso y
15 declaraciones de producción `@unchecked Sendable` ocultan de forma similar
el propietario que Swift 6 necesita verificar. Una de ellas convierte
retroactivamente `FirebaseAuth.User` en sendable para todo el módulo.

## Impulsores de la decisión

- No mezclar nunca principales, miembros o entornos Firebase dentro de una
  operación lógica.
- Validar la autoridad antes de publicar una ruta runtime candidata.
- Preservar invalidación síncrona, propiedad por lease, cleanup antes del
  sucesor, timeout, cancelación y `DRAINING` de los ADR-0008 a ADR-0010.
- Hacer observable el cambio de entorno desde el mismo propietario que lo muta.
- Mantener las referencias SDK dentro de adaptadores comprobables y transferir
  solo valores inmutables de aplicación entre fronteras de concurrencia.
- Evitar estado global al proceso y escapes inseguros del compilador.
- Preservar producto/backend y el alcance de mantenimiento Xcode 26/iOS 26.

## Decisión

Cada grafo compuesto de la aplicación iOS posee un único store síncrono de
entorno de sesión. El store posee entorno base, override vigente, lease activa y
señal de transición dentro de una sola frontera de instancia. Usa una primitiva
pequeña de sincronización porque aplicar e invalidar routing sensible para la
seguridad debe ser síncrono y no puede suspender.

Cada transición muta el estado efectivo antes de publicar síncronamente su
nuevo valor. Instancias distintas no comparten estado ni notificaciones. No
existe fallback estático, singleton, task-local ni ambiental para el routing
runtime.

Cada operación dependiente del entorno captura de forma síncrona el
`SessionEnvironment` efectivo en su propietario iniciador antes de su primera
suspensión o llamada a un repositorio aislado por actor. Los contratos de
repositorio exigen ese valor inmutable explícito; los cuerpos de actor y helpers
anidados no pueden leer un provider vivo. El valor es el snapshot de la
operación y se reutiliza en cada repositorio, builder de paths, request Functions
y decisión de media que invoque.

El trabajo de presentación propiedad de una sesión exige además un guard
canónico de autorización activa. Un case `.authorized` solo permite entrar
mientras el principal siga enlazado al miembro autenticado, los miembros
autenticado y seleccionado sigan activos y cualquier selección delegada siga
autorizada. Los fixtures de tests y previews que construyen intencionadamente un
valor autorizado roto deben fallar cerrado antes de una operación de repositorio
o dispositivo.

Cada operación asíncrona de presentación posee una generación/token y captura
la revisión de sesión viva o la firma completa de autorización. Publicar un
resultado o error exige tanto el propietario vigente como la autorización viva,
salvo un handoff síncrono y propiedad de la misma operación cuyo consumidor
registre un receipt que vincule el estado aplicado con la autorización y
revisión resultantes. El cleanup usa un fence distinto basado solo en el
propietario: libera exclusivamente las tareas, estado de carga y handles de esa
generación aunque la revisión capturada haya quedado obsoleta, falla cerrado
cuando corresponde y no hace nada sobre un sucesor. Identidad de ruta y entorno
siguen sin bastar porque un cierre y reentrada de sesión pueden recrearlos.

Las lecturas propiedad de la ruta que cancelan y reemplazan crean un propietario
sucesor en cada reentrada. Las mutaciones independientes pueden conservar
deliberadamente su propietario explícito ante una reentrada benigna, pero cada
resultado o error que publiquen sigue cercado por la autorización/revisión viva.

La autorización trata el entorno resuelto como candidato. Lee el miembro exacto
y realiza la hidratación obligatoria de miembros contra ese candidato explícito
sin cambiar la ruta viva. Cuando la hidratación tiene éxito y la operación sigue
vigente, el propietario de sesión crea y conserva la lease y después confirma
routing y el modo autorizado visible sin una suspensión entre ambas mutaciones.
El cleanup normal resetea de forma condicional por lease; un cleanup obsoleto no
hace nada. El reset incondicional queda solo como acción explícita de bootstrap
o recuperación fail-safe cuyo llamador ya posee el lane de seguridad serializado.

El tiempo de desarrollo es una dependencia inyectada por instancia. Su
almacenamiento persistente y fuente de tiempo del sistema se inyectan o poseen
por instancia, de modo que tests y grafos preview/app no dependan de
`DevelopmentTimeMachine.shared` ni de sendability no comprobada.

El estado local sensible al entorno usa claves que incluyen el entorno. My
Order no adopta automáticamente las claves legacy de borrador o confirmación
sin calificador porque no puede demostrarse su entorno de origen.

Los objetos de referencia del SDK de Firebase permanecen dentro del propietario
comprobado que ejecuta las operaciones SDK:

- Las referencias Auth permanecen en su adaptador `MainActor`; solo salen
  valores Domain inmutables comprobados, strings de token, booleanos o errores
  tipados.
- Los repositorios con estado o callbacks usan un actor o propietario MainActor
  existente cuando lo permite el contrato de protocolo.
- Los adaptadores inmutables solo permanecen como valores o clases finales con
  `Sendable` comprobado cuando todos sus valores y operaciones lo demuestran.
- Functions captura contexto inmutable de token y entorno para una request.
- Los callbacks de Devices y Messaging saltan explícitamente a su propietario
  actor/MainActor preservando fences de generación y lease viva de proceso.
- Freshness conserva sus actores y cruza fronteras mediante nombres de app
  Firebase o valores inmutables, no referencias SDK.
- Orders conserva su referencia Firestore y cada helper asíncrono de SDK dentro
  del actor `FirestoreOrdersRepository`, incluidos los helpers repartidos en
  otros archivos. Ningún helper async acepta ni devuelve una referencia SDK
  viva.
- Media posee Storage y continuations de callbacks tras una frontera comprobada,
  congela entorno/path antes de empezar y cerca resultados obsoletos.

Los bridges de callbacks comprueban la cancelación de la tarea después de que
resuelva el callback del SDK, por lo que un callback tardío no puede devolver
éxito a una operación cancelada. La revocación de autorización usa la
terminación local de sesión con propietario: invalida contexto y leases de
sesión/dispositivo antes de completar su cleanup, mientras la barrera
serializada `DRAINING` sigue bloqueando al sucesor.

Producción no puede usar `@unchecked Sendable`, `@preconcurrency`,
`nonisolated(unsafe)`, `Task.detached`, GCD ni un escape equivalente para hacer
compilar estas fronteras. Si los contratos primarios del SDK no permiten un
propietario comprobado, la implementación se detiene y requiere aprobación
explícita más un ADR separado conforme al gate de excepciones del ADR-0011.

La construcción Firebase existente en
`Presentation/Root/SessionViewModelDependencies.swift` es deuda conocida de
composición que incumple la frontera objetivo del ADR-0011/`AGENTS.md` y está
asignada explícitamente a la Fase 4 por el roadmap aprobado por el mantenedor.
HU-076 puede adaptar argumentos inyectados, pero no mueve esa composición ni
afirma que todos los imports SDK residan ya en Data/App. No puede introducirse
otro import SDK en Presentation y este residual temporal no constituye una
nueva excepción aceptada.

Android conserva hoy un diseño equivalente de publicación temprana y entorno
ambiental. HU-076 no modifica Android, por lo que crea una brecha temporal
documentada de paridad de seguridad/ownership que requiere un seguimiento
gobernado por separado.

## Opciones consideradas

### Mantener el entorno estático protegido por Mutex

Rechazada. Evita una data race, pero no ofrece contexto estable por operación ni
independencia entre grafos. Su estado y las señales de router tienen además
propietarios distintos.

### Sustituir el global por un actor singleton

Rechazada. Conserva acoplamiento global al proceso y obliga a suspender una
invalidación de seguridad que debe ser síncrona. El aislamiento por actor se
usa dentro de adaptadores SDK asíncronos, no como sustituto del contrato de
routing.

### Usar contexto de entorno task-local

Rechazada. Las operaciones Firebase abarcan callbacks, tareas hijas, delegates
y workflows de presentación que no comparten un árbol de tareas fiable.
Tampoco modela la ruta autorizada viva ni su lease.

### Publicar la ruta candidata y revertirla si falla

Rechazada. Otras operaciones pueden observar el candidato durante la lectura
suspendida del miembro. El rollback no puede deshacer lecturas o escrituras ya
enrutadas allí.

### Mantener sendability no comprobada en fronteras Firebase

Rechazada. Una conformidad global o afirmación de clase oculta el propietario
real y puede quedar inválida silenciosamente tras cambios del SDK o adaptador.

## Consecuencias

### Positivas

- Una operación no puede cambiar de entorno Firebase tras una suspensión.
- Una autorización fallida nunca expone su candidato a trabajo no relacionado.
- Un cleanup obsoleto no puede resetear una sesión sucesora.
- Estado y observaciones de transición son coherentes por grafo de aplicación.
- Swift 6 verifica los cruces SDK en vez de confiar en afirmaciones amplias.
- Los tests pueden componer entornos y relojes independientes sin serializarse
  sobre globales de aplicación.

### Negativas

- El contexto de entorno debe pasar por composición de repositorios y helpers
  anidados.
- El estado de sesión autorizada conserva una lease adicional.
- Algunos adaptadores Firebase necesitan conformidades conscientes de actor y
  saltos explícitos de callbacks.
- Cancelación y orden de repositorios/media requieren cobertura de regresión
  determinista e informar explícitamente cuando el orden red-first previsto no
  se conserva como evidencia reproducible.
- Los borradores o confirmaciones legacy de My Order sin entorno dejan de
  restaurarse automáticamente; aceptar esa pérdida de compatibilidad local
  evita que estado no verificable cruce entornos.
- El único leak de composición en Presentation permanece hasta la Fase 4.

## Implementación y verificación

HU-076 implementa esta decisión en clusters aislados: propietario/autorización,
entornos explícitos, reloj inyectado, Auth/Functions/Devices/Freshness y después
repositorios Firestore/Media. La remediación de revisión añadió el guard
canónico de autorización activa y fixtures fail-closed; nueve casos de Orders
con el mismo contexto y seis con revisión de sesión; estado local de pedido
calificado por entorno; fences de sesión viva para Users, Shared Profile,
Products y Shifts; cleanup de lease de dispositivo revocada; cancelación tras
callback; y ownership exclusivo del actor Firestore de Orders.

La remediación final de cleanup por propietario añadió 16 regresiones
deterministas: siete de lecturas de Orders, siete de lecturas, entrada y
protección de sucesor en Products/Shifts, y dos de Freshness. La publicación
sigue cercada por la sesión viva, mientras el cleanup basado solo en propietario
libera carga/tareas/handles obsoletos y no puede limpiar un sucesor. Freshness
rechaza además un payload suspendido revocado, nunca lo marca ready y solo acepta
un handoff síncrono propio mediante el receipt del consumidor para la revisión
resultante.

Otras dos regresiones posteriores al callback son distintas de esas 16 de
cleanup por propietario: un éxito tardío de verificación de email resuelve como
`false`, y un token FCM tardío lanza `CancellationError` sin persistirlo ni
registrarlo.

Los waiters deterministas usan ownership por UUID cancelable, registro con
doble comprobación, eliminación/reanudación exactamente una vez, límites de
tiempo de suite, `NSCondition` para controlar el mailbox síncrono y cleanup con
`cancelAll`/`defer`. Son medidas de fiabilidad de la evidencia de tests, no
arquitectura de producción.

No se conservó un paso rojo reproducible para cada cluster. Los casos de
mailbox de actor, media, entrada activa, mismo contexto, revisión de sesión,
cleanup por propietario, dispositivo, callback y waiters se añadieron durante
la remediación de revisión. Se registra esta desviación en lugar de afirmar una
ejecución test-first universal. El test parametrizado
`authenticatedClientMapsTokenRefreshFailures` conserva su paso TDD del mapping
para cancelación, timeout, ausencia de usuario autenticado y fallo de refresh de
token no disponible.

En la validación final de fuentes, las referencias de producción a
`ReguertaRuntimeEnvironment`, `DevelopmentTimeMachine.shared`,
`@unchecked Sendable`, `@preconcurrency`, `nonisolated(unsafe)` y
`Task.detached` son cero. Los imports Firebase permanecen en Data 24, App 9 y
Presentation 1. `DispatchQueue` pasa de dos usos preexistentes a uno: se elimina
el salto tocado de AppDelegate, no se añade ninguno y el uso existente de
`ReguertaImagePickerField` queda fuera de HU-076. `Package.resolved`, Android y
`project.pbxproj` no tienen diff.

El árbol final contiene 363 archivos Swift y 62.984 líneas: producción
253/36.197, unit 108/26.403 y UI 2/384. El inventario de fuentes contiene 574
declaraciones `@Test` de Swift Testing, 6 métodos XCTest unitarios y 9 métodos
XCTest UI. En iPhone 17 / iOS 26.5, fast unit pasa 580/580 con 0 skipped y 0
failed (574 Swift Testing y 6 XCTest), UI smoke pasa 4/4 y release gate informa
589 responsabilidades: 588 passed, 1 skip conocido y 0 failed. SwiftLint 0.61.0
inspecciona 363 archivos Swift con 0 infracciones; settings pasa 6/6; los builds
genéricos Debug y Production Release están verdes. `git diff --check` pasa. El
aviso de `PATH` de SwiftLint de la Fase 2 fue histórico y no constituye un
diagnóstico actual de Xcode ni de Issue Navigator.

El cierre exige cero referencias de producción a
`ReguertaRuntimeEnvironment`, `DevelopmentTimeMachine.shared` y
`@unchecked Sendable`; cero escapes nuevos; ningún aumento de imports Firebase
en Presentation; `Package.resolved` intacto; y gates focalizados, fast-unit,
UI-smoke, Debug, Production Release y release completo verdes en iOS 26. La
revisión independiente de concurrencia/arquitectura iOS terminó con 0 hallazgos
P0-P3, y el issue #251 está sincronizado y verificado abierto con sus labels
intactas. En este checkpoint documental la implementación sigue sin commit ni
publicación. Commit, push y abrir las pull requests previa de HU-075 y actual de
HU-076 están autorizados y pendientes en este turno. Merge, cierre del issue,
despliegue, borrado de rama e integración permanecen sin autorización.

## Decisiones y trabajo relacionados

- [ADR-0001](0001-mvvm-clean-architecture.md): MVVM y Clean Architecture.
- [ADR-0003](0003-firebase-backend.md): servicios backend Firebase.
- [ADR-0004](0004-ios-root-dependency-injection.md): composición raíz iOS.
- [ADR-0008](0008-acotar-operaciones-moviles-de-sesion.md): operaciones
  acotadas, cleanup y `DRAINING`.
- [ADR-0009](0009-exigir-autorizacion-push-viva-de-proceso.md): lease push viva.
- [ADR-0010](0010-separar-feeds-comunidad-de-autorizacion-sesion.md):
  invalidación síncrona del contexto de entorno.
- [ADR-0011](0011-usar-nonisolated-como-aislamiento-de-actor-por-defecto-en-ios.md):
  propiedad explícita de actores y gate de escapes inseguros.
- Issues de GitHub [#249](https://github.com/JFrancoG/ReguertaPlus/issues/249),
  [#250](https://github.com/JFrancoG/ReguertaPlus/issues/250) y
  [#251](https://github.com/JFrancoG/ReguertaPlus/issues/251).
