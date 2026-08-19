# ADR-0011: Usar `nonisolated` como aislamiento de actor por defecto en iOS

## Estado

Aceptada

## Fecha

2026-08-19

## Estado de implementación

Implementada y validada localmente mediante HU-074. El build setting está
centralizado a nivel de proyecto y lo heredan los targets de app, tests
unitarios y tests de UI. Debug, Release, el gate focalizado de 33 tests y el
gate estándar completo de 497 tests están verdes sin escapes inseguros de
migración. El 2026-08-19 el mantenedor autorizó commit, push, cierre de la fase
1 y arranque de la fase 2. Pull request, merge, cierre de la issue y borrado de
ramas permanecen como gates de entrega separados.

## Contexto

La aplicación iOS de Reguerta es una base de código consolidada en Swift 6,
con comprobación estricta de concurrencia, presentación SwiftUI, límites de
Clean Architecture e infraestructura respaldada por Firebase. El target de la
app usaba anteriormente `SWIFT_DEFAULT_ACTOR_ISOLATION = MainActor`. Ese ajuste
hacía que las declaraciones sin anotación quedaran aisladas implícitamente al
actor principal, incluidas declaraciones cuyas responsabilidades pertenecen a
Domain o Data y no a la propiedad de la UI.

El aislamiento implícito reducía la visibilidad de los límites entre actores.
Casos de uso puros, factories de dependencias, estado síncrono de routing y
adaptadores Firebase podían compilar porque heredaban `MainActor`, no porque su
propiedad se hubiera modelado deliberadamente. También exigía repetir
anotaciones `nonisolated` en tipos de valor que deberían poder usarse de forma
natural desde cualquier dominio de aislamiento.

HU-074 centraliza `SWIFT_DEFAULT_ACTOR_ISOLATION = nonisolated` a nivel de
proyecto. Las primeras pasadas del compilador exponen llamadas entre actores en
autorización de sesión, freshness de datos críticos, composición de App, estado
global del entorno runtime, fronteras del SDK de Firebase y dobles de test.
Estos diagnósticos identifican decisiones de propiedad que deben hacerse
explícitas; no justifican aislar Domain o Data completos a `MainActor`.

El aislamiento de actor por defecto es una política de compilación del módulo
Swift. El mínimo iOS 26 y el toolchain Xcode 26 actuales fijan el perfil
soportado del repositorio, pero el deployment target no da semántica al ajuste.
Por ello, cada target Swift propio debe tener la misma política efectiva,
aunque los módulos de paquetes externos no resulten afectados.

## Impulsores de la decisión

- Hacer visible en el código la propiedad del actor en vez de heredarla por
  accidente.
- Mantener el estado de UI serializado en `MainActor` y Domain/Data neutrales
  por defecto.
- Conservar la seguridad frente a data races de Swift 6 y los diagnósticos de
  concurrencia estricta.
- Preservar la invalidación síncrona, los fences de propiedad de
  sesión/lease/contexto, el orden cleanup-antes-del-sucesor y la barrera
  `DRAINING` de los ADR-0008, ADR-0009 y ADR-0010.
- Evitar escapes inseguros de migración y anotaciones indiscriminadas usadas
  solo para silenciar al compilador.
- Aplicar una política auditable a los módulos de app, tests unitarios y tests
  de UI.
- Permitir un refactor incremental que preserve comportamiento con el perfil
  actual de Xcode 26, sin adoptar reglas de iOS o Xcode 27.

## Decisión

Todos los módulos Swift propios actuales y futuros del proyecto Xcode de iOS
usan `SWIFT_DEFAULT_ACTOR_ISOLATION = nonisolated` en todas las configuraciones
de build, actualmente Debug y Release.

El ajuste tiene una única autoridad a nivel de proyecto heredada por la app,
`ReguertaTests` y `ReguertaUITests`. Un target solo podrá sobrescribirlo mediante
una decisión arquitectónica aprobada por separado. La validación debe revisar
los build settings efectivos de cada target; duplicar el mismo valor en cada
target no constituye la fuente de verdad.

Se mantienen Swift 6, `SWIFT_STRICT_CONCURRENCY = complete` y Approachable
Concurrency. La migración no puede debilitar los diagnósticos.

