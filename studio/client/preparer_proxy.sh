#!/data/data/com.termux/files/usr/bin/bash
# Fabrique sur le téléphone une copie LÉGÈRE (proxy 480p) de chaque vidéo, pour l'analyse.
# Débit plafonné à ~1 Mb/s : environ 450 Mo par heure de vidéo (5 h ≈ 2,2 Go au lieu de 64 Go).
# L'original n'est ni modifié ni déplacé. Les timecodes du proxy sont identiques à ceux de l'original,
# donc l'EDL produite par l'analyse se recale sur l'original dans Premiere / Resolve.
#
#   Installation (une fois) : pkg install ffmpeg
#   Usage : bash preparer_proxy.sh ~/storage/dcim/Camera/VID_xxx.mp4 [autres fichiers…]
#           (option : EMPREINTE=1 bash preparer_proxy.sh … pour calculer aussi le SHA-256 de l'original)
# Les proxys sont écrits dans  ~/storage/shared/Studio/  (dossier « Studio » visible dans Fichiers),
# prêts à être envoyés sur Google Drive ou au serveur Studio.
set -euo pipefail
OUT="${OUT:-$HOME/storage/shared/Studio}"
mkdir -p "$OUT"
command -v ffmpeg >/dev/null || { echo "Installez d'abord FFmpeg : pkg install ffmpeg"; exit 1; }
command -v termux-wake-lock >/dev/null && termux-wake-lock || true   # empêche la mise en veille
for SRC in "$@"; do
  NAME="$(basename "$SRC")"; STEM="${NAME%.*}"
  DEST="$OUT/$STEM.proxy.mp4"
  if [ -f "$DEST" ]; then echo "Déjà fait : $DEST"; continue; fi
  SIZE=$(stat -c %s "$SRC")
  DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$SRC" | cut -d. -f1)
  echo "▶ $NAME — $((SIZE / 1000000)) Mo, $((DUR / 60)) min. Fabrication du proxy…"
  ffmpeg -hide_banner -loglevel error -stats -i "$SRC" -map 0:v:0 -map 0:a:0? \
    -vf scale=-2:480 -c:v libx264 -preset ultrafast -crf 28 -maxrate 900k -bufsize 1800k -g 48 -pix_fmt yuv420p \
    -c:a aac -b:a 96k -ac 2 -movflags +faststart "$DEST.tmp.mp4"
  mv "$DEST.tmp.mp4" "$DEST"
  SHA=""
  if [ "${EMPREINTE:-0}" = "1" ]; then echo "  SHA-256 de l'original…"; SHA=$(sha256sum "$SRC" | cut -d' ' -f1); fi
  printf '{"original": "%s", "taille_original": %s, "duree_s": %s, "sha256_original": "%s", "proxy": "%s"}\n' \
    "$NAME" "$SIZE" "$DUR" "$SHA" "$(basename "$DEST")" > "$OUT/$STEM.proxy.json"
  echo "✔ $DEST ($(( $(stat -c %s "$DEST") / 1000000 )) Mo)"
done
command -v termux-wake-unlock >/dev/null && termux-wake-unlock || true
echo "Envoyez maintenant le dossier $OUT sur Google Drive (app Drive → + → Importer), ou : python upload.py FICHIER.proxy.mp4"
