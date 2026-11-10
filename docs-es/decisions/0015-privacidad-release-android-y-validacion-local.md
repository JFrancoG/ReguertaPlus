# ADR-0015: Privacidad de Release Android y validación local

## Estado

Aceptada para implementación local Android el 2026-11-10 mediante la aprobación
de HU-090 por el responsable. La implementación y su verificación siguen en
curso. Esta decisión no certifica pruebas superadas, cumplimiento de Play ni
preparación para publicar.

## Contexto

La app Android ReguertaPlus todavía no publicada usa Firebase Analytics sin
ofrecer publicidad. Sus dependencias pueden incorporar permisos publicitarios.
La optimización de Release estaba desactivada, mientras Debug selecciona otra
ruta, identidad de aplicación y comportamiento de IA local. Probar solo Debug
no permite establecer el comportamiento del código de producción optimizado.

La base seleccionada es main `7491ebae`, con la actualización de dependencias
`0cff11eb`: AGP 9.5.1 y el catálogo Android versionado. Las mediciones anteriores
de un árbol sucio son contexto, no una baseline reproducible. El propietario
aprobó conservar Analytics no publicitario y autorizó la implementación Android
y la validación local, sin publicación ni operaciones en producción.

## Decisión

1. Conservar estadísticas de uso y atribución de medición no publicitaria,
   Crashlytics y FCM. Retirar `AD_ID`, `ACCESS_ADSERVICES_AD_ID` y
   `ACCESS_ADSERVICES_ATTRIBUTION` de los artefactos finales y denegar
   explícitamente la recogida del identificador publicitario, los usos
   publicitarios de almacenamiento/datos y la personalización mediante los
   valores predeterminados admitidos por el SDK. Quitar permisos y desactivar
   personalización no constituye por sí solo toda la prueba. Inventariar los
   identificadores no publicitarios restantes, incluida la identidad de instancia
   e instalación Firebase; conservar Analytics no significa anonimato ni ausencia
   de recogida de datos.
2. Optimizar y ofuscar código y recursos de Release con el DSL moderno de AGP
   9.5.1, las reglas actuales de consumidor y solo reglas propias justificadas y
   concretas. Mantener Debug adecuado para desarrollo. La comparación sin
   optimización es un estado controlado de medición local, no la política de
   distribución. Sustituir la reflexión evitable en el límite Data en lugar de
   conservar paquetes enteros o desactivar globalmente la optimización.
3. Usar una aplicación `.validation` separada, no publicable y no depurable para
   recorridos locales representativos. Comparte dependencias, política de
   optimización y comportamiento solo PDF de Release; no hereda la ruta ML Kit
   de Debug. Revisar y registrar sus diferencias deliberadas respecto a Release.
   Preparar este entorno aislado antes de medir runtime y comparar la misma
   variante QA y los mismos ajustes de privacidad antes y después de R8.
4. Inicializar QA con el proyecto fijo `demo-reguerta-hu090` y emuladores locales
   de Auth, Firestore y Storage antes de acceder a los SDK de producto. Encaminar
   el contrato local de Functions únicamente al gateway fijo de fixtures ligado
   a la interfaz loopback del host, accesible como `10.0.2.2` desde el emulador.
   El gateway nunca reenvía peticiones a la nube. Sus respuestas sintéticas y
   Rules de fixtures no prueban la autorización real del backend, Functions ni
   las Rules de producción.
5. Restringir la red de QA con su propia ancla de confianza, sin fallback a las
   CA normales del sistema, acceso explícito en texto claro al host fijo del emulador y
   rechazo de combinaciones inválidas de proyecto/endpoint antes de obtener
   credenciales o abrir conexiones. Desactivar o sustituir localmente la
   telemetría runtime de QA, la inicialización automática de SDK y los envíos de
   fondo a la nube. Las pruebas negativas de salida deben verificar estos límites;
   un XML de seguridad de red no demuestra por sí solo que todo el tráfico esté
   contenido. Release conserva su ruta a producción y confianza predeterminadas,
   sin permitir que un override cliente sustituya la autorización del backend.
   La política implícita de localhost en Android 17 también permite texto claro
   al loopback del dispositivo; no alcanza servicios del host/nube y ningún
   endpoint QA configurado utiliza esa ruta.
6. Desactivar las subidas automáticas de mappings durante las compilaciones
   locales; conservar mappings exactos, metadatos R8 y hashes de artefactos para
   retrace local. Medir el AAB real con herramientas oficiales compatibles y
   exigir correspondencia de metadatos R8/DEX y los porcentajes de optimización
   aplicables. QA local y las comprobaciones de artefactos no sustituyen el
   canario posterior del AAB Release exacto archivado.

## Alternativas consideradas

- Se descarta retirar Analytics por completo porque la política de producto
  aprobada conserva la medición no publicitaria.
- Se descarta probar Debug o activar su comportamiento en QA porque cambia rutas
  y fuentes y no representa la ejecución de Release optimizada.
- Ejecutar ahora el artefacto de producción contra servicios reales queda fuera
  de la autorización. El canario del artefacto exacto sigue siendo un gate posterior.
- Se descartan reglas keep amplias o bypasses de optimización porque ocultan
  defectos de contratos dinámicos y debilitan el objetivo de optimización.

## Consecuencias y límites de verificación

Se reduce el acceso publicitario conservando servicios operativos útiles. La
variante QA, el gateway de fixtures y su política de red requieren mantenimiento;
superar QA no establece el comportamiento del binario de producción exacto ni
la entrega FCM real. Esta decisión de herramientas Android no implica cambios de
iOS ni de paridad funcional visible. Se mantienen el límite PDF de ADR-0006 y
la autoridad de registro de dispositivos viva de proceso de ADR-0009.

HU-090 contiene los criterios de aceptación y la evidencia actual: privacidad
del artefacto final, errores tipados, recorridos locales optimizados, mediciones
comparadas de rendimiento, ratios DEX aplicables con metadatos exactos, validación
de 16 KB y retrace correspondiente. Esta ADR no registra pruebas superadas.

Aquí no se autoriza despliegue Firebase, lectura/escritura en producción,
cambio de Console, subida de binarios/mappings ni operación real de push/canario.
El canario del artefacto exacto exige autorización posterior acotada y una cuenta
revisora existente dirigida por la política confiable del backend a develop
antes de escribir datos de negocio. Sin esa evidencia sigue pendiente el criterio
correspondiente de la HU; #228 conserva su gate independiente de distribución
sobre el almacén seguro.

## Trabajo relacionado y referencias

- [Plan y evidencia de HU-090](../../spec/app/hu-090-android-release-privacy-r8/plan.md)
- [HU-090 / issue #282](https://github.com/JFrancoG/ReguertaPlus/issues/282)
- [ADR-0006: estatutos locales y fallback PDF](0006-respuestas-estatutos-fundamentadas-en-dispositivo.md)
- [ADR-0009: autorización push viva de proceso](0009-exigir-autorizacion-push-viva-de-proceso.md)
- [Gate de distribución del almacén seguro #228](https://github.com/JFrancoG/ReguertaPlus/issues/228)
- [Controles de recogida de Firebase Analytics](https://firebase.google.com/docs/analytics/android/configure-data-collection)
- [Optimización Android con R8](https://developer.android.com/topic/performance/app-optimization/enable-app-optimization)
- [Configuración de seguridad de red Android](https://developer.android.com/privacy-and-security/security-config)
- [Analizador local oficial de artefactos](https://developer.android.com/tools/agents/android-cli/commands/analyze)
