#!/bin/sh
# Publica o kart-edge na VPS: build local (esbuild), envia o dist e recria o container (~2 s fora do ar).
# Uso: sh services/edge/publicar.sh            (só do main, como os Workers)
#      sh services/edge/publicar.sh --segredos (também regrava /srv/kart-edge/dados/segredos/*.env a partir do cofre)
set -eu
VPS=deploy@187.53.120.50
RAIZ=$(cd "$(dirname "$0")/../.." && pwd)
cd "$RAIZ"
node services/edge/build.mjs
ssh "$VPS" 'mkdir -p /srv/kart-edge/dados/segredos ~/servicos/kart-edge && chmod 700 /srv/kart-edge/dados/segredos && touch /srv/kart-edge/edge.env && chmod 600 /srv/kart-edge/edge.env'
rsync -a --delete services/edge/dist/ "$VPS:/srv/kart-edge/dist-novo/"
scp -q services/edge/compose.yml "$VPS:servicos/kart-edge/compose.yml"
if [ "${1:-}" = "--segredos" ]; then
  # cofre (sops) -> um .env por Worker na VPS, sem passar por arquivo no Mac
  OS="${KARTODROMO_OS:-$HOME/PROJETOS/kartodromo-os}"
  SOPS_AGE_KEY_FILE="${SOPS_AGE_KEY_FILE:-$HOME/.config/sops/age/keys.txt}" sops -d --output-type json --extract '["workers_cloudflare"]' "$OS/infra/segredos/producao.enc.yaml" \
    | ssh "$VPS" 'python3 -c "
import json, os, sys
d = json.load(sys.stdin)
for w, kv in d.items():
    p = f\"/srv/kart-edge/dados/segredos/{w}.env\"
    with open(p, \"w\") as f:
        f.write(\"\".join(f\"{k}={v}\\n\" for k, v in kv.items()))
    os.chmod(p, 0o600)
print(\"segredos:\", len(d), \"workers\")
"'
fi
ssh "$VPS" 'set -e
cd /srv/kart-edge
rm -rf dist-antigo; [ -d dist ] && mv dist dist-antigo; mv dist-novo dist
cd ~/servicos/kart-edge && docker compose up -d --force-recreate >/dev/null
for i in $(seq 1 20); do sleep 1; docker exec kart-edge wget -qO- http://127.0.0.1:8787/__edge/saude >/dev/null 2>&1 && break; done
docker exec kart-edge wget -qO- http://127.0.0.1:8787/__edge/saude; echo
docker logs --tail 5 kart-edge 2>&1'
