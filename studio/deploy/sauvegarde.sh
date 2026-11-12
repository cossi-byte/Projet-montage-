#!/usr/bin/env bash
# Sauvegarde vers un stockage cloud configuré dans rclone (Google Drive, Backblaze B2, S3…).
# Utilise « rclone copy » (jamais « sync ») : rien n'est jamais supprimé côté sauvegarde.
#   Préparation (une fois) : sudo apt install rclone && rclone config   (créer un « remote » nommé sauvegarde)
#   Usage : bash deploy/sauvegarde.sh            → analyses + exports + business
#           bash deploy/sauvegarde.sh --originaux → ajoute les originaux (volumineux !)
set -euo pipefail
LIB="${STUDIO_DATA:-$(dirname "$0")/../../library}"
DEST="${SAUVEGARDE_REMOTE:-sauvegarde:studio}"
OPTS=(--checksum --transfers 4 --progress --exclude "*.tmp*" --exclude "audio.wav")
rclone copy "$LIB/projects" "$DEST/projects" "${OPTS[@]}"
rclone copy "$LIB/exports"  "$DEST/exports"  "${OPTS[@]}"
rclone copy "$(dirname "$0")/../business/data" "$DEST/business" "${OPTS[@]}"
if [[ "${1:-}" == "--originaux" ]]; then
  rclone copy "$LIB/originals" "$DEST/originals" "${OPTS[@]}"
fi
echo "✔ Sauvegarde terminée vers $DEST"
