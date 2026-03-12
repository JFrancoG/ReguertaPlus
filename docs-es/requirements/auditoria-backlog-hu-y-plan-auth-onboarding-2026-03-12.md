# Auditoria de Backlog + Plan Auth/Onboarding/i18n (2026-03-12)

## 1. Resumen de auditoria (HU-001..HU-025)

Revision realizada contra issues de GitHub y artefactos spec locales.

Hallazgos:

- `25/25` issues HU abiertas referencian `common/spec/...` en el body de GitHub.
- La fuente de verdad del repo ya usa rutas `spec/...`.
- Las plantillas locales en `spec/issues/*.md` ya estan alineadas a `spec/...`.

Impacto:

- Riesgo alto de confusion en implementacion y review.
- Trazabilidad rota issue -> spec/plan/tasks.

Recomendacion:

- Mantener las issues HU existentes y su numeracion.
- Actualizar bodies en lote desde `spec/issues/*.md` (sin borrar/recrear).

## 2. Por que mantener las issues actuales (en vez de recrearlas)

- Conserva links, comentarios e historico.
- Evita renumerar dependencias.
- Permite limpieza rapida con bajo riesgo.

## 3. Nuevo bloque recomendado (Auth + Onboarding + i18n)

Las HUs actuales no cubren esto como flujo dedicado modernizado.

Crear un bloque nuevo (nuevos IDs HU tras confirmar politica de numeracion), con esta particion:

1. App-shell de auth y estados de navegacion.
2. Splash (contrato de animacion cross-platform).
3. Pantalla de bienvenida.
4. Login.
5. Registro.
6. Recuperar contrasena.
7. Input compartido v2 + mapeo de errores auth.
8. Base de localizacion (EN/ES) + comportamiento de selector de idioma.

## 4. Baseline UI derivado de capturas

Pantallas revisadas:

- Splash
- Bienvenida
- Login (vacio, valido, invalido)
- Registro (vacio, valido, mismatch)
- Recuperar contrasena (vacio, valido, invalido)

Baseline detectado:

- Paleta verde suave con consistencia de marca.
- Patron de formulario con input subrayado, error inline bajo campo, e icono de accion a la derecha.
- Estado disabled de boton primario claramente diferenciado.
- Tipografia con cabeceras decorativas y texto de entrada/cuerpo mas simple.

## 5. Decisiones UX cross-platform (recomendadas)

Paridad de navegacion:

- Usar un flujo de stack simple en ambas plataformas.
- Eliminar comportamiento iOS-only con sheets para auth.
- Mantener estilo nativo por plataforma (SwiftUI vs Material), con el mismo flujo y estados.

Flujo de rutas propuesto:

- `Splash -> Bienvenida -> Login`
- `Login -> Registro`
- `Login -> Recuperar contrasena`
- Tras auth correcta: `Home`

## 6. Contrato de animacion Splash (cross-platform y facil)

Sustituir animacion iOS-only por un contrato comun:

- Logo inicia algo pequeno y semitransparente.
- Escalado + leve rotacion + fade out simultaneos.
- Duracion total aprox `1200-1800ms` mas handoff de navegacion.

Facil de implementar en:

- SwiftUI (`scaleEffect`, `rotationEffect`, `opacity`, transicion temporizada)
- Compose (`animateFloatAsState`/`Animatable`, `graphicsLayer`)

## 7. Contrato de Input v2

Comportamiento compartido:

- Label + campo + icono de accion derecho.
- Estados: `default`, `focused`, `error`, `disabled`.
- Error inline por campo.
- Icono de limpiar opcional.
- Toggle de ver/ocultar password opcional.
- Timing de validacion: tras interaccion (`touched`) y en submit.

Uso en auth:

- Login: email, password.
- Registro: email, password, repetir password.
- Recuperar: email.

## 8. Mapeo de errores Firebase Auth (campo/global)

Introducir capa de mapeo determinista en ambas plataformas:

Ejemplos por campo:

- `invalid-email` -> error en email.
- `weak-password` -> error en password.
- mismatch passwords (cliente) -> error en repetir password.

Ejemplos globales:

- `invalid-credential`, `wrong-password`, `user-not-found` -> mensaje generico de auth fallida.
- `email-already-in-use` -> cuenta ya existente.
- `too-many-requests` -> bloqueo temporal.
- `network-request-failed` -> aviso de conectividad.

No mostrar texto raw de Firebase directamente en UI.

## 9. Plan de localizacion (EN/ES)

Reglas base:

- Ingles como fallback por defecto.
- Espanol totalmente soportado.
- Cero strings hardcodeados en vistas.

Implementacion por plataforma:

- Android: `values/strings.xml` + `values-es/strings.xml`.
- iOS: `Localizable.xcstrings` con `en` y `es`.

Comportamiento de producto:

- Idioma por defecto = idioma del sistema.
- Override opcional en app guardado en local.
- Cadena fallback: override usuario -> sistema -> ingles.

## 10. Notas iPad/Tablet y responsive

- Mantener estrategia responsive actual como puente (`resize` y equivalentes).
- Definir breakpoints y max-width para formularios.
- Evitar formularios excesivamente anchos en pantallas grandes.

## 11. Siguientes pasos inmediatos

1. Sincronizar en lote los bodies de issues GitHub (`#1..#25`) con `spec/issues/*.md`.
2. Publicar bloque nuevo de issues auth/onboarding/i18n con la particion de la seccion 3.
3. Convertir capturas en criterios de aceptacion y claves de texto.
4. Empezar implementacion por orden de foundations:
   base i18n -> auth shell/navegacion -> input v2 -> splash/bienvenida -> pantallas auth.
