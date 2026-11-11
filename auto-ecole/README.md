# Site d'auto-école — inscription en ligne au permis de conduire

Site complet pour une auto-école au Bénin : vitrine publique, inscription en 4 étapes, espace candidat
(suivi, planning, paiements, reçus PDF), administration (tableau de bord, validation des dossiers,
moniteurs, véhicules, créneaux, tarifs, exports) et paiement Mobile Money via FedaPay.

**Stack** : PHP 8 (PDO, requêtes préparées) · MySQL / MariaDB · Bootstrap 5 · JavaScript sans dépendance.
Aucun Composer, aucun npm : on copie les fichiers, on importe le SQL, ça fonctionne.

## 1. Personnaliser (nom, ville, couleurs)

Tout se règle dans **`config/config.php`** :

| Constante | Rôle |
|---|---|
| `APP_NOM`, `APP_VILLE`, `APP_ADRESSE`, `APP_SLOGAN` | Identité de l'auto-école |
| `APP_TELEPHONE`, `APP_WHATSAPP`, `APP_EMAIL` | Coordonnées (WhatsApp au format `22901XXXXXXXX`) |
| `APP_LATITUDE`, `APP_LONGITUDE`, `APP_HORAIRES` | Carte et horaires de la page Contact |
| `COULEUR_PRINCIPALE`, `COULEUR_SECONDAIRE`, `COULEUR_ACCENT` | Couleurs du site et des PDF |
| `FEDAPAY_CLE_SECRETE`, `FEDAPAY_ENVIRONNEMENT` | Paiement Mobile Money |
| `MAIL_ACTIF`, `MAIL_EXPEDITEUR` | Notifications par e-mail |

Les tarifs, durées et pièces à fournir se modifient dans l'administration (**Tarifs**).
Les témoignages et la FAQ se modifient dans les tables `temoignages` et `faq` (phpMyAdmin).

## 2. Installation avec XAMPP (Windows, macOS, Linux)

