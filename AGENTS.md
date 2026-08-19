# Yapa: instrucciones para agentes

Este archivo es el punto de entrada para Codex y cualquier otro agente que trabaje en
el repo. Es equivalente a `CLAUDE.md`: si cambias uno, cambia el otro.

Documentos de referencia, en orden de utilidad:

- `docs/plan-geo-y-push.md`: el plan vigente, dia por dia. Es la fuente de verdad de
  que se construye y que no.
- `ARRANQUE.md`: como dejar la maquina Windows lista para compilar y para la demo.
- `docs/yapa-research-context.md`: contexto de negocio y research. Leelo cuando
  necesites justificar una decision, no en cada tarea.

## Reglas de escritura, obligatorias

Aplican a codigo, comentarios, documentacion, README, mensajes de commit y
descripciones de PR:

1. **Nada de guiones largos (em dash).** Usar coma, dos puntos, punto o parentesis.
2. **Nada de emojis.**
3. **Nada de rastros de texto generado por IA.** Sin muletillas tipo "es importante
   notar que" o "profundicemos en", sin cierres de resumen innecesarios, sin listas de
   tres adjetivos.
4. **Ningun agente va como co-autor.** Sin trailer `Co-Authored-By:` y sin lineas tipo
   "Generated with" en descripciones de PR.
5. **El codigo y su documentacion van en ingles.** Identificadores, comentarios, JSDoc,
   nombres de tests y READMEs de paquetes. Tambien los mensajes de commit.
6. **Se quedan en espanol**, porque son material para la entrevista y no codigo:
   `AGENTS.md`, `CLAUDE.md`, `ARRANQUE.md`, todo `docs/`, los textos de UI de la app,
   la narracion que imprime `npm run demo`, el texto de rechazo que arma el motor, y
   los campos `note` de los scripts de seed, que se copian tal cual dentro de `data/`.
   Traducir esos ultimos desincroniza los JSON ya commiteados.

Escribir como lo escribiria un ingeniero explicando su trabajo a otro, no como lo
escribiria un asistente.

## Formato de commits

Conventional Commits, en ingles, en imperativo y en minuscula.

```
<type>(<scope>): <subject>

<body opcional, explica el porque, no el que>
```

- **type**: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `build`, `perf`.
- **scope**: el paquete o area tocada: `engine`, `seed`, `mobile`, `docs`, `scripts`.
- **subject**: maximo 72 caracteres, sin punto final.
- Un commit por cambio coherente. Nada de "varios arreglos".

Ejemplos reales del repo:

```
feat(engine): add proximity trigger with hysteresis and cooldown
fix(scripts): keep send-push usable without python3
docs(setup): record what the SDK install actually needed on Windows
```

## Que es esto

Demo tecnico para un filtro de entrevista con Yapa, startup pre-MVP. Yapa recomienda
con cual de tus tarjetas pagar en un comercio para maximizar beneficios. Mercado
inicial: Estados Unidos.

No es produccion. El objetivo es demostrar criterio tecnico y de producto en un fin de
semana. La entrega es una demo en vivo por videollamada, asi que importa mas que no se
rompa mientras el fundador mira que quede pulido.

## Reglas de trabajo para el agente

- **Antes de escribir codigo nuevo, decir que opciones hay y cual recomendas.** El
  dueno del repo esta usando el proyecto para aprender a defender decisiones, no solo
  para tener el codigo.
- **Cuando algo sea una limitacion de plataforma, citala con el numero exacto y de
  donde sale.** Esos numeros son el entregable tanto como el codigo.
- **Si detectas sobreconstruccion, decilo.** El riesgo real del proyecto es que crezca
  mas alla de un fin de semana.
- **No inventes tasas de recompensas.** Si no hay dato verificado va `TODO: verify` en
  vez de rellenar. Cada regla del catalogo lleva `verified: boolean` y `sourceUrl`.
- **No amplies el alcance** sin que te lo pidan. Lo que no se construye esta listado en
  el plan y tiene motivo.

## Estructura

```
packages/engine   Motor puro, sin React ni red. Vitest.
packages/seed     Generacion de datos desde OpenStreetMap. Scripts, no corre en la app.
packages/mobile   App Expo, Android. Consume el motor tal cual.
data/             Seeds generados: 386 comercios de Costa Mesa, 467 de Duitama.
scripts/          send-push.sh y el setup de Linux, que ya no esta en el camino.
```

API del motor que la app consume:

```ts
resolveNearby(point, accuracyM, merchants, venues?, limit?): NearbyResult
decide(candidates, cards): Decision
recommend(merchant, cards): Recommendation
evaluateProximity(state, point, accuracyM, merchants, cards, now): ProximityStep
buildConfirmation(merchantId, point, at): TrainingConfirmation
```

## Comandos

```sh
npm install
npm test         # 55 tests: 48 del motor, 7 del seed
npm run typecheck
npm run demo     # el motor decidiendo, sin telefono ni GPS

npm run android --workspace=@yapa/mobile          # build de desarrollo
npm run android:release --workspace=@yapa/mobile  # el que va a la demo
```

