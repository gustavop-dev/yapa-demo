# Yapa: demo técnico

Contexto de negocio y research completo: @docs/yapa-research-context.md
(léelo cuando necesites justificar una decisión, no en cada tarea)

Plan de trabajo vigente: `~/.claude/plans/te-voy-a-dar-wiggly-cake.md`

## Reglas de escritura (obligatorias, sin excepciones)

Aplican a código, comentarios, documentación, README, mensajes de commit y
descripciones de PR:

1. **Nada de guiones largos (em dash).** Usar coma, dos puntos, punto o paréntesis.
2. **Nada de emojis.**
3. **Nada de rastros de texto generado por IA.** Sin muletillas tipo "es importante
   notar que" o "profundicemos en", sin cierres de resumen innecesarios, sin listas
   de tres adjetivos.
4. **Claude no va como co-autor.** Sin trailer `Co-Authored-By: Claude` en los commits
   y sin la línea "Generated with Claude Code" en descripciones de PR.
5. **El código y su documentación van en inglés.** Identificadores, comentarios, JSDoc,
   nombres de tests y READMEs de paquetes. También los mensajes de commit y las
   descripciones de PR.
6. **Se quedan en español**, porque son material para la entrevista y no código:
   `CLAUDE.md`, `ARRANQUE.md`, todo `docs/` y los textos de UI de la app.

Escribir como lo escribiría un ingeniero explicando su trabajo a otro, no como lo
escribiría un asistente.

## Formato de commits

Conventional Commits, en inglés, en imperativo y en minúscula.

```
<type>(<scope>): <subject>

<body opcional, explica el porqué, no el qué>
```

- **type**: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `build`, `perf`.
- **scope**: el paquete o área tocada: `engine`, `seed`, `mobile`, `docs`, `scripts`.
- **subject**: máximo 72 caracteres, sin punto final.
- Un commit por cambio coherente. Nada de "varios arreglos".

Ejemplos del repo:

```
feat(engine): add MCC recommendation engine with OpenStreetMap seed
docs(setup): add Windows getting started guide
```

## Qué es esto

Demo técnico para un filtro de entrevista con Yapa, startup pre-MVP (fundador: David
Rueda, dueño de Staffing Abroad). Yapa recomienda con cuál de tus tarjetas pagar en un
comercio para maximizar beneficios. **Mercado inicial: Estados Unidos.**

No es producción. El objetivo es demostrar criterio técnico y de producto en un fin de
semana, no construir el producto.

## Alcance del demo (no expandir sin que yo lo pida)

Una pantalla y un endpoint:

1. Botón, obtiene ubicación, lista de comercios candidatos cercanos
2. Calcula la recomendación para **cada** candidato
3. Si todos los candidatos convergen en la misma tarjeta, muestra la recomendación
   directo
4. Si discrepan, pregunta al usuario cuál comercio es
5. Muestra la recomendación con el **porqué** explícito (categoría, MCC, tasa)
6. Guarda la confirmación del usuario como dato de entrenamiento
7. Una geocerca que dispare una notificación local

## Decisiones ya tomadas

- **No se conectan bancos.** El usuario declara qué tarjetas tiene, de una lista. Sin
  Plaid, sin agregación, sin login bancario en el demo.
- **La ubicación solo se pide en foreground, con acción explícita del usuario.** Nunca
  background location. Es decisión de compliance, no solo de batería.
- **La ubicación no se persiste.** Se usa para resolver el comercio y se descarta. Solo
  se guarda el comercio confirmado, sin coordenadas crudas.
- **Se decide por MCC, no por comercio exacto.** El comercio exacto solo importa para
  promos merchant-específicas.
- **Stack: React Native con Expo, development build.** Target Android físico. Sin Mac,
  iOS no se compila ni se prueba, va documentado con la API exacta.
- **Detector de comercios: datos propios.** Seed generado desde OpenStreetMap vía
  Overpass para el demo, con corrección a mano de los comercios clave contra el Visa
  Supplier Locator. Overture Maps places es la arquitectura de producción, documentada
  y no construida.
- **Radar y Google Places quedan fuera del código.** Van como página de análisis de
  costo. Radar no tiene tier gratuito y su producto Places es Enterprise; Google cuesta
  32 USD por 1.000 llamadas y su ToS prohíbe cachear categorías y entrenar modelos.
- **La geocerca es en foreground.** El geofencing real en Android exige
  `ACCESS_BACKGROUND_LOCATION`, que contradice la decisión de compliance de arriba. La
  contradicción va documentada como hallazgo.

## Restricciones que NO son negociables

- **iOS: máximo 20 geofences por app.** Android: 100 por app por usuario del
  dispositivo. Límite duro de plataforma.
- **iOS puede darnos ubicación aproximada (1 a 20 km).** Si `accuracyAuthorization` es
  `.reducedAccuracy`, la detección de comercio es imposible **y el region monitoring se
  apaga por completo** (cita de Apple: "your app can't use region monitoring or beacon
  ranging"). **Nunca asumir que tenemos precisión completa.**
- **Android: pedir `ACCESS_FINE_LOCATION` y `ACCESS_COARSE_LOCATION` juntos**, en una
  sola llamada, y declarar ambos en el manifest. Si se pide solo FINE, el sistema
  ignora la petición. La ubicación aproximada de Android da unos 3 kilómetros
  cuadrados, que es un área, no un radio.
- En interiores no hay señal GPS útil. El error horizontal en un mall supera la
  distancia entre locales. Diseñar asumiendo que la ubicación es un *filtro de
  candidatos*, no una respuesta.
- Geolocalización precisa es dato sensible en la mayoría de estados de USA. Nada de
  vender, compartir ni exportar ubicación. Ver el doc de contexto.

## Reglas para ti

- Antes de escribir código nuevo, dime qué opciones hay y cuál recomiendas. Estoy
  usando este proyecto para aprender a defender decisiones, no solo para tener el
  código.
- Cuando algo sea una limitación de plataforma, cítala con el número exacto y de dónde
  sale. Esos números son el entregable tanto como el código.
- Si detectas que estoy sobreconstruyendo, dímelo. El riesgo real de este proyecto es
  que crezca más allá de un fin de semana.
- No inventes tasas de recompensas de tarjetas reales. Si no tenemos el dato
  verificado, márcalo como `TODO: verificar` en vez de rellenar. Cada regla del
  catálogo lleva `verified: boolean` y `sourceUrl`.

## Pendiente de decidir

- Cómo se ve el flujo de push más allá de la notificación local del demo
- Zona exacta del sur de California para el set de datos de Estados Unidos
- Qué mall se usa para grabar el video
