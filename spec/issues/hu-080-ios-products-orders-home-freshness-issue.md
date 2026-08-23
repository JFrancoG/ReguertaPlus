# [HU-080][P1][iOS] Consolidar Products, Orders, Home y Freshness

## Tracking

- GitHub issue: #262
- URL: https://github.com/JFrancoG/ReguertaPlus/issues/262
- State: OPEN / ready for merge
- Branch: `codex/hu-080-ios-products-orders-home-freshness`
- Base: `5c511dda9aeb3dab182888733cf972847a91b97a`

## Objetivo

Modernizar como una vertical iOS cohesiva Products, Orders, Home y Critical
Data Freshness, preservando negocio, seguridad y comportamiento mientras se
reparan pérdidas de datos, políticas ignoradas, fronteras de capas y ownership
asíncrono demostrados por tests.

## Autorización

Instrucción del mantenedor, 2026-08-21:

> Pues abre issue y rama y seguimos

Autoriza issue, rama, especificación, baseline, plan, tareas, tests, previews e
implementación dentro de HU-080. No autoriza commit, push, PR, merge, cierre,
borrado de rama, datos live ni despliegue Firebase/backend.

Instrucción posterior del mantenedor, 2026-08-23, tras completar la aceptación
física y el `release-gate` definitivo:

> Teniamos que hacer commit, push, lanzar PR y cerrar issue y rama.

Autoriza commits focalizados, publicación de la rama, PR lista, el merge
necesario para el cierre, cierre de #262, borrado de la rama e integración
local. Los datos live y el despliegue Firebase/backend siguen fuera de HU-080 y
no son necesarios para esta entrega.

## Problemas iniciales demostrados

1. El remapeo de ID de `FirestoreProductRepository.upsert` omite
   `weightStep/minWeight/maxWeight`; el payload los borra y el producto devuelto
   ya está mutilado.
2. La ventana de consulta de Orders ignora el día de reparto configurado y usa
   miércoles salvo override.
3. Home lee `UserDefaults.standard` y duplica claves privadas del cart store, de
   modo que runtime, previews y tests pueden observar grafos distintos.

El primer RED/GREEN será la integridad de persistencia de Products. Orders y la
frontera Home/Orders se abordarán como cortes posteriores independientes.

## Alcance

- Products: catálogo, editor, imagen, guardado, archive, disponibilidad,
  compra común y refresh de ordering.
- Orders: Mi pedido, cart/checkout, pedido anterior, recibidos, historiales,
  status, ventana de consulta y restauración.
- Home: resumen semanal, acciones y orquestación consumidora de este slice.
- Freshness: resolución, timeout, retry, ACK, sesión/entorno y handoff exacto.
- Owners `@MainActor`, tareas retenidas cuando corresponda, revisiones,
  generaciones y cleanup owner-only.
- Domain/Data/Presentation, tests deterministas, previews, localización,
  VoiceOver, Dynamic Type, contraste, Reduce Motion y layout adaptativo.

## Fuera de alcance

- Verticales posteriores de Phase 6.
- Rediseño de permisos, esquema Firebase, Rules, Functions, backfills, datos
  live, deploys o cierre de HU-070/#198.
- Android, paquetes, settings, CI, rediseño global o migración amplia de tests.
- Cierre global de RNF-02 fuera de los seams Orders/Home/weekKey de Shift/
  paridad de productor tocados aquí, incluida la deuda heredada Settings/Shifts.
- Delivery Git/remoto hasta nueva autorización.

## Criterios de aceptación

- [x] Issue, branch, base e inventario inicial quedan congelados.
- [x] Products conserva todos los campos de peso al asignar ID y persistir.
- [x] My Order, Received Orders y Home respetan override > día configurado >
  fallback miércoles.
- [x] Home deja de leer `UserDefaults` y claves privadas de Data.
- [x] Owners, cancelación, revisiones y cleanup del slice son explícitos y
  están cubiertos por tests deterministas.
- [x] El parser Received rechaza escalares monetarios Bool/no finitos y precios
  o totales negativos, y normaliza una medida por unidad inválida sin descartar
  una línea válida.
- [x] Freshness acepta una revisión sucesora solo con ACK explícito del receipt
  Products exacto, y Products invalida su epoch anterior antes de adoptar una
  revisión no sincronizada o democión.
- [x] Los seams temporales tocados usan la autoridad Madrid compartida sin
  declarar cerrado RNF-02 global.
