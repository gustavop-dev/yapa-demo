# Por donde empezar (Windows)

El desarrollo se hace en Windows, no en la VM de Linux. La razon es concreta: el paso
de USB en VirtualBox suelta el telefono cuando este se re-enumera al activar la
depuracion o al aceptar la huella RSA, y sin `adb` viendo el telefono no se puede
compilar, ni instalar, ni ensayar, ni hacer la demo. Ademas la videollamada corre en
Windows igual, asi que la VM solo agrega capas entre el telefono y lo que ve David.

Repositorio: https://github.com/gustavop-dev/yapa-demo (privado)

## Paso 1: instalar

Todo esto se instala por linea de comandos con `winget`, sin Android Studio. Son unos
2 GB en vez de 8, y no hay wizard grafico que haya que atender:

```powershell
winget install --id Microsoft.OpenJDK.17 --exact
winget install --id Google.PlatformTools --exact
winget install --id Genymobile.scrcpy --exact
```

- **JDK 17** porque la documentacion de React Native dice textual *"We recommend JDK
  17. You may encounter problems using higher JDK versions."*
- **Google.PlatformTools** es `adb` y `fastboot`. Deja el PATH modificado, asi que hay
  que abrir una terminal nueva para que aparezcan.
- **scrcpy 4.1**, el binario oficial. No uses la version de apt de Linux: es la 1.25,
  de 2022.

Node LTS (https://nodejs.org) y Git para Windows (https://git-scm.com/download/win)
van aparte con su instalador. Git Bash es lo que vas a usar para los scripts `.sh` del
repo.

Falta el SDK propiamente dicho, que Android Studio bajaria solo. Sin Android Studio se
baja con las command line tools:

1. Bajar `commandlinetools-win-*_latest.zip` de
   https://developer.android.com/studio (seccion "Command line tools only").
2. Descomprimir en `%LOCALAPPDATA%\Android\Sdk\cmdline-tools\latest`, de forma que
   quede `...\cmdline-tools\latest\bin\sdkmanager.bat`. Ese anidamiento importa: si
   queda un nivel de mas, `sdkmanager` no encuentra su propia raiz.
3. Instalar los paquetes y aceptar licencias:

```powershell
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
& "$env:ANDROID_HOME\cmdline-tools\latest\bin\sdkmanager.bat" --licenses
& "$env:ANDROID_HOME\cmdline-tools\latest\bin\sdkmanager.bat" "platform-tools" "platforms;android-36" "build-tools;36.0.0"
```

4. Dejar `ANDROID_HOME` fijo para las proximas sesiones:

```powershell
[Environment]::SetEnvironmentVariable("ANDROID_HOME", "$env:LOCALAPPDATA\Android\Sdk", "User")
```

## Paso 2: clonar y preparar

En Git Bash o PowerShell:

```sh
git clone https://github.com/gustavop-dev/yapa-demo.git
cd yapa-demo
npm install
npm test
```

`npm test` tiene que dar 55 tests en verde (48 del motor, 7 del seed). Si eso pasa, el
motor viajo bien y el problema, si aparece, va a ser de toolchain y no de codigo.

Para ver el motor decidiendo sin necesidad de telefono:

```sh
npm run demo
```

## Paso 3: el telefono

1. Ajustes, Acerca del telefono, tocar **Numero de compilacion** siete veces.
2. Ajustes, Sistema, Opciones de desarrollador, activar **Depuracion por USB**.
3. Conectar por USB y aceptar la huella RSA que aparece en el telefono.

```sh
adb devices
```

Tiene que listar el telefono como `device`. Si dice `unauthorized`, revisa el dialogo
en la pantalla del telefono. Si no aparece nada, puede faltar el driver USB del
fabricante: buscalo como "OEM USB driver" mas la marca de tu telefono.

## Paso 4: el primer build (el gate)

Si esto no funciona, no sirve seguir con nada mas.

```sh
npm run android --workspace=@yapa/mobile
```

La primera vez tarda entre 10 y 30 minutos porque Gradle baja todo. Si falla, copiá el
error completo.

## Paso 5: espejar la pantalla para la llamada

```sh
scrcpy --stay-awake
```

Dejá el telefono enchufado por USB durante toda la demo: Doze no aplica mientras
carga, y `--stay-awake` evita que la pantalla se apague sola.

En la videollamada, compartí **pantalla completa**, no la ventana suelta de scrcpy.

## Para la demo, no antes

Estas van el dia de la llamada, no ahora:

- Telefono en **modo avion con wifi reconectado a mano**: mata llamadas y SMS
  entrantes en medio de la demo. El GNSS sigue funcionando porque es solo receptor, y
  el push llega igual por wifi.
- Compilar con **`npm run android:release --workspace=@yapa/mobile`**: embebe el
  bundle y elimina el servidor de Metro como dependencia viva. Sin pantalla roja ni
  LogBox delante del fundador.

## Comandos utiles para ensayar

Resetear permisos para volver a ver el dialogo de primer uso:

```sh
adb shell pm clear com.yapa.demo
```

Dejar el telefono exactamente en el estado de "ubicacion aproximada", que es el
momento mas fuerte de la demo:

```sh
adb shell am force-stop com.yapa.demo
adb shell pm revoke com.yapa.demo android.permission.ACCESS_FINE_LOCATION
adb shell pm grant  com.yapa.demo android.permission.ACCESS_COARSE_LOCATION
```

La app tiene que detectarlo y mostrar el estado degradado, aunque Android reporte
`granted: true`.

## Lo que ya esta hecho

- Motor de recomendacion por MCC, 55 tests en verde
- 386 comercios de Costa Mesa y 467 de Duitama, sacados de OpenStreetMap
- Pantalla, modulo de ubicacion y modulo de notificaciones, escritos y con typecheck
  limpio, todavia sin probar en dispositivo
- Dia 3: disparador de proximidad con histeresis (entra a 120 m, se re-arma pasados
  220 m), silencio por encima de 200 m de error, una notificacion por llegada y no una
  por comercio, y cooldown de 90 s. La logica pura vive en `@yapa/engine` y tiene 8
  tests propios, asi que se verifica sin telefono
- El vigilante se corta solo al pasar la app a segundo plano, que es la misma decision
  de compliance que el resto del proyecto
- Boton de ensayo que corre el mismo disparador contra el punto mas denso de Duitama,
  para no depender de que haya algo cerca durante la llamada
- Boton que muestra el `ExponentPushToken` en pantalla y lo escribe al log
- `scripts/send-push.sh` para disparar la push remota cuando tengas el token

## Lo que falta

- Verificar en el telefono todo lo del dia 3: nada de eso corrio nunca en un
  dispositivo, y el plan marca eso como el riesgo numero uno
- Dia 4, que es casi todo tramite de cuentas y no codigo:
  1. Crear el proyecto en Firebase Console
  2. Bajar `google-services.json`, ponerlo en `packages/mobile/` y agregar
     `"googleServicesFile": "./google-services.json"` dentro de `android` en
     `app.json`. Tiene que estar **antes** del prebuild
  3. Generar la service account key (Project settings, Service accounts, Generate New
     Private Key) y subirla con `eas credentials`, en Android, FCM V1
  4. `eas init` para que `app.json` tenga un `projectId` de verdad: hoy dice
     `PENDIENTE` y por eso el boton de token responde que falta
  5. Rebuild, tocar "Mostrar token" y pasarselo a `scripts/send-push.sh`
- El plan completo esta en `docs/plan-geo-y-push.md`
