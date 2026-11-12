#!/usr/bin/env bash
# Installation sans Docker sur Ubuntu/Debian (serveur ou PC Linux). À lancer depuis le dossier studio/.
set -euo pipefail
sudo apt-get update && sudo apt-get install -y ffmpeg python3-venv fonts-dejavu-core
python3 -m venv .venv && . .venv/bin/activate && pip install -r requirements.txt
[ -f deploy/.env ] || { cp deploy/.env.exemple deploy/.env; sed -i "s|^STUDIO_TOKEN=.*|STUDIO_TOKEN=$(python3 -c 'import secrets;print(secrets.token_urlsafe(32))')|" deploy/.env; }
echo "Jeton d'accès (à garder secret) : $(grep STUDIO_TOKEN deploy/.env | cut -d= -f2)"
echo "Démarrer :  set -a; . deploy/.env; set +a; cd server && ../.venv/bin/uvicorn app:app --host 127.0.0.1 --port 8765"
echo "Puis exposez-le en HTTPS : 'tailscale serve 8765' (privé) ou Caddy (public) — voir docs/ANDROID.md"
