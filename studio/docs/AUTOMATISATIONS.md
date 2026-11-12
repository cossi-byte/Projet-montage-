# Automatisations

Règle commune : **Claude prépare, vous validez.** Aucun e-mail envoyé, aucune publication, aucun
partage de fichier, aucun paiement sans votre accord explicite.

| Besoin | Comment | Prérequis | État |
|---|---|---|---|
| Recevoir et classer les e-mails | Claude lit Gmail, trie (clients / opportunités / factures / administratif), applique des libellés | Connecteur **Gmail** activé | ⏳ à activer |
| Repérer nouveaux contrats et opportunités | Claude cherche dans Gmail les mots-clés (devis, tournage, mariage, appel à projets, mission, Upwork…) et met à jour `business/prospects.csv` | Gmail | ⏳ |
| Préparer les réponses | Brouillons Gmail rédigés par Claude, **jamais envoyés** sans vous | Gmail | ⏳ |
| Organiser les rendez-vous | Lecture de l'agenda, proposition de créneaux, création d'événements après accord | **Google Calendar** | ⏳ |
| Tâche quotidienne | Une « tâche planifiée » Claude chaque matin : résumé des e-mails importants, rendez-vous du jour, relances dues, appels à projets qui ferment | Connecteurs + votre accord | proposable sur demande |
| Sauvegarder les projets | `deploy/sauvegarde.sh` (rclone, copie sans suppression) + ce dépôt GitHub pour les documents | rclone configuré sur le serveur | ✅ script prêt |
| Classer les rushes | `pipeline/classer_rushes.py` + analyse automatique à la réception (`STUDIO_AUTOPROCESS=1`) | serveur | ✅ testé |
| Documents de production | Claude rédige feuilles de service, dépouillements, plans de travail, autorisations de tournage à partir de vos scénarios | aucun | ✅ sur demande |
| Suivi des tâches et clients | `business/prospects.csv` ou base Notion | Notion autorisé (option) | ✅ CSV / ⏳ Notion |
| Préparer les publications | Exports verticaux + sous-titres (Studio), visuels et miniatures (Canva), textes et hashtags (Claude). **Publication par vous** | Canva ✅ | ✅ |
| Workflows sans Claude (déclencheurs) | **n8n** auto-hébergé : nouvelle vidéo reçue → notification ; nouveau mail « devis » → ligne dans le suivi ; nouveau fichier Drive → envoi vers Studio | `docker compose --profile automatisation up -d` | 📄 fourni, non testé ici |

### Exemple de demande quotidienne (une fois Gmail et Agenda activés)
> « Fais le point du matin : e-mails importants depuis hier, réponses à préparer en brouillon,
> mes rendez-vous du jour, relances prospects dues, appels à projets qui ferment dans 15 jours. »
