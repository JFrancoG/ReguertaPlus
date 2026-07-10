# [HU-064] Pulir cabeceras de Noticias y Comunidad y recuperar la imagen en iOS

## Summary

Mover en Android los títulos de Noticias y Comunidad debajo de la flecha de vuelta, y diagnosticar/corregir en iOS por qué no se muestra la imagen opcional de las noticias.

## Links
- GitHub Issue: #167
- URL: https://github.com/JFrancoG/ReguertaPlus/issues/167
- Pull Request: #168 https://github.com/JFrancoG/ReguertaPlus/pull/168
- Spec: spec/app/hu-064-news-community-ui-polish/spec.md
- Plan: spec/app/hu-064-news-community-ui-polish/plan.md
- Tasks: spec/app/hu-064-news-community-ui-polish/tasks.md

## Acceptance criteria

- En Noticias Android, la flecha ocupa la fila de navegación y el título localizado aparece en una fila inferior.
- En Comunidad Android, la flecha ocupa la fila de navegación y el título localizado aparece en una fila inferior.
- Las cabeceras de Dashboard y del resto de destinos Android conservan su disposición actual.
- La navegación de vuelta y su descripción de accesibilidad no cambian.
- En iOS, una noticia con una referencia de imagen persistida válida muestra la imagen tanto en Home como en la lista completa de Noticias.
- Una referencia ausente o no válida mantiene un comportamiento no bloqueante, sin afectar al texto de la noticia.
- No cambia el esquema de Firestore ni el contrato de subida de imágenes.

## Scope

### In Scope
- Cabecera Android de Noticias y Comunidad.
- Carga/presentación de imágenes de Noticias en iOS.
- Cobertura de regresión focalizada.
- Specs y mirror de issue bajo `spec/`.

### Out of Scope
- Rediseño general de tarjetas o perfiles.
- Cambios en publicación/edición de noticias.
- Cambios de backend, Storage o Firestore.

## Implementation checklist
- [x] Crear rama y artefactos HU/spec/plan/tasks.
- [x] Revisar la cabecera compartida Android y limitar el cambio a Noticias/Comunidad.
- [x] Trazar el valor `urlImage` de iOS desde persistencia hasta la carga remota.
- [x] Implementar los ajustes y añadir cobertura focalizada.
- [x] Ejecutar la validación relevante por plataforma.
- [x] Abrir PR #168 y enlazarla con esta issue.

## Suggested labels
- type:feature
- area:news
- area:profiles
- platform:cross
- priority:P2
