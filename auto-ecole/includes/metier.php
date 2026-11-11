<?php
/**
 * Règles métier : statuts, dossiers, paiements, notifications, fichiers.
 */
declare(strict_types=1);

// ---------- Libellés ----------
const STATUTS_DOSSIER = [
    'en_attente'   => ['En attente',   'warning'],
    'valide'       => ['Validé',       'info'],
    'en_formation' => ['En formation', 'primary'],
    'examen'       => ['Examen',       'secondary'],
    'admis'        => ['Admis',        'success'],
    'ajourne'      => ['Ajourné',      'danger'],
    'rejete'       => ['Rejeté',       'dark'],
];
/** Étapes affichées dans le suivi du dossier côté candidat. */
const ETAPES_DOSSIER = ['en_attente', 'valide', 'en_formation', 'examen', 'admis'];

const FORMULES = [
    'code'     => 'Code seul',
    'conduite' => 'Conduite seule',
    'complet'  => 'Formule complète (code + conduite)',
];
const TYPES_DOCUMENT = [
    'piece_identite'     => 'Pièce d\'identité',
    'photo'              => 'Photo d\'identité',
    'certificat_medical' => 'Certificat médical',
];
const STATUTS_DOCUMENT = [
    'en_attente' => ['En cours de vérification', 'warning'],
    'valide'     => ['Validé',                   'success'],
    'rejete'     => ['Refusé',                   'danger'],
];
const STATUTS_PAIEMENT = [
    'en_attente' => ['En attente', 'warning'],
    'confirme'   => ['Confirmé',   'success'],
    'echoue'     => ['Échoué',     'danger'],
    'annule'     => ['Annulé',     'secondary'],
];
const MODES_PAIEMENT = ['mobile_money' => 'Mobile Money', 'especes' => 'Espèces à l\'agence'];
const OPERATEURS     = ['mtn' => 'MTN MoMo', 'moov' => 'Moov Money'];

function badge(array $table, string $cle): string
{
    [$libelle, $couleur] = $table[$cle] ?? [$cle, 'secondary'];
    return '<span class="badge text-bg-' . $couleur . '">' . e($libelle) . '</span>';
}

// ---------- Catégories ----------
function categories(bool $actives = true): array
{
    return q('SELECT * FROM categories ' . ($actives ? 'WHERE actif = 1 ' : '') . 'ORDER BY ordre, code')->fetchAll();
}

function prix_formule(array $categorie, string $formule): int
{
    return (int) ($categorie['prix_' . $formule] ?? 0);
}

