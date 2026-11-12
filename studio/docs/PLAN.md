# Plan retenu : un studio en trois niveaux

Décision prise en fonction de votre situation : vous travaillez avec un téléphone Android, au Togo,
avec des fichiers pouvant atteindre 64 Go, et il faut limiter les dépenses tant que les revenus ne sont pas là.

## Le principe qui change tout : n'envoyez pas 64 Go, envoyez 2 Go

Les monteurs professionnels travaillent ainsi depuis toujours : **les originaux restent sur un
disque, on travaille sur des copies légères (proxys)**, puis on « reconforme » sur les originaux à la fin.

Pour analyser une vidéo, Claude n'a besoin ni de la 4K ni de 64 Go : il lui faut les images
(une par plan) et le son. Une version 480p à environ 1 Mb/s contient tout ce qu'il faut et pèse
**environ 450 Mo par heure**. Une vidéo de 5 heures et 64 Go devient un fichier de 2,2 Go,
soit 30 fois moins de données et 30 fois moins de temps d'envoi.

Les timecodes du proxy sont identiques à ceux de l'original. Le découpage, l'EDL et les
sous-titres produits par l'analyse s'appliquent donc directement aux originaux dans Premiere
ou Resolve.

## Niveau 1 — Gratuit, à partir d'aujourd'hui

```
Téléphone : vidéo originale (mémoire interne ou SSD USB-C)
   │  Termux : bash preparer_proxy.sh VIDEO.mp4        → VIDEO.proxy.mp4 (≈ 450 Mo/h) + .json
   ▼
Google Drive (votre compte, 15 Go gratuits) : importer le proxy + le .json, partager « avec le lien »
   │  Vous donnez le lien à Claude dans une session Claude Code (ce dépôt)
   ▼
Claude : recuperer.py LIEN --analyser  → plans, transcription, vignettes, rapport, EDL, SRT
   │  Claude regarde les planches, rédige rapport, conducteur, sélection, plan de montage
   ▼
Vous : rapport privé + EDL/SRT → finition (CapCut sur téléphone, ou Premiere/Resolve plus tard)
   puis retirez le partage du lien Drive
```

- **Coût** : 0 € en plus de votre abonnement Claude.
- **Limites** : la fabrication du proxy chauffe le téléphone et prend du temps. Testez d'abord un clip
  de 5 minutes pour mesurer la vitesse, puis lancez les gros fichiers la nuit, téléphone branché.
  L'espace de la session (≈ 30 Go) suffit pour plusieurs proxys, mais il s'efface à la fin de la session.
  Les résultats doivent donc vous être remis avant, et ils ne sont **jamais** mis sur GitHub (dépôt public).
- **Testé** : fabrication du proxy, récupération par lien avec contrôle d'intégrité, analyse complète, EDL
  au nom de l'original. **Non testé** : un vrai lien Google Drive (je n'en avais pas). Le premier
  essai se fera avec votre premier lien.

## Niveau 2 — Serveur loué, quand les premiers contrats arrivent

À prendre si vous devez **recevoir des originaux complets** (un client qui envoie ses rushes, une
livraison en haute définition) ou analyser chaque semaine.

- Le système complet `studio/` (réception 64 Go, page web pour téléphone, analyse automatique).
- **Mon choix : Contabo**, une offre de 4 à 6 vCPU, 8 à 12 Go de RAM et au moins 300 Go de disque.
  C'est le meilleur rapport espace/prix, ce qui compte le plus pour des vidéos. La puissance
  processeur est moins garantie que chez Hetzner, mais suffisante. Les sources relevées
  aujourd'hui (non officielles) indiquent environ 5 à 7 €/mois pour 4 vCPU / 8 Go. Les offres à
  gros disque coûtent plus cher : vérifiez sur contabo.com.
  Hetzner a fortement augmenté ses prix en 2026 et n'est plus le choix évident.
- L'inscription, le paiement et la vérification d'identité se font **par vous**. Ensuite, une
  seule commande installe tout (`deploy/installer_serveur.sh`).

## Niveau 3 — Un ordinateur, l'investissement qui change le métier

Un PC portable reconditionné (16 Go de RAM, carte graphique dédiée, SSD) permet de faire tourner
DaVinci Resolve (version gratuite) ou Premiere Pro. Avec le panneau **Filmit** déjà connecté à
votre compte, Claude pourra alors placer les clips, poser les marqueurs et préparer les séquences
directement dans votre logiciel. Le même PC peut servir de serveur Studio (niveau 2 sans abonnement).

## Ordre conseillé

1. **Cette semaine** : connecteurs Gmail, Agenda et Drive (claude.ai → Paramètres → Connecteurs) ;
   Termux et FFmpeg sur le téléphone ; premier test sur un clip de 5 minutes.
2. **Ce mois-ci** : portfolio (*Koko*, une bande démo de 60 s), offres et tarifs, 10 prospects par semaine.
3. **Premiers revenus** : serveur (niveau 2) si les volumes l'exigent, sinon épargner pour le PC (niveau 3).

## Sources (prix relevés le 12/11/2026, à revérifier)
- [Hetzner — augmentations de prix 2026 (Northflank)](https://northflank.com/blog/hetzner-cloud-server-price-increases) · [hetzexit](https://hetzexit.pages.dev/)
- [Contabo — prix (Toolradar)](https://toolradar.com/tools/contabo/pricing) · [Valebyte](https://valebyte.com/en/providers/contabo/)
