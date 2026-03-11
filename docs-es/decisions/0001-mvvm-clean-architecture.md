# ADR-0001: Usar MVVM + Clean Architecture en iOS y Android

## Status

Accepted

## Fecha

2026-02-05

## Contexto

Estamos construyendo iOS y Android en paralelo y queremos mantener alineada
la entrega y la estructura. Sin una base comun, la estructura y la nomenclatura
pueden divergir rapido, lo que dificulta la colaboracion entre plataformas.

## Decision

Adoptar MVVM para presentacion y Clean Architecture para la estructura global
en iOS y Android. Vamos a alinear nomenclatura de variables, funciones, carpetas,
modulos y estructura de features siempre que sea posible.

## Consecuencias

### Positivas

- Modelo mental consistente entre plataformas
- Facilita el desarrollo en paralelo y las revisiones cruzadas
- Separacion clara de responsabilidades (presentacion, dominio, datos)
- Mejor testabilidad y mantenibilidad

### Negativas

- Mas estructura y boilerplate al inicio
- Requiere disciplina para mantener la alineacion con el tiempo

## Notas

Las limitaciones especificas de cada plataforma pueden romper la alineacion
cuando sea necesario, pero el objetivo es mantener la paridad.