// ---------- Dossiers ----------
/** Dossier (le plus récent) d'un utilisateur, avec la catégorie. */
function inscription_de(int $utilisateurId): ?array
{
    $i = q('SELECT i.*, c.code AS categorie_code, c.libelle AS categorie_libelle
            FROM inscriptions i JOIN categories c ON c.id = i.categorie_id
            WHERE i.utilisateur_id = ? ORDER BY i.id DESC LIMIT 1', [$utilisateurId])->fetch();
    return $i ?: null;
}

/** Dossier par identifiant, avec le candidat et la catégorie. */
function inscription(int $id): ?array
{
    $i = q('SELECT i.*, c.code AS categorie_code, c.libelle AS categorie_libelle,
                   u.nom, u.prenoms, u.telephone, u.email, u.actif AS compte_actif
            FROM inscriptions i
            JOIN categories c ON c.id = i.categorie_id
            JOIN utilisateurs u ON u.id = i.utilisateur_id
            WHERE i.id = ?', [$id])->fetch();
    return $i ?: null;
}

/** Sommes payées / en attente / restantes pour un dossier. */
function situation_paiement(array $inscription): array
{
    $r = q("SELECT COALESCE(SUM(CASE WHEN statut = 'confirme' THEN montant END), 0) AS paye,
                   COALESCE(SUM(CASE WHEN statut = 'en_attente' AND mode = 'especes' THEN montant END), 0) AS attente
            FROM paiements WHERE inscription_id = ?", [$inscription['id']])->fetch();
    $total = (int) $inscription['montant_total'];
    $paye  = (int) $r['paye'];
    $att   = (int) $r['attente'];
    $reste = max(0, $total - $paye);
    $tranche = (int) ceil($total / max(1, (int) $inscription['nb_tranches']));
    $payable = max(0, $reste - $att);                 // ce qui peut encore faire l'objet d'un nouveau paiement
    return [
        'total'    => $total,
        'paye'     => $paye,
        'attente'  => $att,
        'reste'    => $reste,
        'payable'  => $payable,
        'suggere'  => min($tranche, $payable),
        'minimum'  => min(PAIEMENT_MINIMUM, $payable),
        'pourcent' => $total > 0 ? (int) round($paye * 100 / $total) : 0,
    ];
}

/** Le candidat peut-il réserver des créneaux de ce type ? */
function peut_reserver(array $inscription, string $type): bool
{
    return in_array($inscription['statut'], ['valide', 'en_formation', 'examen'], true)
        && in_array($inscription['formule'], [$type, 'complet'], true);
}

// ---------- Notifications ----------
/**
 * Enregistre une notification pour l'utilisateur et l'envoie par e-mail s'il en a un.
 * Le journal (table notifications) reste consultable même si l'e-mail n'a pas pu partir
 * (cas fréquent sous XAMPP, qui n'a pas de serveur d'envoi configuré).
 */
function notifier(int $utilisateurId, string $sujet, string $message): void
{
    $u = q('SELECT prenoms, email FROM utilisateurs WHERE id = ?', [$utilisateurId])->fetch();
    if (!$u) {
        return;
    }
    $envoye = 0;
    if ($u['email']) {
        $corps = "Bonjour {$u['prenoms']},\n\n$message\n\nVotre espace candidat : " . url_absolue('connexion.php')
               . "\n\n" . APP_NOM . ' — ' . APP_ADRESSE . "\nTél. " . APP_TELEPHONE;
        $envoye = envoyer_email($u['email'], $sujet, $corps) ? 1 : 0;
    }
    q('INSERT INTO notifications (utilisateur_id, sujet, message, email_envoye) VALUES (?, ?, ?, ?)',
      [$utilisateurId, $sujet, $message, $envoye]);
}

function envoyer_email(string $destinataire, string $sujet, string $corps, ?string $repondreA = null): bool
{
    if (!MAIL_ACTIF || !email_valide($destinataire)) {
        return false;
    }
    $nettoyer = static fn(string $s): string => str_replace(["\r", "\n"], ' ', $s);   // anti-injection d'en-têtes
    $entetes = [
        'From: ' . mb_encode_mimeheader(APP_NOM, 'UTF-8') . ' <' . MAIL_EXPEDITEUR . '>',
        'Reply-To: ' . $nettoyer($repondreA ?: APP_EMAIL),
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=UTF-8',
        'Content-Transfer-Encoding: 8bit',
    ];
    return @mail($destinataire, mb_encode_mimeheader($nettoyer($sujet), 'UTF-8'), $corps, implode("\r\n", $entetes));
}

// ---------- Paiements ----------
function nouvelle_reference(): string
{
    return 'PAY-' . date('ymd') . '-' . strtoupper(bin2hex(random_bytes(3)));
}

/**
 * Crée un paiement en attente et renvoie l'URL vers laquelle rediriger le candidat :
 *  - espèces       → page des paiements (à régler à l'agence, confirmé par l'admin) ;
 *  - Mobile Money  → page de paiement FedaPay, ou simulation si aucune clé n'est configurée.
 * Lève RuntimeException avec un message lisible en cas de problème.
 */
function initier_paiement(array $inscription, int $montant, string $mode, ?string $operateur): string
{
    $s = situation_paiement($inscription);
    if ($s['payable'] <= 0) {
        throw new RuntimeException('Il ne reste rien à payer sur ce dossier.');
    }
    if ($montant < $s['minimum'] || $montant > $s['payable']) {
        throw new RuntimeException('Le montant doit être compris entre ' . fcfa($s['minimum']) . ' et ' . fcfa($s['payable']) . '.');
    }
    if (!isset(MODES_PAIEMENT[$mode])) {
        throw new RuntimeException('Choisissez un moyen de paiement.');
    }
    if ($mode === 'mobile_money' && !isset(OPERATEURS[$operateur])) {
        throw new RuntimeException('Choisissez votre opérateur Mobile Money.');
    }

    // Un seul paiement Mobile Money en cours à la fois : on annule les tentatives abandonnées
    q("UPDATE paiements SET statut = 'annule' WHERE inscription_id = ? AND mode = 'mobile_money' AND statut = 'en_attente'",
      [$inscription['id']]);

    $reference = nouvelle_reference();
    q('INSERT INTO paiements (inscription_id, reference, montant, mode, operateur) VALUES (?, ?, ?, ?, ?)',
      [$inscription['id'], $reference, $montant, $mode, $mode === 'mobile_money' ? $operateur : null]);
    $paiementId = (int) db()->lastInsertId();

    if ($mode === 'especes') {
        flash('info', 'Paiement en espèces enregistré. Présentez-vous à l\'agence avec la référence ' . $reference
            . ' pour régler ' . fcfa($montant) . '. Il sera confirmé par notre équipe.');
        return url('candidat/paiements.php');
    }

    require_once RACINE . '/includes/fedapay.php';
    if (!fedapay_actif()) {
        return url('candidat/paiement_demo.php?ref=' . urlencode($reference));
    }
    try {
        $u = q('SELECT nom, prenoms, telephone, email FROM utilisateurs WHERE id = ?', [$inscription['utilisateur_id']])->fetch();
        $t = fedapay_creer_transaction(
            $montant,
            'Formation permis ' . $inscription['categorie_code'] . ' — dossier ' . $inscription['numero_dossier'],
            url_absolue('candidat/paiement_retour.php?ref=' . urlencode($reference)),
            $u
        );
        q('UPDATE paiements SET transaction_id = ? WHERE id = ?', [$t['id'], $paiementId]);
        return $t['url'];
    } catch (Throwable $ex) {
        error_log('FedaPay : ' . $ex->getMessage());
        q("UPDATE paiements SET statut = 'echoue' WHERE id = ?", [$paiementId]);
        throw new RuntimeException('Le service de paiement Mobile Money est momentanément indisponible. Réessayez ou choisissez le paiement à l\'agence.');
    }
}

/** Passe un paiement en « confirmé » (une seule fois) et prévient le candidat. */
function confirmer_paiement(int $paiementId, ?int $adminId = null): bool
{
    $ok = q("UPDATE paiements SET statut = 'confirme', date_paiement = NOW(), confirme_par = ?
             WHERE id = ? AND statut IN ('en_attente', 'echoue')", [$adminId, $paiementId])->rowCount() === 1;
    if ($ok) {
        $p = q('SELECT p.*, i.utilisateur_id, i.numero_dossier FROM paiements p JOIN inscriptions i ON i.id = p.inscription_id WHERE p.id = ?',
               [$paiementId])->fetch();
        notifier((int) $p['utilisateur_id'], 'Paiement confirmé — ' . fcfa($p['montant']),
            'Nous avons bien reçu votre paiement de ' . fcfa($p['montant']) . ' (référence ' . $p['reference']
            . ', dossier ' . $p['numero_dossier'] . "). Votre reçu est téléchargeable dans votre espace candidat, rubrique Paiements.");
    }
    return $ok;
}

// ---------- Fichiers envoyés ----------
function dossier_uploads(): string
{
    return RACINE . '/uploads/documents';
}

/**
 * Contrôle et enregistre un fichier envoyé ($_FILES['x']).
 * Vérifie l'erreur d'envoi, la taille, le type MIME RÉEL (finfo) et, pour les images, leur contenu.
 * Renvoie ['fichier', 'nom_original', 'mime', 'taille'] ou lève RuntimeException.
 */
function enregistrer_upload(array $f, string $libelle): array
{
    $err = $f['error'] ?? UPLOAD_ERR_NO_FILE;
    if ($err === UPLOAD_ERR_NO_FILE) {
        throw new RuntimeException("$libelle : aucun fichier sélectionné.");
    }
    $max = round(UPLOAD_TAILLE_MAX / 1048576, 1) . ' Mo';
    if ($err === UPLOAD_ERR_INI_SIZE || $err === UPLOAD_ERR_FORM_SIZE || ($f['size'] ?? 0) > UPLOAD_TAILLE_MAX) {
        throw new RuntimeException("$libelle : fichier trop lourd (maximum $max).");
    }
    if ($err !== UPLOAD_ERR_OK || !is_uploaded_file($f['tmp_name'])) {
        throw new RuntimeException("$libelle : l'envoi a échoué, réessayez.");
    }
    if ($f['size'] <= 0) {
        throw new RuntimeException("$libelle : le fichier est vide.");
    }
    $mime = (new finfo(FILEINFO_MIME_TYPE))->file($f['tmp_name']) ?: '';
    if (!isset(UPLOAD_TYPES[$mime])) {
        throw new RuntimeException("$libelle : format non accepté. Envoyez une photo (JPG, PNG) ou un PDF.");
    }
    if (str_starts_with($mime, 'image/') && @getimagesize($f['tmp_name']) === false) {
        throw new RuntimeException("$libelle : l'image est illisible.");
    }
    if (!is_dir(dossier_uploads()) && !mkdir(dossier_uploads(), 0755, true)) {
        throw new RuntimeException('Le dossier d\'envoi n\'est pas accessible en écriture.');
    }
    $nom = bin2hex(random_bytes(16)) . '.' . UPLOAD_TYPES[$mime];     // nom imprévisible, extension imposée
    if (!move_uploaded_file($f['tmp_name'], dossier_uploads() . '/' . $nom)) {
        throw new RuntimeException("$libelle : impossible d'enregistrer le fichier (droits d'écriture du dossier uploads).");
    }
    return [
        'fichier'      => $nom,
        'nom_original' => mb_substr(basename((string) $f['name']), 0, 255),
        'mime'         => $mime,
        'taille'       => (int) $f['size'],
    ];
}

function supprimer_upload(string $fichier): void
{
    if (preg_match('/^[a-f0-9]{32}\.(jpg|png|pdf)$/', $fichier)) {
        @unlink(dossier_uploads() . '/' . $fichier);
    }
}
