#!/usr/bin/env bash
# Fires a remote push notification against the Expo Push Service.
#
# Usage:
#   export YAPA_PUSH_TOKEN='ExponentPushToken[xxxxxxxx]'
#   ./scripts/send-push.sh
#   ./scripts/send-push.sh "Custom title" "Custom body"
#
# The point of this notification is that it needs NO location. It is fired from a
# server against the promo catalog: zero GPS, zero battery, zero sensitive permissions.
# Most of the value of push lives here, not in the geofence.
#
# The notification copy stays in Spanish: it is what the founder reads on screen.
#
# Service rate limit: 600 notifications per second per project.

set -euo pipefail

if [[ -z "${YAPA_PUSH_TOKEN:-}" ]]; then
  echo "YAPA_PUSH_TOKEN is not set." >&2
  echo "The token comes from getExpoPushTokenAsync and needs:" >&2
  echo "  1. A Firebase project created" >&2
  echo "  2. google-services.json in the binary, before the prebuild" >&2
  echo "  3. An FCM V1 service account key uploaded with: eas credentials" >&2
  exit 1
fi

TITLE="${1:-Tu categoria rotativa vence en 3 dias}"
BODY="${2:-Activala para no perder el 5% en supermercados.}"

# Git Bash on Windows has no python3, so the pretty printer is optional: without it
# the raw JSON still gets printed instead of the script dying on a broken pipe.
if command -v python3 >/dev/null 2>&1; then
  pretty() { python3 -m json.tool; }
else
  pretty() { cat; echo; }
fi

curl -sS \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -X POST "https://exp.host/--/api/v2/push/send" \
  -d "$(printf '{"to":"%s","title":"%s","body":"%s","channelId":"yapa-default","priority":"high"}' \
        "$YAPA_PUSH_TOKEN" "$TITLE" "$BODY")" \
  | pretty

echo
echo "If data.status is 'ok', keep the id: the receipt can be queried at"
echo "https://exp.host/--/api/v2/push/getReceipts"
