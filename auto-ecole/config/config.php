<?php
/**
 * Configuration générale du site.
 * Tout ce qui est propre à VOTRE auto-école se règle ici.
 */

// ---------- Identité de l'auto-école ----------
const APP_NOM        = 'Auto-École Excellence';          // [NOM]
const APP_VILLE      = 'Cotonou';                        // [VILLE]
const APP_PAYS       = 'Bénin';
const APP_SLOGAN     = 'Votre permis de conduire, en toute confiance';
const APP_ADRESSE    = 'Carrefour Sainte-Rita, Cotonou';
const APP_TELEPHONE  = '01 90 00 00 00';                 // affichage
const APP_WHATSAPP   = '2290190000000';                  // format international, sans + ni espaces
const APP_EMAIL      = 'contact@auto-ecole.bj';
const APP_LATITUDE   = 6.3703;                           // position sur la carte
const APP_LONGITUDE  = 2.3912;
const APP_HORAIRES   = [
    'Lundi – Vendredi' => '07h30 – 19h00',
    'Samedi'           => '08h00 – 16h00',
    'Dimanche'         => 'Fermé',
];

// ---------- Couleurs [COULEURS] ----------
const COULEUR_PRINCIPALE = '#0b3a6f';   // bleu nuit : sérieux, rassurant
const COULEUR_SECONDAIRE = '#0e7c4a';   // vert : validation, réussite
const COULEUR_ACCENT     = '#ffb703';   // jaune : boutons d'action

// ---------- URL de base ----------
// Laisser vide pour une détection automatique (fonctionne dans un sous-dossier XAMPP).
// Sinon, par exemple : '/auto-ecole' ou '' pour la racine du domaine → mettre '/'.
const APP_URL_BASE = '';

// ---------- Paiement Mobile Money (FedaPay) ----------
// Tant que la clé secrète est vide, le site fonctionne en MODE DÉMONSTRATION :
// une page de simulation remplace FedaPay (aucun argent réel n'est débité).
const FEDAPAY_CLE_SECRETE   = '';          // sk_sandbox_... ou sk_live_...
const FEDAPAY_ENVIRONNEMENT = 'sandbox';   // 'sandbox' (tests) ou 'live' (production)
const PAIEMENT_MINIMUM      = 5000;        // montant minimal d'une tranche (FCFA)

// ---------- E-mails ----------
const MAIL_ACTIF      = true;                        // false = ne rien envoyer (journal uniquement)
const MAIL_EXPEDITEUR = 'no-reply@auto-ecole.bj';    // adresse du domaine de l'hébergement

// ---------- Fichiers envoyés ----------
const UPLOAD_TAILLE_MAX = 2 * 1024 * 1024;           // 2 Mo par fichier
const UPLOAD_TYPES      = [                          // type MIME réel => extension
    'image/jpeg'      => 'jpg',
    'image/png'       => 'png',
    'application/pdf' => 'pdf',
];

// ---------- Sécurité ----------
const CONNEXION_MAX_TENTATIVES = 5;    // tentatives échouées autorisées…
const CONNEXION_FENETRE_MIN    = 15;   // …sur cette durée (minutes)

// ---------- Environnement ----------
const APP_DEBUG = false;               // true = afficher les erreurs PHP (développement uniquement)

date_default_timezone_set('Africa/Porto-Novo');