- [x] Se preservan autorización, sesión/entorno, checkout/restauración, resumen
  semanal y freshness fail-closed/ACK exacto.
- [x] Domain, Data, App y Presentation respetan sus límites sin escapes de
  concurrencia.
- [x] La superficie afectada queda localizada y adaptativa, con previews
  deterministas/renderizados de los estados relevantes y deuda visual explícita.
- [x] Focales, fast-unit, UI aplicable, ui-smoke, release-gate, SwiftLint,
  settings y builds quedan verdes sobre el árbol post-remediación congelado.
  La aceptación física, el release-gate definitivo, los builds y los guards
  finales también pasan.
- [x] La deuda residual y el estado de aceptación manual quedan registrados.
- [x] Android, HU-070/#198 y las siguientes verticales quedan explícitos.
- [x] La aceptación manual HU-080 está completada. El pase inicial en iPhone 11
  / iOS 26.6 confirma journeys funcionales, Voice Control, Reduce Motion,
  contraste aumentado y rutas no afectadas con texto grande. El retest del
  2026-08-23 confirma celdas agrupadas, pronunciación localizada del intervalo
  y texto casi al máximo hasta la última noticia. El pase post-focus final
  confirma además el foco inicial en el resumen semanal, que no se recupera
  durante refreshes y vuelve una sola vez al reentrar. Las pruebas de HU-079 no
  se reutilizan.

## Validación

- Simulador: iPhone 17 / iOS 26.5.
- Dispositivo físico: iPhone 11 / iOS 26.6, 2026-08-22 y 2026-08-23.
- `fast-unit-v1` y selectores exactos durante implementación.
- `ui-smoke-v1` cuando cambie shell/navegación/UI.
- `release-gate-v1` sobre el árbol final congelado.
- SwiftLint, settings 6/6, Debug, Production Release, guards de capas/escapes,
  `git diff --check`, scope, paquetes y `project.pbxproj`.
- Matriz: phone/iPad, Large/XXX Large/AX5, ES/EN, light/dark, VoiceOver,
  Increased Contrast y Reduce Motion.

## Evidencia implementada

- Products: RED de contrato, GREEN 1/1 y cohorte Data/payload 38/38.
- Orders: RED conductual válido en
  `/private/tmp/hu080-orders-window-red-valid.tnrMMj/result.xcresult`; GREEN
  focal 1/1 en `/private/tmp/hu080-orders-window-green.zK8cEZ/result.xcresult`.
- Cohorte de corte Orders/Home, incluido el consumidor explícito de Received
  Orders y el fallback real de configuración `nil` a miércoles:
  `/private/tmp/hu080-orders-cohort-authority.xYL7Wc/result.xcresult`, 103/103,
  sin fallos ni omisiones.
- Home/Orders boundary: RED estructural 1/1 en
  `/private/tmp/hu080-home-boundary-red.izfD7U/result.xcresult` y RED de
  compilación del contrato Domain ausente en
  `/private/tmp/hu080-home-usecase-red.bcp4c0/result.xcresult`.
- El GREEN inicial Home 6/6 y cohorte 74/74 queda como evidencia cronológica
  superada tras endurecer identidad del grafo, cleanup cancelable y revisión.
- GREEN focal Home 7/7 en
  `/private/tmp/hu080-home-focused-green-final.1fcQGA/result.xcresult` y cohorte
  final Home/Orders/Data/composición 93/93 en
  `/private/tmp/hu080-orders-home-boundaries-cohort.G0yv7F/result.xcresult`.
- Parser Received Orders: RED de ownership Data/Presentation y GREEN inicial 3/3 en
  `/private/tmp/hu080-received-parser-green.IYOP5J/result.xcresult`.
- Traducción de error de status: RED conductual/capa y GREEN inicial 3/3 en
  `/private/tmp/hu080-status-write-green.Q08hOf/result.xcresult`.
- Corte de fronteras Orders Data tras el hardening de revisión: 8/8 en
  `/private/tmp/hu080-order-boundaries-final.xcresult`, con scan completo de
  capas, cancelación y el consumidor legacy de líneas por peso.
- Ownership Products: REDs válidos 0/1, 1/2 y 2/3 en
  `/private/tmp/hu080-products-direct-draft-red-suite.xcresult`,
  `/private/tmp/hu080-products-upload-owner-red-2.xcresult` y
  `/private/tmp/hu080-products-archive-red-3.xcresult`. El GREEN inicial fue
  3/3 lógico y 5/5 concreto; la caracterización de visibilidad fue 5/5 lógico
  y 7/7 concreto. Ambos quedaron superados provisionalmente por:
  `/private/tmp/hu080-products-final.KphCDD/result.xcresult`, 62/62 lógico y
  64/64 concreto. La revisión final de sesión volvió a superar esa cohorte.
