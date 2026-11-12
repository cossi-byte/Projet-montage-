# Studio — transfert, analyse et montage assisté de vidéos (jusqu'à 64 Go)

| Dossier | Rôle |
|---|---|
| `server/` | Serveur de réception par morceaux (reprise, SHA-256, originaux en lecture seule) + page web pour téléphone |
| `client/` | `upload.py` : envoi en ligne de commande (Termux, PC), Python seul, sans dépendance |
| `pipeline/` | `analyze.py` (analyse complète), `studio.py` (chercher, extraire, monter, exporter), `classer_rushes.py` |
| `business/` | Devis et factures PDF, suivi des prospects, modèles de candidatures et propositions |
| `deploy/` | Installation serveur (script ou Docker + HTTPS), sauvegarde rclone, n8n |
| `docs/` | `CONNECTEURS.md`, `ANDROID.md`, `MONTAGE.md`, `OPPORTUNITES.md`, `AUTOMATISATIONS.md` |

## Démarrage rapide (serveur Linux)

```bash
cd studio && bash deploy/installer_serveur.sh          # FFmpeg + dépendances + jeton secret
set -a; . deploy/.env; set +a
cd server && ../.venv/bin/uvicorn app:app --host 127.0.0.1 --port 8765
# exposer en HTTPS : « tailscale serve 8765 » (privé) ou Caddy (voir deploy/docker-compose.yml)
```

Envoyer : ouvrir l'adresse HTTPS dans Chrome sur le téléphone, ou
`python3 client/upload.py video.mp4` (variables `STUDIO_URL` et `STUDIO_TOKEN`).

Analyser : bouton « Lancer l'analyse », réglage `STUDIO_AUTOPROCESS=1` (automatique à la réception),
ou `python3 pipeline/analyze.py library/originals/<id>__video.mp4 --language fr`.

## Comment le système tient 64 Go

- **Morceaux de 32 Mo** (réglable de 1 à 256 Mo), envoyés à 3 en parallèle, chacun vérifié par SHA-256 ;
  un morceau corrompu est refusé (HTTP 422) et renvoyé.
- **Écriture directe à la bonne position** dans un fichier pré-alloué : pas de réassemblage, pas de double
  occupation du disque.
- **État enregistré après chaque morceau** : le client peut être coupé, le serveur redémarré, le téléphone
  éteint ; on reprend avec les morceaux manquants seulement.
- **SHA-256 du fichier complet** recalculé à la fin et comparé à celui du client ; l'original est ensuite
  passé en lecture seule (`chmod 444`) avec son empreinte à côté.
- **Mémoire constante** : mesurée à 71 Mo côté serveur et 220 Mo côté client pour un fichier de 7,9 Go.
- **Analyse sans charger la vidéo** : l'original est lu une seule fois (proxy 480p + audio 16 kHz) ;
  la transcription traite l'audio par tranches de 15 min ; chaque étape reprend si elle est interrompue.
- Limite par défaut : 64 Gio (`STUDIO_MAX_SIZE`). Extensions acceptées : mp4, mov, m4v, mkv, mxf, avi, wav, mp3, m4a.

## Sécurité

- Jeton d'accès obligatoire (`STUDIO_TOKEN`), comparé en temps constant ; HTTPS par Caddy ou Tailscale.
- Les originaux ne sont jamais modifiés ni supprimés par aucun outil ; `DELETE` n'abandonne qu'un envoi inachevé.
- Aucun fichier n'est envoyé à un service externe : transcription (Whisper) et analyse tournent sur le serveur.
  Seuls les modèles Whisper sont téléchargés une fois depuis Hugging Face.
- Faire tourner le serveur sous un utilisateur non-root (fait dans l'image Docker) : root ignore le `chmod 444`.

## Licences des outils

FFmpeg (LGPL/GPL), PySceneDetect (BSD-3), OpenCV (Apache-2.0), faster-whisper et modèles Whisper (MIT),
MoviePy (MIT), FastAPI (MIT), Uvicorn (BSD), Pillow (MIT-CMU), NumPy (BSD), Caddy (Apache-2.0),
rclone (MIT), n8n (Sustainable Use License : gratuit pour un usage interne, pas de revente du service).
Toutes compatibles avec un usage professionnel pour votre propre activité.
