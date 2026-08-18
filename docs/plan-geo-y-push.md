# Yapa: plan de georreferencia y push

## Context

Demo técnico para un filtro de entrevista con Yapa (fundador: David Rueda). David puso
dos problemas sobre la mesa, **georreferencia y notificaciones push**, y esos son los
dos que va a evaluar.

Este plan reemplaza al anterior por una razón concreta: el proyecto invirtió el
esfuerzo en el motor de recomendación por MCC, que quedó excelente, y hoy tiene **cero
código de ubicación corriendo en un teléfono y cero código de notificaciones**. O sea,
resolvió muy bien una tercera pregunta y todavía no tocó las dos que le hicieron. Todo
lo que sigue corrige ese desbalance.

Condiciones nuevas que ordenan el plan:

- **Quedan 4 o 5 días.**
- **La entrega es una demo en vivo por videollamada**, no un video ni un repo. Eso
  cambia la prioridad: importa que no se rompa mientras David mira, más que que quede
  pulido.
- **Push remota de verdad**, no solo local.
- **No se depende del centro comercial.** La demo se hace desde el escritorio con
  ubicación real de Duitama más ubicación simulada para el caso de Estados Unidos.
- No hay cuenta de Expo ni de Firebase todavía. Ambas son gratis y son bloqueantes.

---

## Reglas de estilo del proyecto (ya en CLAUDE.md, obligatorias)

Sin guiones largos, sin emojis, sin muletillas de IA, y Claude nunca como co-autor en
los commits. Aplica a código, comentarios, documentación y mensajes de commit.

---

## Lo que ya está construido y NO se vuelve a tocar

Está en el repo, con 47 tests en verde y typecheck limpio. Se congela acá.

| Paquete | Qué provee | API que la app va a consumir |
|---|---|---|
| `@yapa/engine` | Motor puro, sin React ni red | `resolveNearby()`, `decide()`, `recommend()`, `buildConfirmation()` |
| `@yapa/seed` | Generación de datos desde OpenStreetMap | scripts, no corre en la app |
| `data/` | 386 comercios de Costa Mesa, 467 de Duitama | JSON embebido en la app |

Las firmas exactas que la pantalla va a usar, de `packages/engine/src/geo.ts` y
`converge.ts`:

```ts
resolveNearby(point, accuracyM, merchants, venues?, limit?): NearbyResult
// NearbyResult: 'ok' con candidates y venue opcional, 'accuracy-too-low', 'no-candidates'

decide(candidates, cards): Decision
// Decision: 'converged' con recommendation, o 'ambiguous' con groups
```

`resolveNearby` ya rechaza fixes con más de 500 m de error y ya escala el radio de
búsqueda según la precisión reportada. La pantalla no re-implementa nada de eso.

---

## Parte 1: georreferencia

### El hallazgo que vale la demo

Verificado leyendo el código nativo de `expo-location` 57.0.11
(`LocationModule.kt`), no la documentación:

```kotlin
val locationPermission = getPermissionsWithPermissionsManager(ACCESS_COARSE_LOCATION)
val fineLocationPermission = getPermissionsWithPermissionsManager(ACCESS_FINE_LOCATION)
var accuracy = "none"
if (locationPermission.granted) { accuracy = "coarse" }
if (fineLocationPermission.granted) { accuracy = "fine" }
```

`status`, `granted` y `canAskAgain` salen **solo** del chequeo de COARSE. Consecuencia:
**si el usuario concede ubicación aproximada, `granted` devuelve `true` y `status`
devuelve `'granted'`.** La única forma de enterarse es mirar
`response.android?.accuracy === 'coarse'`.

Una app que confía en `granted` cree que tiene precisión y no la tiene, y va a resolver
comercios con un error de unos 3 kilómetros cuadrados (cifra oficial de Android). Ese es
el momento más fuerte de la demo y no está documentado en Expo: sale de leer el fuente.

### Flujo exacto, en el orden correcto

Todo dentro del handler del tap, nunca al montar la pantalla.

1. `Location.getForegroundPermissionsAsync()` para ver el estado sin disparar diálogo.
2. `Location.requestForegroundPermissionsAsync()` si hace falta. Expo ya pide FINE y
   COARSE juntos internamente, que es lo que Android exige, así que no hay que hacer
   nada extra desde JS.
3. Si no hay permiso: si `canAskAgain` es true, mostrar el porqué y reintentar; si no,
   `Linking.openSettings()`.