El aislamiento del código sigue estas reglas:

- Los modelos de presentación y stores SwiftUI que poseen estado de UI mutable
  declaran `@MainActor` explícitamente.
- Las factories y operaciones de composición de App declaran el aislamiento
  exigido por el grafo que construyen. Construir objetos propiedad de la UI no
  convierte en main-actor las dependencias de Domain o Data.
- Entidades, tipos de valor, contratos de repositorio, políticas puras y casos
  de uso puros de Domain permanecen nonisolated por defecto. Una operación
  estrecha de orquestación puede usar un actor explícito solo cuando lo exige
  el orden o el estado que posee.
- El estado mutable de infraestructura tiene un único propietario explícito.
  Se prefiere un actor para estado asíncrono. Se usa una primitiva de
  sincronización pequeña cuando una invariante de seguridad o routing requiere
  una transición síncrona que no puede suspender.
- Los tipos de referencia de Firebase y otros SDK permanecen dentro del
  adaptador de infraestructura aislado apropiado: Data para implementaciones
  de persistencia o servicios, o App para responsabilidades de ciclo de vida y
  composición de plataforma. No se filtran a Domain o Presentation ni cruzan
  fronteras de actor como objetos vivos; en su lugar cruzan valores Domain,
  DTO inmutables o errores tipados.
- Delegates y callbacks de SDK realizan un salto explícito al propietario que
  puede mutar estado. GCD no es el modelo principal de concurrencia de la app.
- Los tests usan el mismo aislamiento por defecto que producción y adoptan
  `@MainActor` solo cuando el sistema bajo prueba posee estado del actor
  principal.
- Una anotación `nonisolated` explícita se conserva únicamente cuando
  sobrescribe un contexto aislado o satisface un contrato real de protocolo o
  conformidad. No se repite como ceremonia bajo el default del módulo.

`nonisolated` expresa la ausencia de un requisito de actor global; no significa
"ejecutar en background". SE-0466 controla la inferencia del aislamiento del
módulo. De forma separada, Approachable Concurrency activa actualmente
`NonisolatedNonsendingByDefault` de SE-0461, por lo que una función async
nonisolated puede continuar en el aislamiento del llamador. El trabajo que deba
abandonar deliberadamente ese actor usa `@concurrent`.

La migración no puede introducir `@preconcurrency`, `@unchecked Sendable`,
`nonisolated(unsafe)`, `Task.detached`, GCD ni un escape equivalente como atajo
de compilación. Si una frontera actual del SDK no puede expresarse de forma
segura tras contrastar fuentes primarias, el trabajo se detiene antes de
escribir la excepción. Toda excepción requiere aprobación explícita del
usuario y un ADR separado que documente alternativas, invariante de propiedad,
alcance, tests focalizados y condición de retirada.

El cambio de build setting y los cambios mínimos de código necesarios para
recuperar la compilación completa forman un único corte atómico. Las fases
posteriores de arquitectura, SwiftUI, layout y limpieza mecánica permanecen
separadas.

## Opciones consideradas

### Mantener `MainActor` como default del módulo

Rechazada. Es cómodo para una aplicación de UI principalmente secuencial, pero
en este código también oculta aislamiento no intencionado en Domain, Data y la
composición de dependencias. Leyendo el código no puede distinguirse la
propiedad deliberada de UI de un default global del módulo.

### Mantener el default `MainActor` y anotar Domain/Data individualmente

Rechazada. Repetir `nonisolated` en declaraciones o extensiones individuales de
Domain/Data mantendría el dialecto `MainActor` implícito para el resto del
módulo y haría más difícil auditar el aislamiento efectivo. La propiedad
explícita en las declaraciones que la necesitan es más clara.

### Dar defaults distintos a la app y a los targets de tests

Rechazada. Los tests ejercitarían otro modelo de aislamiento y podrían omitir
fallos del compilador presentes en producción o requerir workarounds exclusivos
de test.

### Adoptar `nonisolated` y añadir `@MainActor` o supresiones indiscriminadas

Rechazada. Recrearía el aislamiento implícito en el código o desactivaría las
comprobaciones que la migración pretende hacer útiles.

