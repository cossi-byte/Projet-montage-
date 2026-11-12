# Connecteurs — état réel au 12/11/2026

Trois choses différentes, à ne pas confondre :

- **Connecteur MCP** : outil que Claude appelle directement dans la conversation (ex. Canva).
- **API** : interface programmable d'un service ; il faut écrire du code ou passer par n8n/Make/Zapier, et souvent une clé payante.
- **Logiciel pilotable** : logiciel de bureau qui accepte des commandes d'un script ou d'un plugin (Premiere, Resolve, After Effects) — il doit tourner sur **un ordinateur**, jamais sur le téléphone.

Les connecteurs claude.ai **ne s'installent pas depuis le code** : on les active dans
**claude.ai → Paramètres → Connecteurs** (autorisation OAuth par vous). Claude ne peut pas
lancer cette autorisation à votre place.

## Testés dans cette session

| Outil | Type | État constaté | Ce qui marche vraiment |
|---|---|---|---|
| **Canva** | MCP officiel | ✅ **Connecté et testé** : lecture de vos designs (« Blank black poster », « Brown Simple Spa & Beauty Salon Poster »…) | Créer des designs depuis une consigne, modifier textes/images, exporter PDF/PNG/MP4, redimensionner, miniatures YouTube, affiches, kits presse |
| **CapCut** (serveur « AITuber ») | MCP tiers | ✅ **Connecté et testé** : plan *Free*, **10 crédits** | Génère des vidéos IA (voix off, images IA, sous-titres) à partir d'un script, clips musicaux, avatars. **Ce n'est pas le logiciel CapCut** : il ne monte pas vos rushes. Chaque génération consomme des crédits → accord demandé à chaque fois |
| **Filmit** (serveur « DaVinci ») | MCP tiers → Premiere Pro, DaVinci Resolve, After Effects | ⚠️ **Compte connecté (plan gratuit, 50 actions/jour) mais aucun logiciel relié** | Une fois un logiciel ouvert sur un **ordinateur** avec le panneau Filmit → onglet MCP → *Connect* : créer séquences, placer des clips, marqueurs, couper, titres, motion design After Effects. Resolve : pas d'effets, de transitions ni d'images clés via son API |
| **Adobe for creativity** | MCP officiel | 🔒 **Autorisation requise** | Après autorisation : retouche photo par lots, déclinaisons réseaux sociaux, redimensionnement vidéo, Quick Cut (montage de moments forts), PDF |
| **Notion** | MCP officiel | 🔒 **Autorisation requise** | Après autorisation : pages projets, bases prospects, plannings |
| **Gmail / Google Calendar** | MCP officiels | ❌ **Aucun outil exposé dans cette session** | À activer dans claude.ai → Connecteurs. Ensuite : lire/classer/rédiger des brouillons d'e-mails, gérer l'agenda |
| **Figma, Slack, Linear, Atlassian** | MCP officiels | 🔒 Autorisation requise | Non prioritaires pour votre activité |
| **Asana** | MCP | ❌ Échec de connexion (serveur incompatible) | — |
| **GitHub** | MCP officiel | ✅ Connecté | Sauvegarde versionnée de vos projets (ce dépôt) |

## Sans connecteur MCP disponible

| Outil | Réalité | Solution proposée |
|---|---|---|
| **Google Drive** | Connecteur claude.ai à activer (même procédure que Gmail) | Pour les **gros fichiers vidéo**, utiliser plutôt `rclone` sur le serveur (gratuit) : `rclone copy drive:Rushes /data/entrant` |
| **Google Contacts** | Pas de connecteur officiel | Export CSV des contacts → `business/prospects.csv` ; ou API People via n8n |
| **LinkedIn** | **Aucune API de prospection ouverte** ; l'automatisation (scraping, messages en masse) est interdite par ses conditions et fait bannir les comptes | Claude prépare la liste de cibles, rédige messages et posts ; **vous** les envoyez à la main |
| **DaVinci Resolve** | API de script officielle (Python/Lua) ; le pilotage depuis un programme externe est pleinement pris en charge par la version **Studio** (payante), plus limité dans la version gratuite — à vérifier sur votre version | Via Filmit (ci-dessus) ou import de l'**EDL** produite par l'analyse |
| **Premiere Pro / After Effects** | Pilotables par ExtendScript/UXP, uniquement sur ordinateur | Via Filmit, ou import de l'EDL / des sous-titres SRT |
| **CapCut (logiciel)** | **Pas d'API publique** de montage | Importer à la main les extraits, SRT et exports verticaux produits par Studio |
| **Frame.io** | API officielle V4 (Adobe), pas de connecteur MCP | n8n (nœud HTTP) pour déposer les exports à valider par le client ; abonnement Frame.io requis au-delà de l'offre gratuite |
| **n8n** | Logiciel libre (licence *Sustainable Use*), auto-hébergeable gratuitement | Inclus dans `deploy/docker-compose.yml` (profil `automatisation`) |
| **Make / Zapier** | Services payants (offres gratuites limitées), connecteurs Gmail/Drive/Notion prêts | Utiles si vous ne voulez pas gérer de serveur ; à souscrire vous-même |
| **Upwork / Fiverr / Malt** | Pas d'API ouverte aux freelances pour chercher des missions | Claude recherche sur le web, prépare candidatures et devis ; vous postulez vous-même. Voir `OPPORTUNITES.md` |

## Ce que vous devez faire (5 minutes)

1. claude.ai → **Paramètres → Connecteurs** : activer **Gmail**, **Google Calendar**, **Google Drive**, autoriser **Notion** et **Adobe**.
2. Sur un ordinateur (dès que vous en avez un) : installer le panneau **Filmit** dans Premiere Pro / After Effects / Resolve et cliquer *Connect*.
3. Me dire « teste les connecteurs » dans une nouvelle session : je vérifierai chacun en lecture seule.