- Products incrementa la revisión ante toda asignación del draft, retiene y
  cancela el upload de imagen al invalidar editor/sesión/entorno, evita que un
  archive tardío cierre un editor sucesor y conserva fences/cleanup owner-only
  para visibilidad.
- Home/Freshness/cart: los probes `red.Gf27aw`, `red2.ksfbMy` y `red3.ODxrtV`
  fueron setup/compilación y quedan superados. El RED arquitectónico válido fue
  `/private/tmp/hu080-home-freshness-cart-red4.Z6VSBE/result.xcresult`, que no
  compiló porque aún no existían los seams de owner/waiter; el GREEN inicial
  pasó 6/6 en
  `/private/tmp/hu080-home-freshness-cart-green.aHmxeY/result.xcresult`.
- La revisión independiente obtuvo RED 3/5 en
  `/private/tmp/hu080-freshness-entry-red-valid.qblX4O/result.xcresult`: una
  entrada precancelada iniciaba refresh y un waiter podía registrarse tras ser
  desplazado. El hardening pasó 5/5 y la cohorte entonces provisional fue
  `/private/tmp/hu080-home-freshness-orders-final.Dj9hbF/result.xcresult`,
  136/136; la revisión final encontró más gaps y la invalida como autoridad de
  cierre.
- Root retiene un intento inmutable de entrada a Mi pedido; Freshness resuelve
  waiters ligados a generación/identidad al quedar ready, vencer timeout,
  invalidarse o cancelarse; el worker de cart serializa, coalesce al último
  snapshot y no solapa un sucesor con un owner cancelado no cooperativo.
- Previews: RED inicial 13/15 en
  `/private/tmp/hu080-galleries-failure-red.mfmC7h/result.xcresult` por faltar
  Products/Received failure; GREEN 15/15 en
  `/private/tmp/hu080-galleries-failure-green-retry.NOyZJc/result.xcresult`.
  La revisión produjo RED 11/16 y GREEN 16/16 al exigir modifier+canvas,
  Received 600 XXX y assertions runtime/retry. Autoridad final:
  `/private/tmp/hu080-freshness-previews-post-review.hVomdC/result.xcresult`,
  21/21.
- UI focal: el productor mock abre Products, cambia `Tomatoes` a
  `Tomatoes updated`, guarda y verifica una única fila actualizada. Autoridad
  post-review:
  `/private/tmp/hu080-product-ui-post-review.6qV9mC/result.xcresult`, 1/1.
- Los cortes son puros/locales y no ejecutaron operaciones Firebase live.

### Hardening de revisión final y cierre post-parser

- Home weekday: RED 10/11 en
  `/private/tmp/hu080-home-friday-red.A7x2P9/result.xcresult` porque Home aún
  ignoraba el viernes configurado; GREEN 11/11 en
  `/private/tmp/hu080-home-friday-green.B4n8Q2/result.xcresult` con política
  Domain compartida por My Order, Received y Home.
- Madrid: el primer probe timezone no compiló y no cuenta como evidencia
  conductual. Los RED válidos fueron 3/4 para `Shift.weekKey` en
  `/private/tmp/hu080-shift-week-authority-red.xcresult` y 4/5 para paridad en
  `/private/tmp/hu080-producer-parity-red-2.xcresult`. El contrato conjunto
  pasó 36/36 en `/private/tmp/hu080-calendar-session-green-retry.xcresult`.
- Parser scalar: RED 3/5 en
  `/private/tmp/hu080-received-parser-scalar-red.xcresult`; ese corte rechazó
  Bool/no finitos y totales negativos y normalizó medida por unidad inválida a
  1.
- Precio unitario negativo post-parser: RED
  `/private/tmp/hu080-received-parser-negative-price-red.xcresult`, 6 lógicas =
  5 pass + 1 fail y 12 concretas = 10 pass + 2 fail. Un `priceAtOrder: -1`
  sobrevivía si el subtotal explícito era positivo. El GREEN
  `/private/tmp/hu080-received-parser-negative-price-green-final.xcresult` pasa
  6/6 lógicas y 12/12 concretas con build limpio.
