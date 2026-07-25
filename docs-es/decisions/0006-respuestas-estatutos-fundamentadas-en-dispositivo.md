# ADR-0006: Fundamentar en el dispositivo las respuestas sobre estatutos

## Estado

Aceptada

## Fecha

2026-07-24

## Contexto

HU-019 describia inicialmente un asistente local-first que escalaba preguntas
complejas a un modelo en la nube. La implementacion existente no ejecutaba un
modelo local: ordenaba paginas completas del PDF por coincidencia lexica,
devolvia extractos largos y conservaba un endpoint anonimo opcional de nube.
Esto producia coincidencias debiles, hacia enganoso el modo de respuesta y
abria una via para enviar fuera del dispositivo la pregunta de un socio y el
contexto del documento.

Los estatutos son un documento breve y estable en espanol: 13 paginas fisicas
de PDF y 22 articulos. Aun asi, incluir todo el documento en un prompt supera el
presupuesto practico de contexto de algunos modelos locales y no hace fiables
las citas. Las respuestas pueden influir en la comprension de derechos,
deberes y gobierno de la asociacion, por lo que el texto generado nunca debe
presentarse como fuente de verdad.

iOS 26 ofrece Foundation Models solo cuando Apple Intelligence y un locale
espanol compatible estan disponibles. En Android, ML Kit Prompt puede usar
Gemini Nano mediante AICore en un conjunto limitado de dispositivos. El
artefacto actual de Prompt esta etiquetado como beta; los terminos adicionales
prohiben usar en produccion servicios etiquetados como Preview, Experimental
Access o una designacion similar, y tambien prohiben clientes que probablemente
puedan ser usados por menores de 18 anos. Mientras no exista una aclaracion
escrita del proveedor, el proyecto trata beta de forma conservadora como una
designacion prerelease similar.

## Criterios de decision

- Mantener en el dispositivo las preguntas y el contenido de los estatutos.
- Ofrecer procedencia verificable por articulo y pagina fisica del PDF.
- Evitar dependencia de nube, credenciales, coste y fallos de red.
- Degradar de forma predecible en hardware no compatible.
- Subordinar la redaccion generada al texto canonico del PDF.
- Mantener paridad visible Android/iOS cuando lo permitan las condiciones de
  cada plataforma.

## Opciones consideradas

### Prompt local con el documento completo

Descartada porque la extraccion completa no cabe en todos los contextos de los
modelos objetivo y una cita generada por el modelo no es verificable.

### Distribuir un modelo Android propio con LiteRT

Aplazada para el MVP. Evitaria los terminos de audiencia de ML Kit, pero haria
responsable a la app de una descarga grande, aceleracion por hardware,
compatibilidad en todo el rango API 29, actualizaciones y evaluacion de calidad
por familia de modelo. Sigue siendo una opcion si un modelo en espanol lo
bastante pequeno supera el conjunto canonico en dispositivos representativos
de gama baja y media.

### Recuperacion determinista con generacion en nube

Descartada porque envia fuera del dispositivo la pregunta y los extractos,
anade coste operativo y contradice el fallback a solo PDF aprobado.

### Busqueda extractiva determinista

Se conserva como capa de fundamentacion. Por si sola es fiable, pero no ofrece
la explicacion breve y natural solicitada para dispositivos capaces.

### Generacion local fundamentada y condicionada por capacidad

Seleccionada. La recuperacion determinista elige primero los articulos
relevantes. El modelo local solo puede resumir esos extractos. La aplicacion, y
no el modelo, controla las citas y el estado de respaldo.

## Decision

Crear un indice local versionado con un fragmento por articulo, disposiciones
finales opcionales, rangos de paginas fisicas del PDF y aliases deterministicos
de busqueda en espanol. Para cada pregunta, un recuperador puro selecciona un
maximo de tres fragmentos. Si no existe respaldo suficiente, la aplicacion no
invoca el modelo ni publica una respuesta.

En dispositivos iOS compatibles, usar `SystemLanguageModel.default` solo si su
disponibilidad esta lista y admite tanto `es_ES` para la pregunta y evidencia
en espanol como el locale de salida ingles o espanol activo. Crear una
`LanguageModelSession` nueva para cada pregunta con instrucciones estaticas,
mantener la entrada del usuario fuera de las instrucciones, exigir de forma
explicita el idioma activo de la app para el resumen, usar muestreo
determinista y tratar rechazos, guardrails, idioma no compatible, cancelacion y
errores de contexto como resultado sin respuesta disponible.

