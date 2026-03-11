# Arquitectura

Vamos a construir iOS y Android usando MVVM y Clean Architecture.

Objetivos:
- Mantener un modelo mental compartido entre plataformas.
- Alinear la nomenclatura de variables, funciones, carpetas y estructura de features cuando sea posible.
- Facilitar el desarrollo en paralelo con la menor friccion posible.

Estructura general:
- Presentacion: MVVM (Views/Composables -> ViewModel -> UI State)
- Dominio: casos de uso / reglas de negocio
- Datos: repositorios y data sources

Servicios de backend:
- Base de datos: Firebase Firestore
- Autenticacion: Firebase Authentication
- Almacenamiento: Firebase Storage
- Crash reporting: Firebase Crashlytics
- Notificaciones push: Firebase Cloud Messaging (FCM)

Las decisiones relacionadas estan en `../decisions`.
Los detalles del stack tecnico estan en `../tech-stack/README.md`.