- Handoff Freshness→Products: RED 2/3 en
  `/private/tmp/hu080-freshness-revision-handoff-red.xcresult`. El estado final
  acepta la revisión avanzada solo si el receipt Products exacto reconoce la
  revisión live; un predicado current genérico no basta.
- Home entry/pre-read: REDs 1/2, 2/3 y 2/4 en
  `/private/tmp/hu080-home-entry-context-red-valid.xcresult`,
  `/private/tmp/hu080-home-revision-handoff-red-2.xcresult` y
  `/private/tmp/hu080-home-onchange-red.xcresult`; los RED pre-read fueron 4/5
  en `/private/tmp/hu080-home-state-owner-red.xcresult` y
  `/private/tmp/hu080-home-state-pre-read-red.xcresult`. Root conserva solo el
  handoff benigno reconocido y Home rechaza scope/cancelación/autorización antes
  de tocar generación o store.
- Products sesión: la progresión RED previa fue 5/6 y 5/7. El RED final es
  `/private/tmp/hu080-products-demotion-owner-red-2.xcresult`, 8 lógicas = 7
  pass + 1 fail porque la democión no invalidaba el epoch. El GREEN focal final
  `/private/tmp/hu080-products-session-owner-green-final.xcresult` pasa 15/15
  lógico y 18/18 concreto. Una cohorte posterior ejecutó 69 responsabilidades:
  68 pasaron y una falló al detectar aún el retry de democión; queda superada
  por la autoridad Products final:
  `/private/tmp/hu080-products-cohort-authority-final.xcresult`, 70/70 lógico y
  73/73 concreto.
- El contrato post-review pasa 41/41 en
  `/private/tmp/hu080-final-contracts-post-review.xcresult`; la última cohorte
  dedicada Home/Freshness/Orders pasa 147/147 en
  `/private/tmp/hu080-home-freshness-orders-cohort-final.xcresult`. Ambas quedan
  superadas como autoridad de cierre por `fast-unit` y `release-gate` canónicos.

## Gates y conteo

- Cohortes: Products final 70 lógico/73 concreto; último corte dedicado
  Home/Freshness/Orders 147/147; Freshness/previews 21/21; UI Products 1/1.
- El corte canónico anterior queda como pre-hardening y superado: fast-unit
  `/private/tmp/hu080-fast-unit-canonical-authority-final.xcresult` pasó
  774 lógicas/965 concretas, ui-smoke
  `/private/tmp/hu080-ui-smoke-canonical-authority-final.xcresult` pasó 4/4 y
  release `/private/tmp/hu080-release-gate-canonical-authority-final.xcresult`
  registró 786 lógicas/980 concretas. Ninguno es autoridad de cierre tras el
  hardening de precio negativo.
- El primer fast-unit post-parser
  `/private/tmp/hu080-fast-unit-canonical-post-parser-red.xcresult` pasó
  774/775 lógicas y 965/966 concretas antes de un timeout silencioso heredado de
  `waitForCondition` en Shifts. La diagnosis focal
  `/private/tmp/hu080-shifts-focal-diagnosis.xcresult` pasó 6/6 y el rerun
  completo pasó sin cambio de código; es diagnóstico superado, no autoridad ni
  residual HU-080.
- `fast-unit` canónico pre-manual:
  `/private/tmp/hu080-fast-unit-canonical-post-parser-green-final.xcresult`,
  775/775 lógico y 966/966 concreto, todo pass.
- `ui-smoke` canónico pre-manual:
  `/private/tmp/hu080-ui-smoke-canonical-post-parser-final.xcresult`, 4/4 pass.
- `release-gate` canónico pre-manual:
  `/private/tmp/hu080-release-gate-canonical-post-parser-final.xcresult`, 787
  lógico = 786 pass + un skip conocido de launch; 981 concreto = 977 pass +
  cuatro variantes launch skipped. El skip
  `ReguertaUITestsLaunchTests/testLaunch` es deuda histórica heredada: su
  screenshot es flaky entre clones de simulador paralelos y los journeys UI
  dedicados cubren launch. No es fallo HU-080: hay cero fallos de test y el
  build registra 0 errores / 0 warnings / 0 analyzer warnings.
- SwiftLint pre-focus 0/435, settings 6/6, Debug y Production Release pasan. `pbxproj`,
  lockfiles de paquetes, guards/escapes prohibidos, scope y `git diff --check`
  están limpios.