Recuperar antes de clasificar el ambito. Si no se obtiene evidencia, marcar
como ajenas solo las consultas inequivocamente no relacionadas; tratar las
ambiguas o relacionadas con estatutos como evidencia insuficiente. Estos dos
resultados y un fallo de generacion muestran orientaciones localizadas
distintas sin desactivar el compositor. Solo la indisponibilidad real del
modelo o del locale cambia iOS al modo solo PDF.

En builds develop/debug de Android, usar ML Kit Prompt solo cuando
`Generation.getClient().checkStatus()` devuelva `AVAILABLE`. El estado
`DOWNLOADABLE` puede ofrecer una accion explicita de preparacion. Los demas
estados mantienen oculto el compositor de preguntas. El adaptador comprueba el
presupuesto de tokens, usa solo los extractos recuperados y rechaza salidas
vacias o sin respaldo. Cualquier distribucion develop que habilite este
adaptador queda restringida a testers adultos conocidos que hayan aceptado los
terminos del proveedor.

Los builds Release de Android no incluyen ni invocan el servicio Prompt
prerelease. Permanecen en modo solo PDF hasta que la API sea apta para
produccion y la asociacion confirme que su audiencia cumple los terminos de
edad del proveedor. Es una brecha temporal de paridad explicita, no un fallback
a nube.

Cada resultado publicado muestra:

- un resumen generado claramente identificado;
- citas deterministas de articulo y pagina fisica del PDF;
- el extracto fuente exacto recuperado;
- acceso permanente al PDF incluido en la app;
- una indicacion de que prevalece el texto del PDF.

Los identificadores de modelo, scores de recuperacion, numero de tokens y
diagnosticos de error solo se muestran en develop. Ninguna pregunta, extracto,
respuesta o diagnostico se envia a un servicio de inferencia en nube. Las
preguntas y la evidencia canonica permanecen en espanol. En iOS, el resumen
generado sigue el idioma ingles o espanol activo de la app, mientras titulos y
extractos oficiales permanecen en su espanol original.

## Consecuencias

### Positivas

- Preguntas y generacion permanecen en local.
- Cada respuesta se puede verificar con texto fuente exacto y el PDF.
- Los usuarios con interfaz inglesa reciben el resumen en ingles sin traducir
  ni sustituir la evidencia canonica en espanol.
- Los dispositivos no compatibles tienen una experiencia sencilla y honesta
  de solo PDF.
- Android e iOS comparten indice por articulos y conjunto canonico de
  evaluacion.
- Se eliminan configuracion de endpoint y rutas de inferencia anonima en nube.

### Negativas

- La consulta local no estara disponible en muchos dispositivos actuales.
- Android produccion tiene inicialmente menos funcionalidad que iOS compatible
  por las condiciones del proveedor.
- Android develop aun devuelve resumenes en espanol y aplica fallback tras
  fallos de contenido; igualar el idioma y los errores contextuales de iOS
  sigue siendo una brecha temporal de paridad.
- Los resumenes generados aun pueden equivocarse y exigen etiquetado explicito,
  evidencia exacta y evaluacion recurrente.
- La disponibilidad y las respuestas pueden cambiar tras actualizar el sistema
  operativo o el modelo.

## Validacion y criterios de salida

- Los tests unitarios deben demostrar retrieval top tres para el conjunto
  canonico de preguntas en espanol y cubrir entradas fuera de ambito y
  adversariales.
- Los tests de estado deben demostrar que un modelo no disponible, evidencia
  insuficiente, rechazo, error de generacion o cancelacion nunca publica una
  respuesta ni llama a nube.
- Cada familia de modelo Apple soportada debe superar una evaluacion manual de
  prompts en un dispositivo con Apple Intelligence antes de Release.
- Android develop debe evaluarse en cada familia de Gemini Nano soportada.
- Los testers Android develop con acceso a Prompt deben confirmar que tienen 18 anos o mas.
- Habilitar la consulta local Android en Release exige revisar de nuevo el
  estado de la API, terminos, elegibilidad de audiencia y evaluacion en espanol.

## Referencias

- [Guia de seguridad de Apple Foundation Models](https://developer.apple.com/documentation/foundationmodels/improving-the-safety-of-generative-model-output)
- [Requisitos de uso aceptable de Apple Foundation Models](https://developer.apple.com/apple-intelligence/acceptable-use-requirements-for-the-foundation-models-framework/)
- [ML Kit Prompt API](https://developers.google.com/ml-kit/genai/prompt/android/get-started)
- [Terminos adicionales de ML Kit GenAI](https://developers.google.com/ml-kit/genai-terms)
- [Guia de soluciones de IA Android, incluidos modelos LiteRT propios](https://developer.android.com/ai/overview)
