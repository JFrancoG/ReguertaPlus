# ADR-0016: Vincular la separación de repartos al historial ordinario

## Estado

Aceptado para la implementación local de HU-089 el 2026-10-11 por instrucción
del mantenedor de implementar las diez semanas y las excepciones por fuerza
mayor. Siguen pendientes la ratificación colectiva y la activación compartida.

## Contexto

La rotación continua fija el orden y las fechas publicadas. Las coberturas pueden
cambiar quién realiza el turno, y el reparto inmediatamente anterior no basta
para comprobar distancias con otras vueltas o temporadas. Consumir compensaciones
también puede acortar la separación entre posiciones de responsables ordinarios.

## Decisión

- Validar el plan ordinario generado frente a todas las posiciones de reparto
  publicadas y capturadas, usando propietario original, fecha y vuelta. Exigir
  70 días naturales entre posiciones de un mismo propietario en vueltas distintas
  cuando al menos una posición sea nueva. Ayudantes, mercado y coberturas
  extraordinarias no crean posiciones ordinarias; los descansos por compensación
  no tienen un reparto físico fechado. Conservar todo el prefijo ya publicado.
- Añadir una activación explícita e independiente `hu089-delivery-spacing-v1`
  en la fuente de planificación del emulador fijo registrado. Funciona con las
  compensaciones deshabilitadas. Las fuentes anteriores conservan su política.
- Mantener la cola, el algoritmo de compensación y el calendario. Rechazar un
  plan incompatible sin inventar aplazamientos ni cambiar el orden de los socios.
  Incluye los conflictos causados por la compresión de fechas al consumir una
  compensación. Una cola semanal pequeña puede necesitar varias excepciones
  concretas antes de poder planificarse.
- Usar el almacén administrativo de confianza para excepciones inmutables con
  motivo. Vincular cada autorización al socio, dos fechas/vueltas exactas,
  solicitud, administrador, hora de aprobación de confianza y autoridad vigente.
  Comprobar de nuevo el permiso del administrador al capturar y publicar. Repetir
  el mismo comando devuelve su recibo original; otro comando no puede sustituirlo.
  La excepción nunca anula la seguridad entre responsable y ayudante consecutivos.
  Autorizaciones y recibos son privados del backend en Rules estrictas y de
  compatibilidad.
- Incorporar el historial y las autorizaciones completos al snapshot de equidad
  y al digest del paquete. Publicar comprueba autoridad y fuente dentro de su
  transacción. Recuperar comprueba la fuente capturada, excluyendo solo las filas
  nuevas propias ya verificadas. Sigue comprobando el historial preexistente.
  Acotar a 1.000 filas de historial retenido y 250 autorizaciones por autoridad;
  la recuperación admite además sus propias filas verificadas dentro del límite
  existente de 500 escrituras. La evidencia excesiva o incompleta bloquea el proceso.

## Consecuencias

No se añade otro planificador ni motor de colas. Un turno ordinario cubierto sigue
en el historial del propietario, mientras el sustituto no obtiene una posición
ordinaria. Las autorizaciones no se reutilizan tras cambiar la autoridad vigente;
una nueva solicitud necesita nueva autorización. Los conflictos históricos ya
publicados no invalidan por sí solos el calendario existente.

Lo aplican el planificador ordinario y el flujo gobernado de paquete/publicación.
El ensayo aislado de unidades de compensación no publica planes estacionales y
mantiene su política anterior explícita. La interfaz administrativa nativa, la
composición real, la migración del historial anterior y la activación colectiva
siguen en la integración de HU-084. Este bloque no cambia el esquema de turnos
públicos ni la proyección nativa de coberturas.

Nota de integración: `planningRequestId` en el comando de excepción recibe el
`bundleId` estable compartido por preview/stage/activate, no el identificador de
la solicitud individual de cada fase. Aclara el contrato de identidad existente.

## Trabajo relacionado

- [ADR-0013](0013-modelar-turnos-como-rotaciones-continuas-con-proyecciones-estacionales.md)
- [ADR-0015](0015-registrar-ciclo-explicito-de-pertenencia-en-coberturas.md)
- [Especificación HU-089](../../spec/shifts/hu-089-coverage-policy-amendments/spec.md)
- Issues GitHub [#279](https://github.com/JFrancoG/ReguertaPlus/issues/279) y [#268](https://github.com/JFrancoG/ReguertaPlus/issues/268)


## Propuestas nativas de parejas exactas — 2026-10-26

Ambas apps Debug eligen una pareja calculada por el backend a partir de una
solicitud de vista previa persistida, conservando la identidad estable del lote.
Se reconstruye la fuente gobernada y se reutiliza el planificador de temporada
sin separación solo para diagnosticar conflictos; el cálculo puro de parejas se
comparte con la validación ordinaria. Nunca se guarda, prepara para publicación
ni publica ese diagnóstico. Se mantienen las compensaciones, la pertenencia y
las demás reglas. Se elige la última vista previa válida de cada lote, se rechazan
evidencias malformadas y se limitan las lecturas (20 vistas, 250 propuestas).
Si falta solicitud o fuente se muestra una lista vacía con motivo explícito.

La transacción de autorización vuelve a calcular la propuesta y comprueba la
pareja exacta y su contexto completo de fuente y solicitud. Las apps no permiten
escribir identidades, fechas, vueltas ni IDs de lote arbitrarios. Solo cambian el
registro privado y su recibo, con repetición vinculada al UID y permisos actuales.
La aprobación colectiva, la conexión real de fuentes y la activación siguen pendientes.
