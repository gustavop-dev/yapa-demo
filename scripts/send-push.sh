#!/usr/bin/env bash
# Dispara una notificacion push remota contra el Expo Push Service.
#
# Uso:
#   export YAPA_PUSH_TOKEN='ExponentPushToken[xxxxxxxx]'
#   ./scripts/send-push.sh
#   ./scripts/send-push.sh "Titulo propio" "Cuerpo propio"
#
# El punto de esta notificacion es que NO necesita ubicacion. Se dispara desde un
# servidor contra el catalogo de promos: cero GPS, cero bateria, cero permisos
# delicados. La mayor parte del valor del push esta aca, no en la geocerca.
#
# Rate limit del servicio: 600 notificaciones por segundo por proyecto.

set -euo pipefail

if [[ -z "${YAPA_PUSH_TOKEN:-}" ]]; then
  echo "Falta YAPA_PUSH_TOKEN." >&2
  echo "El token sale de getExpoPushTokenAsync y necesita:" >&2
  echo "  1. Proyecto de Firebase creado" >&2
  echo "  2. google-services.json en el binario, antes del prebuild" >&2
  echo "  3. Service account key de FCM V1 subida con: eas credentials" >&2
  exit 1
fi

TITLE="${1:-Tu categoria rotativa vence en 3 dias}"
BODY="${2:-Activala para no perder el 5% en supermercados.}"

curl -sS \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -X POST "https://exp.host/--/api/v2/push/send" \
  -d "$(printf '{"to":"%s","title":"%s","body":"%s","channelId":"yapa-default","priority":"high"}' \
        "$YAPA_PUSH_TOKEN" "$TITLE" "$BODY")" \
  | python3 -m json.tool

echo
echo "Si data.status es 'ok', guardate el id: se puede consultar el recibo en"
echo "https://exp.host/--/api/v2/push/getReceipts"
