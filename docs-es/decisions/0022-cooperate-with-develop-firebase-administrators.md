# ADR-0022: Acordar el mantenimiento de develop con los administradores de Firebase

## Estado

Aceptado como política el 2026-10-28 tras seleccionar expresamente el mantenedor
«Aceptar mantenimiento acordado de develop (recomendado)». Solo modifica la
exclusión técnica de la capacidad humana que conservan los administradores de
Firebase en develop. El contrato versionado, los participantes confirmados, los
controles técnicos y la admisión de cada fase real mantienen sus condiciones
separadas. Aceptar la política no certifica que las Rules estén aplicadas ni que
el cierre operativo esté completo.

## Contexto

El censo real de `reguerta-9f27f` encuentra 23 de las 24 Functions usando la misma
cuenta Compute, compartida por producción y el puente de develop. Esa cuenta
conserva Editor; otras identidades de servidor también pueden escribir Firestore.
Hay dos cuentas de usuario con el rol de propietario del proyecto. No se observaron
claves creadas por usuarios en las cuatro cuentas de servicio inspeccionadas, pero
los permisos del proyecto siguen permitiendo administración y suplantación.
La ausencia de archivos de claves no demuestra que exista un único escritor.

Las Rules de clientes no limitan el acceso privilegiado de servidor. Develop y
producción comparten la base predeterminada y quitar permisos globales a sus
servidores afectaría a producción. Los seis wrappers cierran los efectos elegidos
de develop sin desactivar los transportes compartidos de producción; no cierran
todas las capacidades administrativas.

ADR-0021 solo permite cooperación para la capacidad que conserva el propietario
de la hoja. Su excepción no autoriza implícitamente la administración de Firestore.

## Decisión aceptada

Solo para **develop**, permitir una ventana de mantenimiento acordada con todas
las personas identificadas que conserven acceso administrativo directo, capacidad
de escritura o de ejecutar acciones con cuentas de servicio. Se comprometen a no
editar datos manualmente, publicar Rules, desplegar código, cambiar permisos ni
iniciar scripts u otros procesos durante la ventana, salvo las acciones operativas
concretas autorizadas por separado. El acuerdo identifica participantes,
proyecto/base/entorno, comandos permitidos, huellas de datos/controles y plazo.
Si queda un participante administrativo sin identificar o confirmar, no se admite
el mantenimiento.
ADR-0021 sigue regulando la excepción separada del propietario identificado de
la hoja; esta política distinta para administradores de Firebase no cubre el uso
automático de credenciales ni cambia la administración de Firestore en producción.

Esta excepción cubre la **capacidad humana conservada**, no el uso automático de
sus credenciales. Los puntos de entrada automáticos, servicios, escrituras de
clientes, colas, invocaciones anteriores y envíos externos sin resolver siguen
necesitando controles técnicos reales y conciliación. Los avisos históricos que
pudieron enviarse permanecen expresamente sin reproducción. Un periodo tranquilo
o la ausencia de solicitudes actuales no demuestra vaciado ni borra `legacyUntracked`.

El modo debe figurar expresamente en una nueva versión del contrato de
mantenimiento, conservando los contratos estrictos y de propietario actuales.
No se declara bloqueada técnicamente la capacidad IAM residual ni se convierte
un censo en una prueba de cierre. Se reutilizan comandos/CAS, lecturas de controles,
incidentes y recuperación existentes. Si falta evidencia, alguien actúa, retira
su acuerdo, vence el plazo o cambian los permisos, se detiene el avance y se
conserva el cierre afectado; no hay reapertura automática.

La administración de Firestore en producción conserva sus requisitos actuales.
Extender esta política a producción requiere otra decisión y autorización real.

## Alternativas y consecuencias

Mantener la exclusión técnica absoluta exige revisar un diseño de aislamiento,
incluida la separación de develop y producción y cómo pierden acceso las
credenciales antiguas y las operaciones en curso. Usar otra cuenta de servicio
no basta mientras las identidades originales conserven acceso.

La política aceptada evita quitar permisos compartidos necesarios para producción, pero
acepta que un administrador pueda incumplir el acuerdo o hacer un cambio transitorio
no detectado. No autoriza una migración ni elimina las demás condiciones de
activación. La implementación y cada ventana real mantienen sus autorizaciones
separadas.

## Punto de implementación

El esquema v3 explícito incorpora este acuerdo a los controles de admisión y
Sheets existentes; el v1 estricto y el v2 de propietario no cambian. Las
confirmaciones humanas identificadas quedan vinculadas a fuentes, IAM efectivo,
controles técnicos, operaciones y ventana exactos. El lector de observaciones se
aporta explícitamente y se vuelve a comprobar alrededor de los efectos regulados.
Las observaciones rechazadas quedan vinculadas al recibo de incidente existente.
Este contrato local no equivale a un acuerdo real firmado, un adaptador de
autoridad del proveedor, la admisión de una migración ni autorización de producción.

Consulta la [guía de pausa selectiva](../testing/hu084-pausa-selectiva-develop.md)
para el bloque implementado y su límite de aceptación.

## Referencias

- [ADR-0021](0021-usar-mantenimiento-acordado-con-el-propietario-en-hojas-de-turnos.md)
- [HU-085](../../spec/shifts/hu-085-production-shift-workbook-activation/spec.md)
- [Acceso de servidor y Rules](https://firebase.google.com/docs/firestore/security/rules-conditions)
- [IAM de Firestore](https://firebase.google.com/docs/firestore/security/iam)