- Inventario pre-manual: Production 283 ficheros Swift/40.787 líneas; unit tests
  150/35.214; UI tests 2/524; total 435/76.525. Delta frente a activación: +22
  ficheros y +3.501 líneas. Hay 769 declaraciones Swift Testing + 6 métodos
  XCTest unit = 775 responsabilidades lógicas; UI XCTest tiene 12 métodos y
  el inventario release suma 787 lógicas/981 concretas. El corte post-parser
  añadió un `@Test` y 9 líneas unit al inventario congelado anterior.

Este conteo y el release gate anterior son snapshots pre-remediación y ya no
son autoridad de cierre. El corte físico/post-manual queda documentado así:

- RED Home accesibilidad/layout:
  `/private/tmp/hu080-home-physical-ax-red.cOf9t4/result.xcresult`, 17/22 pass y
  cinco fallos esperados.
- GREEN Home accesibilidad/layout:
  `/private/tmp/hu080-home-physical-ax-green.wi7eA3/result.xcresult`, 22/22 pass.
- Cohorte layout/preview final:
  `/private/tmp/hu080-home-ax5-preview-green.Lg0fJ4/result.xcresult`, 31/31 pass.
- RED de contrato del foco:
  `/private/tmp/hu080-home-focus-red.uRmJfM/result.xcresult`, fallo válido de
  compilación solo por faltar `HomeDashboardInitialVoiceOverFocusGate`. El
  primer intento de implementación
  `/private/tmp/hu080-home-focus-green.gkISmX/result.xcresult` queda solo como
  cronología inválida porque no compiló la aserción mutante del propio test.
- GREEN del foco 4/4 y cohorte Home adaptativa 10/10:
  `/private/tmp/hu080-home-focus-green.9pdW4k/result.xcresult` y
  `/private/tmp/hu080-home-focus-adaptive-green.OYM6JZ/result.xcresult`.
- `fast-unit` actual:
  `/private/tmp/hu080-home-focus-fast-unit.TKuQQL/result.xcresult`, 779/779
  lógico y 970/970 concreto.
- UI Home overflow 1/1 y `ui-smoke` 4/4:
  `/private/tmp/hu080-home-focus-overflow-ui.M2PBV7/result.xcresult` y
  `/private/tmp/hu080-home-focus-ui-smoke.XYWewg/result.xcresult`.
- Primer `release-gate` sobre el árbol final congelado, RED válido:
  `/var/folders/wt/r327qtw12_s5tbbcnx9dzqv80000gn/T/hu080-final-release-gate.PYUaRiqVbc/result.xcresult`,
  791 lógicas = 788 pass + 2 fail + 1 skip y 985 concretas = 979 pass + 2 fail
  + 4 skip. Expuso la entrada no alcanzable de Mi pedido y el scroll ambiguo
  del editor de producto, que seleccionaba el drawer oculto.
- UI de navegación final:
  `/var/folders/wt/r327qtw12_s5tbbcnx9dzqv80000gn/T/hu080-ui-navigation-final.4Ccw8lVx2O/result.xcresult`,
  3/3 pass tras fijar selectores explícitos para Home, drawer y editor de
  producto.
- `release-gate` definitivo:
  `/var/folders/wt/r327qtw12_s5tbbcnx9dzqv80000gn/T/hu080-final-release-gate.v2ErAd7VtU/result.xcresult`,
  791 lógicas = 790 pass + 1 skip + 0 fail y 985 concretas = 981 pass + 4 skip
  + 0 fail. Los test build-results terminaron con 0 errores y 0 warnings.
- Higiene local final: SwiftLint 0/437, settings 6/6, Debug y Production
  Release verdes, y guard de escapes prohibidos verde. `git diff --check` está
  limpio; `project.pbxproj`, lockfiles, staging y adiciones de escapes
  prohibidos tienen diff cero.
- Snapshot post-focus intermedio: Production 283 ficheros/40.887 líneas; unit
  tests 151/35.290; UI tests 2/524; total 436/76.701. Delta frente a activación:
  +23 ficheros/+3.677 líneas. Se conserva como cronología, no como autoridad de
  cierre.
- Inventario final congelado: Production 283 ficheros/40.888 líneas; unit tests
  151/35.290; UI tests 3/535; total 437/76.713. Delta frente al baseline de
  activación 413/73.024: +24 ficheros/+3.689 líneas. El release definitivo
  acredita 791 responsabilidades lógicas y 985 ejecuciones concretas.

