# Migration Backlog

Trabajo priorizado para pasar del estado actual a un design-system cross-platform mas limpio.

## P0 (Ahora)

- [x] Definir diccionario canonico de tokens semanticos para color/tipo/spacing/radius.
- [x] Publicar tabla de mapping cross-platform (legacy -> canonico).
- Mantener source snapshots trazables y actualizados.

## P1 (Siguiente)

- [x] Normalizar variantes y naming de botones entre Android/iOS.
- [x] Normalizar modelo de estado de inputs (`error`, `focus`, `disabled`, helper text).
- Normalizar API de dialogs y modelo de acciones.
- Retirar o aislar elementos explicitamente deprecated/sin uso.

## P2 (Cuando entre Auth/Onboarding UI)

- [x] Construir splash/welcome/auth solo con primitivas stable/candidate del design-system.
- Validar responsive en dispositivos compactos y grandes.
- Anadir pantalla catalogo/sandbox para regresion visual.

## P3 (Continuo)

- Introducir checks visuales automatizados donde sea viable.
- Podar aliases deprecated periodicamente y actualizar docs.
