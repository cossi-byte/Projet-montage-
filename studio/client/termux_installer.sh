#!/data/data/com.termux/files/usr/bin/bash
# À lancer dans Termux (Android) : prépare l'envoi de vidéos vers votre serveur Studio.
set -e
pkg update -y && pkg install -y python openssl-tool ffmpeg
termux-setup-storage   # autorise l'accès à /sdcard (DCIM, Download, clé USB-C montée)
mkdir -p ~/studio && cp "$(dirname "$0")/upload.py" "$(dirname "$0")/preparer_proxy.sh" ~/studio/
echo 'export STUDIO_URL=https://VOTRE_SERVEUR' >> ~/.bashrc
echo 'export STUDIO_TOKEN=COLLER_LE_JETON_ICI' >> ~/.bashrc
echo "Éditez ~/.bashrc (nano ~/.bashrc) pour mettre l'adresse et le jeton, puis :"
echo "  python ~/studio/upload.py ~/storage/dcim/Camera/VID_xxx.mp4"
echo "Proxy léger pour l'analyse (solution gratuite) :  bash ~/studio/preparer_proxy.sh ~/storage/dcim/Camera/VID_xxx.mp4"
