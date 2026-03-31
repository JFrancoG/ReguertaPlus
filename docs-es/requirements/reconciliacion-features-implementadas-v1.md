# Reconciliacion de Features Implementadas (Android+iOS vs Docs MVP) v1

Fecha: 2026-03-07
Ambito: Extraccion desde las apps Android/iOS vigentes y contraste contra requisitos/specs MVP actuales.

## 1. Fuentes revisadas

- `/Users/jesusf/Documents/APPs/Reguerta/features-implementadas-android.md`
- `/Users/jesusf/Documents/APPs/Reguerta/features-implementadas-ios.md`
- Documentacion canonica actual en `docs/requirements` y `spec`.

## 2. Cobertura ya contemplada en docs actuales

- Auth + whitelist/autorizacion y control por roles.
- Ventana semanal de pedidos, dia bloqueado y vista de pedido de semana anterior.
- Compromisos de compra y validaciones.
- Pedidos recibidos para productor (por producto/por usuario).
- CRUD base de productos con stock.
- Gestion admin de socios y salvaguardas de rol admin.
- Notificaciones push y recordatorios.
- Registro de dispositivos y puntero al ultimo dispositivo activo:
  - `users/{userId}/devices/{deviceId}`
  - `users.lastDeviceId`

## 3. Esencia de features faltantes no formalizadas aun

| ID candidato | Esencia a preservar | Visto en app(s) | Destino propuesto |
|---|---|---|---|
| CAND-APP-01 | Control remoto de version/startup con update forzada y opcional | Android+iOS | `requisitos-mvp`, historias, specs de startup/notificaciones |
| CAND-APP-02 | Puerta de frescura de datos criticos antes de entrar en `Mi pedido`, con timeout/reintento | Android+iOS | `requisitos-mvp`, historias, specs de pedidos |
| CAND-APP-03 | Refresco de sesion/token por lifecycle y UX explicita de sesion expirada | Android+iOS | `requisitos-mvp`, historias/specs de auth/startup |
| CAND-APP-04 | Sincronizacion selectiva en foreground con throttle/TTL | Android+iOS | `requisitos-mvp` + notas de estructura Firestore |
| CAND-CAT-01 | Pipeline de imagen de producto (seleccionar, recortar/redimensionar, subir a Storage, persistir URL) | Android+iOS | requisitos/historias/specs de catalogo |
| CAND-CAT-02 | Toggle masivo de disponibilidad del productor (todos disponibles/no disponibles, estilo vacaciones) | iOS (explicito), Android (intencion cercana) | requisitos/historias/specs de catalogo |
| CAND-ENV-01 | Estrategia de entornos runtime mas alla del revisor (`local`/`develop`/`production`) | iOS (explicito), Android (build-based develop/production) | no funcionales + docs operativos |
| CAND-DATA-01 | Timestamps remotos por coleccion como contrato de sincronizacion | Android+iOS | estructura Firestore/docs operativos |

## 4. Conflictos detectados

- Comportamiento de usuario no autorizado distinto:
  - iOS actual puede cerrar sesion.
  - Docs objetivo actuales piden mantener sesion en modo restringido.
- Borrado duro aun presente en app para algunas entidades:
  - Docs objetivo actuales priorizan borrado logico/baja.
- Desalineacion de enums entre legado y contrato nuevo:
  - En apps persisten valores legacy en español en varios flujos.
  - Contrato canonico Firestore actual define enums en ingles.
- Desalineacion de exposicion funcional:
  - Noticias/ajustes/historico existen como scaffold parcial pero sin exposicion funcional completa.

## 5. Preguntas de decision para cerrar antes de propagar

1. ¿`CAND-APP-01` (control remoto de version forzada/opcional) entra como requisito formal MVP?
2. ¿`CAND-APP-02` (puerta de frescura antes de `Mi pedido`) debe ser obligatorio en UX MVP?
3. ¿Mantenemos estrategia de no autorizado en modo restringido (sin logout) y retiramos logout por no autorizado?
4. ¿Formalizamos el toggle masivo de disponibilidad productor (`CAND-CAT-02`) dentro de MVP?
5. ¿La gestion de imagen de producto (`CAND-CAT-01`) queda explicita en MVP o solo como detalle tecnico?
6. ¿Mantenemos soporte runtime `local`, o acotamos a `develop`/`production` (+ override revisor)?
7. ¿La orquestacion por timestamps (`CAND-DATA-01`) debe ser requisito formal o queda como estrategia tecnica interna?

## 6. Siguiente paso tras respuestas

Con las respuestas del bloque 5, propagar de forma coherente a:

- `docs/requirements/*`
- `docs-es/requirements/*`
- specs impactadas en `spec/*`
- markdown de issues (y issues reales en GitHub cuando aplique).

## 7. Registro de resolucion

Resuelto el 2026-03-07:
- P1: Opcion A
- P2: Opcion A
- P3: Opcion A

Aclaracion anadida el 2026-03-30:
- P3 se mantiene resuelta como modo restringido para no autorizados (sin forzar logout por no autorizado).
- El detalle de UX en home, modulos deshabilitados y accion de cierre de sesion para no autorizados se sigue en la HU-038 para no mezclarlo con la expiracion de sesion de HU-023.
- P4: Opcion A
- P5: Opcion A
- P6: Opcion A
- P7: Opcion A

Resumen:
- Las siete areas candidatas quedan aceptadas para documentacion formal MVP y trazabilidad de implementacion.

## 8. Estado de propagacion

Propagacion completada el 2026-03-07:
- Requisitos actualizados con RF-APP-01..RF-APP-05 y RF-CAT-07..RF-CAT-08.
- Historias HU-021..HU-025 pasan de candidatas a alcance activo.
- Contratos Firestore actualizados con configuracion operativa por entorno para arranque/sync.
- Artefactos spec-driven creados para HU-021..HU-025 (EN) con markdown de issue e issues reales en GitHub.