La aceptación física, los gates locales, los builds, los guards y el inventario
final están completos sobre el árbol congelado.

## Render y residuales

RenderPreview:

- Received wide:
  `/var/folders/wt/r327qtw12_s5tbbcnx9dzqv80000gn/T/ActionArtifacts/default/RenderPreview/RenderPreview_result_2026-08-21T121921Z@3x.png`.
- Received failure/retry:
  `/var/folders/wt/r327qtw12_s5tbbcnx9dzqv80000gn/T/ActionArtifacts/default/RenderPreview/RenderPreview_result_2026-08-21T121932Z@3x.png`.
- Home checking compact AX5 pre-manual:
  `/var/folders/wt/r327qtw12_s5tbbcnx9dzqv80000gn/T/ActionArtifacts/default/RenderPreview/RenderPreview_result_2026-08-21T121941Z@3x.png`.
- Home checking compact AX5 post-manual, Reduce Motion, contraste aumentado y
  tres noticias deterministas:
  `/var/folders/wt/r327qtw12_s5tbbcnx9dzqv80000gn/T/ActionArtifacts/default/RenderPreview/RenderPreview_result_2026-08-22T214359Z@3x.png`.
- Products failure:
  `/var/folders/wt/r327qtw12_s5tbbcnx9dzqv80000gn/T/ActionArtifacts/default/RenderPreview/RenderPreview_result_2026-08-21T122005Z@3x.png`.

La prueba física reclasificó el solape AX5 como defecto funcional: Home no
permitía llegar a Últimas noticias. La corrección deja un único scroll de ruta,
celdas con crecimiento intrínseco y agrupación VoiceOver, headings semánticos,
raya visible y etiqueta hablada ES/EN para el intervalo. El retest físico del
2026-08-23 acepta esos tres comportamientos, pero reproduce el foco inicial en
la primera noticia. Home incorpora ahora un
`@AccessibilityFocusState(for: .voiceOver)` de una sola vez sobre el heading
del resumen semanal: espera a que VoiceOver esté activo y el destino montado,
no roba foco durante refreshes y se reinicia al recrear la ruta. La revisión
independiente post-focus no encuentra P0-P3.

El pase físico final del 2026-08-23 confirma el foco inicial en el resumen
semanal, que no vuelve durante refreshes y se solicita una vez de nuevo tras
salir y reentrar en Home.

En iPhone 11 / iOS 26.6 pasaron resumen, Mi pedido online, Pedidos recibidos,
edición/persistencia de producto e imagen, pesos al crear/editar, carrito,
historial, menú, Voice Control por números, Reduce Motion, contraste aumentado
y las rutas no afectadas con texto grande. El retest del 2026-08-23 confirma
además el recorrido agrupado, el intervalo y el texto casi máximo hasta la
última noticia. El pase final confirma también el foco inicial en el resumen,
sin refoco tras refresh y con un nuevo foco al reentrar. Sin
conexión, Mi pedido conserva el fail-closed esperado
y el resto de rutas sigue navegable; el feedback inferior es visualmente pobre,
pero evaluar un Reguerta dialog/banner queda diferido tras el MVP.

Los dos canvases locales de Product editor siguen como excepción directa bajo
`ReguertaTheme`; su normalización/split queda como deuda post-MVP. Siguen fuera
Android, HU-070/#198 live y las verticales posteriores. HU-080
alinea solo sus seams Orders/Home/weekKey de Shift/paridad de productor con
`Europe/Madrid`; la deuda RNF-02 heredada en Settings/Shifts y otros verticales
sigue fuera de alcance, sin afirmar cierre global. La auditoría independiente
final no deja hallazgos P0-P3 en la superficie HU-080 modificada.

## Documentos vivos

- `spec/app/hu-080-ios-products-orders-home-freshness/spec.md`
- `spec/app/hu-080-ios-products-orders-home-freshness/phase-6-baseline.md`
- `spec/app/hu-080-ios-products-orders-home-freshness/plan.md`
- `spec/app/hu-080-ios-products-orders-home-freshness/tasks.md`

Estado: OPEN / ready for merge. Implementación, aceptación física, focales,
`fast-unit`, UI, preview, `release-gate`, SwiftLint, settings, builds, guards,
inventario y reconciliación documental están completos y verdes. El commit
fuente `812be29` está creado y el delivery remoto completo está autorizado. La
issue permanece abierta solo hasta que merge y cierre sean definitivos; no se
autoriza ni necesita mutación live.