4. **Detectar precisión degradada:** `perm.android?.accuracy === 'coarse'`.
5. Si está degradada, ofrecer el upgrade volviendo a llamar la **misma** función. Android
   muestra un diálogo distinto, de upgrade. Confirmado por la doc de Android: *"Request
   the ACCESS_FINE_LOCATION and ACCESS_COARSE_LOCATION permissions together again.
   Because the user has already allowed the system to grant approximate location to your
   app, the system dialog is different this time."*
6. `Location.hasServicesEnabledAsync()` para dar un mensaje claro si la ubicación del
   dispositivo está apagada, en vez de esperar un rechazo opaco.
7. `Location.getLastKnownPositionAsync({ maxAge: 60000, requiredAccuracy: 100 })` para
   pintar algo de inmediato mientras llega el fix bueno.
8. `Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })`
   **envuelto en `Promise.race` con un timeout propio de 15 segundos.**

El punto 8 no es paranoia. Verificado en el fuente de 57.0.11: `requestSingleLocation`
llama `getCurrentLocation(locationRequest, null)` pasando `null` como
`CancellationToken`. **No hay timeout en ninguna capa.** Si el proveedor nunca devuelve
un fix, la promesa no resuelve ni rechaza, y hay un issue abierto que reporta
exactamente ese cuelgue (expo/expo#39851). En una demo en vivo eso es la muerte.

### Lo que se muestra en pantalla

- Latitud y longitud.
- **`coords.accuracy`, que es el radio de incertidumbre en metros.** Este número es el
  protagonista visual de la demo.
- El modo del permiso: "Precisa" o "Aproximada", leído de `perm.android.accuracy`.
- **Un aviso cuando `position.mocked === true`.** Ese campo existe solo en Android y sale
  de `location.isFromMockProvider`. Sirve para dos cosas: ser honesto en vivo cuando se
  simula estar en California, y demostrar detección de spoofing, que es un problema real
  de fintech (Radar vende un producto entero para eso).
- El resultado de `resolveNearby`, con sus tres estados diferenciados: candidatos,
  precisión insuficiente, o nada cerca.

### Configuración de Android

`expo-location` ya declara `ACCESS_COARSE_LOCATION` y `ACCESS_FINE_LOCATION` en su
propio manifest, así que para foreground **no hay que declarar nada**. El config plugin
solo agrega `ACCESS_BACKGROUND_LOCATION` si se le pasa
`isAndroidBackgroundLocationEnabled: true`, y el default es `false`.

Aun así, en `app.json` va el bloqueo defensivo, porque la decisión de compliance merece
ser visible en el código y no solo en el README:

```json
"android": {
  "blockedPermissions": [
    "android.permission.ACCESS_BACKGROUND_LOCATION",
    "android.permission.FOREGROUND_SERVICE_LOCATION"
  ]
}
```

Y una lista de APIs que **no pueden aparecer** en el código, por la misma decisión:
`requestBackgroundPermissionsAsync`, `startLocationUpdatesAsync`, `startGeofencingAsync`
y sus hermanas. Confirmado que con foreground puro **no hace falta** ningún foreground
service ni `foregroundServiceType`, porque Android considera acceso foreground legítimo
el que ocurre con la Activity visible.

---

## Parte 2: push

### La realidad de push remota en Android, sin adornos

Verificado en la doc oficial de Expo: **para recibir push remota en Android hace falta
un proyecto Firebase, sin excepción.** El Expo Push Service abstrae el envío, no las
credenciales.

Lo que hay que hacer, en orden:

1. Crear proyecto en Firebase Console.
2. Bajar `google-services.json` y ponerlo en el proyecto, más
   `"android": { "googleServicesFile": "./google-services.json" }` en `app.json`.
   Tiene que estar **antes** del prebuild.
3. Generar una service account key en Firebase (Project settings, Service accounts,
   Generate New Private Key).
4. Subirla a EAS con `eas credentials`, en Android, FCM V1.
5. `getExpoPushTokenAsync({ projectId })`, con el projectId de EAS.

No hay atajo: OneSignal también exige credenciales Firebase para Android. Toda push a
Android pasa por FCM. Lo único que cambia entre proveedores es quién guarda la llave.
Costo en dinero: cero. Costo en tiempo: 2 a 4 horas para alguien que nunca lo hizo.

### Las tres trampas de Android que cuestan horas

Las tres están verificadas y las tres fallan en silencio, sin error.

1. **El canal va antes que todo.** Cita textual de Expo: *"The setNotificationChannelAsync
   must be called before getDevicePushTokenAsync or getExpoPushTokenAsync to obtain a
   push token."* Y sobre el permiso: *"This prompt will not appear until at least one
   notification channel is created."* Si se invierte el orden, el diálogo simplemente no
   aparece y no hay mensaje de error.
2. **`AndroidImportance.MAX` o `HIGH`, y no se puede cambiar después.** La doc de Android
   dice: *"Once you submit the channel to the NotificationManager, you can't change the
   importance level."* Si el canal se crea con importancia baja, subirla en el código no
   hace nada hasta desinstalar la app o usar otro `channelId`. En una demo eso significa
   una notificación que no se ve.
3. **`shouldPlaySound: true` es obligatorio para que se vea en foreground.** Cita textual
   de Expo: *"On Android, setting shouldPlaySound: false will result in the drop-down
   notification alert not showing, no matter what the priority is."*

Y el handler actual, porque `shouldShowAlert` quedó deprecado:

```ts
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});
```

### Las dos notificaciones, y por qué son dos

Esta es la parte de producto, no de plomería, y es lo que diferencia.

**Notificación 1, local, necesita ubicación.** Se dispara al acercarse a un comercio
sembrado, con la app abierta: `watchPositionAsync` más chequeo de radio más
`scheduleNotificationAsync`. Es el trigger que David imagina cuando dice "geolocalización
más push".

**Notificación 2, remota, no necesita ubicación en absoluto.** Se dispara con un `curl`
desde la terminal contra el Expo Push API, con la app cerrada, y dice algo como "hoy tu
tarjeta X da 3x en restaurantes".

```sh
curl -H "Content-Type: application/json" -X POST "https://exp.host/--/api/v2/push/send" -d '{
  "to": "ExponentPushToken[...]",
  "title": "Tu categoria rotativa vence en 3 dias",
  "body": "Activala para no perder el 5%",
  "channelId": "default"
}'
```

La segunda existe para hacer explícito el punto más fuerte del research: **la mayor parte
del valor de las push no necesita geolocalización.** Un crédito de streaming que vence,
una categoría rotativa sin activar, un multiplicador del día. Eso es un cron contra el
catálogo: cero ubicación, cero batería, cero permisos delicados. Y el loop de mayor
retención, el post transacción ("pagaste 80 en X con la tarjeta A, con la B habrías
ganado 4,80 más"), tampoco necesita GPS: necesita feed de transacciones.

Un fundador preocupado por resolver geolocalización para poder mandar push probablemente
no ha escuchado que **los dos problemas son desacoplables y uno entrega valor sin tocar
el otro**. Mostrar las dos notificaciones lado a lado convierte ese párrafo en una
demostración.

### Dato verificado sobre notificaciones locales

Sobreviven al reinicio del teléfono. Confirmado leyendo el fuente: el manifest de
`expo-notifications` declara `RECEIVE_BOOT_COMPLETED` con receivers para `BOOT_COMPLETED`
y `MY_PACKAGE_REPLACED`, y `ExpoSchedulingDelegate.setupScheduledNotifications()`
re-agenda todo lo persistido. Se agenda con
`AlarmManagerCompat.setExactAndAllowWhileIdle`. No hay frase en la documentación que lo
prometa, pero el mecanismo está.

---

## Parte 3: la demo en vivo

El riesgo número uno no es el código: es que el tiempo de construcción se coma el
tiempo de ensayo. Todo lo que sigue existe para que eso no pase.

### Lo que hay que verificar hoy, no el último día

**Ubuntu 24.04 arranca en Wayland, y compartir una ventana suelta por Zoom o Meet pasa
por xdg-desktop-portal más PipeWire, con fallas conocidas de pantalla en negro al
segundo intento.** La mitigación cuesta cero: iniciar sesión en "Ubuntu on Xorg" desde
el engranaje de la pantalla de login, y confirmar con `echo $XDG_SESSION_TYPE` que
devuelve `x11`. Conviene comprobarlo ya porque implica reconfigurar la sesión.

Además, `adb` y `scrcpy` **no están instalados** en la máquina. Van el día 1.

### Cómo ve David la pantalla del teléfono

**scrcpy por USB, con el binario prebuilt oficial** (el paquete de apt y el snap están
marcados como obsoletos en la documentación del proyecto), en sesión Xorg, y
**compartiendo pantalla completa, no una ventana suelta**, que es donde falla el portal.

Respaldo que no depende de portales: `scrcpy --v4l2-sink=/dev/video2 --no-playback` con
`v4l2loopback`, y el teléfono aparece como una cámara más en la llamada.

### Las cinco decisiones que eliminan la mayoría de los modos de falla

1. **Compilar con `npx expo run:android --variant release`.** Embebe el bundle y elimina
   el servidor de Metro como dependencia viva. De paso, sin LogBox ni pantalla roja
   delante del fundador. Es la decisión que más riesgo saca de encima.
2. **Teléfono en modo avión, con wifi reconectado a mano.** Mata llamadas y SMS entrantes
   en medio de la demo. El GNSS sigue funcionando porque es solo receptor, y el push
   llega igual por wifi.
3. **Teléfono enchufado por USB.** Doze no aplica mientras carga, y habilita
   `scrcpy --stay-awake` para que la pantalla no se apague sola.
4. **Timeout propio en el fix**, ya justificado arriba. Más una guarda contra doble toque:
   hay un issue de Expo que es literalmente llamadas simultáneas colgando la promesa.
5. **No cerrar la demo con el push.** Los dos actos con dependencia externa (ubicación
   simulada y push remota) van tarde pero no últimos. El cierre es analítico y depende
   solo de vos.

### La densidad de datos, medida

Corrí una grilla de 100 metros sobre todo el bbox de Duitama con las 467 tiendas del
seed, simulando un fix bueno de 30 metros:

| Métrica | Valor |
|---|---|
| Puntos de grilla evaluados | 644 |
| Puntos con al menos un candidato | 213, o sea **33,1%** |
| Mediana de candidatos por punto | **0** |
| De los que tienen candidatos, convergen | 112 |
| De los que tienen candidatos, hay que preguntar | 101 |

**Conclusión operativa: no demuestres con GPS real desde tu casa.** Hay dos tercios de
probabilidad de caer en una zona sin comercios sembrados, y la app va a decir "no hay
nada cerca", que es correcto pero parece roto.

El punto más denso, para ensayar y para la demo:

```
5.823085, -73.037776   ->  8 candidatos, decisión ambigua
Drogueria Super (5912), American Broaester (5499), Herrajes Multiherrajes (5251),
La Canasta Campesina (5499), Restaurante y Pescaderia Riomar (5812),
Broaster de las Americas (5812), Empanadas (5814), Big Burger (5814)
```

Ocho comercios, cinco MCC distintos, y discrepancia real. Es el escenario perfecto para
mostrar la pregunta mínima que desempata.

**Y hay una jugada que convierte la limitación en argumento:** hacer un fix real primero,
desde donde estés. Si sale "no hay candidatos cerca", eso **no es un fallo**, es el tercer
estado de `resolveNearby` funcionando. La frase es: "acá no tengo comercios sembrados, y
la app lo dice en vez de inventarse uno". Después se pasa a ubicación simulada, con el
aviso de `mocked === true` en pantalla, y se dice de frente que se está simulando.

### Guion, 6 actos en 12 minutos

Presupuestar 12 minutos de contenido para 20 de reunión, porque David va a interrumpir.

1. **El problema, 90 segundos.** Sin app todavía. Por qué la ubicación no alcanza:
   interiores, multipath, y el error horizontal contra la distancia entre locales.
2. **El permiso y la precisión, 3 minutos.** El acto más fuerte y va temprano. Conceder
   "Aproximada" en vivo, y mostrar que `granted` dice `true` mientras la app detecta que
   la precisión no sirve. Después el upgrade a precisa y el número de metros cambiando en
   pantalla.
3. **Candidatos y el porqué, 3 minutos.** El intocable. Fix real, después simulado al
   punto denso de Duitama, ocho candidatos, la pregunta mínima, y la recomendación con la
   cita del emisor.
4. **El caso de Estados Unidos, 2 minutos.** Simular Costa Mesa, Target, MCC 5310, y la
   exclusión de Amex con su texto. **Este es el acto sacrificable** si el tiempo aprieta o
   si algo falla.
5. **Las dos notificaciones, 2 minutos.** La local por proximidad, y la remota por `curl`
   con la app cerrada. Acá se dice la frase que probablemente nadie le dijo: la mayor
   parte del valor del push no necesita geolocalización, y los dos problemas son
   desacoplables.
6. **Los límites y lo que no sé, 90 segundos.** Cierre analítico, sin depender de nada
   externo: los 20 geofences de iOS, que reduced accuracy apaga el region monitoring, los
   32 USD por mil llamadas de Google, y las tres correcciones a su propio research doc.

### Plan B

**Seis clips cortos de 40 a 90 segundos, uno por acto**, no un video largo. Si un acto
falla en vivo, se reemplaza ese clip y se sigue, en vez de anunciar la derrota. Grabarlos
en T menos 24 horas, con el código ya congelado.

Sumar: emulador caliente con la misma APK (salva por completo el acto de ubicación
simulada), y la APK guardada para `adb install -r` si hace falta reinstalar.

Y ensayar la frase de recuperación. Recomponerse con calma de un fallo puntúa más alto
que una demo perfecta, porque es lo que él va a ver todos los días si te contrata.

### Reset de permisos para ensayar el primer uso muchas veces

`pm revoke` por sí solo **no alcanza**: hay que limpiar las banderas `user-set` y
`user-fixed` o el diálogo no vuelve a aparecer. Ese es el error clásico al ensayar.

Y para dejar el teléfono exactamente en el estado que produce elegir "Aproximada", sin
depender de acertarle al toggle del diálogo:

```sh
adb shell am force-stop $PKG
adb shell pm revoke $PKG android.permission.ACCESS_FINE_LOCATION
adb shell pm grant  $PKG android.permission.ACCESS_COARSE_LOCATION
```

La app debe leer `android.accuracy === 'coarse'` en ese estado. Nota de honestidad:
`pm grant` y `pm revoke` están documentados oficialmente; `pm reset-permissions` y
`cmd appops reset` no lo están y hay que probarlos en tu teléfono concreto.

Advertencia de marca: si el teléfono es Xiaomi, Oppo, Vivo o Huawei, el push no llega con
la app deslizada de recientes. En ese caso, decir "en segundo plano" y no deslizarla.

---

## Cronograma, 5 días

### Día 1: destrabar, compilar y asegurar la pantalla compartida

Tres cosas bloqueantes que no dependen de escribir código, y que van primero:

1. **Cuentas**: Expo y Google para Firebase. Unos 20 minutos entre las dos.
2. **Sesión Xorg**: reiniciar en "Ubuntu on Xorg" y confirmar `echo $XDG_SESSION_TYPE`
   igual a `x11`. Si esto falla el último día, no hay demo en vivo.
3. **`adb` y `scrcpy`**: ninguno está instalado. El binario prebuilt de scrcpy, no el de
   apt ni el snap.

Después el gate del toolchain: JDK, Android Studio, SDK, `sdkmanager --licenses`, udev
para que `adb devices` no diga `no permissions`, depuración USB. Ya está confirmado que
Node 20.19.4 y `plugdev` están listos, y que hay JDK 21 (React Native recomienda 17, así
que si el build falla con algo críptico esa es la primera sospecha).

Probar scrcpy espejando el teléfono y compartiendo pantalla completa en una llamada de
prueba, aunque sea con vos mismo en otro dispositivo.

**Instalar `expo-location`, `expo-notifications` y `expo-constants` todas juntas antes
del primer build**, y poner `google-services.json` antes del prebuild. Cada dependencia
nativa nueva cuesta un rebuild de 10 a 25 minutos.

El día cierra con un "hello world" corriendo en el teléfono. Si no cierra, se replanifica
con 4 días por delante en vez de descubrirlo el último día.

### Día 2: georreferencia

La pantalla completa: selector de tarjetas, botón, permisos, detección de precisión
degradada, fix con timeout propio, `coords.accuracy` en pantalla, aviso de ubicación
simulada, y el resultado de `resolveNearby` más `decide` con los tres estados. Se consume
el motor tal cual está, sin tocarlo.

Al terminar el día, la mitad de lo que David pidió está demostrable.

### Día 3: push local

Canal con `AndroidImportance.MAX` primero, permisos después, handler de foreground con
`shouldPlaySound: true`. Notificación inmediata de prueba, y la de proximidad enganchada
a `watchPositionAsync`. Probar caminando media cuadra.

### Día 4: push remota

Firebase, `google-services.json`, service account key, `eas credentials`, rebuild,
`getExpoPushTokenAsync`. **Objetivo único del día: que el `ExponentPushToken` aparezca
impreso.** Después, el `curl`.

**Punto de corte duro:** si al final del día 4 no hay token, se entrega la push local
pulida y el README explica por qué Android exige FCM V1 y qué hace cada credencial. Ese
README ya demuestra que entendés el tema, y es mejor que llegar sin nada.

### Día 5: congelar y ensayar

Congelar el código a primera hora. Compilar la APK con `--variant release` y no volver a
tocar nada.

Ensayar la demo completa de punta a punta al menos tres veces, reseteando permisos entre
ensayos con los comandos de arriba, y practicando específicamente el acto del permiso
aproximado, que es el más fuerte y el que más se puede desarmar.

Grabar los seis clips de respaldo, uno por acto. Dejar el emulador caliente con la misma
APK y la APK guardada para reinstalar.

Escribir la página de restricciones y la lista de preguntas abiertas, incluida la
pregunta para David que no hay que llevar resuelta: en compras presenciales no hay click
de afiliado ni tracking de merchant, así que el offline monetiza vía originación de
tarjetas, vía card-linked offers, o vía suscripción. Esa respuesta define cuál es el
trigger correcto de push.

---

## Página de restricciones (verificada, para narrar en la llamada)

| Restricción | Número | Fuente |
|---|---|---|
| Regiones monitoreadas por app, iOS | 20 | Apple, `startMonitoring(for:)` |
| Geofences por app, Android | 100 por app por usuario | Android, Geofencing API |
| Latencia de geofence, Android | menos de 2 min típico, hasta 6 min si estuvo quieto | Android |
| iOS reduced accuracy | 1 a 20 km, "at most a few times per hour" | Apple, `kCLLocationAccuracyReduced` |
| reducedAccuracy apaga el geofencing | No degrada, se apaga | Apple: "your app can't use region monitoring or beacon ranging" |
| Android aproximada | unos 3 kilómetros cuadrados (área, no radio) | Android |
| Android precisa | "usually within about 50 meters" | Android |
| GPS bajo cielo abierto | 4,9 m de radio en smartphones | GPS.gov |
| Android 17 location button | Obligatorio por política de Play para apps de acceso puntual | Android |
| Maryland, geolocalización precisa | 1.750 pies (unos 533 m) | Research doc |
| Google Nearby Search Pro | 32 USD por 1.000 llamadas, y su ToS prohíbe cachear categorías y entrenar modelos | Google Maps Platform Terms |
| Radar | Sin tier gratuito, Places es Enterprise | radar.com/pricing |

Las tres correcciones al research doc de David siguen siendo el material más fuerte:
Radar no tiene tier gratuito, el caché por celda geohash no es legal con Google, y el
flywheel de entrenamiento tampoco. Las tres salieron de leer contratos.

---

## Qué NO se construye

| No se construye | Por qué |
|---|---|
| Geofencing real en background | Exige `ACCESS_BACKGROUND_LOCATION`, y desde Android 11 pedirlo abre Ajustes. Contradice la decisión de compliance. Es el hallazgo, no una omisión. |
| El endpoint desplegado | El motor ya es un módulo puro y corre embebido. Con 5 días y demo en vivo, un servidor remoto es una dependencia de red que se puede caer mientras David mira. |
| Camino de iOS en código | Sin Mac no compila ni se prueba. Va documentado con la API exacta. |
| Siembra de Innovo Plaza | Ya no se depende del mall. La plantilla y el parser quedan en el repo como diseño. |
| Gestión dinámica de geocercas | Va en la página de restricciones. Construirlo es un fin de semana entero. |
| Más tarjetas o más MCC | 45 MCC y 3 tarjetas ya sobran para lo que se evalúa. |

---

## Verificación

**Motor:** `npm test`, 47 tests, ya en verde. No se toca.

**Permisos, en el teléfono, repetible:**
- Conceder "Aproximada" y confirmar que la app lo detecta y entra en estado degradado,
  aunque `granted` sea `true`. Este es el caso que hay que probar más veces.
- Conceder "Precisa" y confirmar la resolución normal.
- Denegar y confirmar el mensaje claro.
- Denegar dos veces y confirmar que aparece el atajo a Ajustes.

**Ubicación:**
- Fix real en Duitama, con candidatos reales del seed de 467 comercios.
- Ubicación simulada en Costa Mesa, confirmando que el caso Target aparece con la cita de
  Amex y que la app avisa `mocked === true`.
- Forzar el timeout propio y confirmar que la app no se queda colgada.

**Notificaciones:**
- Local inmediata, visible como heads-up con la app en foreground.
- Local de proximidad, caminando.
- Remota por `curl`, con la app cerrada.
- Reiniciar el teléfono y confirmar que una notificación agendada sigue viva.
