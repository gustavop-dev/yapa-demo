# Por donde empezar (Windows)

El desarrollo se hace en Windows, no en la VM de Linux. La razon es concreta: el paso
de USB en VirtualBox suelta el telefono cuando este se re-enumera al activar la
depuracion o al aceptar la huella RSA, y sin `adb` viendo el telefono no se puede
compilar, ni instalar, ni ensayar, ni hacer la demo. Ademas la videollamada corre en
Windows igual, asi que la VM solo agrega capas entre el telefono y lo que ve David.

Repositorio: https://github.com/gustavop-dev/yapa-demo (privado)

## Paso 1: instalar (casi todo son descargas)

1. **Node LTS**: https://nodejs.org (el instalador .msi)
2. **Git para Windows**: https://git-scm.com/download/win
   Incluye Git Bash, que es lo que vas a usar para correr los scripts `.sh` del repo.
3. **Android Studio**: https://developer.android.com/studio
   Al abrirlo por primera vez, dejá que el asistente baje el SDK y acepte las
   licencias. Esa es la parte que mas se rompe si se hace a mano.
4. **scrcpy**: bajar el zip de Windows desde
   https://github.com/Genymobile/scrcpy/releases (hoy la v4.1)
   Descomprimirlo en una carpeta fija y agregar esa carpeta al PATH.
   No uses versiones viejas: la que trae apt en Linux es la 1.25, de 2022.

**JDK**: Android Studio ya trae un JDK embebido y Gradle lo usa por defecto, asi que
normalmente no hace falta instalar nada aparte. Si el build se queja de la version de
Java, instalá **JDK 17**: la documentacion de React Native dice textual *"We recommend
JDK 17. You may encounter problems using higher JDK versions."*

## Paso 2: clonar y preparar

En Git Bash o PowerShell:

```sh
git clone https://github.com/gustavop-dev/yapa-demo.git
cd yapa-demo
npm install
npm test
```

`npm test` tiene que dar 47 tests en verde (40 del motor, 7 del seed). Si eso pasa, el
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

- Motor de recomendacion por MCC, 47 tests en verde
- 386 comercios de Costa Mesa y 467 de Duitama, sacados de OpenStreetMap
- Pantalla, modulo de ubicacion y modulo de notificaciones, escritos y compilando,
  todavia sin probar en dispositivo
- `scripts/send-push.sh` para disparar la push remota cuando tengas el token

## Lo que falta

- Dias 3 y 4 del plan: notificacion de proximidad y push remota con Firebase
- El plan completo esta en `docs/plan-geo-y-push.md`