1. Installer [XAMPP](https://www.apachefriends.org) avec **PHP 8.0 ou plus**, puis démarrer **Apache** et **MySQL**.
2. Copier le dossier `auto-ecole` dans `C:\xampp\htdocs\` (→ `C:\xampp\htdocs\auto-ecole`).
3. Ouvrir <http://localhost/phpmyadmin> → onglet **Importer** → choisir `database/schema.sql` → **Exécuter**.
   Le script crée la base `auto_ecole`, les tables et les données de démonstration.
4. Vérifier `config/database.php` (par défaut XAMPP : utilisateur `root`, mot de passe vide — rien à changer).
5. Ouvrir <http://localhost/auto-ecole/>.

Le sous-dossier est détecté automatiquement : aucune URL à configurer.

> Sous XAMPP, la fonction `mail()` n'envoie rien par défaut. Ce n'est pas bloquant : chaque notification
> est aussi enregistrée et visible dans l'espace du candidat et sur sa fiche dans l'administration.

## 3. Installation sur un hébergement mutualisé (cPanel, LWS, o2switch, Hostinger…)

1. **Base de données** : dans cPanel → *Bases de données MySQL*, créer une base et un utilisateur,
   et donner tous les droits à l'utilisateur sur la base.
2. **Import** : ouvrir phpMyAdmin, sélectionner la base, puis importer `database/schema.sql`
   **après avoir supprimé les deux lignes** `CREATE DATABASE …` et `USE auto_ecole;` au début du fichier
   (sur un mutualisé, la base existe déjà et porte un autre nom).
3. **Fichiers** : envoyer le contenu du dossier `auto-ecole` dans `public_html/` (ou un sous-dossier)
   par FTP ou par le gestionnaire de fichiers.
4. **Connexion** : renseigner l'hôte, le nom de la base, l'utilisateur et le mot de passe dans `config/database.php`.
5. **PHP** : choisir PHP 8.0+ (cPanel → *Sélectionner une version de PHP*), avec les extensions
   `pdo_mysql`, `fileinfo`, `mbstring`, `curl` et `zip`.
6. **Droits** : le dossier `uploads/documents` doit être accessible en écriture (755 ou 775).
7. **HTTPS** : activer le certificat SSL gratuit (Let's Encrypt / AutoSSL). Les cookies de session
   passent alors automatiquement en mode sécurisé.
8. **E-mails** : mettre dans `MAIL_EXPEDITEUR` une adresse du domaine (ex. `no-reply@votre-domaine.bj`).

### À faire absolument avant la mise en ligne

- [ ] Se connecter en admin et **changer le mot de passe** (menu en haut à droite → nom de l'utilisateur).
- [ ] Supprimer ou désactiver les comptes de démonstration (candidats et moniteurs).
- [ ] Renseigner la clé FedaPay (voir § 5), sinon le paiement Mobile Money reste simulé.
- [ ] Laisser `APP_DEBUG` à `false`.
- [ ] Vérifier que `https://votre-domaine/config/config.php` et `https://votre-domaine/uploads/documents/` renvoient bien **403**.

Les fichiers `.htaccess` fournis protègent `config/`, `includes/`, `database/` et `uploads/` sous Apache et LiteSpeed.
Avec **Nginx**, il faut ajouter l'équivalent dans la configuration du serveur :

```nginx
location ~ ^/(config|includes|database|uploads)/ { deny all; }
```

## 4. Comptes de démonstration

| Rôle | Identifiant | Mot de passe |
|---|---|---|
| Administrateur | `admin@auto-ecole.bj` (ou `0190000000`) | `Admin@2026` |
| Moniteur | `0197000001` | `Moniteur@2026` |
| Candidat (dossier en formation) | `0196000001` | `Candidat@2026` |

Tous les candidats de démonstration (`0196000001` à `0196000007`) ont le même mot de passe.
Les numéros se saisissent indifféremment `0196000001`, `01 96 00 00 01`, `+229 01 96 00 00 01` ou à l'ancien format à 8 chiffres.

## 5. Paiement

### Mobile Money (MTN MoMo, Moov Money) via FedaPay

1. Créer un compte sur <https://fedapay.com> et récupérer la **clé secrète** (menu *API*).
2. Dans `config/config.php` :
   ```php
   const FEDAPAY_CLE_SECRETE   = 'sk_sandbox_xxxxxxxx';   // puis sk_live_… en production
   const FEDAPAY_ENVIRONNEMENT = 'sandbox';               // puis 'live'
   ```
3. Tester en *sandbox* avec les numéros de test fournis par FedaPay, puis passer en `live`.

Fonctionnement : le site crée la transaction, redirige le candidat vers la page de paiement FedaPay, puis,
au retour (`candidat/paiement_retour.php`), **relit le statut et le montant chez FedaPay avec la clé secrète**
avant de confirmer. Les paramètres de l'URL de retour ne sont jamais crus sur parole.

**Tant que la clé est vide, le site est en mode démonstration** : une page de simulation clairement
signalée remplace FedaPay et aucun argent n'est débité. Cette page disparaît dès qu'une clé est renseignée.

> L'intégration FedaPay suit la documentation de l'API REST mais n'a pas pu être testée contre les serveurs
> de FedaPay (aucune clé disponible lors du développement). Faites un paiement de test en sandbox avant d'ouvrir au public.
> Si un candidat ferme son navigateur avant le retour sur le site, le paiement reste « en attente » :
> l'admin peut le confirmer à la main depuis **Paiements** après vérification dans le tableau de bord FedaPay.

Pour utiliser KKiaPay à la place, seul `includes/fedapay.php` (3 fonctions) est à réécrire.

### Espèces à l'agence

Le candidat choisit « Espèces » : un paiement *en attente* est créé avec une référence.
L'admin le confirme à l'encaissement (**Paiements** ou fiche du candidat), ou encaisse directement
un montant depuis la fiche. Chaque paiement confirmé donne un **reçu PDF**.

### Tranches

Le candidat choisit 1, 2 ou 3 tranches à l'inscription. Il peut ensuite payer le montant de son choix,
entre `PAIEMENT_MINIMUM` (5 000 FCFA) et le solde restant.

## 6. Arborescence

```
auto-ecole/
├── index.php  formations.php  faq.php  contact.php      Pages publiques
├── inscription.php                                       Inscription en 4 étapes
├── connexion.php  deconnexion.php
├── fichier.php                                           Sert une pièce après contrôle des droits
├── config/
│   ├── config.php                                        Nom, ville, couleurs, paiement, e-mails
│   └── database.php                                      Connexion MySQL
├── includes/
│   ├── init.php                                          Session sécurisée, PDO, en-têtes
│   ├── fonctions.php                                     Échappement, CSRF, validation, formatage
│   ├── auth.php                                          Connexion, rôles, anti-force brute
│   ├── metier.php                                        Dossiers, paiements, notifications, uploads
│   ├── fedapay.php                                       API FedaPay
│   ├── pdf.php  xlsx.php                                 Générateurs PDF et Excel (sans dépendance)
│   └── header.php  footer.php
├── candidat/                                             Espace candidat
│   ├── index.php                                         Suivi du dossier, pièces
│   ├── planning.php                                      Réservation des cours
│   ├── paiements.php  payer.php  recu.php                Historique, paiement, reçu PDF
│   ├── paiement_retour.php  paiement_demo.php            Retour FedaPay / simulation
│   └── profil.php
├── admin/                                                Administration (+ espace moniteur)
│   ├── index.php                                         Tableau de bord
│   ├── candidats.php  candidat.php  export.php           Liste, fiche, export Excel/PDF
│   ├── paiements.php  creneaux.php  planning.php
│   └── moniteurs.php  vehicules.php  tarifs.php  messages.php  compte.php
├── assets/                                               Bootstrap 5 (local), style.css, app.js
├── uploads/documents/                                    Pièces des candidats (accès direct interdit)
└── database/schema.sql                                   Schéma + données de démonstration
```

## 7. Rôles

- **Candidat** : son dossier, ses pièces, son planning, ses paiements. Rien d'autre.
- **Moniteur** : *Mon planning* — ses créneaux, les candidats inscrits, le pointage des présences.
- **Admin** : tout, y compris le planning de tous les moniteurs.

## 8. Sécurité

- Mots de passe : `password_hash` / `password_verify`, re-hachage automatique.
- Requêtes préparées PDO partout (émulation désactivée).
- Jeton **CSRF** vérifié sur tous les formulaires POST.
- Validation côté serveur de tous les champs ; le JavaScript n'est qu'un confort.
- Fichiers envoyés : type MIME réel (`finfo`), taille (2 Mo), contenu des images, nom aléatoire,
  extension imposée, dossier interdit d'accès direct et d'exécution, lecture via `fichier.php` avec contrôle du propriétaire.
- Sessions : cookie `HttpOnly`, `SameSite=Lax`, `Secure` en HTTPS, identifiant régénéré à la connexion, expiration après 2 h d'inactivité.
- Connexion : 5 échecs en 15 minutes bloquent l'identifiant (réglable dans `config.php`).
- Sortie HTML systématiquement échappée ; en-têtes `X-Frame-Options`, `X-Content-Type-Options`.

## 9. Limites connues

- Le mot de passe oublié passe par l'agence (réinitialisation par l'admin depuis la fiche du candidat) : il n'y a pas d'envoi automatique de lien.
- Pas de webhook FedaPay : la confirmation se fait au retour du candidat sur le site (voir § 5).
- La FAQ et les témoignages n'ont pas d'écran d'administration.
- Un visiteur qui abandonne l'inscription après l'étape 3 laisse ses fichiers dans `uploads/documents` ; ils peuvent être purgés à la main.