`npm test` y `npm run typecheck` tienen que quedar en verde antes de cualquier commit.
El motor tenia 47 tests cuando llego a Windows y hoy tiene 48 mas los 7 del seed: si
ves otro numero, algo se rompio o alguien agrego tests sin actualizar esta linea.

## Decisiones ya tomadas, no reabrir sin pedirlo

- **No se conectan bancos.** El usuario declara sus tarjetas de una lista. Sin Plaid.
- **La ubicacion se pide solo en foreground y con accion explicita del usuario.** Nunca
  background location. Es compliance, no bateria.
- **La ubicacion no se persiste.** Solo se guarda el comercio confirmado, con geohash
  de nivel 6 y sin coordenadas crudas.
- **Se decide por MCC, no por comercio exacto.** El comercio exacto solo importa para
  promos merchant-especificas.
- **Stack: React Native con Expo, development build, Android fisico.** iOS no se
  compila ni se prueba, va documentado con la API exacta.
- **Los POIs salen de datos propios**, sembrados desde OpenStreetMap via Overpass.
  Overture Maps es la arquitectura de produccion, documentada y no construida.

Estas APIs **no pueden aparecer en el codigo**, por la decision de compliance:
`requestBackgroundPermissionsAsync`, `startLocationUpdatesAsync`,
`startGeofencingAsync` y sus hermanas. `app.json` ademas bloquea
`ACCESS_BACKGROUND_LOCATION` y `FOREGROUND_SERVICE_LOCATION` de forma explicita.

## Hallazgos que sostienen la demo

Verificados leyendo fuente y documentacion, no de memoria. Si tocas estas partes, no
las simplifiques sin entender que resuelven:

- **En Android `granted` miente.** En el modulo nativo de `expo-location` 57.0.11,
  `status`, `granted` y `canAskAgain` se calculan chequeando solo
  `ACCESS_COARSE_LOCATION`. Con precision aproximada, `granted` devuelve `true`. El
  unico dato confiable es `response.android.accuracy`. Ver `packages/mobile/src/location.ts`.
- **`getCurrentPositionAsync` no tiene timeout en ninguna capa.**
  `requestSingleLocation` pasa `null` como `CancellationToken` (issue expo/expo#39851).
  Por eso hay un `Promise.race` propio de 15 segundos.
- **El canal de notificacion va antes que el permiso y antes que el token.** Cita de
  Expo: "This prompt will not appear until at least one notification channel is
  created". Si se invierte el orden, el dialogo no aparece y no hay error.
- **La importancia del canal no se puede cambiar despues de crearlo.** Si queda baja,
  subirla en el codigo no hace nada hasta desinstalar la app.
- **`shouldPlaySound: true` es obligatorio** para que la notificacion se vea en
  foreground en Android.
- **Push remota en Android exige Firebase, sin excepcion.** El Expo Push Service
  abstrae el envio, no las credenciales.

## Estado actual

Hecho y verificado en Windows:

- Motor y seed intactos, 55 tests en verde, typecheck limpio en los tres paquetes.
- Dia 3 del plan, la notificacion de proximidad: `evaluateProximity` en el motor con
  histeresis de 120 a 220 m, silencio por encima de 200 m de error, una notificacion
  por llegada y no una por comercio, y cooldown de 90 s. Ocho tests propios.
- El vigilante de la app se da de baja al pasar a segundo plano y al desmontar.
- Boton de ensayo que corre el mismo disparador contra el punto mas denso del seed de
  Duitama, y boton que muestra el `ExponentPushToken`.
- Toolchain: JDK 17, SDK con platform 36 y build-tools 36.0.0, adb 37.0.1, scrcpy 4.1.

Pendiente:

- **Nada de esto corrio nunca en un telefono.** El plan marca eso como el riesgo numero
  uno. El gate es `adb devices` listando el dispositivo y despues el primer build, que
  tarda entre 10 y 30 minutos la primera vez.
- **Dia 4, push remota.** Es tramite de cuentas mas que codigo: proyecto en Firebase,
  `google-services.json` en `packages/mobile/` y declarado en `app.json` antes del
  prebuild, service account key subida con `eas credentials` en FCM V1, y `eas init`
  para que `app.json` deje de tener `projectId: "PENDIENTE"`.
- **Dia 5**, congelar, ensayar tres veces y grabar los seis clips de respaldo.

## Trampas del entorno Windows

- `dl.google.com` corta las descargas grandes a mitad. Usar `curl -C -` dentro de un
  bucle que reintente.
- PowerShell 5.1 no logra alimentar el prompt de `sdkmanager --licenses`. Aceptar
  desde Git Bash con `yes |`.
- `winget` no toca el PATH de un Java viejo ya instalado, asi que una terminal puede
  seguir viendo el 8. `JAVA_HOME` va fijo al 17.
- Git Bash no trae `python3`. Nada del repo puede depender de el.
- `scripts/setup-android.sh` es solo para Linux y esta fuera del camino actual.