## Consecuencias

### Positivas

- La propiedad de UI queda explícita en las declaraciones que la necesitan.
- Las APIs de Domain y Data dejan de heredar accidentalmente un executor de UI.
- Los errores de concurrencia estricta exponen pronto estado global mutable y
  cruces inseguros del SDK.
- Las anotaciones `nonisolated` redundantes pueden retirarse incrementalmente
  después de recuperar el proyecto verde.
- App y tests compilan bajo la misma política de concurrencia.
- Las futuras revisiones pueden razonar desde el código y no desde defaults
  ocultos del target.

### Negativas

- El cambio inicial del ajuste no es compatible a nivel de fuente y hace que
  límites implícitos existentes dejen de compilar.
- La composición de App y los adaptadores SDK necesitan propiedad explícita
  adicional.
- Sustituir el estado global de routing preservando fences síncronos de
  seguridad es un cambio arquitectónico de alto riesgo que requiere tests y
  revisión dedicados.
- Algunas suites que dependían de `MainActor` implícito necesitan aislamiento
  explícito o soporte de test neutral.

## Implementación y verificación

La decisión se implementa mediante historias ejecutables gobernadas por
separado. HU-074 solo posee los dos primeros pasos:

1. Registrar política, baseline, alcance y matriz de propiedad.
2. Mover el build setting a una única autoridad de proyecto y recuperar la
   compilación Debug y Release sin escapes inseguros.

Historias posteriores podrán añadir carriles reproducibles de validación,
sustituir estado mutable más amplio del entorno, reforzar fronteras Firebase,
consolidar la composición de App, refactorizar slices funcionales/SwiftUI y
retirar sintaxis redundante. Cada una requiere su propia HU, issue, rama, gates
medibles y activación explícita; ADR-0011 no activa ese roadmap.

Cada corte ejecutable mantiene concurrencia estricta, preserva cancelación y
fences de resultados tardíos, supera tests focalizados y la validación completa
aplicable, y recibe una revisión independiente de concurrencia/arquitectura.
Los cambios SwiftUI también requieren la revisión SwiftUI/accesibilidad del
repositorio.

Esta decisión no autoriza despliegues Firebase, upgrades de paquetes,
mutaciones de datos live, cambios de código Android ni adopción de iOS/Xcode 27.

## Decisiones y trabajo relacionados

- [ADR-0001](0001-mvvm-clean-architecture.md): MVVM y Clean Architecture.
- [ADR-0002](0002-min-platform-versions.md): baseline de plataforma iOS 26.
- [ADR-0003](0003-firebase-backend.md): servicios backend Firebase; esta
  decisión solo cambia la propiedad concurrente del cliente.
- [ADR-0004](0004-ios-root-dependency-injection.md): inyección de dependencias
  raíz para SwiftUI en iOS.
- [ADR-0008](0008-acotar-operaciones-moviles-de-sesion.md): operaciones móviles
  de sesión acotadas y barreras de cleanup.
- [ADR-0009](0009-exigir-autorizacion-push-viva-de-proceso.md): autorización push
  viva de proceso.
- [ADR-0010](0010-separar-feeds-comunidad-de-autorizacion-sesion.md): propiedad
  de refrescos de comunidad e invalidación síncrona de contexto.
- HU-073: convenciones entregadas de construcción de structs e inferencia de
  sendability; este ADR solo sustituye su suposición histórica del build
  setting `MainActor`.
- Issue de GitHub [#249](https://github.com/JFrancoG/ReguertaPlus/issues/249).

## Referencias

- [SE-0466: Controlar la inferencia del aislamiento de actor por defecto](https://github.com/swiftlang/swift-evolution/blob/main/proposals/0466-control-default-actor-isolation.md)
- [SE-0461: Ejecutar funciones async nonisolated en el actor del llamador por defecto](https://github.com/swiftlang/swift-evolution/blob/main/proposals/0461-async-function-isolation.md)
- [Guía de migración de concurrencia de Swift 6](https://www.swift.org/migration/documentation/swift-6-concurrency-migration-guide/)
- [`MainActor` de Swift](https://developer.apple.com/documentation/swift/mainactor)
