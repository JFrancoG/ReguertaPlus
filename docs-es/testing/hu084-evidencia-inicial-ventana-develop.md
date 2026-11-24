# HU-084 — Evidencia inicial y propuesta de ventana de develop

## Migración de Develop verificada el 20 de noviembre de 2026

La continuación autorizada envió un único lote de Sheets para `request-hu084-initial-73d77a7da377753f11f9`. A las 23:23:32 de Madrid, la cuenta propietaria verificó las 53 celdas proyectadas, los dos marcadores de la operación y la conservación del resto del libro. Tres inspecciones de solo lectura en Firestore verificaron los 203 destinos de la migración que dejó 72 turnos de temporada. La continuación realizó cero escrituras en Firestore.

La retirada del acceso temporal terminó a las 23:24:18 de Madrid. Drive denegó al escritor el acceso al archivo (404), IAM confirmó que estaba deshabilitado y aislado, y Drive y Sheets rechazaron la credencial de lectura revocada (401 en ambos). El registro final confirmó la proyección y el cierre de permisos. Las evidencias privadas son `2026-11-20-sheets-continuation15/resultado-develop.md` y `2026-11-20-sheets-continuation15/journal/access-Iy3G5G/events.jsonl`.

El mantenedor revisó las etiquetas de la oferta en iOS y Android el 21 de noviembre. El orden de las altas (D01) ya está corregido en local. El sorteo verificable (D09) pasó el ensayo local con una ronda pública firmada. La integración de créditos y espaciado del planificador se comprobó en local. La proyección de la cobertura completada en Sheets y su aviso al socio ya tienen evidencia local. La candidata ya incorpora main. Siguen pendientes en el proyecto compartido las Rules, las Functions, el permiso del escritor y la inicialización de coberturas. [Admisión de Develop el 24 de noviembre](../../spec/shifts/hu-084-stable-shift-coverage-and-credits/review.md#integrated-candidate-and-develop-admission-on-24-november-2026). [Decisión de entrega](../decisions/0019-coordinar-proyecciones-y-notificaciones-de-coberturas.md#entrega-de-la-cobertura-completada-el-21-de-noviembre-de-2026). [Prueba del planificador](../../spec/shifts/hu-084-stable-shift-coverage-and-credits/review.md#credit-publication-and-delivery-spacing-on-21-november-2026). El repaso conjunto de UI y UX queda para el final de la implementación, antes de publicar. Cuando la candidata cumpla los requisitos de integración y acceso, quedarán los dos recorridos con sesión normal en Develop, mercado y reparto. Los cuatro escenarios de producción corresponden a la activación del calendario base y requieren su propia autorización. [Trabajo pendiente y criterios de aceptación](../../spec/shifts/hu-084-stable-shift-coverage-and-credits/plan.md#remaining-work-as-of-2026-11-20)

## Continuación local de Sheets para la operación existente

La continuación vincula las 55 instrucciones originales a la operación `request-hu084-initial-73d77a7da377753f11f9`. Lee el recibo de Firestore, el punto de control de la barrera y los 203 destinos ya confirmados. El operador se reserva en el diario local el derecho a realizar un único envío antes de pedir el permiso temporal. Tras la concesión vuelve a verificar el libro, reserva tiempo para comprobar el resultado y retirar los accesos, y registra la intención antes de enviar el lote. Conserva la primera fase fallida, el motivo depurado y la hora. [Continuación](../../functions/scripts/develop-sheets-continuation.cjs) · [Lectura de Firestore](../../functions/scripts/develop-sheets-continuation-firestore.cjs)

| Escenario local | Resultado comprobado |
| --- | --- |
| Hoja original y ambos marcadores ausentes | Se envía un solo lote con 53 actualizaciones de celdas y los dos marcadores originales. La lectura final verifica la proyección y la conservación del libro. |
| Proyección ya aplicada y ambos marcadores presentes | Se verifica el libro sin solicitar una escritura. |
| Proyección parcial, marcador ajeno, cambio en otra celda, discrepancia en Firestore o autorización caducada | El operador se detiene antes del envío. |
| Respuesta perdida o ausencia de cambios tras enviar | La intención conservada permite inspeccionar el resultado. Una segunda invocación no puede reenviar el lote. |

Pasaron los cuatro escenarios en una hoja simulada con un diario local antes de la continuación real en Develop. [Pruebas focalizadas](../../functions/test/develop-sheets-continuation.test.cjs) · [Composición de la ejecución](../../functions/scripts/develop-sheets-continuation-operator.cjs)

## Intento 15 cerrado con Firestore verificado y Sheets pendiente — 2026-11-20

El mantenedor autorizó un único intento para `request-hu084-initial-73d77a7da377753f11f9` y confirmó su inicio a las 22:39 de Madrid. Se registraron las once respuestas. A las 22:47 el operador cerró con `inspection-required` en la fase de Sheets. La autorización del intento 15 quedó consumida.

| Destino | Resultado verificado |
| --- | --- |
| Firestore | El recibo de la transacción y una lectura independiente confirmaron los 203 destinos y sus versiones. Se crearon los 141 documentos previstos y se retiraron los 62 turnos originales tras archivarlos. Develop contiene 72 turnos de temporada y conserva los mismos 117 avisos. |
| Sheets | El diario registra cero envíos del lote. Las seis pestañas conservan los 742 valores y fórmulas de la captura anterior. Las 53 celdas previstas conservan el valor original. Las dos imágenes completas del libro leídas por la propietaria después de la transacción carecen de los dos marcadores de esta operación. |
| Permisos y cierre | Drive volvió al acceso restringido con la propietaria y cuatro lectores. La cuenta de escritura quedó deshabilitada, aislada y sin permisos IAM directos ni claves administradas por el usuario. La revocación del lector temporal se verificó con 401 en Drive y Sheets. Se cerraron los proveedores y el diario con 85 registros. El punto de control de la barrera sigue conservado en Firestore. |

La inspección secundaria de Sheets registró `read_back_mismatch` al comprobar la proyección. El operador omitió la excepción inicial de Sheets. Al publicarse el recibo de Firestore quedaban como máximo 6,049 segundos para presentar el lote conservando la reserva para la lectura posterior. En local, una demora simulada hasta el límite produjo el mismo resultado secundario. El diario permite distinguir el resultado de los datos, pero no determinar si se agotó ese margen en la ejecución real. La reproducción está en `2026-11-20-post15-diagnosis/forensic-receipt-private.json`.

[Continuación implementada y cuatro escenarios](#continuación-local-de-sheets-para-la-operación-existente).

Los recibos privados están en `2026-11-20-interactive15-postflight/observation-vDPE5y/postflight-private.json`, `connected-reader-cells.json` y `visible-drive-permissions.json`. El registro de la ejecución está en `2026-11-20-interactive15-preparation/run-result-private.json`.

## Paquete 15 preparado para autorización — 2026-11-20

La entrada de escritorio usada para la migración reconstruyó el paquete 15 en una sesión limpia a las 20:32 de Madrid. Verificó 345 archivos y obtuvo la huella `78be41628977a97124822c4631dc8ccb92ad3316efa5a10ba20e4a02c9f5996a` para la operación `request-hu084-initial-73d77a7da377753f11f9`. El sello de arranque es `e58ab426baff2816ac483df0d6ae1cf50963e93399e1673cd37f7c2ccb0f66e4`. La entrada corregida también se probó en dos procesos independientes: ambos se detuvieron al faltar la autorización, antes de abrir Google. Esta preparación precedió a la autorización del intento 15.

La cuenta propietaria confirmó la versión 307 del libro y coincidieron la imagen completa y los permisos con la revisión anterior. Tras revocar el acceso de lectura, Drive y Sheets devolvieron 401. Firestore conserva los 62 turnos originales y los 117 avisos. Dos transacciones de solo lectura confirmaron que las cuatro claves de la operación están libres. La cuenta de escritura sigue deshabilitada. Se revisaron los recibos de los intentos previos, incluido el cierre del 14 antes de crear su diario.

La decisión cubre un único intento en Develop con permisos temporales de Drive e IAM. Contempla 203 escrituras en Firestore, incluido el archivo de los 62 turnos originales y la creación de 72 turnos de temporada. Sheets recibiría un lote de 53 actualizaciones de celdas y dos marcadores. Pueden aparecer efectos tardíos de operaciones anteriores. El mantenedor autorizó posteriormente el intento, aceptó el riesgo y confirmó el inicio. La cuenta dedicada puede dejar la hoja tal como está.

La ficha privada es `2026-11-20-interactive15-preparation/paquete-para-revisar.md`. En `2026-11-20-interactive15-desktop-session`, los recibos `actual-desktop-offline-review.json` y `review-before-consent.json` acreditan la reconstrucción en el escritorio y el bloqueo antes del consentimiento.

## Intento 14 cerrado antes del diario de ejecución — 2026-11-20

El mantenedor autorizó un único avance, aceptó el riesgo histórico y confirmó el inicio. A las 20:15:56.750 de Madrid se fechó la ventana. El arranque local se interrumpió al preparar el operador. El lector inició la revocación unos 91 ms después. No se creó diario, bloqueo ni recibo de ejecución. La autorización de este intento queda consumida.

La entrada de escritorio ocultó la excepción original al cerrar la sesión. Un diagnóstico local en el mismo proceso reprodujo la aserción `unreviewed backend transition` en `historicalIamPreparation`. El proceso conservaba el módulo de compatibilidad anterior al paquete 14. El sello verificaba los archivos del disco, mientras Node seguía ejecutando el módulo que ya tenía en memoria. Con los mismos archivos fechados, un proceso nuevo reconstruyó el paquete en local. Recibo privado `2026-11-20-interactive14-postflight/desktop-offline-diagnosis.json`, SHA-256 `8d028638b0682f14f723ef6593f8a014b872004cb44d0119273e7b5225953746`.

A las 20:18:17, tres transacciones y 47 peticiones de solo lectura verificaron los 203 destinos. Los 141 documentos previstos para creación seguían ausentes y los 62 turnos previstos para eliminación conservaban contenido y versiones. Coincidieron el censo de 14 colecciones y los 117 avisos. La cuenta escritora estaba deshabilitada y aislada. El lector obtuvo 200 al revocar y después 401 al consultar Drive y Sheets. El panel de Drive mostró acceso restringido con la propietaria y cuatro lectores, sin la cuenta escritora. El operador se detuvo antes de enviar el lote a Sheets. A las 20:22, una conexión de lectura ya autorizada comparó las seis pestañas con la captura de la versión 307. Coincidieron los 742 valores y fórmulas, las notas, los tramos de texto con formato y las validaciones. Esta lectura cubre esos campos. Los formatos completos, las combinaciones de celdas, los marcadores y el número de versión actual quedan fuera de esa comparación. Recibos privados `observation-NhdMvK/postflight-private.json` (SHA-256 `18b79090ad114638b2dc00f719c59ca9bc74b4f686f6e8d1b33c1bbb44e0517c`), `visible-drive-permissions.json` y `connected-reader-cells.json` en el mismo directorio de cierre.

**Corrección comprobada en el escritorio.** Antes de solicitar acceso a Google, el operador comprueba que la sesión está limpia y reconstruye el paquete revisado. A las 20:22 la sesión que había fallado rechazó el código antiguo. Tras reiniciar el escritorio, los mismos archivos produjeron la huella exacta del paquete 14 y se verificaron las 343 fuentes. Ambas comprobaciones fueron locales. La entrada de arranque del sucesor conserva la primera causa clasificada, su fase y su hora antes de retirar el acceso, incluso si falla el cierre. Pasaron seis pruebas focalizadas del operador, además del lint y la compilación de Functions. Recibos privados `actual-desktop-cached-rejection.json`, `actual-desktop-fresh-rebuild.json` y `2026-11-20-post14-start-correction/offline-receipt.json`.

**Decisión al cerrar el intento 14.** Preparar el paquete 15 con la entrada corregida y las lecturas vigentes. La plantilla y sus pasos están en el directorio privado `2026-11-20-post14-start-correction/uso-del-cargador.md`. El recibo `outer-entry-verification.json` acredita que la entrada habitual comprueba el cargador y los módulos y rechaza el paquete 14 ya consumido antes del consentimiento. La ejecución compartida requiere autorización para el nuevo paquete. La migración se da por terminada cuando se verifican los turnos y asignaciones en Firestore y Sheets y se retiran los permisos temporales.

## Paquete 14 listo para autorización — 2026-11-20

El nuevo paquete está sellado para un único avance en Develop. Durante la preparación se leyó dos veces el libro de la cuenta propietaria. La versión pasó de 305 a 307 y se conservaron las celdas, los formatos revisados y los permisos. Google revocó el acceso temporal de lectura con HTTP 200. Drive y Sheets devolvieron después 401.

El censo de 14 colecciones conserva los 62 turnos y los 117 avisos con sus versiones. Las 24 funciones, los tres trabajos pausados, los seis índices disponibles y los permisos efectivos revisados coinciden con la referencia. Dos transacciones de solo lectura comprobaron la fuente y las cuatro claves vacantes del paquete. Se conservaron las barreras de los intentos 10, 12 y 13 y el incidente del 13.

La operación es `request-hu084-initial-d8f6a77838fe221677f4`. El paquete lleva la huella `87bc33104403a84461b354380ee13e2f2226438565530d284a22361d1e8eb0fe` y el sello de arranque `90d7a33d4eac164b00ae5c09d9bbb77d05de2b282fd5bf346ef0b2e8ac6e8219`. La revisión independiente comprobó las 23 fuentes con posibles efectos históricos y 25 recibos. En un proceso nuevo se comprobó que el operador se detiene a falta de autorización y que la entrada de escritorio se detiene antes de leer la configuración OAuth o abrir Google.

**Seguimiento.** El mantenedor autorizó el avance de 203 escrituras en Firestore y un lote de Sheets de 53 actualizaciones de celdas y dos marcadores. La sesión se detuvo durante el arranque local. [Cierre del intento 14](#intento-14-cerrado-antes-del-diario-de-ejecución--2026-11-20).

Los archivos privados para esta decisión son `2026-11-20-interactive14-preparation/paquete-para-revisar.md`, `2026-11-20-attempt14-offline-review/sealed-startup-denial-private.json` y `2026-11-20-interactive14-desktop-session/review-before-consent.json`.

## Ensayo local tras el intento 13

La corrección del operador de Develop se ensayó con el SDK y el emulador de Firestore. Las respuestas humanas, el reloj, Google y Sheets se simularon. Tras 61 segundos de espera para la observación previa a la escritura, el operador volvió a comprobar los datos y las versiones contra la admisión, generó el manifiesto de ejecución y verificó los 203 cambios en Firestore. Sheets recibió un único lote simulado de 53 actualizaciones de celdas y dos marcadores. [Decisión de ejecución](../decisions/0028-materializar-escrituras-de-develop-tras-la-observacion-humana.md)

Con el reloj controlado, la transacción pudo escribir a los 60.000 ms del manifiesto de ejecución. A los 60.001 ms se detuvo. Un cambio externo de la fuente antes de materializar el manifiesto o entre su registro y la escritura también detuvo ambos destinos. En estos rechazos los 141 documentos previstos para creación seguían ausentes y los 62 previstos para eliminación conservaban su versión. El operador ya conserva la primera categoría de error de Firestore, su fase y su hora aunque el cierre del incidente encuentre otro fallo.

También se comprobó la autorización del contenido. Al cambiar un turno del manifiesto admitido y recalcular todas sus huellas, la reconstrucción desde los datos originales detectó la discrepancia antes de emitir el manifiesto de ejecución. Pasaron las siete comprobaciones integradas, con cero omisiones, además de lint y compilación de Functions. El recibo privado del ensayo es `2026-11-20-attempt13-local-manifest-order/final-receipt.json`, SHA-256 `dba1aca5ea9221ae78dd68d9b26f6879102c9c26fe22b2e7e3adb79dc4573289`. Se comprobó la compatibilidad de los recibos anteriores reconstruyendo las 285 huellas del backend. Las únicas diferencias dentro de ese conjunto son el adaptador de barrera y su JavaScript compilado. El fichero `source-candidate-v2.json` identifica las 343 fuentes del operador final, incluidas las siete diferencias respecto al paquete 13. Las 103 dependencias cargadas en un arranque local tienen su huella verificada.

El ensayo con demoras de respuesta de 33,886 y 18,245 segundos dejó 90,359 segundos en la fase de trabajo al enviar a Sheets, 15,359 por encima de la reserva. La segunda demora procede de la respuesta al incidente del intento 13. La latencia posterior a una migración compartida sigue pendiente de medición. La ventana de ejecución de esta variante es de 20 minutos.

**Seguimiento.** El paquete 14 incorporó esta corrección. La decisión y el resultado constan en el cierre del intento 14. [Preparación del paquete 14](#paquete-14-listo-para-autorización--2026-11-20). La cuenta de pruebas tiene el libro a disposición del operador y nunca lo usa manualmente, según el mantenedor. La persona que atiende la ventana puede responder sobre la actividad que conoce desde el chat sin abrir ni cerrar la hoja. El operador comprueba la hoja y los permisos con los recibos de la ejecución.

## Intento 13 cerrado en Firestore — 2026-11-20

El único avance autorizado en Develop pasó la admisión y obtuvo la credencial temporal del escritor. Se registraron las once respuestas. El operador retuvo un incidente de barrera en la fase `operation` de Firestore con motivo `operation_failed`. La pregunta 11 sirvió para releer la barrera y registrar ese incidente. El diario omitió la primera excepción interna. La autorización del paquete 13 quedó consumida.

**Tiempos en Madrid.** El manifiesto se materializó a las 11:06:30.183 y su vigencia de 60 segundos terminó a las **11:07:30.183**. La respuesta 10 llegó a las **11:07:26.532**, dentro del plazo mostrado y con 3,651 segundos para completar las comprobaciones previas a la escritura. La observación del registro 60 terminó a las 11:07:29.156. Cuando se escribió ese registro quedaban unos 374 ms. Tres relecturas locales del mismo prefijo de 61 registros tardaron 638, 647 y 610 ms. En las tres reproducciones se agotó el margen antes de las lecturas de Firestore que preceden a la validación del manifiesto. El diario real carece de la hora de esa validación y del error original. La caducidad explica el fallo reproducido en local. La primera causa de la ejecución real sigue sin determinar.

En la reproducción local con el paquete, las versiones y el manifiesto del intento 13, el ejecutor recalculó las 203 mutaciones a los 60.000 ms y alcanzó las lecturas de control de avisos. A los 60.001 ms rechazó el mismo manifiesto por caducidad. El ensayo terminó antes de cualquier escritura. El diario real carece del instante en que la transacción comprobó el plazo. Recibo privado en el postflight del intento 13, `manifest-clock-offline/receipt.json`, SHA-256 `e28a3a97592f48e2ce6d7881d4650df010e230af762efafbd902879808ad4890`.

**Resultado del cierre.** A las 11:10:45 la comprobación independiente había completado dos transacciones y 47 peticiones HTTP de lectura, con cero errores. Coincidieron 234 documentos en 14 colecciones, también los seis documentos individuales y las capturas revisadas. Los 62 turnos y 117 avisos conservaron contenido y versiones. La operación y la base de migración seguían ausentes. La barrera y su incidente coinciden con el diario. Sheets conservó la imagen completa del libro y no recibió el lote. El operador verificó la retirada de los permisos de Drive e IAM y la revocación de OAuth. La hoja está disponible. Recibo privado `2026-11-20-interactive13-postflight/observation-c4bvb0/postflight-private.json`, SHA-256 `3b32c26731e10b74b1ec8ee2ead2bbcc39b2ac6169ea03ef6379d40f571cfcb4`.

Una transacción adicional de solo lectura comprobó individualmente los **203 destinos del manifiesto**. Los 141 documentos previstos para creación seguían ausentes. Los 62 previstos para eliminación conservaban su contenido y las dos marcas de tiempo de Firestore, `createTime` y `updateTime`. Recibo privado `manifest-targets-Sn207x/receipt.json` en el mismo directorio de comprobación, SHA-256 `aa1716fc55381147a9a7738d035b550a82f3ea86aad8fda7a1451d1891ef6284`.

**Seguimiento.** El diagnóstico y el ensayo posterior están documentados arriba. La migración de Develop y los seis escenarios de aceptación funcional siguen pendientes. [Ensayo local](#ensayo-local-tras-el-intento-13)

## Paquete 13 preparado — 2026-11-20

El operador 13 de Develop quedó preparado y revisado en local. Incluye los tres módulos que corrigen el plazo de respuesta. Se revisaron 343 archivos de fuentes y se comprobó que el arranque cargaba 103 de ellos. La revisión independiente comprobó 17 entradas privadas de preparación. El sello de arranque cubre 16 archivos. Un proceso nuevo rechazó el arranque antes de contactar a los proveedores. El cliente de escritorio también se detuvo antes de solicitar OAuth.

La cuenta propietaria obtuvo dos capturas iguales del libro en versión **305**, frente a la versión 303 del paquete 12. Se conservaron el contenido y los permisos. La revocación temporal devolvió 200 y las lecturas posteriores de Drive y Sheets devolvieron 401. Coincidieron las 14 colecciones de Develop, incluidos los 62 turnos y los 117 avisos. Dos transacciones de solo lectura comprobaron la fuente y las cuatro claves libres de la nueva operación. Se conservaron las barreras históricas de los intentos 10 y 12. El escritor seguía deshabilitado y aislado.

| Identidad del paquete | Valor |
| --- | --- |
| Recibo | `develop-original-20261120-interactive-13` |
| Operación | `request-hu084-initial-0eb52a3163ebea83f3b4` |
| Huella del paquete | `shift-planning:v1:sha256:10f10255e4e96326c02bbd87992e5ae4cc3c8e2b9adeaaa73d7bad7490b145b3` |
| SHA-256 del sello de arranque | `452f2c9eaa1c4a929aac787684fffc396a7f0193ca6f1b27369c1138d512441f` |

El avance previsto comprendía 203 escrituras en Firestore y un lote de Sheets con 53 actualizaciones de celdas y dos marcadores. La inversa de 140 escrituras requería su propia decisión. Antes de la autorización, el paquete carecía de ventana fechada. La preparación conservó los datos. Recibos privados `2026-11-20-interactive13-preparation/startup-integrity-private.json` y `2026-11-20-attempt13-offline-review/attempt13-independent-package-risk-review-private.json`.

## Intento 12 cerrado durante la admisión — 2026-11-20

El operador recibió ocho respuestas y adquirió la barrera del paquete 12. La octava llegó a las **09:56:50.498 de Madrid**, con 15,963 segundos aún disponibles según el plazo anunciado de las **09:57:06.461**. Nunca se solicitó una novena respuesta. El registro 47 rechazó la admisión con `admission_not_proven` y sin manifiesto final. El 48 recogió la aserción al comprobar la admisión. El 64 cerró con `inspection-required` y todas las llamadas resueltas.

**Por qué era imposible admitir la operación en ese momento.** El intervalo de quietud observado terminó a las 09:46:44.861. Los diez minutos de vigencia de la evidencia de barrera terminaron a las **09:56:44.861**, 5,637 segundos antes de la respuesta. Se reprodujo con el verificador del paquete sobre los registros 24, 39 y 43. Acepta la evidencia al abrir la octava pregunta y la rechaza a la hora real de respuesta. La admisión se detuvo durante la preparación del manifiesto, antes de las dos lecturas técnicas sujetas al límite de 60 segundos. El diario omite la primera excepción interna, por lo que queda abierta la posibilidad de otro fallo concurrente. Recibo de reproducción en el mismo directorio de postflight `chronology-VzNE91/receipt.json`, SHA-256 `d91af15d6ecb09e7acf03e32797dae4bba2e6ab50337ac27e91988ba206b4707`.

**Resultado.** La comprobación independiente de las 09:58:14 confirmó que los 62 turnos y los 117 avisos conservaban sus contenidos y versiones. Faltaban tanto el documento de operación como la base de migración. La barrera adquirida coincide con la evidencia retenida y carece de registro de fallo. El operador no llegó a emitir la credencial del escritor ni a enviar el lote de Sheets. La retirada se verificó en Drive, IAM y OAuth. El escritor quedó deshabilitado y aislado, sin claves ni asignaciones. El diario contiene 65 registros. Recibo privado `2026-11-20-interactive12-postflight/observation-smLY0b/postflight-private.json`, SHA-256 `cb14998cbf2a0beae33e9925b353a9cd37f0624f2d1fc5eb8c38882a6517d1c1`.

**Corrección local.** El informe de actividad inicial y los informes posteriores de la barrera muestran el primero de los plazos aplicables. Dos regresiones dirigidas comprobaron que una respuesta recibida tras caducar la evidencia se rechaza aunque siga abierta la fase, y que se respeta una fase que vence antes. Pasaron la compilación y el lint de Functions. La corrección sigue en el worktree, pendiente de despliegue.

**Seguimiento del intento 12.** El paquete 12 quedó consumido e inmutable. La revisión de sus tres módulos corregidos culminó en el paquete 13. [Preparación del sucesor](#paquete-13-preparado--2026-11-20).

## Preparación del lector de pruebas — 2026-11-20

El mantenedor autorizó el proyecto Google Cloud de pruebas `reguerta-turnos-lector-dev`. Google confirmó el proyecto activo y las API de Drive y Sheets habilitadas. Con la aceptación expresa del mantenedor se registró «Turnos Develop» como cliente de escritorio en modo de pruebas. La consola mostró una sola cuenta de prueba, «Plus Projects Test», y los dos permisos de lectura de metadatos de Drive y hojas de cálculo. Con el lector se obtuvieron dos capturas completas idénticas en versión 303. El contenido preservado y la autoridad coinciden con la referencia. Se revocó la sesión y Drive y Sheets devolvieron 401. El paquete generado prevé 203 escrituras en Firestore, 53 celdas de ayuda y dos marcadores. Dos transacciones pasivas confirmaron la fuente y la ausencia de registros de barrera en la nueva clave. La hoja permanece disponible. El censo de Develop de hoy coincide con las 14 colecciones del candidato, incluidos 62 turnos y 117 avisos. Los seis índices están listos y se verificó el aislamiento del escritor. Cambió la huella bruta del inventario de ejecución. El registro anterior conserva la huella del conjunto y no identifica un recurso concreto. Recibos privados en `2026-11-20-reader-project` y `2026-11-20-interactive12-refresh`.

## Comprobación de chat previa a otra ventana — 2026-11-12

Con la hoja disponible se envió una pregunta de prueba. El mantenedor respondió «Sí, veo el aviso; la hoja sigue disponible» y se acusó recibo en el mismo chat. Esto comprueba el recorrido de ida y vuelta hasta el operador del chat. No es una respuesta al intento 11 ni una confirmación de cierre, autorización de migración o aceptación de riesgo para otro intento. No se inició una ventana. A las 17:11 de Madrid, una transacción de solo lectura cotejó claves y versiones de los 62 turnos y 117 avisos de Develop; no había registro de operación, base, evidencia ni fallo de barrera para la clave del paquete 11. El recibo privado es `2026-11-12-interactive12-source/scope-1794499877958.json`. Este contraste no verifica el libro ni los demás controles del operador. La lectura posterior de la propietaria situó el libro en **versión 303**, frente a la 301 del paquete anterior.

Con la hoja disponible se comprobaron las seis pestañas, las 63 combinaciones de celdas, las protecciones y los metadatos que solicita el operador. Coinciden los 742 valores o fórmulas y sus posiciones. En una celda, la interfaz de Google representaba un espacio con un carácter distinto. La lectura directa de esa celda confirmó su valor original. El lector conectado contrastó además 155.098 posiciones de cuadrícula en 47 rangos. En 44 coincidió la representación exacta. En los tres restantes de las dos pestañas históricas coincidieron todos los valores escalares, listas y posiciones, y la diferencia se limitó a propiedades de formato con objetos vacíos. Los 14 conjuntos del censo, las 24 Functions, los tres trabajos pausados y los seis índices se revisaron en lectura. El escritor estaba aislado y deshabilitado. El contenido de su política IAM coincidió pese al cambio de `etag`. La diferencia en la huella histórica del inventario solo puede describirse a nivel de conjunto.

El Playground recortó el contenido necesario para las dos capturas completas de la propietaria. La limitación también afectó a la lectura por rangos. La evidencia del lector independiente queda identificada por su origen. Google confirmó la retirada de la conexión temporal de «Plus Projects Test». La misma sesión pasó de 200 a 401 al consultar tanto Drive como Sheets. Se conservan los resultados en `2026-11-12-interactive12-owner/browser`. El paquete para la versión 303 y el arranque de la ventana siguen pendientes. El siguiente paso propuesto es usar el lector local con el consentimiento oficial de Google para obtener las capturas completas. La comprobación del chat y las pruebas de las apps ya están cubiertas.

## Intento 11 cerrado antes de la migración — 2026-11-12

Tras corregir la referencia local de arranque y verificar la misma instancia en dos llamadas, el mantenedor volvió a confirmar el cierre. La ventana se fechó de **12:21:55 a 12:41:55 de Madrid**. Se aplicaron los permisos temporales previstos. El primer reto de la propietaria se emitió a las 12:22:29 y se trasladó al chat a las 12:22:36. El chat registró el envío y un recordatorio a las 12:29:27. No consta en el diario una respuesta válida a ese reto antes de las 12:34:25. El operador rechazó la recogida en ese punto y completó la limpieza a las **12:34:52**, sin brechas ni llamadas pendientes. El registro de envío al chat no acredita cuándo vio la pregunta la persona.

Los 32 registros del diario incluyen la concesión y la retirada verificadas en Drive. El intento terminó antes del sello inicial, la barrera, la admisión y la emisión del token del escritor. No hay intención conjunta, lote de Sheets ni escritura de negocio. Dos transacciones y 31 consultas de solo lectura por ADC confirmaron el mismo contenido y versiones de los 62 turnos y los 117 avisos y la ausencia de operación, cambio de base y registros de barrera. El escritor quedó deshabilitado y aislado, con cero claves y permisos temporales. La sesión OAuth quedó revocada y comprobada en Drive y Sheets. Una lectura final de la interfaz de Compartir mostró a la propietaria y cuatro lectores, sin el escritor. Se avisó al mantenedor de que podía volver a usar la hoja.

La única autorización se consumió. Se conservan el paquete, las dos decisiones, el diario y el posflight. El siguiente diagnóstico se limita al canal de respuesta del primer reto. Las suites de rotación y de las apps quedan cubiertas por la evidencia anterior. Una operación nueva requiere identificar ese punto de entrega, revisar el alcance vigente y obtener autorización propia. Evidencia privada en `2026-11-12-interactive11-live`, `develop-original-20261112-interactive-11` y `2026-11-12-interactive11-postflight/observation-p7xXss`.

## Autorización y preparación de la ventana 11 — 2026-11-12

El mantenedor autorizó un único avance de Develop con los permisos temporales del paquete 11 y aceptó expresamente el riesgo histórico. Se registraron dos recibos a las 12:00:55 (Madrid) y se verificaron el sello y los vínculos al paquete. La primera confirmación de cierre llegó a las 12:12:48. La llamada que debía iniciar la ventana carecía de la referencia de arranque verificada en la llamada anterior. Se comprobó la ausencia de recibo de ventana, diario, exclusión y resultado. La confirmación caducó, se avisó de que se podía reabrir la hoja y la autorización sigue disponible. No hubo concesión al escritor ni migración. El recibo local `prewindow-caller-outcome.json` conserva esta interrupción anterior a la ventana.

## Operador sucesor y revisión del intento 10 — 2026-11-12

La cadena íntegra del intento 10 tiene 72 registros. El 39 conserva la barrera, el 52 la admisión, el 55 la verificación del token y el 56 la inspección. En ese punto Firestore devolvió `not-observed` y Sheets `not-started`. El 71 cerró como `inspection-required`, con limpieza verificada y sin llamadas pendientes. El postflight conservó la misma fuente y acreditó la ausencia del documento de mantenimiento. No hay efecto de negocio que revertir. El registro de barrera histórico permanece en su clave y el ejecutor exige que la clave de una nueva adquisición esté libre. La primera excepción del 10 sigue sin conocerse.

El sucesor privado conecta `start-entry.cjs → operator.cjs → wrapClosingSession` en las fábricas de sesión normal y de recuperación. Verifica 341 huellas de fuente. De las 339 anteriores, 336 coinciden y tres cambiaron. Se incorporan el helper canónico y una dependencia de observación ya existente. Reconstruir los 17 archivos fijados del paquete anterior produce exactamente la operación consumida. El nuevo operador rechaza su clave y los paquetes históricos incluso con un recibo distinto. En esa comprobación inicial el vínculo operativo, la autorización y el horario estaban vacíos.

Se renovaron con la sesión existente 42 consultas de controles del proyecto compartido y 37 lecturas de Firestore acotadas a Develop. El censo coincide en contenido y versiones, incluidos 62 turnos y 117 avisos. Seis índices estaban listos y el escritor seguía aislado, deshabilitado y sin claves de usuario ni permisos temporales. Las 24 Functions coincidieron al normalizar el orden de los filtros. Cambiaron el `etag` de la política del escritor y la huella bruta del inventario de aislamiento. Las lecturas guardadas permiten verificar el aislamiento actual, pero no atribuir la diferencia de la huella bruta a un recurso concreto. Se conserva esa diferencia para la revisión del paquete. Ninguna de estas consultas escribió datos.

El runner registra la primera excepción capturada con su fase y un motivo de una lista segura. Un fallo externo desconocido queda clasificado por fase; el diario omite el mensaje del proveedor. Pasaron build y lint de Functions, lint específico de CJS, tres comprobaciones focalizadas del runner y tres del operador privado. Después se alineó la ruta del paquete con el materializador y se repitió únicamente el recorrido afectado (1/1). Las 356 ejecuciones de regresión y 98 de emulador se conservan como evidencia de la revisión anterior. En este paso solo se ejercitó la diferencia del operador y su diagnóstico, con dobles locales.

La primera lectura preparatoria se abrió con la cuenta habitual de Firebase, según confirmó el mantenedor. No produjo una observación y el puente no conservó la primera excepción; la credencial quedó revocada (200 y 401 tanto en Drive como en Sheets). La segunda lectura se realizó con la cuenta propietaria verificada y los dos ámbitos de solo lectura, sin renovación. Trece lecturas observaron el libro y su carpeta, las ACL y dos capturas de contenido iguales. La versión actual del libro es 301 (299 en el paquete 10). El lector registró el resultado y verificó la revocación con 200 y la denegación posterior con 401 en ambos servicios.

El paquete nuevo `beab18309646…d94e4ea6` conserva el contenido y las asignaciones revisadas. Prevé 203 escrituras Firestore y 53 celdas de ayuda más dos marcadores en Sheets. La inversa de 140 escrituras es una referencia de recuperación separada. La comprobación pasiva usó dos transacciones de solo lectura: fuente conforme, evidencia y fallo de la barrera ausentes para la nueva operación, cero intentos de escritura y único bloqueo `window_scope_missing`. Una revisión independiente cotejó las huellas, 23 predecesores y 25 recibos. El operador concreto quedó vinculado al paquete y a la revisión de riesgo; el sello de arranque cubre 16 archivos. En un proceso nuevo verificó sus identificadores y se detuvo ante la falta de autorización y de aceptación del riesgo, con cero invocaciones de proveedores. El estado es `READY_FOR_FRESH_AUTHORIZATION`.

**Siguiente decisión del mantenedor.** Revisar el paquete y el riesgo de efectos tardíos de trabajo histórico de Develop cuya entrega no puede reconstruirse por completo. La autorización de un único avance, la aceptación de ese riesgo para este paquete y la confirmación de una ventana concreta de veinte minutos son decisiones independientes. La hoja sigue disponible. No se concedió acceso de escritura, adquirió barrera ni inició migración.

Recibos privados de esta revisión en `2026-11-12-attempt11-offline-review`, `2026-11-12-window11-focused-validation`, `2026-11-12-interactive11-preparation` y `2026-11-12-interactive11-refresh`.

## Preparación interactiva de veinte minutos — local, 2026-11-02

El segundo intento detenido y la corrección privada del arranque están publicados
en `d7d11eaf`; se verificó la cabecera remota antes de este trabajo. El mantenedor
ofrece 20 o 30 minutos. **Veinte minutos es el máximo revisado de la nueva variante
explícita de develop original; treinta no está admitido.** No hay ventana real
fechada ni autorización nueva de ejecución.

[ADR-0027](../decisions/0027-recoger-observaciones-coherentes-de-develop-antes-del-token-escritor.md)
recoge la corrección local. Una observación completa de fase proporciona juntas
sus proyecciones de propietario y administradores, con fases nuevas e independientes
antes/después del callback. La entrada ya retenida lee por separado su checkpoint
inmutable. Adquisición, admisión y ejecución usan 3 + 3 + 2 observaciones completas
en vez de 7 + 8 + 7. `original-develop-deferred-writer-v1` se vincula a la operación
y al diario exactos y coloca adquisición/admisión antes del único token escritor.
El modo por defecto y las copias conservan diez minutos. La preparación dispone de
780 s y la recogida inicial de 750 s; IAM espera allí al menos 120 s. Se conservan
token de 300 s, trabajo de 150 s, limpieza de 60/90/120 s, manifiesto de 60 s y
evidencias de diez minutos. Una pregunta humana sin responder vence con su etapa,
no al final de la ventana exterior.

El operador privado nuevo utiliza arranque y respuesta atendidos. Cada respuesta
humana real conserva su identidad de petición/respuesta y hora propias; los hechos
administrativos sin cambios conservan una revisión estable. Así una confirmación
nueva no se confunde con una alteración de identidad administrativa. Se comprueban
los vínculos externos de paquete, preparación y planes de la plantilla técnica
contra el paquete regenerado.

La compatibilidad histórica es explícita: las 285 entradas de fuente del backend
reconstruyen el digest anterior sustituyendo solo el adaptador de barrera TS/JS
compilado. El presupuesto histórico por defecto se reconstruye cambiando únicamente
su hash de fuente revisado; no se alteran plazos ni recibos. Se mantienen fijados
los 17 archivos originales. El paquete `7201f1cf…f257715` sustituye al `9d528701…b8f`
solo por resúmenes de procedencia histórica; política, intenciones/digests forward
e inverse, operaciones, 203/140 escrituras Firestore, 53 celdas, dos marcadores y
fechas/orden publicados son idénticos. La preparación materializada es `373ee000…faced`.

La preparación local final está **READY_FOR_FRESH_AUTHORIZATION**, sin admisión
real. La regresión con observador real demostró primero que exigir las fuentes
congeladas rechazaba el commit propio de 62 a 72 filas antes de Sheets. La fase
final relee independientemente el recibo comprometido y verifica imágenes/versiones
exactas, filas ajenas intactas e historia de capturas sin alterar. Cada core nuevo
debe coincidir con una creación/borrado propio exacto. El digest de fuentes actuales
queda separado de la identidad causal histórica; las entregas desconocidas siguen
desconocidas y sin reejecutarse. La ruta estricta sigue rechazando diferencias. La
prueba y el modo de veinte minutos solo admiten avance, sin habilitar otra inversa.

Validación final Node 22.23.4: **328 regresiones del repositorio + 30 casos de
transición propia unitarios/SDK-emulador + 14 pruebas privadas**, cero fallos ni
omitidas. Build/lint completos de Functions, lint CJS focalizado y diff correctos.
El gate decisivo usa observador real, imágenes/versiones actuales de Firestore e
inspección retenida independiente. El ciclo positivo de 98,702 s incluye ocho
esperas reales de 12 s y comprueba trabajo posterior al token inferior a 150 s.
Cambios de campo, ABA de versión, fuente/captura ajena, emisión/respuesta lenta y
pregunta sin responder conservan parada y limpieza. Los 553 archivos de código,
scripts, pruebas y compilados permanecieron idénticos durante el gate SDK final.
Google, personas y ciclo IAM siguen siendo dobles explícitos: no se acredita
latencia real ni ejecución humana/de navegador. El recogedor inicial admite por
separado respuestas más lentas con veinte minutos y rechaza las mismas con los diez
por defecto. La discrepancia inicial de huella se corrigió con el materializador
público de producción y sus constructores reales; se conserva el gate fallido.

Evidencias privadas: `2026-11-02-interactive-window-preparation` y
`2026-11-02-interactive-window-local`. Se validan ambos diarios anteriores de 21
registros y su limpieza. El recibo nuevo `develop-original-20261102-interactive-03`
no está consumido; autorización, fechas y compromisos permanecen vacíos. Su control
local de preparación vincula la variante de avance validada y el paquete exacto;
siguen siendo obligatorias la autorización y la ventana real fechada. Esta preparación no ha realizado
acciones de Google/IAM/OAuth/Sheets/producción ni abierto mantenimiento. Sin cambios
ni diferencia nueva Android/iOS. No hacen falta builds de apps por este cambio exclusivo del backend.

## Segundo intento autorizado: detenido y limpiado — 2026-11-02

Tras renovar el acceso y comprobar de nuevo hoja, lote, controles y fuentes, el
usuario confirmó diez minutos desde el anuncio inmediato del inicio. El recibo
`develop-original-20261102-active-context-02` fija **09:37:55.386–09:47:55.386 UTC**
(**10:37:55–10:47:55 Europe/Madrid**). La declaración de hoja cerrada durante el día
no amplía esa ventana ni la vigencia de los permisos. El intento único está consumido.

El ejecutor reactivó el escritor y concedió su permiso IAM temporal. Dejó pendiente
la concesión nativa de edición, pero la llamada que lo arrancó devolvió el control
sin atenderla; venció la espera de 20 s. Los eventos conservados y el recorrido de
código identifican ese fallo de coordinación. El diario del intento solo conserva
el motivo terminal genérico; no se le atribuye un diagnóstico que no registró.
La acción nativa no llegó a despacharse. No hubo permiso de edición de la hoja,
token del escritor, confirmaciones posteriores al permiso, mantenimiento, escrituras
de negocio, FCM, inversa, repetición ni acceso a producción.

La limpieza terminó a las **09:39:03.593 UTC (10:39:03 Madrid)**: propietario/cuatro
lectores, permiso IAM retirado, escritor explícitamente deshabilitado y aislamiento
verificado. OAuth Online sin renovación fue revocado; el mismo token devolvió 401
en Drive y Sheets tras dos comprobaciones. El diario íntegro contiene 21 registros,
ningún archivo pendiente, cero llamadas en curso y cero incumplimientos del presupuesto
de etapas. La expiración de la acción nativa es el fallo de preparación, no un éxito
de migración. La exclusión local quedó liberada y la ventana del usuario terminada.
La migración de develop sigue pendiente; HU-084/HU-085 abiertas y PR #278 en borrador.

La composición ejecutada se conserva íntegra y por SHA-256 en el directorio privado
`2026-11-02-native-context-retry-preparation`, junto a eventos, lectura previa,
captura visual y recibos. Se validó la cadena del diario con el lector real. El
paquete sigue idéntico: 17 entradas fijadas, 203 escrituras Firestore, 53 celdas y dos
marcadores. La hoja estaba en versión 287 antes del arranque; esta sesión no la escribió.

La corrección local posterior incorpora el bucle de atención a la interfaz real:
`startAndAttend` arranca y atiende las acciones en la misma llamada activa;
`answerAndAttend` resuelve una respuesta humana real y atiende la continuación.
Se elimina la exposición separada de `run`/`answer`. `attend` reanuda una espera de
proveedor. Devuelve una petición humana, estado terminal o espera explícita tras
hasta 45 s entre acciones; una acción ya iniciada termina antes de devolver control,
bajo el plazo existente de su etapa. La expiración sin despacho guarda ahora su
propio diagnóstico. No amplía plazos, inventa respuestas ni repite acciones.

Esto corrige el arranque concreto que falló; una interrupción arbitraria entre
llamadas aún puede hacer expirar la operación, que conserva su contención. Antes de
otro intento hay que preparar un recibo/autorización nuevos y utilizar directamente
la interfaz atendida. La aprobación consumida no permite ejecutarlo ahora. No se
necesita mantener cerrada la hoja para la preparación local.

Las ocho pruebas anteriores precedían a esta ejecución y no acreditaban el arranque
real. La validación local posterior pasa **16 pruebas sin fallos ni omitidas**, con lint
focalizado sin avisos. La revisión independiente detectó y se corrigió que un fallo
al guardar el diagnóstico pudiera interrumpir la limpieza; ambos caminos tienen
regresión. Las pruebas privadas se ejecutaron con Node 23.11.0; no se presentan
como un nuevo gate del runtime desplegado Node 22. Una lectura real de navegador
a través del nuevo driver terminó correctamente, sin concesión ni escritura. Usa el
mismo driver que la interfaz concreta e incluye concesión/retirada correctas y
fallidas, expiración sin UI, límite entre
llamadas, respuesta humana y espera hasta finalizar la acción. Builds de apps y
emuladores no se repiten por documentación y composición privada; no hay cambios ni
nueva diferencia Android/iOS. La documentación nueva queda local tras `874146e3`.

Preparación histórica: el usuario autorizó un solo intento nuevo; una primera sesión
de lectura se cerró mientras se esperaba la confirmación de ventana. Otra sesión
previa cuya credencial apareció por error en un diagnóstico fue revocada y comprobada
con 401 en ambos servicios antes de renovarla. No se conservan credenciales en los
recibos. Ninguna de esas lecturas previas concedió acceso al escritor ni abrió
mantenimiento. La autorización posterior sí quedó consumida por el intento descrito.

## Intento autorizado del 2 de noviembre: detenido y limpiado

La revisión anterior está publicada en `86af466b`. El usuario autorizó el avance y
los permisos temporales y confirmó la hoja cerrada, en línea y sin intervenciones
hasta las 10:15 Europe/Madrid. La comprobación previa real conservó versión 287,
propietario/cuatro lectores, controles coincidentes y fuentes Firestore coincidentes;
la admisión de lectura seguía rechazando únicamente `window_scope_missing`.

El único intento empezó a las **09:05:11.669 UTC**. Reactivó la cuenta dedicada y
concedió su permiso IAM temporal, pero se detuvo antes del envío nativo de Compartir.
No se concedió edición de Sheets, emitió token del escritor, recogió consentimiento
posterior al permiso, abrió mantenimiento ni escribió datos de negocio. Sin FCM,
reintento, inversa ni acceso a producción. El estado terminal es `inspection-required`.

Limpieza terminada a las **09:06:23.770 UTC**, sin incumplimientos de tiempos ni llamadas
pendientes: archivo con propietario/cuatro lectores, permiso IAM retirado, escritor
explícitamente deshabilitado y aislamiento verificado. OAuth Online del propietario,
sin renovación, revocado; el mismo token devuelve 401 tanto en Drive como en Sheets
tras cuatro comprobaciones (32,837 s). El usuario puede volver a utilizar la hoja.

El error original de preparación no quedó detallado en el recibo. Una reproducción
posterior de solo lectura demuestra que invocar el navegador después de terminar la
llamada de `cua_repl` falla con `node_repl exec context not found`; la misma lectura
funciona dentro de una llamada activa. Esto identifica una incompatibilidad concreta
de la composición privada, sin atribuir retrospectivamente un error no conservado.
La composición local se ajustó para dejar pendiente la acción nativa y atenderla con
una llamada activa que espera su finalización. Expira antes de despachar si no se
atiende en 20 s, conserva el diagnóstico de fallo y no reintenta. Se conserva aparte
el archivo exacto usado en el intento. No cambia código desplegado ni el paquete.

Validación: cuatro pruebas locales nuevas (despacho único, expiración sin UI, fallo
con diagnóstico y espera de la acción en curso), lint focalizado y lectura real desde
la conexión corregida. No se probó otro permiso ni escritura. Evidencia privada:
`2026-11-02-authorized-develop-window`, con diario de 21 registros, capturas y recibos.
No se repiten builds nativos/emuladores: solo cambia documentación en el repositorio
y la composición privada. Sin diferencia entre apps.

Siguiente: revisar la composición corregida y preparar otro intento con horario e
identidad de recibo nuevos; la autorización consumida no permite repetir esta ventana.
Las confirmaciones posteriores a la concesión siguen pendientes; no se reutiliza la
confirmación inicial como si acreditase hechos posteriores. HU abiertas y PR en borrador.

## Renovación de autoridad y propietario; revisión fechada — 2026-11-02

El bloque de recibos y entradas humanas tiene commit y push `8edfc7df`; coinciden
la rama remota y la cabecera de la PR #278 en borrador. Se reutilizaron las 126 pruebas
locales, tres comprobaciones privadas y build/lint tras verificar los 346 hashes de
archivos de ejecución/paquete. Esta renovación de lecturas y documentación queda
local, pendiente de commit.

Evidencia privada: `2026-11-02-authority-owner-refresh`. Horas reales UTC:
Cloud `2026-11-02T08:07:46.878Z`, censo atómico de develop `2026-11-02T08:07:40.706Z`,
propietario/Sheets `2026-11-02T08:11:33.635Z` (Madrid es UTC+1 en esta fecha).

- Coinciden las 24 configuraciones de Functions y los 24 servicios Run con sus
  nombres, revisiones e identidades; también Rules, IAM del proyecto/invocador,
  tres jobs pausados y seis índices READY. Inventarios globales de jobs, worker pools
  e instancias Run vacíos. Scheduler cubre 34 regiones; las 88 consultas de triggers/
  builds activos en 44 ubicaciones explícitas tienen éxito y están vacías.
  Sin servicios App Engine, Extensions ni pools de identidad de cargas de trabajo.
- Diez cuentas de servicio, cuatro deshabilitadas, cero claves de usuario y cero
  concesiones IAM propias. La única añadida desde las nueve de octubre es el escritor
  de Sheets de develop ya revisado: deshabilitado y ausente de los runtimes.
  Cloud Asset sigue deshabilitado; se consultan las APIs individuales. La enumeración
  de ubicaciones de Cloud Build no está disponible: la cobertura son las 44 ubicaciones
  indicadas, sin interpretar el fallo de descubrimiento como ausencia de recursos.
- Coinciden exactamente contenido y versiones de todas las colecciones/singletons
  revisadas de Firestore y del registro privado: 12 eventos y 16 entregas. El ejecutor
  real realiza una transacción de lectura, cero llamadas a controles/escrituras y
  rechaza la admisión únicamente por `window_scope_missing`. No prueba drenaje histórico.
- La hoja original de develop conserva versión 287, propietario y cuatro lectores;
  su carpeta solo tiene propietario. Dos lecturas directas completas de conservación
  y dos de las seis zonas acotadas coinciden entre sí y con la evidencia anterior.
  Fechas, orden, valores y formato revisado permanecen iguales; escritor sin permiso.
- OAuth del propietario autorizado expresamente, solo metadatos/Sheets de lectura,
  Online y sin token de renovación. Revocación aceptada y 401 en Drive y Sheets con
  el mismo token tras seis comprobaciones (53,492 s); credencial temporal local retirada.

La vinculación renovada de 23 controles usa las horas reales y fija 25 archivos de
recibos/fuentes, incluidos diez archivos de código desplegado conservados y verificados.
Los cierres históricos mantienen sus fechas originales. Siguen desconocidos los 23
contadores de trabajo anterior. Declaración de automatizaciones, observaciones y
consentimiento futuro son independientes. El paquete se reproduce exactamente con sus
17 entradas fijadas; no cambian identidades de paquete/preparado/avance/inversa ni las
203 escrituras Firestore de avance / 140 de inversa, 53 celdas de ayudantes y dos
marcadores. No se añade algoritmo ni control de proveedor.

### Propuesta concreta para revisar, sin autorización

**2 de noviembre de 2026, 10:00–10:15 Europe/Madrid (09:00–09:15 UTC).**
OAuth y el canal nativo de permisos deben estar preparados antes. La comprobación
previa de cinco minutos es independiente del presupuesto de diez minutos del escritor.

| Hora de Madrid | Límite propuesto |
| --- | --- |
| 10:00–10:05 | Conciliación final de lectura y revisión expresa de operación/riesgo |
| 10:05–10:08 | Ciclo exacto de permisos, espera IAM mínima de 120 s y evidencia inicial; recogida terminada antes de 10:07:30 |
| 10:08–10:10:30 | Una dirección de avance, solo tras admisión correcta |
| 10:10:30–10:11:30 | Retirar acceso al archivo y comprobar denegación |
| 10:11:30–10:13 | Retirar IAM y deshabilitar expresamente el escritor |
| 10:13–10:15 | Revocar OAuth del propietario y comprobar denegación |

Fechas solo en `dated-inputs-private.json` / `dated-review-private.json`. No se inventa
recibo, aceptación de riesgo, confirmación ni informe del propietario/administradores.
Los formularios normales sin fechas siguen sin confirmar. No se concedió permiso ni
se emitió token del escritor. Se conserva un único token futuro de 300 s, límites de
180/150/60/90/120 s y 600 s totales. Son máximos, no esperas obligatorias ni garantías
para llamadas de proveedor/humanas no cancelables; el margen exigido puede rechazar antes.
Las capturas de esta mañana serán demasiado antiguas para la ventana propuesta:
recoger evidencia inicial nueva y 30 s de quietud después del cierre real de permisos,
junto a compromisos/informes nuevos del propietario y administradores. Antigüedad
máxima de 600 s. Si pasa el horario, hay que fechar/revisar de nuevo y confirmar otra
ventana; nunca empezar tarde ni ampliar sus límites.

Validación: tres comprobaciones privadas renovadas correctas, plan fechado aceptado
por el validador real, presupuesto válido y expiración rechazada, plantilla sin
confirmar rechazada por la barrera real. Reproducción del paquete y 17 entradas correctas.
Lectura Cloud 1,113 s, captura del propietario 8,246 s; estas medidas aisladas y los
53,492 s de revocación no certifican la duración del ciclo completo Google/humano.
Sin cambios de código ejecutable ni apps: build/lint y 126 pruebas reutilizados con
hashes coincidentes; no se repiten emuladores ni pruebas nativas para evidencias/docs.
Sin diferencia de paridad entre apps.

Siguiente: revisar propuesta, autorizar operación/permisos temporales/riesgo exactos,
preparar el canal y después pedir la ventana real al propietario/administradores.
No se abrió mantenimiento ni hubo migración, escritura Sheets, FCM, despliegue, cambio
IAM/ACL ni acceso a producción. No hace falta cerrar la hoja. HU abiertas y PR en borrador.

## Hitos anteriores (historial conservado)

Recogedor concreto con commit y push en `4dd7bb54` (2026-11-02). La vinculación de
recibos y las entradas humanas siguientes están **locales, pendientes de commit**.
No hay mantenimiento abierto. Las observaciones conservan sus horas reales.

## Evidencias y operación exactas

Directorio privado: `2026-11-02-initial-evidence-window`.
`initial-evidence-draft-private.json` fija el paquete revisado, las lecturas nuevas
Cloud/censo, la imagen anterior del propietario, la inspección de fuentes y la
revisión del canal nativo. Enumera los 25 controles de escritores y las ocho rutas
de entrega contenida. Paquete de barrera, ámbito, acuerdos, aceptación de riesgo
histórico de la operación, recibo de cierre del permiso e intervalo real de quietud
siguen nulos. El constructor real rechaza el borrador antes de acceder a proveedores.

Se conserva el paquete `9d5287014d6ac4ff82b62841f164aeb3137e6545bbf72ad729e04e5d617d1b8f`,
la ida `request-hu084-initial-68e09b87cef3ef75a357` y la inversa
`hu084-inverse-68e09b87cef3ef75a357`. Las lecturas nuevas coinciden con las fuentes
fijadas; adjuntarlas no exige regenerar el paquete. La intención revisada conserva
203 escrituras Firestore, 53 celdas de ayudantes y dos marcadores, protegiendo fechas,
orden y avisos históricos. La inversa requiere admisión propia y nunca es un reintento
automático.

Lecturas nuevas de solo lectura (Europe/Madrid, 2 de noviembre):

- Censo a las 00:17:55: las 14 colecciones revisadas, documentos individuales y registros
  de captura conservan exactamente contenidos y versiones del servicio. Hay 62 turnos,
  48 usuarios proyectados, cuatro calendarios, tres documentos de configuración,
  117 avisos, 12 eventos capturados y 16 registros de entrega. La autoridad inicial
  del planificador sigue ausente.
- Cloud a las 00:18:02: coinciden las 24 configuraciones de Functions, tres jobs
  pausados, Rules, IAM de proyecto/invocador y seis índices READY. El escritor sigue
  deshabilitado, sin claves de usuario ni bindings propios y fuera del inventario
  de ejecución comprobado.
- Cambió un hash del inventario bruto. Dos respuestas completas nuevas difieren solo
  en el orden de los filtros de eventos y coinciden al normalizarlo. Los 24 nombres/
  configuraciones de Functions y los 24 nombres/revisiones/identidades de servicios
  coinciden con lo revisado. No se conservó la respuesta bruta anterior; su hash solo
  no se presenta como prueba de igualdad de toda aquella respuesta histórica.
- El ejecutor real realiza una transacción de lectura de fuentes y cero adquisiciones
  de controles/escrituras. Las fuentes coinciden; rechaza con `window_scope_missing`.
- La evidencia del propietario de Sheets es **anterior**, del 1 de noviembre a las
  21:50:39 de Madrid. No es una observación nueva de ventana. Su OAuth ya se revocó.

La lectura Cloud duró 1,072s y el censo 3,709s. No acreditan la duración conjunta de
permisos, admisión, Sheets y limpieza. Trabajo histórico y entregas desconocidos
siguen desconocidos; no se reenvía ningún aviso.

## Horario propuesto, todavía sin iniciar

Reservar **hasta 15 minutos** desde una confirmación futura: hasta cinco para entradas
iniciales de solo lectura y diez para el ciclo existente del escritor. OAuth debe
estar preparado antes de esa confirmación. No se rellenan ahora inicio, fin ni
condición IAM reales.

| Desde la futura confirmación | Finalidad máxima |
| --- | --- |
| 0–5 minutos | Conciliación de lectura, plan revisado y compromisos preliminares; sin permisos ni mantenimiento |
| 5–8 minutos | Permisos exactos, propagación IAM mínima de 120s, completar evidencia inicial real y un token |
| 8–10:30 minutos | Barrera/admisión y una dirección de ida |
| 10:30–11:30 minutos | Retirar permiso de hoja y comprobar negativa con el mismo token |
| 11:30–13 minutos | Retirar IAM y deshabilitar explícitamente al escritor |
| 13–15 minutos | Revocar OAuth y verificar negativas de Drive y Sheets |

Son límites máximos, no esperas obligatorias. Se mantienen 180/150/60/90/120s dentro
de los 600s operativos, sin ampliar la duración de los permisos. Las comprobaciones
estrictas de margen pueden rechazar antes del límite de la tabla. Incumplir un límite
de preparación o ejecución detiene el avance; nunca amplía la ventana en silencio.

Valores propuestos del comando: 30s de quietud observada, antigüedad máxima de evidencia
de 600s. La captura inicial y la quietud pasan a ocurrir después del cierre real de
permisos y de las confirmaciones finales, dentro del presupuesto de preparación.
Queda sustituida la propuesta anterior de terminar la quietud antes de iniciar
el ciclo del escritor.
Ese fin de quietud sigue siendo inmutable para comprobar antigüedad; las relecturas
no pueden cambiarle la fecha. Son propuestas, no valores desplegados ni prueba de
terminación histórica. El horario no genera consentimientos ni fechas del proveedor.

## Arranque y recuperación corregidos

El registro guarda primero la operación/paquete, ventana, ámbito previsto, intención
del propietario y administradores, aceptación del riesgo histórico y entradas
revisadas. Solo quedan nulos cuatro hashes derivados: acuerdo del propietario,
acuerdo administrativo, controles conjuntos y evaluación histórica. No pueden cambiar
participantes, autoridad, fuentes, operaciones, plazos, fecha de aceptación del riesgo
ni su identificador de confirmación. El último hash solo admite completar la hora
real de evaluación.

Tras conceder el permiso exacto, el canal nativo cierra el diálogo de Compartir,
comprueba que ha desaparecido, relee los permisos de forma independiente y devuelve
el recibo de cierre. La capacidad de conceder se consume una sola vez y el adaptador
no crea credenciales temporales de escritura del propietario. Su sesión personal
sigue siendo una capacidad humana conservada bajo ADR-0021; cerrar el diálogo no
revoca la propiedad ni acredita el cierre de otras automatizaciones del propietario.
Una respuesta perdida o un diálogo que continúa abierto no produce recibo válido.

La sesión vincula el recibo a este intento, al plan previo y a la transición completa
de permisos. El puerto explícito `readInitialReview` aporta entonces confirmaciones
finales reales y evidencia inicial; recibe el mismo transporte/reloj acotados, la
captura del propietario y el control de autoridad. Debe esperar todas las lecturas.
El sellador no inventa confirmaciones, horas, quietud ni hechos de cierre. Las
confirmaciones deben vincular la intención completa después de cerrar esta concesión;
la captura y la quietud siguen a esas confirmaciones. Se rechazan recibos anteriores,
fechas futuras, participantes/plazos/fuentes cambiados, entradas sustituidas y caducidad.

`google-initial-evidence-sealed` se guarda de forma persistente antes de solicitar
el único token del escritor. Los servicios se construyen después de disponer de ese
recibo. La espera mínima IAM comienza en la concesión real e incluye el tiempo usado
para completar la evidencia; no se añaden otros 120s ni se amplía la ventana. Después
de la propagación se vuelve a comprobar la hoja y la vigencia de la evidencia antes
de pedir el token. La admisión recibe exclusivamente el ámbito sellado y validado,
nunca el plan con campos nulos.

La recuperación relee ese mismo sello como evidencia histórica: no recoge nuevas
confirmaciones, concede permisos, emite tokens ni reanuda la ejecución. Si el arranque
se interrumpió antes del sello, la inspección de barrera/negocio queda no disponible
y siguen las limpiezas independientes de hoja/IAM/OAuth. Un fallo al guardar conserva
el estado de inspección pendiente. Cancelar durante la recogida espera su terminación
y limpia sin pedir token. No se relajan validadores de negocio, rutas de producción,
formato del registro ni límites de permisos/tokens; tampoco se añade inversa automática.

## Validación de la corrección del arranque (publicada en `25109ad4`)

Validación: **115 casos locales distintos** (91 regresiones sin cambios de la ejecución de 113 casos y los 15 casos finales del sello y nueve del canal nativo), **90 casos de emulador**, cero fallos/omisiones. Pasan build, lint completo, lint CJS específico y comprobación del diff.

Evidencia privada: `2026-11-02-startup-seal`. Pasan build/lint completos de Functions
y lint CJS específico. Las pruebas locales cubren sellado correcto, la fábrica real
de servicios, recibos cambiados/antiguos/ausentes, confirmaciones anteriores, caducidad
durante propagación IAM, interrupciones de recogida/disco y reinicio solo para limpiar.
Las respuestas Google y la interfaz nativa de estas pruebas son sintéticas; la regresión
con emulador usa Firestore local real. No certifican los tiempos conjuntos de Google/UI
ni el cierre real del diálogo español. Las apps Android/iOS no cambian.

Siguiente paso: preparar el plan previo exacto y la recogida concreta de evidencia
inicial para la ventana propuesta, conservando el paquete y renovando solo las
observaciones necesarias. Comprobar que las confirmaciones finales, captura y quietud
caben en el mismo plazo antes de pedir ejecutar. Hay que regenerar los hashes de
revisión para este código cambiado. El borrador histórico incompleto sigue sin ser
ejecutable; este ensayo no genera recibos ni una ventana reales.

Sin cambios IAM/ACL, renovación OAuth, escrituras Sheets, FCM, despliegues,
mantenimiento ni acceso a producción en esta corrección. HU-084/HU-085 siguen
abiertas y PR #278 en borrador. No necesitas cerrar la hoja ni hacer nada ahora.

## Recogida concreta y ensayo de tiempos — 2026-11-02

`develop-initial-review-collector.cjs` conecta la recogida inicial con los lectores
existentes. Su plantilla revisada debe contener ya los recibos técnicos de cierre
y el manifiesto; las fechas dinámicas de lectura, acuerdos humanos e intervalo de
quietud deben estar vacíos. La composición comprueba el paquete preparado/revisado
exacto antes de llamar a proveedores. No descubre credenciales ni inicia ejecución real.

Tras el recibo nativo de permisos verificado, recoge la confirmación del propietario
para ese acuerdo completo y después la administrativa, vinculada al acuerdo del
propietario. Lee controles Cloud/autoridad, el censo de cuatro rutas, todas las fuentes
mediante una transacción SDK de solo lectura y la captura directa de la hoja. Tras
el intervalo mínimo de quietud repite las observaciones y obtiene informes humanos
finales explícitos. La igualdad de contenido no sustituye un informe humano. El
comparador causal admite solo las adiciones revisadas al registro de capturas y
conserva los contadores desconocidos. El validador real debe aceptar el resultado
antes del sellado. Cada grupo espera todas sus operaciones antes de avanzar o limpiar.

La recogida debe terminar antes de **inicio de ventana +150 segundos**, reservando
30 segundos dentro de los 180 existentes para las comprobaciones restantes. La
concesión nativa y ambas confirmaciones consumen ese mismo plazo. Los dos minutos
mínimos de IAM siguen contando desde la concesión real e incluyen la recogida; no
se añaden otra espera ni más duración a permisos o token. HTTP recibe el límite más
estricto. La cancelación se propaga a la recogida y a la espera de quietud.

| Escenario simulado | Duración de recogida | Resultado |
| --- | ---: | --- |
| Normal: dos confirmaciones de 10 s, dos lecturas de fuente de 3 s, dos de hoja de 2 s y 30 s de quietud | 60,400 s | Aceptado; quedan 79,470 s hasta el límite de recogida |
| Dos confirmaciones de 60 s | 125,200 s | Rechazado: no cabe el intervalo de quietud |
| Lecturas de fuente de 80 s | 212,200 s | Rechazado al terminar la lectura SDK pendiente; supera el límite en 72,330 s |
| Concesión tarda 145 s | 10,000 s | Rechazado tras confirmar; supera el límite en 5,130 s |

Son tiempos deterministas **simulados, no latencias medidas de Google o la interfaz**.
Una petición SDK o confirmación humana iniciada puede no admitir cancelación. Se espera
su terminación y se impide emitir el token; no se garantiza terminar la limpieza en
diez minutos ante cualquier demora externa. Los callbacks reciben plazo y comprobador
de cancelación. Un intento vencido exige inspección/contención; no demuestra limpieza
correcta ni autoriza repetir escrituras.

El archivo privado `2026-11-02-initial-collection/collection-preparation-private.json`
vincula siete entradas conservadas sin cambios, paquete/operaciones exactos, orden de
lectores, mapa de 25 controles, recibos de tiempos y campos pendientes. Las 23 filas
técnicas del borrador anterior siguen sin fechas/huellas de cierre revisadas; esta
preparación no las convierte en hechos verificados. Las otras dos filas requieren
confirmaciones humanas de la ventana real. No se copian datos de las pruebas a esa
preparación real, que sigue sin permitir ejecución.

Validación actual: 106 pruebas locales y 90 con Firestore local, cero fallos/omitidas;
build/lint completos de Functions, lint CJS focalizado y diff correctos. El caso nuevo
de composición verifica rechazo de paquete distinto antes de proveedores y fallo de
inspección SDK de solo lectura antes del sellado; el caso positivo del recogedor usa
fuentes/Google/personas simulados. La regresión del emulador no certifica el ciclo
completo real del recogedor y migración. Android/iOS sin cambios ni nueva diferencia.

Siguiente: completar la plantilla técnica revisada y la conexión final de lecturas/
confirmaciones con los recibos conservados, renovar solo evidencias/credenciales que
requieran actualidad y comprobar el mismo presupuesto antes de pedir ventana real.
No hay mantenimiento ni autorización de esa ejecución. No debes hacer nada ni cerrar
la hoja ahora.

## Recibos conservados y entradas humanas explícitas — 2026-11-02

La plantilla estática vincula ya los **23 controles técnicos**, las dos filas humanas
futuras, paquete/operaciones/fuentes/hoja exactos y las cuentas de propietario,
operador y ambos administradores. El directorio privado `2026-11-02-technical-receipts`
conserva el preparador reproducible, 25 archivos fijados por huella,
`technical-receipts-private.json`, `initial-template-private.json` y
`confirmation-inputs-private.json`. Diez archivos de código desplegado coinciden con
las huellas del proveedor conservadas y la configuración retenida actual. La respuesta
antigua de Rules carece de metadatos añadidos en otra lectura: nombre, fuente y fecha
de creación coinciden exactamente. El lector conserva la respuesta nueva completa
como referencia, sin relajar la comparación.

`bind-develop-technical-receipts.cjs` rechaza controles/recibos ausentes, bytes cambiados,
fechas sin el campo original citado, discrepancias Rules/captura y ceros de trabajo
inventados. Distingue lecturas verificadas de cierre, observaciones de registros
ausentes y evidencia compuesta condicionada de autoridad. Vincula procedencia; no
prueba que todos los escritores actuales estén técnicamente bloqueados. Los nuevos
workers son factorías lógicas sin registro en la composición inspeccionada; la ruta
HTTP es `shiftCoverage`, no un endpoint inventado del worker. Los 23 contadores de
trabajo anterior siguen desconocidos y deben vincularse a la aceptación específica
del riesgo histórico. El mantenedor confirma ahora que no hay automatización externa
adicional a las apps/Functions conocidas. Esa declaración no prueba terminación
histórica ni sustituye el inventario técnico actualizado.

`createDevelopHumanInputs` proporciona las tres entradas del recogedor: confirmaciones
de propietario/administradores, informes iniciales e informes posteriores nuevos.
Su transporte `exchange` debe mostrar la petición exacta; no abre navegador ni pregunta
ahora. Incluye cuentas/funciones, intervalo UTC, operaciones, acuerdo inmutable y
secuencia única. Las plantillas dejan a null consentimiento, tiempos y estado; no
traen aceptación marcada. Cada respuesta lleva huella de petición, identificador
único y hora realmente observada. Los validadores de dominio comprueban participantes
y compromisos completos. Peticiones/respuestas se guardan en el diario existente.
Respuestas vacías, negativas, antiguas, futuras, sustituidas, reutilizadas, retiradas
o con actividad detienen el avance. Cada informe posterior exige una respuesta nueva.
El contador inicial de cambios sin conexión sigue null hasta validar las confirmaciones
explícitas de cierre/conexión. Se espera la terminación de una entrada pendiente al
cancelar; no se amplía ningún plazo ni garantía de limpieza.

Los formularios completan los campos estáticos de ámbito/acuerdos/riesgo. Siguen
vacíos el identificador del intento, ventana, aceptación concreta del riesgo y su
fecha, cierre real de permisos, confirmaciones e informes observados. La aceptación
previa de ADR-0026 no se copia como autorización de otra ejecución. Antes de dar por
actuales las filas condicionadas hay que renovar el inventario completo de autoridad
automática, la ausencia de entradas no desplegadas y las observaciones directas de
propietario/hoja/carpeta. Son renovaciones de evidencia pendientes; no requieren otro
algoritmo ni regenerar el paquete, que no ha cambiado.

Validación: **126 pruebas locales distintas y tres comprobaciones privadas sin red**,
sin fallos ni omitidas; build/lint completos y lint CJS correctos. La comprobación
positiva privada completa una copia con tiempos/consentimientos expresamente simulados
y pasa el validador real; no guarda aceptación operativa. Los formularios reales sin
confirmar se rechazan por separado. Las 90 pruebas previas de emulador se conservan
como evidencia histórica, no repetida ni presentada como nueva aceptación en vivo.
Android/iOS sin cambios ni diferencia nueva. Siguiente: renovar las observaciones
identificadas y revisar el paquete con fechas concretas antes de pedir ejecución.
Sin mantenimiento, llamadas a proveedores, permisos, token, escritura Sheets, FCM ni
producción en este bloque. No necesitas cerrar la hoja ahora.
## Intento interactivo detenido antes de la concesión — 2026-11-02

El intento autorizado `develop-original-20261102-interactive-03` empezó a las
11:22:03 UTC y se detuvo al preparar la concesión de edición en el cuadro de
Compartir: el adaptador no encontró de forma inequívoca un control nativo. El
diario no identifica cuál de sus selectores falló. La pantalla observada después
mostraba la invitación sin enviar; se canceló y no se concedió acceso a la hoja.
No se emitió token del escritor ni se inició el lote de Sheets o la migración.

La limpieza verificó la retirada de la concesión IAM temporal, la desactivación
del escritor y la revocación de OAuth. Una lectura posterior confirmó la cuenta
deshabilitada, sin claves ni bindings; Drive y Sheets devolvieron 401 al mismo
token de lectura revocado. El cuadro de Compartir mostró de nuevo al propietario
y cuatro lectores, sin el escritor. La inspección posterior de Firestore encontró
la fuente esperada y únicamente el bloqueo de ventana ausente. La reversión no se
ejecutó y este intento no autoriza otro. Evidencia privada: diario
`2026-11-02-authorized-develop-window/journal/develop-original-20261102-interactive-03`.

La corrección local espera de forma acotada la aparición de los controles y
registra cuál falta o es ambiguo. Solo repite lecturas de accesibilidad; no repite
la entrada, la confirmación del destinatario ni el envío de permisos. Doce pruebas
del adaptador, el lint y el build de Functions pasan. El formulario demorado es una
simulación: la corrección todavía no se ha ensayado en Google y no demuestra la
causa exacta. Para otro intento hay que revisar de nuevo la huella del canal,
renovar las observaciones y obtener una autorización concreta.

## Formulario real verificado sin envío — 2026-11-11

Con la corrección `caefdcf7`, el mismo adaptador reconoció el destinatario, el rol
Editor y la casilla de notificación en el formulario real de Google. Llegó al
punto anterior a compartir a las 16:09:59 UTC; el ensayo bloqueó expresamente el
envío y canceló la invitación. La lista volvió a mostrar al propietario y cuatro
lectores, sin el escritor. No se concedió edición ni se abrió mantenimiento.

El ensayo usó metadatos sintéticos para atravesar los controles locales del
adaptador, con la interfaz real y dos bloqueos independientes del envío. Valida
el reconocimiento del formulario, no la concesión/retirada efectiva de permisos
ni la admisión de migración. La evidencia privada `2026-11-11-native-form-unsent`
conserva nueve lecturas AX, el resultado, la captura tras cancelar y la nueva
revisión del canal ligada a su SHA-256 `8f8e48ae…9e3cb`. No se modifica el
expediente consumido del 2 de noviembre.

Los 17 archivos fijados siguen íntegros y se reproducen exactamente el paquete
`7201f1cf…f257715` y su materialización `373ee000…faced`: 203 escrituras Firestore,
53 celdas y dos marcadores. Para el siguiente intento hay que renovar las lecturas
de autoridad, fuentes y hoja/carpeta y preparar autorización/ventana nuevas; el
resultado del formulario no sustituye esas lecturas.

La renovación real de solo lectura (`2026-11-11-readonly-refresh`) verifica los
controles de Cloud, los seis índices y el escritor deshabilitado, sin claves ni
bindings temporales y aislado. El paquete antiguo se rechaza porque cambió solo
`versions.ios.min` en `config/global` y `config/public`; `config/member` conserva
su imagen. Un nuevo censo atómico confirma que las demás fuentes revisadas siguen
idénticas. La configuración no se escribe en ninguna dirección de la migración.

El candidato privado `41d3109d…05fd`, preparación `1175a90e…bbea`, conserva las
intenciones públicas, imágenes antiguas y 53 celdas idénticas, con 203/140
escrituras forward/inverse. Renueva los enlaces de procedencia, operación,
archivos y marcadores; sus rutas físicas de auditoría no son byte-idénticas.
No reutiliza la autorización del intento anterior. Mantiene las observaciones históricas de
Drive/Sheets identificadas como tales y **no es ejecutable**: faltan su renovación
directa, manifiestos/controles de la ventana y autorización nueva. El conector
actual sigue omitiendo versión/permisos completos; no se consideran verificados
por el resultado parcial de metadatos.

Una transacción real de solo lectura con ese candidato verifica la fuente y
devuelve únicamente `window_scope_missing`, con cero escrituras y sin abrir
mantenimiento. Esta admisión parcial no acredita las observaciones de Google
pendientes ni permite ejecutar el candidato.

### Renovación directa de la hoja y la carpeta

La sesión de lectura autorizada produjo una captura directa completa conservada
en `2026-11-11-owner-refresh`: dos imágenes de celdas idénticas, versión 287,
propietario y permisos de hoja/carpeta estables. La imagen de preservación sigue
siendo `2682cfb7…81b3`. El cierre agotó el tiempo de la sesión de herramientas
después de guardar la captura. La recuperación encontró el token inválido
(respuesta 400 a otra revocación) y comprobó 401 con el mismo token en Drive y
Sheets. No se conserva una respuesta 200 del cierre inicial y no se inventa.
No se solicitó otro token ni se concedió edición o abrió mantenimiento.

La composición final `2026-11-11-next-window-preparation` enlaza el paquete
renovado `bcb7d82a…2632f`, preparación `0926cf4b…39645` y operación
`request-hu084-initial-fd4a76de51ab9a9280cd` con los formularios y la nueva revisión
del canal. Los 17 archivos fijados, los tres diarios anteriores y la denegación
sin autorización validan. La construcción aislada y tres pruebas privadas del
codec/vínculo usan datos y respuestas expresamente sintéticos, sin proveedores.
El recibo nuevo `develop-original-20261111-interactive-04` conserva autorización
en false, ventana null y confirmaciones vacías. La preparación está lista para
solicitar autorización; los manifiestos y la evidencia vigente se obtendrán bajo
la barrera real, con el presupuesto revisado de 20 minutos y un único token de
300 segundos. Las observaciones históricas de efectos y autoridad no se convierten
en pruebas nuevas ni se elimina su aceptación de riesgo pendiente.

## Intento 04 detenido tras conceder el permiso — 2026-11-11

El intento único autorizado `develop-original-20261111-interactive-04` envió la
concesión a las 16:40:55 UTC. Google añadió al escritor como Editor, pero el
adaptador no reconoció el estado siguiente. La retirada automática también falló
al comprobar el diálogo recién reabierto. El terminal original conserva
`inspection-required` y `file-unverified`; no se emitió token del escritor ni se
inició mantenimiento, migración o lote de celdas. El ensayo previo sin envío no
ejercitaba estas transiciones posteriores a la concesión.

El operador retiró el acceso desde el cuadro de Compartir, guardó y reabrió el
diálogo: a las 16:42:46 UTC figuraban únicamente el propietario y cuatro lectores.
La verificación independiente posterior confirma escritor deshabilitado, cero
claves y bindings IAM, aislamiento y fuente Firestore intacta; el mismo token
OAuth devuelve 401 en Drive y Sheets. El diario recibió una recuperación manual
con referencias y huellas de esas pruebas y se liberó el bloqueo local mediante
su API. Los 23 registros originales permanecen intactos, incluido el fallo de
limpieza automática. La recuperación no permite reanudar ni repetir la migración.

Evidencia privada: el diario `develop-original-20261111-interactive-04`,
`2026-11-11-next-window-preparation/manual-file-cleanup-*`,
`2026-11-11-postflight04-164322` y el recibo OAuth posterior. La ventana terminó
anticipadamente y la autorización única quedó consumida.

La corrección local añade espera acotada de lecturas tras compartir, cerrar,
reabrir y guardar una retirada, sin repetir esos clics. Una acción ya enviada
debe observarse hasta un estado asentado incluso si vence su plazo; el error de
plazo se conserva y bloquea el avance. Si la concesión queda incierta, la sesión
no convierte una lectura de ACL ausente en prueba de cierre, también al recuperar.
Pasan 19 pruebas del canal y 25 de sesión con Node 22, lint/build de Functions y
lint CJS. La corrección se publicó después en `fcdab63e`; el ensayo real posterior
se recoge a continuación.

## Concesión y retirada con el escritor deshabilitado — 2026-11-11

El ensayo exclusivo autorizado pasó con el adaptador de `fcdab63e`: una concesión
y una retirada completas, con verificación independiente de ACL, sin resultado
incierto ni fallo de limpieza. Entre 17:02:17 y 17:02:45 UTC se comprobaron la cuenta
deshabilitada, cero claves de usuario y cero bindings IAM antes/después de ambas acciones.
No se activó el escritor ni se emitió su token; el ejecutor del ensayo excluye
mutaciones IAM, llamadas a Sheets, Firestore y migración.

La sesión del propietario solicitó únicamente `drive.metadata.readonly`, Online
sin renovación. Se revocó con respuesta 200 y el mismo token devolvió 401 en Drive.
El diálogo reabierto mostró al propietario y cuatro lectores, sin el escritor.
Evidencia privada: `2026-11-11-native-disabled-writer-rehearsal`, diez registros de
fase, resultado, revisión ligada al SHA actual, cierre OAuth y captura final.
Los cuatro casos locales del helper validan sus guardas, no sustituyen el ensayo
real ni prueban una migración completa.

Queda validado el ciclo nativo que había fallado. Otro intento de migración
requiere regenerar la revisión con el código publicado, renovar las observaciones
afectadas por los cambios de permisos y obtener su propia autorización/ventana.
Este ensayo no abre mantenimiento ni autoriza esa ejecución.

## Revisión renovada para el intento 05 — 2026-11-11

La nueva lectura directa autorizada observó la hoja y su carpeta entre 17:37:42
y 17:37:50 UTC: versión real **291**, propietario y cuatro lectores, sin acceso
del escritor. Las dos capturas completas de las seis pestañas son idénticas y
conservan la imagen `2682cfb7…81b3`, incluidas las fechas y el orden publicados.
Se hicieron trece GET acotados. OAuth Online sin renovación se revocó con respuesta
200; el mismo token devolvió primero 401 en Drive/200 en Sheets y, a las 17:38:44,
401 en ambos. Se conservan ambas sondas, sin ocultar la propagación del cierre.

El paquete regenerado `6177be45…9f73a81`, preparación `f3b5a9b0…faa2b5b8` y
operación `request-hu084-initial-6678cf8a7c2756773ef8` enlazan esa captura y los
controles Cloud/identidad renovados a las 17:08:24 UTC. Sus 17 archivos fijados
validan; mantiene las 203 escrituras forward y 140 inverse previstas, sin escribir
configuración, y las 53 peticiones de celdas más dos marcadores. Las peticiones de
celdas son exactas respecto al paquete previo; los identificadores y marcadores
de auditoría se regeneran. La inspección del paquete exacto a las 17:39:38 UTC usa
una transacción Firestore de solo lectura y cero escrituras: la fuente coincide y
el único bloqueo es `window_scope_missing`. No se presenta como admisión completa.

La plantilla nueva `develop-original-20261111-interactive-05` incorpora la revisión
del canal ligada al ciclo real de concesión/retirada y distingue los tres diarios
con cierre automático del fallo original y la recuperación manual del intento 04.
Las comprobaciones locales verifican los enlaces, el rechazo sin autorización,
la construcción aislada y tres pruebas del codec/formularios; los datos positivos
son sintéticos, sin proveedores. La preparación dejó autorización false, ventana
null y confirmaciones vacías; el intento posterior recoge su consumo. La propuesta
fue de veinte minutos, con un único token de 300 segundos; no fijó fechas ni
reutilizó compromisos.

La revisión independiente enlaza 337 hashes actuales con la revisión anterior y
las dos correcciones de canal/sesión ya validadas. La comparación histórica frente
al 1 de noviembre se conserva, incluidas sus diferencias; no se declara igualdad
literal. El operador privado fija el manifiesto y comprueba archivos y evidencias
al cargar, preparar e iniciar el intento. Cinco pruebas locales de alteración,
ausencia, manifiesto cambiado, archivo añadido y cambio antes de iniciar detienen
el avance con cero llamadas a proveedores. Antes de cargar el operador se requiere
un contexto Node nuevo o retirar solo su caché y la del worktree en la sesión CUA;
comprobar el disco no acredita los módulos ya cargados. No cambia el ejecutor del
repositorio.

Evidencia privada: `2026-11-11-interactive05-owner-refresh`,
`2026-11-11-interactive05-rebind` y `2026-11-11-interactive05-preparation`.
Durante esta preparación solo hubo lecturas y validación local, con el escritor
deshabilitado. La ejecución requería autorización propia y la ventana real, con
observaciones vigentes y
confirmaciones posteriores al permiso. Android/iOS no cambian y mantienen paridad;
las comprobaciones nativas y el build/lint se reutilizan por no cambiar código de
apps o Functions. El guion privado de arranque se valida por separado.

## Intento 05 detenido durante las confirmaciones — 2026-11-11

El intento único autorizado comenzó a las 18:19:26 UTC, con máximo hasta las
18:39:26. La concesión de edición quedó verificada y se recibió la confirmación
nueva del propietario. La recogida rechazó el paso de administradores 457 ms
después de publicar su pregunta, cuando quedaban más de diez minutos de plazo.
El terminal de las 18:21:40 conserva `inspection-required` y `file-unverified`:
la retirada automática esperó veinte segundos sin atención de la llamada CUA.
No hubo emisión de token del escritor, adquisición de barrera, lote de Sheets ni
escrituras de migración. La respuesta de administradores recibida después quedó
en el registro 31; es tardía y no se presenta como confirmación aceptada.

La retirada manual se guardó y verificó reabriendo Compartir a las 18:23:46 UTC:
propietario y cuatro lectores, sin escritor. El postflight independiente confirma
escritor deshabilitado, cero claves de usuario/bindings IAM, aislamiento y fuente
Firestore intacta. El cierre OAuth automático conserva respuesta 200 y 401 del mismo token
en Drive y Sheets. La ventana humana se liberó anticipadamente. El proceso CUA
se cerró después de guardar las pruebas; la recuperación del bloqueo local usa
la API existente: conserva los 32 registros originales, incluido el terminal y
la respuesta tardía, y añade dos recibos de recuperación; ambos bloqueos locales
quedan retirados. No se modifica la guarda de recuperación para liberar un
proceso vivo ni se autoriza reanudar la ejecución.

El montaje pasaba un `notify` que escribía mediante `nodeRepl.write`. Una prueba
local reproduce `node_repl exec context not found` al resolver desde otra llamada
una continuación asíncrona que usa ese aviso; la llamada síncrona sí funciona.
El orden del diario y el código apuntan a ese fallo de instrumentación, aunque la
excepción original no quedó guardada. La corrección debe mantener los avisos en
estado consultable, invalidar pregunta/temporizador al cerrar y rechazar respuestas
tardías antes de escribirlas. También debe atender la cola de retirada mientras
espera respuestas humanas. Aumentar el plazo no corrige este problema.

La corrección local `2026-11-11-coordinator-fix` conecta intercambio humano, cola
nativa y vigilancia en una plantilla sin paquete, credenciales ni autorización.
El rechazo de la recogida invalida la pregunta antes de registrar el evento; una
concesión atrasada se cancela al cerrar y una retirada puede atenderse durante
la limpieza. Acciones nativas aún en curso mantienen inspección pendiente. Pasan
12 pruebas con Node 22 y lint focalizado. En NodeREPL se comprobó una espera entre
dos llamadas: la respuesta resuelve sin error de contexto y una respuesta tras
cierre no añade registros. Es un ensayo sintético sin proveedores; la plantilla
rechaza ejecución y todavía debe vincularse a un nuevo paquete revisado.

Evidencia privada: `2026-11-11-interactive05-live`,
`2026-11-11-postflight05-182301` y el diario
`develop-original-20261111-interactive-05`. La autorización quedó consumida.
Las observaciones anteriores de versión 291 y la preparación del intento 05 son
históricas; otro intento requiere revisar el coordinador corregido y renovar los
enlaces afectados por los cambios de permisos. Producción y las apps no cambiaron.
Se reutilizan los gates de Functions y nativos: el repositorio solo cambia
documentación en este bloque; las comprobaciones del coordinador privado son las
indicadas arriba.

## Paquete actualizado y coordinador conectado — 2026-11-11

El cierre del intento 05 y su corrección local se publicaron en `5df19c52`.
La nueva preparación renueva Cloud/IAM/índices y el censo atómico de develop:
payloads y versiones de servicio coinciden con la fuente anterior. La captura
directa de la hoja y su carpeta observa la versión real **293**, propietario y
cuatro lectores. Las dos imágenes completas de las seis pestañas conservan
`2682cfb7…81b3`. OAuth Online sin renovación se revocó con respuesta 200; tras dos
sondas Drive401/Sheets200, el mismo token devuelve 401 en ambos a las 18:55:13 UTC.

El paquete `e97cf026…22377d1`, preparación `10cc98e4…e3ed760` y operación
`request-hu084-initial-1215bc534e8eba0f9007` fijan esas observaciones. Los 17 pins,
las 203/140 escrituras previstas y las 53 peticiones de celdas más dos marcadores
validan; las peticiones de celdas son idénticas y no se escribe configuración.
La inspección exacta de Firestore usa una transacción de lectura y cero escrituras;
la fuente coincide y queda solo `window_scope_missing`.

El operador privado 06 conecta el intercambio humano, la cola nativa y el driver
corregidos al ejecutor existente. Sus puertos de inspección, limpieza y recuperación
cierran la pregunta antes de actuar, incluso cuando la apertura devuelve
`setupFailed`. El registro de sesión invalida la pregunta antes de añadir un
rechazo de recogida. La vigilancia atiende retiradas, cancela concesiones atrasadas
y mantiene inspección pendiente si hay una acción nativa en curso. No hay callbacks
de herramientas en la continuación asíncrona. Conserva la guarda de 337 fuentes y
siete pruebas históricas, y fija también las huellas de los tres módulos nuevos.

Pasan **22 pruebas del operador y tres independientes**, con Node 22, más construcción
sintética y lint focalizado. Incluyen el `runControlledWindow` real con puertos
simulados, fallo de barrera, apertura `setupFailed`, respuesta tardía sin escritura,
retirada atendida una vez y negativa del operador sin acceder al proveedor cuando
falta autorización. Los cinco diarios anteriores y sus recuperaciones conservan
sus huellas. Esto valida la conexión local; no acredita un ciclo real de servicios.

El recibo `develop-original-20261111-interactive-06` deja autorización false,
ventana null y confirmaciones vacías. El máximo propuesto sigue en veinte minutos
y un token de 300 segundos. Antes de ejecutar hacen falta autorización nueva,
observaciones vigentes y confirmaciones reales; la vigilancia debe permanecer
atendida en las llamadas CUA y una interrupción no acredita limpieza.
El escritor sigue deshabilitado, sin concesiones nuevas de edición ni IAM.
No se abre mantenimiento ni se ejecutan migración, despliegues o FCM.
Producción y ambas apps no cambian.

Evidencia privada: `2026-11-11-package-coordinator-refresh-184922`,
`2026-11-11-interactive06-owner-refresh`, `2026-11-11-interactive06-preparation`
y `2026-11-11-interactive06-wiring-tests`. Se reutilizan los gates nativos/Functions
por no cambiar su código ni contratos; las comprobaciones nuevas son las locales
indicadas. La preparación nueva queda local, posterior al commit citado arriba.

## Intento 06 cerrado al vencer la confirmación — 2026-11-11

La preparación se publicó en `29ea717c`. El intento único autorizado comenzó a
las 19:50:36 UTC, con máximo hasta las 20:10:36. La concesión quedó verificada y
se pidió la confirmación posterior del propietario. La recogida terminó sin
respuesta registrada dos milisegundos después del plazo de las 20:03:06 UTC.
Ese orden coincide con el temporizador de respuesta; el diario no conserva el
texto de la excepción. El controlador se mantuvo atendido durante la espera.

El terminal de las 20:03:35 UTC conserva `inspection-required` y limpieza sin
fallos: una retirada nativa verificada, IAM retirado, escritor deshabilitado y
OAuth revocado con respuesta 200 y 401 del mismo token en Drive y Sheets. No hay
acciones en vuelo, incumplimientos de presupuesto, archivos pendientes ni
bloqueos locales. Los 31 registros permanecen intactos, con terminal al final.
No hubo emisión del token del escritor, adquisición de barrera, lote de Sheets
ni migración; el postflight independiente confirma la fuente exacta sin cambios,
escritor deshabilitado, cero claves de usuario/bindings IAM y aislamiento.
Compartir vuelve a mostrar al propietario y cuatro lectores.

La respuesta «Sí, todo sigue vigente» llegó después del terminal y se conserva
separada del diario, sin aceptarla como consentimiento ni reanudar la operación.
La pregunta indicaba el compromiso hasta las 21:10:36 de Madrid, pero omitía en
su propio texto el límite de respuesta de las 21:03:06. Las futuras peticiones
deben indicar claramente **responder antes de** y **mantener el compromiso hasta**,
con las dos horas obtenidas del desafío real. La ventana humana se liberó tras
verificar el cierre; la autorización única está consumida.

Formato obligatorio al presentar cada desafío: «**Responde antes de [hora Madrid
de `deadlineMillis`]**. Mantén el compromiso hasta [hora Madrid de fin de ventana]».
La respuesta se aplica solo si `status().pending` conserva el mismo digest y sigue
dentro del plazo. Una respuesta posterior al terminal se guarda aparte; nunca se
llama a `answerAndAttend` para reabrir una pregunta cerrada.

Evidencia privada: diario `develop-original-20261111-interactive-06`,
`2026-11-11-interactive06-live`, `2026-11-11-postflight06-200456` y
`2026-11-11-interactive06-result`. Este resultado comprueba el cierre automático
real con la vigilancia corregida, no una migración en vivo. Se reutilizan las
25 pruebas locales del código sin cambios; no se repiten gates nativos/Functions
para este registro documental. Producción y las apps no cambian. Otro intento
requiere actualizar las observaciones afectadas por permisos, revisar el paquete
y recibir autorización y confirmaciones nuevas; esta respuesta tardía no las suple.

## Preparación del intento 07 — 2026-11-11

Tras el cierre del intento 06, publicado en `6c97de0e`, se renovaron las
observaciones de Develop. La hoja está en la versión 295 y conserva la imagen
completa, las fechas y el orden revisados. El paquete `7ef0b3f0…d1041c3`,
preparado `21bd0830…a1ef64aa` y operación `request-hu084-initial-0d45873f91ccf634adc1`
conservan 203 escrituras previstas en Firestore, 53 celdas y dos marcadores.
La admisión exacta efectuó una transacción de solo lectura y ninguna escritura;
su único impedimento registrado es la ausencia de una ventana concreta.

La revisión independiente comprobó los 17 archivos del paquete, la equivalencia
del contenido y las fuentes, y el rechazo del operador antes de acceder a
proveedores cuando faltan las confirmaciones. Pasaron 28 pruebas locales: 11 del
coordinador, una de conexión, siete de integridad de fuentes, tres de formularios,
dos de presentación de plazos y cuatro del fechado en copias temporales. No
son una prueba de migración real. El nuevo control rechaza fechar la ventana si
la sesión de lectura del propietario no cubre, de forma conservadora, los 20
minutos completos. Cada pregunta debe mostrar por separado el límite para
responder y la hora hasta la que se mantiene el compromiso, en hora de Madrid.

El usuario autorizó un único intento y confirmó la ventana. El fechador registró
el intervalo a partir de las 20:29:06 UTC, pero la composición del operador falló
antes de arrancarlo: nuestra llamada omitió `ownerCredential.sessionId`. Es un
fallo de preparación del operador, no de la respuesta del usuario. No se creó ni
arrancó el operador y la ventana no comenzó operativamente. No se concedieron
permisos, emitió token del escritor, abrió mantenimiento ni ejecutó migración; no
se hizo otro intento. La sesión de lectura OAuth se revocó con respuesta 200 y el
mismo token fue rechazado con 401 en Drive y Sheets. La comprobación independiente posterior confirmó que la fuente coincide con el
paquete 07, el escritor sigue deshabilitado y aislado, sin claves de usuario ni
bindings IAM: diez lecturas y una transacción de solo lectura, sin escrituras.
No existe diario del 07 ni bloqueo local de ejecución o recuperación. La pestaña
OAuth se cerró, el SDK terminó y se descartaron las referencias al token. La
ventana se liberó y el usuario puede volver a abrir la hoja. Antes de fechar otra
ventana hay que validar el descriptor completo y obtener una nueva autorización.

Se ha preparado una validación local previa al fechado que exige el descriptor
completo del propietario, duración suficiente de su sesión, acceso IAM, identidad
del SDK y los cuatro controles de la pestaña. Tres pruebas Node 22 pasaron: la
omisión del identificador se rechaza antes del fechador y de los proveedores; el
caso completo construye el operador 07 exacto en una copia con ventana y
confirmaciones simuladas y proveedores dobles. No es una ejecución real. Queda
pendiente incorporar esa misma entrada validada al próximo arranque y obtener una
nueva autorización; el expediente consumido del 07 no se modifica.

La respuesta tardía del 06 no se reutiliza. Evidencia privada:
`2026-11-11-interactive07-refresh`, `2026-11-11-interactive07-owner-refresh`,
`2026-11-11-interactive07-preparation`, `2026-11-11-interactive07-live` y
`2026-11-11-postflight07-202959` y `2026-11-11-operator-input-preflight`.

## Intento 08 detenido durante las confirmaciones — 2026-11-11

El cierre del intento 07 se publicó en `e106d4cd`. El paquete 08
`a21f4f0c…f54bce2` y la admisión exacta conservaron las 203 escrituras
previstas, 53 celdas y dos marcadores. La observación viva de la hoja confirmó
la versión 295, la autoridad y la imagen completa iguales a la referencia
retenida del 07; su revocación histórica corresponde solo a aquella sesión.
Pasaron 32 pruebas locales y la revisión independiente. El controlador también
validó los datos completos de arranque antes de fechar la ventana real.

El intento único autorizado comenzó a las 21:42:27 de Madrid, con fin máximo
a las 22:02:27. La confirmación del propietario se recibió y registró a las
21:54:17, dentro del plazo. La petición posterior para administradores comenzó a las 21:54:18, con
el mismo límite de las 21:54:57, por lo que quedaron unos 39 segundos para
responder. No consta respuesta antes de vencer y la recogida se rechazó. No se
atribuye el resultado al usuario: hay que acordar una ventana de respuesta
inicial viable antes de plantear otro intento, sin repeticiones silenciosas.
Antes de la primera pregunta se explicará que propietario, administradores e
informes son tres confirmaciones consecutivas dentro de un mismo plazo común.

El terminal a las 21:55:28 conserva `inspection-required`, limpieza sin fallos,
operaciones asentadas, ninguna acción en vuelo ni incumplimiento de plazos. Los
34 registros no tienen archivos pendientes. La retirada de la hoja y de IAM
consta verificada; el ejecutor revocó OAuth con 200 y recibió 401 con el mismo
token en Drive y Sheets. La pestaña OAuth se cerró y el proceso llamador descartó
las referencias. No se emitió token del escritor ni se inició barrera, lote de
Sheets o migración; tampoco se accedió a producción. La autorización única del
08 está cerrada. El postflight independiente de solo lectura confirmó la fuente
exacta, el escritor deshabilitado y aislado, sin claves ni bindings: diez lecturas
y una transacción, sin escrituras. El diario no tiene archivos pendientes y no
hay bloqueos locales de ejecución o recuperación.

Evidencia privada: diario `develop-original-20261111-interactive-08`,
`2026-11-11-interactive08-refresh`, `2026-11-11-interactive08-preparation` e
`2026-11-11-interactive08-live` y `2026-11-11-postflight08-205619`.

La confirmación de administradores recibida tras el cierre («Confirmo ambas
cuentas hasta las 22:30») se conserva en un recibo privado separado. No se añade
al diario, no amplía la ventana del 08 y no autoriza otro intento; los 34 registros
y su huella permanecen intactos.

## Intento 09 detenido tras las confirmaciones — 2026-11-11

Tras el cierre del 08, publicado en `7ed436eb`, se preparó el paquete
`432623c0…d01d0f4` con la lectura actual de la hoja en versión 297. La sesión
de lectura estaba activa y su cierre quedaba pendiente del propio intento; no se
le atribuyó el cierre de una sesión anterior. Se mantuvieron el contenido, las
203 escrituras previstas, 53 celdas y dos marcadores. La admisión exacta fue de
solo lectura; pasaron 32 pruebas locales y la revisión independiente.

El usuario confirmó la ventana y las tres respuestas consecutivas se registraron
dentro del plazo. La recogida inicial se rechazó después de esas respuestas,
aunque las etapas registradas se completaron correctamente antes del vencimiento.
El fallo ocurrió en el procesamiento posterior de la recogida; el registro no
conserva el error capturado y por sí solo no identifica la primera excepción.
El terminal conserva `inspection-required`, limpieza sin fallos, operaciones
asentadas, sin acciones en vuelo ni incumplimientos de plazos. Los 39 registros
del diario no tienen archivos pendientes. La retirada de la hoja y de IAM consta
verificada; el ejecutor revocó OAuth con respuesta 200 y el mismo token recibió
401 en Drive y Sheets. La pestaña se cerró y el llamador descartó las referencias.

La inspección registra que Sheets no se inició y que la barrera y Firestore no
estaban disponibles para esa inspección. El postflight independiente confirmó
que la fuente exacta sigue igual y el escritor continúa deshabilitado y aislado,
sin claves ni bindings: diez lecturas y una transacción, sin escrituras. No hay
bloqueos locales y la ventana se ha liberado. No se conserva una traza de
excepción que permita atribuir el primer rechazo a un fallo de lectura
o a un plazo. El intento único terminó y no se ha autorizado un reintento.

Una reproducción local con el paquete y las respuestas registradas identificó una
incompatibilidad suficiente para rechazar la admisión: la aceptación del riesgo
histórico era anterior a diez observaciones de cierre incluidas en el paquete,
aunque el validador exige que esas evidencias la precedan. Al no haberse conservado la excepción real,
la reproducción no demuestra que esa fuese la primera causa del rechazo en vivo.
No se ha ejecutado otro intento ni se ha modificado la evidencia consumida.

La corrección local comprueba esa cronología antes de abrir la sesión o contactar
proveedores. Si falla la recogida posterior, el diario conserva un punto de control
estable y una categoría genérica, sin mensajes, valores ni credenciales; si falla
ese registro, se conserva el error original y continúa la limpieza. Pasan las
112 pruebas integradas locales de sellado, colector, ventana controlada, entradas humanas y
sesión original, junto con lint y build de Functions y comprobación específica de
los cuatro archivos `.cjs`. Estos resultados no demuestran cuál fue la primera
excepción real del 09 ni son una ejecución real. Antes de otro intento deberá obtenerse una aceptación
genuina del riesgo histórico después de preparar y revisar la evidencia y los
cierres correspondientes y antes de cualquier proveedor; no se cambiará su fecha
ni se utilizará la confirmación de ventana 09 como aceptación del riesgo. Los dos
scripts modificados requieren revisar sus nuevas huellas antes de otro intento.

Evidencia privada: diario `develop-original-20261111-interactive-09`,
`2026-11-11-interactive09-refresh`, `2026-11-11-interactive09-preparation`,
`2026-11-11-interactive09-live` y `2026-11-11-postflight09-212435`.

## Intento 10 detenido tras la admisión — 2026-11-11

La corrección del 09 se publicó en `8105d0cf`. Para el 10 se revisó el paquete
`8d81fbb5…9408d7c` y la lectura actual de la hoja en versión 299. La revisión
de fuentes fijó 339 archivos: 337 anteriores sin cambios y dos scripts añadidos,
con ocho recibos de respaldo; se reutilizó la regresión integrada de 112 pruebas
y pasaron 39 pruebas locales nuevas. La aceptación expresa del riesgo fue
separada de la autorización de operación y posterior a la revisión del paquete
y los 23 predecesores. La confirmación de ventana también fue independiente.

En la ventana autorizada se registraron a tiempo las tres confirmaciones iniciales
y seis respuestas posteriores. La recogida inicial se verificó y selló, se adquirió
la barrera, la admisión terminó con las comprobaciones superadas y se emitió el
único token del escritor, con comprobación positiva. Después el ejecutor se detuvo
y pasó a inspección. No consta una intención de ejecución conjunta en el diario.
El diario no conserva la excepción original; la revisión posterior se describe a
continuación.

El terminal conserva `inspection-required`, sin fallos de limpieza ni acciones
en vuelo; los 72 registros no tienen archivos pendientes. El cierre del permiso
de la hoja, IAM y OAuth consta verificado por el ejecutor. La pestaña OAuth se
cerró y se descartaron las referencias del llamador. La barrera se adquirió.
El postflight independiente de solo lectura confirmó la fuente exacta sin cambios, el escritor deshabilitado y aislado, sin claves ni
bindings, y el documento de mantenimiento ausente. El registro histórico de
la barrera sigue retenido y coincide con el diario; no se afirma su liberación.
No hay locks locales, intención conjunta ni despacho de lote registrados.

La revisión local identifica dos obstáculos reproducibles: el envoltorio de la
sesión no reflejaba los datos del escritor añadidos posteriormente y la admisión
tardó 88,115 segundos en completarse, superando su límite de 60 segundos. No se
conservó la excepción original, así que no puede afirmarse cuál fue el primer
fallo real ni su orden. El checkpoint histórico se conserva y no se afirma su
liberación.

La corrección local conserva la identidad de la sesión para que los campos del
escritor diferido sean visibles. La admisión mantiene el inicio real de recogida
y empieza su límite técnico de 60 segundos con dos lecturas nuevas de fuente.
El manifiesto se genera después de las observaciones humanas inicial y final,
con la barrera verificada, sin retimbrarlo ni ampliar su límite. Una prueba conjunta en
Firestore Emulator pasó con el ejecutor y la sesión reales, 88,115 segundos
sintéticos de respuestas repartidas, preparación del escritor de 16,728 segundos
y dos informes posteriores de seis segundos. El primer write se preparó en la
transacción CAS con el manifiesto a 26,858 segundos; se verificaron 203 escrituras,
53 celdas y dos marcadores. Una caducidad inyectada rechazó el CAS y el lote y
permitió limpiar permisos. Google, Sheets, personas y tiempos son dobles; el
`readTime` del censo se adapta al reloj de prueba. No se garantiza que la latencia
real quepa en ese margen. Además, seis pruebas del motor en el emulador cubrieron
la generación posterior a las observaciones en ida y vuelta, y el rechazo de
informes o fuente alterados. Estas correcciones del operador son posteriores al
commit `8105d0cf`. El próximo operador debe incorporar el helper corregido y
revisar las nuevas huellas antes de cualquier decisión de recuperación o intento.

El gate local posterior reúne 356 ejecuciones de pruebas en 19 archivos, sin
fallos ni omisiones; no se contabilizan como casos únicos. Build, lint de Functions
y revisión ESLint específica de los siete `.cjs` pasan. El gate completo del
emulador pasó 96 ejecuciones en tres archivos, incluidas las seis pruebas nuevas
del motor; las dos conjuntas pasaron por separado: 98 ejecuciones de emulador en
total, sin volver a sumar las seis. Los logs están en
`2026-11-11-window10-local-fix-validation` y
`2026-11-11-attempt10-joint-emulator`; no son una ejecución real en Develop.

Evidencia privada: diario `develop-original-20261111-interactive-10`,
`2026-11-11-interactive10-refresh`, `2026-11-11-interactive10-preparation` y
`2026-11-11-interactive10-live` y `2026-11-11-postflight10`.

### Validación para commit y push — 2026-11-12

Las siete huellas de código y pruebas y las de los logs brutos coinciden con el
gate final del 11 de noviembre: se reutilizan sus 356 ejecuciones de regresión y
98 de emulador, build y lint para esta entrega. Después solo cambió el texto de
entrega y la fecha del changelog. El código nativo y los contratos de las apps
siguen iguales; no se repiten sus gates. Quedan pendientes incorporar el helper
al próximo operador concreto y revisar su paquete y huellas antes de otro intento
autorizado.
