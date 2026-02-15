# ADR-0002: Definir versiones minimas de plataforma

## Status

Accepted

## Fecha

2026-02-05

## Contexto

Necesitamos una base comun para features, disponibilidad de SDKs y alcance de
pruebas, manteniendo el desarrollo eficiente y un soporte razonable.

## Decision

- iOS minimo: iOS 26
- Android minimo: API 29 (Android 10)

## Consecuencias

### Positivas

- Acceso a APIs y tooling modernos
- Matriz de compatibilidad mas simple
- Menor costo de mantenimiento y QA

### Negativas

- Se excluyen dispositivos/OS mas antiguos
- Menor base de instalacion en Android antiguo
