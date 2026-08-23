# [HU-081][P1][iOS] Consolidar turnos, planificación, intercambios, calendario y ajustes

## Tracking

- GitHub issue: #264
- URL: https://github.com/JFrancoG/ReguertaPlus/issues/264
- State: OPEN / in progress
- Branch: `codex/hu-081-ios-shifts-planning-swaps-delivery-calendar-settings`
- Base: `35a874288e3844d9c3d88abbaa39e2fb6fef42b2`
- Roadmap: tercera vertical de Phase 6.
- Profile: iOS maintenance; iOS 26, Swift 6, strict concurrency.

## Objetivo

Modernizar como una vertical iOS cohesiva Shifts, Planning, Swaps, Delivery
Calendar y Settings, preservando los contratos funcionales existentes mientras
se corrigen la inconsistencia temporal demostrada, la falsa autoridad cliente
en swaps, las reglas de negocio alojadas en Presentation y el ownership
asíncrono incompleto.

## Autorización

Instrucción del mantenedor, 2026-08-23:

> Ok. Abre issue, rama y comenzamos con el siguiente paso

Autoriza issue, rama, auditoría, especificación, baseline, plan, tareas, tests,
previews y comienzo de la implementación dentro de HU-081. No autoriza commit,
push, PR, merge, cierre, borrado de rama, datos live, despliegue Firebase ni
cambios Google Sheets.

## Contexto

HU-081 no reabre las historias funcionales ya entregadas. Preserva
RF-TURN-01...07, RF-CAL-01...05, RNF-02, HU-011/015/016/017/020/041/042/063/066,
la integración de planificación, los intercambios, la configuración de
apariencia/modo no disponible y los contratos de sesión/entorno heredados de
HU-079/HU-080.

## Problemas iniciales demostrados

1. `refreshDeliveryCalendar` descarta default y excepciones para todo socio no
   admin, aunque Rules permiten la lectura a cualquier socio activo, HU-042
   exige reflejarlas a miembros y My Order/Received Orders/Home las consumen.
2. `DeliveryCalendarSupport` deriva semana y ventanas con `Calendar.current` /
   huso del dispositivo, mientras Shift week keys y Orders usan
   `Europe/Madrid`. El mismo `weekKey` puede producir timestamps distintos.
3. El cliente puede impedir `create` si su `shiftsFeed` local no proyecta
   candidatos, pero Functions es la autoridad: relee turnos/socios activos y
   calcula candidatos transaccionalmente. Un snapshot obsoleto puede negar una
   solicitud válida.
4. `ShiftSwapTransition` transporta requests completos aunque Data serializa
   comandos mínimos y Functions ignora las mutaciones client-side.
5. Políticas reutilizables de swaps/calendario viven en Presentation y deben
   clasificarse sin duplicar la autoridad del backend.
6. `ShiftsFeatureViewModel` concentra cinco repositorios y múltiples estados/
   generaciones; algunos efectos cancel-and-replace usan tareas no retenidas.
7. `notificationRepository` está inyectado pero no se usa; Functions crea las
   notificaciones de swap en su transacción.
8. No hay viajes UI del slice y faltan previews de swaps y estados de
   carga/vacío/error/guardado.

## Alcance

- Shifts globales/próximos, board y display.
- Planning delivery/market y sus solicitudes.
- Swap create/respond/cancel/apply, acknowledgements y command boundary.
- Delivery Calendar default, excepciones, editor y ventanas de pedidos.
- Settings general/productor/admin/develop en los seams consumidores.
- Domain/Data/App/Presentation, owners, cancelación, sesión y entorno.
- Swift Testing, UI focal, previews, localización, accesibilidad, motion y
  layout adaptativo.

## Fuera de alcance

- Nuevas reglas de turnos, política de ausencias, permisos o producto nuevo.
- Esquema Firestore, Functions, Rules, backfills, Google Sheets, datos live o
  deploys; HU-070/#198 permanece independiente.
- Seed/read-back live de `config/member.deliveryDayOfWeek`; el cliente lo
  necesita para que un socio resuelva el default, pero HU-022/HU-070 conservan
  el rollout y los canaries.
- Android; la paridad temporal queda explícita.
- Verticales/fases posteriores, paquetes, project settings, CI, iOS/Xcode 27,
  migración amplia de tests o cierre RNF-02 fuera de los seams tocados.
