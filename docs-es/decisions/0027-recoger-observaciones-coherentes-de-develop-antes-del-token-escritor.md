# ADR-0027: Recoger observaciones coherentes de develop antes de emitir el token escritor

## Estado

Aceptado para preparación y ensayo local — 2026-11-02. El mantenedor ha pedido
preparar otro intento de develop y ofrece 20 o 30 minutos de disponibilidad.
Esta decisión prepara una variante explícita de **20 minutos**. No autoriza su
ejecución real, credenciales, permisos IAM/Drive, migración, despliegue ni producción.
No se reutiliza la autorización del intento único ya consumido.

## Contexto

El segundo intento se detuvo antes de conceder edición porque el arranque devolvió
el control sin atender la acción pendiente del navegador. La interfaz privada
atendida corrige ese arranque concreto. Al revisar el presupuesto completo apareció
otro problema de composición: los puertos técnico, del propietario y de los
administradores recogían por separado toda la misma evidencia de Google/hoja/censo
y pedían otro informe humano. Adquisición, admisión y ejecución exigían por ello
22 observaciones completas después de emitir un token de 300 segundos, dentro de
150 segundos de trabajo. Las pruebas aisladas no acreditaban que esa secuencia real
fuera viable.

Ampliar la disponibilidad sin cambiar esa secuencia no lo resuelve. Se conservan el
planificador, la barrera, el CAS de fuentes y los contratos de órdenes, recibos y
recuperación. No se añade otro flujo, worker, diario, proveedor ni entrada real.

## Decisión

1. Añadir un puerto cooperativo v3 opcional y explícito. Cada fase devuelve junta
   una observación completa nueva y sus proyecciones de propietario/administradores.
   Se validan el checkpoint y ambas proyecciones con los controles de dominio
   existentes. Los informes humanos deben haberse observado dentro de esa fase,
   no en otra fase u operación. Se cierra la sesión de observación antes de volver.
   Después del callback se obtiene otra observación completa nueva. El fallo de un
   puerto conjunto configurado no recurre a las lecturas antiguas. Los llamadores
   estrictos v1, de propietario v2 y v3 sin adaptar conservan su comportamiento.
2. Para una barrera ya retenida, leer su checkpoint inmutable por separado de la
   observación actual. La adquisición real sigue recogiendo y reteniendo el cierre;
   la ejecución retenida sigue comprobando todas las evidencias antes y después del
   callback. La evidencia histórica sola no admite una operación actual. No hay una
   caché por tiempo que abarque operaciones.
3. Vincular `original-develop-deferred-writer-v1` a la petición de ejecución revisada.
   Solo esa variante explícita de la hoja original de develop admite hasta 20 minutos.
   Los límites actuales de diez minutos de copias y del modo por defecto se conservan.
   La preparación adquiere la barrera cerrada y materializa la admisión antes de
   emitir el token. Esos pasos mantienen su persistencia/incidentes y no ejecutan
   la migración.
4. Emitir como máximo un token escritor de 300 segundos después de preparar,
   comprobar IAM y releer identidad/aislamiento/hoja/sello actuales. La espera mínima
   de propagación IAM de 120 segundos queda en preparación. El recogedor inicial
   conserva su reserva de 30 segundos antes del plazo final de preparación.
5. Mantener 150 segundos de trabajo, 60 de limpieza de archivo, 90 de IAM y 120 de
   OAuth. Mantener la vigencia del manifiesto en 60 segundos y la de evidencias en
   diez minutos; ampliar la ventana del operador no las prolonga. Una emisión,
   lectura o respuesta humana lenta puede seguir rechazándose antes de mutar o
   dejar un resultado incierto retenido. Inspeccionar y limpiar por separado; nunca
   repetir, invertir ni reabrir automáticamente.

6. Tratar por separado la observación final posterior a un commit propio de avance
   y la prueba congelada de admisión. Pasar el recibo real del callback a esa fase y
   releer por una vía independiente las imágenes comprometidas retenidas. Exigir
   identidad exacta de operación/preparación, contenidos/versiones de servicio
   esperados, ausencia de documentos adicionales y filas ajenas del censo intactas.
   Conservar el digest de fuentes actuales separado del digest causal histórico.
   No inventar una observación sin cambios después de una mutación legítima.
   La historia anterior sigue siendo inmutable; cada core nuevo observado debe
   coincidir con la imagen exacta de creación/borrado propia y sus versiones.
   Los cores ajenos o alterados rechazan; los eventos aún no entregados siguen
   desconocidos y sin reejecutarse. Esta prueba solo sirve para el avance y no
   concede inversa, repetición ni admisión nueva.

## Consecuencias y límite de validación

La secuencia completa prevista tiene tres observaciones en adquisición, tres en
admisión y dos en ejecución; el token se emite después de las seis primeras.
Es un objetivo de composición que debe verificarse con la barrera, el ejecutor y el
SDK locales reales, no una garantía sobre la latencia de Google o de las respuestas
humanas. No se introduce una variante de 30 minutos ni un token más duradero.

Ensayar observaciones nuevas antes/después, actividad/retirada/cambios, sustitución
de ámbito/checkpoint, informes antiguos/reutilizados, manifiesto vencido tras emisión
lenta, fallo de preparación sin token, escrituras inciertas, interrupción y limpieza
independiente. Medir el recorrido local completo con retrasos de proveedor/personas
expresamente simulados. Antes de ejecutar se renuevan autoridad/hoja/fuentes reales y
se autoriza por separado la operación/ventana concreta. Android/iOS y producción no
cambian; la ratificación colectiva y la activación de HU-085 son hitos independientes.

Decisiones relacionadas: [ADR-0021](0021-usar-mantenimiento-acordado-con-el-propietario-en-hojas-de-turnos.md),
[ADR-0022](0022-cooperate-with-develop-firebase-administrators.md),
[ADR-0026](0026-accept-bounded-develop-historical-effect-risk.md).
