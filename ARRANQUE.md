# Por donde empezar

Orden pensado para que lo bloqueante vaya primero y lo que puede fallar se descubra
hoy, no el dia de la demo.

## Paso 0: la sesion grafica (5 minutos, hacelo primero)

Ubuntu 24.04 arranca en Wayland, y compartir pantalla por Zoom o Meet desde Wayland
tiene fallas conocidas de pantalla en negro. Si esto te falla el dia de la llamada, no
hay demo.

1. Cerra sesion.
2. En la pantalla de login, toca el engranaje y elegi **"Ubuntu on Xorg"**.
3. Entra y verifica en una terminal del escritorio (no por SSH):

```sh
echo $XDG_SESSION_TYPE     # tiene que decir: x11
```

Si dice `wayland`, volve a cerrar sesion y revisa que elegiste Xorg.

## Paso 1: las cuentas (10 minutos, en el navegador)

Las dos son gratis y bloquean el dia de push remota. Hacelas ahora aunque no las uses
hasta el jueves.

- **Expo**: crear cuenta en https://expo.dev
- **Firebase**: entrar a https://console.firebase.google.com con tu cuenta de Google.
  Todavia no crees el proyecto, solo confirma que podes entrar.

## Paso 2: el toolchain de linea de comandos

```sh
./scripts/setup-android.sh
```

Instala JDK 17, adb, reglas udev y scrcpy. Leelo antes si querés: esta comentado.

Por que JDK 17 y no el 21 que ya tenés: la documentacion de React Native dice textual
*"We recommend JDK 17. You may encounter problems using higher JDK versions."*

Despues:

```sh
source ~/.bashrc
java -version    # 17
adb version
scrcpy --version
```

## Paso 3: Android Studio y el SDK

```sh
sudo snap install android-studio --classic
```

Abrilo y dejá que el asistente de primer arranque baje el SDK y acepte las licencias.
Es la parte que mas se rompe si se hace a mano, por eso conviene el asistente.

Cuando termine, verifica que el SDK quedo donde el script espera:

```sh
ls $ANDROID_HOME     # deberia listar platform-tools, platforms, build-tools
```

Si quedo en otro lado, corregi `ANDROID_HOME` en tu `~/.bashrc`.

## Paso 4: el telefono

1. Ajustes, Acerca del telefono, tocar **Numero de compilacion** siete veces.
2. Ajustes, Sistema, Opciones de desarrollador, activar **Depuracion por USB**.
3. Conectar por USB y aceptar la huella RSA que aparece en el telefono.

```sh
adb devices      # tiene que listar tu telefono como "device", no "unauthorized"
```

Si dice `no permissions`, cerra sesion y volve a entrar: las reglas udev y el grupo
plugdev necesitan un login nuevo.

## Paso 5: el primer build

Este es el gate. Si esto no funciona, no sirve seguir con nada mas.

```sh
npm run android --workspace=@yapa/mobile
```

La primera vez tarda entre 10 y 30 minutos: Gradle baja todo. Si falla, copiame el
error completo.

## Paso 6: espejar la pantalla

```sh
scrcpy --stay-awake
```

Deja el telefono enchufado por USB mientras dure la demo: Doze no aplica mientras
carga, y `--stay-awake` evita que la pantalla se apague sola.

Para la llamada, compartí **pantalla completa**, no la ventana suelta de scrcpy. Es
donde falla el portal de captura.

---

## Cuando termines el paso 5

Avisame y seguimos con la notificacion de proximidad y la push remota. El codigo de
ubicacion ya esta escrito y compilando, solo falta probarlo en el dispositivo.

## Lo que ya esta hecho y no vas a tener que tocar

- Motor de recomendacion por MCC, con 47 tests en verde
- 386 comercios de Costa Mesa y 467 de Duitama, sacados de OpenStreetMap
- La pantalla, el modulo de ubicacion y el de notificaciones, escritos y compilando
- `scripts/send-push.sh` para disparar la push remota cuando tengas el token
