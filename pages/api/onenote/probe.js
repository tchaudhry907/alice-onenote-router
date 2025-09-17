# ===== OneNote + Graph FULL diag =====
BASE="https://alice-onenote-router.vercel.app"

# 0) Copy the Authorization header again from /debug/diagnostics (Graph) BEFORE running this
RAW="$(pbpaste | tr -d '\r')"
case "$RAW" in
  Authorization:*) AUTH="$RAW" ;;
  [Bb]earer\ *)    AUTH="Authorization: $RAW" ;;
  *)               AUTH="Authorization: Bearer $RAW" ;;
esac
TOKEN="${AUTH#Authorization: Bearer }"
case "$TOKEN" in *.*.*) echo "🔐 Using bearer (masked)";; *) echo "❌ Clipboard missing a real token"; exit 1;; esac

echo "➡️ endpoint probe"
curl -i -s "$BASE/api/onenote" | sed -n '1p;/^x-matched-path:/p'

echo
echo "➡️ whoami (GET via server)"
curl -i -s "$BASE/api/onenote?act=me" -H "$AUTH"

echo
echo "➡️ whoami (POST via server)"
curl -i -s -X POST "$BASE/api/onenote" -H "$AUTH" -H "Content-Type: application/json" --data '{"act":"me"}'

echo
echo "➡️ Graph /me (direct)"
curl -i -s https://graph.microsoft.com/v1.0/me -H "$AUTH"

echo
echo "➡️ Graph notebooks (direct)"
curl -i -s "https://graph.microsoft.com/v1.0/me/onenote/notebooks?\$select=id,displayName" -H "$AUTH"
