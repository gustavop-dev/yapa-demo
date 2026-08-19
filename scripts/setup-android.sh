#!/usr/bin/env bash
# LINUX ONLY, y fuera del camino actual. El desarrollo se movio a Windows: ver
# ARRANQUE.md, que instala lo mismo con winget y las command line tools del SDK.
# Se conserva porque documenta las reglas udev y el problema del scrcpy de apt, que
# no tienen equivalente en Windows.
#
# Prepara la maquina para compilar la app y para espejar el telefono en la llamada.
#
# Instala: JDK 17, adb, reglas udev, y scrcpy desde el binario oficial.
# NO instala Android Studio: eso va aparte, ver el paso 3 del README de arranque.
#
# Leelo antes de correrlo. Pide sudo para apt y para las reglas udev.

set -euo pipefail

say() { printf '\n>>> %s\n' "$1"; }

# ---------------------------------------------------------------------------
# 1. JDK 17
#
# React Native lo dice textual: "We recommend JDK 17. You may encounter problems
# using higher JDK versions." Esta maquina tiene solo el 21, que es justo el caso
# que la doc marca como problematico. Instalamos el 17 al lado, sin sacar el 21.
# ---------------------------------------------------------------------------
say "Instalando JDK 17 (React Native no recomienda el 21)"
sudo apt-get update
sudo apt-get install -y openjdk-17-jdk

JAVA17_HOME="$(dirname "$(dirname "$(readlink -f /usr/lib/jvm/java-17-openjdk-amd64/bin/java)")")"
echo "JDK 17 quedo en: $JAVA17_HOME"

# ---------------------------------------------------------------------------
# 2. adb y reglas udev
#
# Sin las reglas udev, `adb devices` dice "no permissions" y no ves el telefono.
# El usuario ya esta en el grupo plugdev, que es la otra mitad del requisito.
# ---------------------------------------------------------------------------
say "Instalando adb y reglas udev"
sudo apt-get install -y adb android-sdk-platform-tools-common

# ---------------------------------------------------------------------------
# 3. scrcpy
#
# El paquete de apt es la version 1.25, de 2022. La documentacion de scrcpy marca
# como obsoletos tanto el apt como el snap. Bajamos el binario oficial mas reciente,
# que es lo que vas a usar para que David vea la pantalla del telefono.
# ---------------------------------------------------------------------------
say "Instalando scrcpy desde el binario oficial (el de apt es la 1.25, vieja)"
SCRCPY_DIR="$HOME/.local/opt/scrcpy"
mkdir -p "$SCRCPY_DIR" "$HOME/.local/bin"

ASSET_URL="$(curl -sS https://api.github.com/repos/Genymobile/scrcpy/releases/latest \
  | grep -o 'https://[^"]*linux-x86_64[^"]*\.tar\.gz' | head -1)"

if [[ -z "$ASSET_URL" ]]; then
  echo "No pude resolver la URL del release de scrcpy." >&2
  echo "Bajalo a mano desde https://github.com/Genymobile/scrcpy/releases" >&2
else
  echo "Bajando $ASSET_URL"
  curl -sSL "$ASSET_URL" -o /tmp/scrcpy.tar.gz
  tar -xzf /tmp/scrcpy.tar.gz -C "$SCRCPY_DIR" --strip-components=1
  ln -sf "$SCRCPY_DIR/scrcpy" "$HOME/.local/bin/scrcpy"
  rm -f /tmp/scrcpy.tar.gz
fi

# ---------------------------------------------------------------------------
# 4. Variables de entorno
#
# ANDROID_HOME apunta a donde Android Studio deja el SDK por defecto en Linux.
# Si instalas el SDK en otro lado, corregi esta linea en tu ~/.bashrc.
# ---------------------------------------------------------------------------
say "Escribiendo variables en ~/.bashrc"

BLOCK_START="# --- yapa demo: android env ---"
if grep -q "$BLOCK_START" "$HOME/.bashrc"; then
  echo "El bloque ya estaba en ~/.bashrc, no lo duplico."
else
  cat >> "$HOME/.bashrc" <<EOF

$BLOCK_START
export JAVA_HOME="$JAVA17_HOME"
export ANDROID_HOME="\$HOME/Android/Sdk"
export PATH="\$PATH:\$ANDROID_HOME/platform-tools:\$ANDROID_HOME/emulator:\$HOME/.local/bin"
# --- fin yapa demo ---
EOF
  echo "Agregado. Abri una terminal nueva o corre: source ~/.bashrc"
fi

say "Listo. Verifica con:"
cat <<'EOF'
  source ~/.bashrc
  java -version          # deberia decir 17
  adb version
  scrcpy --version
  echo $ANDROID_HOME

Falta lo que este script NO hace, y va en este orden:
  1. Instalar Android Studio y dejar que baje el SDK
  2. Activar Opciones de desarrollador y Depuracion USB en el telefono
  3. Conectar el telefono y confirmar: adb devices
EOF
