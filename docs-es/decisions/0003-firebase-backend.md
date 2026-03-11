# ADR-0003: Usar Firebase como backend

## Status

Accepted

## Fecha

2026-02-05

## Contexto

Necesitamos un backend rapido de implementar, de bajo mantenimiento y que
encaje con un producto mobile-first. Tambien queremos una capa gratuita
razonable mientras validamos el producto y escalamos gradualmente.

## Decision

Usar Firebase como plataforma de backend, especificamente:
- Base de datos: Firestore
- Autenticacion: Firebase Authentication
- Almacenamiento: Firebase Storage
- Crash reporting: Firebase Crashlytics
- Notificaciones push: Firebase Cloud Messaging (FCM)

## Rationale

Firebase ofrece un backend gestionado y simple, con una capa gratuita fuerte y
servicios cohesionados que reducen el overhead operativo y aceleran la
iteracion.

## Consecuencias

### Positivas

- Desarrollo rapido e infraestructura mas simple
- Menor carga de DevOps
- Servicios integrados para auth, storage, crash reporting y notificaciones

### Negativas

- Consideraciones de vendor lock-in
- Menos flexibilidad que un backend propio para requisitos complejos
