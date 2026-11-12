# Travailler depuis un téléphone Android : ce qui est possible, ce qui ne l'est pas

## Les limites, sans détour

| Question | Réponse |
|---|---|
| Puis-je envoyer une vidéo de 64 Go directement dans le chat Claude ? | **Non.** Les pièces jointes du chat sont limitées à des fichiers bien plus petits. Il faut le serveur Studio (ci-dessous). |
| Cette session Claude Code (dans le cloud) peut-elle recevoir mes 64 Go ? | **Non.** Elle tourne dans un conteneur temporaire (≈ 30 Go d'espace, effacé après inactivité), qui n'est pas joignable depuis Internet. Il a servi à construire et tester le système. |
| Le téléphone peut-il faire tourner Premiere, Resolve, After Effects ? | **Non.** Ce sont des logiciels de bureau (Windows/macOS ; Resolve aussi Linux). DaVinci Resolve existe sur iPad, pas sur Android. |
| Le téléphone peut-il analyser une vidéo de plusieurs heures ? | En théorie FFmpeg et Python tournent dans Termux, mais transcrire et analyser des heures de vidéo sur un téléphone serait extrêmement lent et le ferait chauffer. **L'analyse se fait sur le serveur.** |
| Que fait le téléphone, alors ? | Il **envoie** les fichiers (Chrome ou Termux), **consulte** les rapports, vignettes, proxys et sous-titres, et **discute avec Claude**. |

## L'architecture recommandée

```
Téléphone Android ──HTTPS, par morceaux, reprise──▶  SERVEUR (VPS ou PC)
  Chrome : page Studio                                 ├─ studio/server   : réception 64 Go, SHA-256
  Termux : upload.py                                   ├─ studio/pipeline : proxy, plans, transcription…
  App Claude ◀─────────── Claude Code installé ────────┤─ library/        : originaux intacts + analyses
                                                       └─ n8n (option)    : automatisations
```

Claude Code doit tourner **là où sont les fichiers**. Sur le serveur, installez Claude Code,
ouvrez ce dépôt, et pilotez-le depuis l'app Claude du téléphone (Remote Control) ou en SSH
depuis Termux (`pkg install openssh`).

### Option A — Serveur loué (VPS) : recommandé si vous n'avez pas d'ordinateur

- **Disque** : au moins **250 Go** (un original de 64 Go + proxy + audio + exports), idéalement un volume de stockage séparé de 500 Go à 1 To.
- **Processeur** : 4 cœurs minimum. Mesure réelle sur 4 cœurs : proxy 1080p → 480p à **≈ 8× le temps réel** (1 h de rushes ≈ 7 à 8 min). Une source 4K sera plus lente.
- **Système** : Ubuntu 24.04. Installation : `studio/deploy/installer_serveur.sh` ou `docker compose` (voir `deploy/`).
- **Coût** : de quelques euros à quelques dizaines d'euros par mois selon le disque et le fournisseur (Hetzner, OVHcloud, Contabo, Scaleway…). **Vérifiez les tarifs du jour : je ne souscris rien sans votre accord.**

### Option B — Un ordinateur chez vous

Un PC (même ancien) sous Linux ou Windows avec un gros disque. Pour y accéder depuis le téléphone
sans ouvrir votre box à Internet : **Tailscale** (gratuit pour un usage personnel) puis
`tailscale serve 8765` → adresse HTTPS privée, visible seulement par vos appareils.
Avantage : Premiere/Resolve peuvent tourner sur la même machine et être pilotés par Claude via Filmit.

## Envoyer une vidéo depuis le téléphone

**Méthode 1 — Chrome (le plus simple, marche aussi avec une clé USB-C)**
1. Ouvrez `https://votre-serveur` dans Chrome, collez le jeton une fois.
2. « Choisir un fichier » → Fichiers → votre vidéo (mémoire interne, carte SD **ou clé/disque USB-C**).
3. « Envoyer ». La page empêche la mise en veille de l'écran pendant l'envoi.
4. Coupure, appel, batterie vide ? Rouvrez la page, resélectionnez **le même fichier**, « Envoyer » : seuls les morceaux manquants partent.

**Méthode 2 — Termux (plus robuste pour les très gros fichiers)**
```bash
# installer Termux depuis F-Droid (la version Play Store n'est plus maintenue)
bash termux_installer.sh
python ~/studio/upload.py ~/storage/dcim/Camera/VID_20261112.mp4
```
Le client calcule d'abord le SHA-256 du fichier complet, puis l'envoie par morceaux de 32 Mo,
en 3 connexions parallèles ; relancer la même commande reprend un envoi interrompu.
Pour garder Termux actif écran éteint : `termux-wake-lock`.

## Stockage externe USB-C

- Formatez le disque en **exFAT** : le FAT32 refuse les fichiers de plus de 4 Go.
- Android lit les disques USB-C (OTG) via l'app *Fichiers* ; un SSD externe en USB 3 est bien plus rapide et fiable qu'une clé.
- Termux n'accède pas librement aux clés USB (restriction Android) : pour un fichier sur clé USB, utilisez la **méthode Chrome**.
- Gardez toujours une copie des originaux sur le disque USB jusqu'à ce que le serveur affiche « Reçu et vérifié » avec le même SHA-256.

## Le vrai goulot d'étranglement : votre connexion

Temps d'envoi d'un fichier de **64 Go** :

| Débit montant | Durée |
|---|---|
| 5 Mb/s (4G moyenne) | ≈ 28 h |
| 20 Mb/s | ≈ 7 h |
| 100 Mb/s (fibre) | ≈ 1 h 25 |

Et 64 Go de forfait mobile coûtent cher. Pistes : envoyer depuis une connexion fibre (bureau,
espace de coworking) ; envoyer d'abord une **version allégée** pour l'analyse (le serveur produit
de toute façon un proxy) et apporter l'original plus tard sur disque ; ou laisser l'original sur
un disque et n'envoyer que les passages utiles.

## Ce que Claude peut faire directement sur Android

L'app Claude (et claude.ai dans Chrome) : discussion, rédaction, recherche web, connecteurs
(Canva, Gmail, Agenda, Notion une fois activés), et pilotage d'une session Claude Code tournant
sur votre serveur. C'est votre poste de commande ; la puissance de calcul est sur le serveur.