- Delivery Git/remoto hasta nueva autorización.

## Criterios de aceptación

- [x] Issue, rama, base, perfil e inventario inicial quedan congelados sin
  duplicados.
- [x] Todo socio activo carga default y excepciones de calendario, mientras
  escritura y planificación siguen siendo exclusivas de admin.
- [ ] Overrides/ventanas son independientes del huso del dispositivo y usan
  `Europe/Madrid` para cada instante empresarial.
- [ ] Los comandos swap contienen solo inputs cliente; Functions conserva la
  autoridad de candidatos, aplicación, helpers y notificaciones.
- [ ] Un snapshot local obsoleto no impide un create válido y el no-candidate
  backend produce feedback específico/localizado.
- [ ] Domain, Data, App y Presentation respetan sus responsabilidades sin falsa
  autoridad cliente ni escapes de concurrencia.
- [ ] Feed, swaps, planning y calendario tienen owners cohesivos, cancelación,
  successor fences y owner-only cleanup cubiertos por tests.
- [ ] Sesión/miembro/rol/entorno se validan antes de generación, I/O o publicación.
- [ ] Se elimina la dependencia de notificaciones muerta sin cambiar Functions.
- [ ] Appearance, modo no disponible, impersonación, reloj develop y contratos
  funcionales de turnos/calendario se preservan.
- [ ] UI localizada/adaptativa y previews deterministas cubren estados y roles.
- [ ] UI focal, matriz manual/física, `fast-unit`, `ui-smoke` aplicable,
  `release-gate`, SwiftLint, settings y builds quedan verdes.
- [ ] Deuda residual, Android, HU-070/#198 y siguientes verticales quedan explícitos.

## Plan inicial

1. Congelar inventario, owners, contratos, test/previews y commands.
2. Capturar RED de lectura de calendario para socio activo y separar lectura
   de escritura/planificación admin-only.
3. Capturar RED timezone y mover la política mínima de calendario a Domain.
4. Capturar el stale-feed RED y hacer veraz el command boundary de swaps.
5. Cortar ownership por vidas de operación demostradas, sin Stores ceremoniales.
6. Completar UI/previews y revisiones independientes.
7. Ejecutar gates y reconciliar evidencia antes de pedir delivery.

## Validación

- `./scripts/validate-ios.sh fast-unit --destination 'platform=iOS Simulator,name=iPhone 17,OS=26.5'`
- `./scripts/validate-ios.sh ui-smoke --destination 'platform=iOS Simulator,name=iPhone 17,OS=26.5'` cuando aplique.
- `./scripts/validate-ios.sh release-gate --destination 'platform=iOS Simulator,name=iPhone 17,OS=26.5'`
- UI focal, SwiftLint, settings 6/6, Debug, Production Release y guards.
- Phone/iPad, Large/XXX Large/AX5, ES/EN, light/dark, Increased Contrast,
  Reduce Motion, VoiceOver y Voice Control.

## Documentos vivos

- `spec/app/hu-081-ios-shifts-planning-swaps-delivery-calendar-settings/spec.md`
- `spec/app/hu-081-ios-shifts-planning-swaps-delivery-calendar-settings/phase-6-baseline.md`
- `spec/app/hu-081-ios-shifts-planning-swaps-delivery-calendar-settings/plan.md`
- `spec/app/hu-081-ios-shifts-planning-swaps-delivery-calendar-settings/tasks.md`

## Progreso actual

- RED válido: la suite `ReguertaShiftsViewModelTests` descubrió seis tests y
  falló solo la nueva expectativa de socia activa (`default == nil`).
- GREEN: 27/27 en las suites focales de Shifts, Calendar, revocación y
  autorización.
- `fast-unit-v1`: PASS en iPhone 17 / iOS 26.5.
- El cambio productivo elimina únicamente el gate admin de lectura; escritura
  de calendario y planificación conservan sus gates admin.
- Es evidencia local: no afirma que la proyección `config/member` requerida
  exista actualmente en los entornos live.

Estado: OPEN / en progreso. Issue, rama, auditoría, baseline, especificación,
plan y tareas están activos. No se autoriza ni se afirma commit, push, PR,
merge, cierre, borrado de rama, mutación live o despliegue.
