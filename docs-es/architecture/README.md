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

## Politica de abstraccion de tipos Swift

En iOS se elige la abstraccion mas estrecha que conserve el contrato real:

- Usar un tipo concreto cuando la composicion fija una implementacion y ese limite no admite sustitucion.
- Usar un parametro generico o `some Protocol` cuando cada instancia tiene un unico tipo concreto conocido estaticamente.
- Usar `any Protocol` solo para sustitucion en runtime, almacenamiento heterogeneo o una frontera deliberadamente no generica.

No quitar solo la palabra `any` como limpieza. Un nombre de protocolo usado como tipo sigue siendo existencial en los modos del lenguaje que aun permiten la grafia implicita. En particular, se mantiene `any Error` cuando una frontera acepta deliberadamente errores heterogeneos; si el contrato esta cerrado, se usa un error concreto o `throws(ErrorConcreto)`.

En revisiones enfocadas se usa el diagnostico opt-in `ExistentialType` de Swift para inventariar el coste de los existenciales. Cada aviso se clasifica en vez de convertir el diagnostico en un gate de cero warnings, porque tambien senala fronteras validas de inyeccion y valores heterogeneos. Las reglas regex de SwiftLint no deben prohibir `any` globalmente: no pueden determinar si el borrado de tipo en runtime es necesario.

### Auditoria de existenciales

La auditoria opt-in se ejecuta desde la raiz del repositorio:

```bash
ios/Reguerta/scripts/audit-swift-existentials.sh
```

El modo `--diff`, usado por defecto, muestra solo los diagnosticos situados en lineas Swift modificadas desde el ancestro comun con `origin/main`. Se puede usar `--base <git-ref>` para elegir otra referencia de comparacion o `--all` para inventariar todos los diagnosticos del codigo del proyecto. El script compila la app y los targets de tests en un Derived Data temporal y aislado, permite los warnings y elimina despues ese directorio.

La auditoria es informativa: encontrar avisos termina correctamente para que cada existencial se clasifique segun su contrato. Los argumentos invalidos, los errores de Git o del informe y los fallos de compilacion terminan con error. Requiere Xcode y Python 3.

Servicios de backend:
- Base de datos: Firebase Firestore
- Autenticacion: Firebase Authentication
- Almacenamiento: Firebase Storage
- Crash reporting: Firebase Crashlytics
- Notificaciones push: Firebase Cloud Messaging (FCM)

Las decisiones relacionadas estan en `../decisions`.
Los detalles del stack tecnico estan en `../tech-stack/README.md`.
