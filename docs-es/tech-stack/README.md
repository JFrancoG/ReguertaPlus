# Stack Tecnologico

Este documento es la fuente de verdad del stack tecnico de Reguerta.

## Principios Base

- Mantener alineada la arquitectura entre Android e iOS (MVVM + Clean Architecture).
- Buscar paridad de features entre plataformas, permitiendo desfases temporales si una se bloquea.
- Usar frameworks nativos de UI y patrones modernos de concurrencia.

## Baselines de Plataforma

- Version minima de iOS: 26.0+
- Version minima de Android: API 29 (Android 10)

## Stack Android

- Lenguaje: Kotlin
- UI: Jetpack Compose
- Base de design system: Material 3
- Navegacion: Navigation 3
- Arquitectura: MVVM + Clean Architecture
- Inyeccion de dependencias: Hilt (estandar preferido para wiring de dependencias)
- Asincronia/concurrencia: Kotlin Coroutines + Flow/StateFlow
- Serializacion: kotlinx.serialization
- Persistencia local/preferencias: DataStore (Preferences)
- Carga de imagenes: Coil (Compose + integracion OkHttp)
- Integracion backend: Firebase SDK (Auth, Firestore, Storage, Messaging, Crashlytics, Analytics)

## Stack iOS

- Lenguaje: Swift 6
- UI: SwiftUI
- Arquitectura: MVVM + Clean Architecture
- Concurrencia: Swift Concurrency (`async/await`, flujos con tasks)
- Modo de concurrencia: concurrencia estricta de Swift 6 configurada como
  `complete`
- Approachable Concurrency: habilitada (`SWIFT_APPROACHABLE_CONCURRENCY = YES`)
- Objetivo de aislamiento de actor por defecto: `nonisolated` para todos los
  módulos iOS propios, heredado desde una única autoridad a nivel de proyecto
- Estado de la migración de aislamiento: implementada y validada localmente por
  HU-074 bajo ADR-0011; los targets de app, tests unitarios y tests de UI
  heredan la política de proyecto. El commit `a26768e` está publicado en la
  rama HU-074; la integración sigue siendo un gate separado en la issue #249
- Propiedad de actores: los modelos observables de UI y Stores declaran
  `@MainActor` explícitamente; Domain y Data permanecen neutrales por defecto y
  el estado mutable de infraestructura tiene un único propietario explícito
- Modelo de estado/observacion: Observation framework (`@Observable`) como patron observable por defecto
- Gestion de dependencias: Swift Package Manager (SPM)
- Integracion backend: Firebase iOS SDK (Auth, Firestore, Storage, Messaging, Crashlytics, Analytics)

## Backend y Cloud

- Plataforma: Firebase
- Datos: Firestore
- Auth: Firebase Authentication
- Almacenamiento de archivos: Firebase Storage
- Push: Firebase Cloud Messaging (FCM)
- Crash reporting: Firebase Crashlytics
- Logica server: Firebase Cloud Functions (Node.js 22 + TypeScript)

## Tooling de Tests y Validacion

- Android: Gradle (`test`, `lint`, instrumentacion segun necesidad)
- iOS: `Reguerta` es el scheme canonico de Xcode con los planes versionados
  `fast-unit-v1`, `ui-smoke-v1` y `release-gate-v1`
- Entrada de validacion iOS: `scripts/validate-ios.sh`, con un destino explicito
  de simulador iOS 26; Develop y Production conservan sus roles de entorno
- Lint iOS: SwiftLint 0.61.0 queda fijado en el repositorio, se resuelve desde
  `PATH` y se ejecuta en modo estricto/sin cache tanto en el runner como en la
  fase de Xcode
- Preparacion del host para lint iOS: Xcode puede omitir
  `/opt/homebrew/bin`, usado por Homebrew en Apple Silicon, del `PATH` de sus
  fases; la configuracion soportada una sola vez es un enlace simbolico
  verificado en `/usr/local/bin/swiftlint` hacia el binario instalado, mientras
  el proyecto permanece independiente de prefijos de Homebrew
- Settings iOS: `scripts/verify-swift-settings.sh` comprueba los tres targets en
  Debug y Release contra el contrato Swift 6/nonisolated
- Cobertura iOS: se registra desde bundles de `fast-unit-v1` como tendencia sin
  umbral; los tests de rendimiento permanecen sin instrumentar
- Functions: `npm run lint` y `npm run build`

## Notas

- Si hay conflicto entre este documento, ADRs o instrucciones de agentes, resolver mediante aclaracion explicita con el usuario antes de continuar.
- ADR-0011 define la política de aislamiento iOS, las restricciones de migración
  y la frontera de aprobación para escapes inseguros.
