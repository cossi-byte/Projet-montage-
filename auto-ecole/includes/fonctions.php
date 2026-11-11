<?php
/**
 * Fonctions utilitaires : affichage, URL, messages flash, CSRF, validation.
 */
declare(strict_types=1);

/** Échappe une valeur pour l'affichage HTML. */
function e(mixed $v): string
{
    return htmlspecialchars((string) ($v ?? ''), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

/** URL interne à partir de la racine du site. */
function url(string $chemin = ''): string
{
    return BASE_URL . '/' . ltrim($chemin, '/');
}

/** URL absolue (pour les e-mails et les retours de paiement). */
function url_absolue(string $chemin = ''): string
{
    $hote = $_SERVER['HTTP_HOST'] ?? 'localhost';
    return (EST_HTTPS ? 'https://' : 'http://') . $hote . url($chemin);
}

function rediriger(string $chemin): never
{
    header('Location: ' . (preg_match('#^https?://#', $chemin) ? $chemin : url($chemin)));
    exit;
}

function est_post(): bool
{
    return ($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST';
}

/** Lit un champ POST en texte nettoyé. */
function champ(string $nom, string $defaut = ''): string
{
    $v = $_POST[$nom] ?? $defaut;
    return is_string($v) ? trim($v) : $defaut;
}

// ---------- Messages flash ----------
function flash(string $type, string $message): void
{
    $_SESSION['flash'][] = ['type' => $type, 'message' => $message];
}

function afficher_flash(): string
{
    $html = '';
    foreach ($_SESSION['flash'] ?? [] as $f) {
        $html .= '<div class="alert alert-' . e($f['type']) . ' alert-dismissible fade show" role="alert">'
               . e($f['message'])
               . '<button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Fermer"></button></div>';
    }
    unset($_SESSION['flash']);
    return $html;
}

/** Affiche une liste d'erreurs de formulaire. */
function afficher_erreurs(array $erreurs): string
{
    if (!$erreurs) {
        return '';
    }
    $html = '<div class="alert alert-danger" role="alert"><strong>Merci de corriger :</strong><ul class="mb-0 ps-3">';
    foreach ($erreurs as $err) {
        $html .= '<li>' . e($err) . '</li>';
    }
    return $html . '</ul></div>';
}

// ---------- Protection CSRF ----------
function csrf_jeton(): string
{
    if (empty($_SESSION['csrf'])) {
        $_SESSION['csrf'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf'];
}

function csrf_champ(): string
{
    return '<input type="hidden" name="_csrf" value="' . e(csrf_jeton()) . '">';
}

/** À appeler au début de tout traitement POST. */
function csrf_verifier(): void
{
    // Envoi plus gros que post_max_size : PHP vide $_POST, on l'explique clairement
    if (empty($_POST) && (int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > 0) {
        http_response_code(413);
        exit('<h1>Fichiers trop lourds</h1><p>L\'envoi dépasse la taille autorisée. <a href="javascript:history.back()">Revenez en arrière</a> et choisissez des fichiers plus légers (photos de ' . (int) (UPLOAD_TAILLE_MAX / 1048576) . ' Mo maximum).</p>');
    }
    $recu = $_POST['_csrf'] ?? '';
    if (!is_string($recu) || empty($_SESSION['csrf']) || !hash_equals($_SESSION['csrf'], $recu)) {
        http_response_code(419);
        exit('<h1>Session expirée</h1><p>Le formulaire a expiré. <a href="javascript:history.back()">Revenez en arrière</a>, rechargez la page et réessayez.</p>');
    }
}

// ---------- Formatage ----------
function fcfa(int|float|string|null $montant): string
{
    return number_format((float) $montant, 0, ',', ' ') . ' FCFA';
}

function date_fr(?string $date, bool $heure = false): string
{
    if (!$date) {
        return '—';
    }
    $t = strtotime($date);
    return $t ? date($heure ? 'd/m/Y à H\hi' : 'd/m/Y', $t) : '—';
}

function jour_fr(string $date): string
{
    $jours = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
    $mois  = ['', 'janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
    $t = strtotime($date);
    return ucfirst($jours[(int) date('w', $t)]) . ' ' . date('j', $t) . ' ' . $mois[(int) date('n', $t)];
}

function heure_fr(string $heure): string
{
    return substr($heure, 0, 2) . 'h' . substr($heure, 3, 2);
}

// ---------- Validation ----------
/**
 * Normalise un numéro béninois vers 10 chiffres (01XXXXXXXX).
 * Accepte +229, 00229, espaces, points, tirets, et l'ancien format à 8 chiffres.
 * Renvoie null si le numéro est invalide.
 */
function normaliser_telephone(string $tel): ?string
{
    $n = preg_replace('/\D+/', '', $tel);
    if (str_starts_with($n, '00229')) {
        $n = substr($n, 5);
    } elseif (strlen($n) > 10 && str_starts_with($n, '229')) {
        $n = substr($n, 3);
    }
    if (strlen($n) === 8) {
        $n = '01' . $n;
    }
    return preg_match('/^01\d{8}$/', $n) ? $n : null;
}

function telephone_affiche(string $tel): string
{
    return trim(chunk_split($tel, 2, ' '));
}

function email_valide(string $email): bool
{
    return strlen($email) <= 150 && filter_var($email, FILTER_VALIDATE_EMAIL) !== false;
}

/** Date AAAA-MM-JJ valide ? */
function date_valide(string $date): bool
{
    $d = DateTime::createFromFormat('Y-m-d', $date);
    return $d !== false && $d->format('Y-m-d') === $date;
}

function age(string $dateNaissance): int
{
    return (new DateTime($dateNaissance))->diff(new DateTime('today'))->y;
}

/** Règles de mot de passe : 8 caractères minimum, avec au moins une lettre et un chiffre. */
function erreur_mot_de_passe(string $mdp): ?string
{
    if (strlen($mdp) < 8) {
        return 'Le mot de passe doit contenir au moins 8 caractères.';
    }
    if (!preg_match('/[A-Za-z]/', $mdp) || !preg_match('/\d/', $mdp)) {
        return 'Le mot de passe doit contenir au moins une lettre et un chiffre.';
    }
    return null;
}

/** Lien WhatsApp avec message pré-rempli. $tel : numéro local (01XXXXXXXX) ou international. */
function lien_whatsapp(string $tel, string $message = ''): string
{
    $n = preg_replace('/\D+/', '', $tel);
    if (strlen($n) === 10 && str_starts_with($n, '01')) {
        $n = '229' . $n;
    }
    return 'https://wa.me/' . $n . ($message !== '' ? '?text=' . rawurlencode($message) : '');
}

/** Petites icônes SVG intégrées (aucune police d'icônes à télécharger). */
function icone(string $nom, int $taille = 20): string
{
    static $chemins = [
        'check'    => '<path d="M20 6 9 17l-5-5"/>',
        'x'        => '<path d="M18 6 6 18M6 6l12 12"/>',
        'tel'      => '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
        'mail'     => '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>',
        'lieu'     => '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>',
        'horloge'  => '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
        'user'     => '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
        'fichier'  => '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
        'carte'    => '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
        'agenda'   => '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
        'voiture'  => '<path d="M5 17H3v-5l2-5h14l2 5v5h-2"/><circle cx="7.5" cy="17" r="2"/><circle cx="16.5" cy="17" r="2"/><path d="M9.5 17h5M3 12h18"/>',
        'bouclier' => '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
        'telecharger' => '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
        'fleche'   => '<path d="M5 12h14M12 5l7 7-7 7"/>',
        'whatsapp' => '<path d="M21 11.5a8.4 8.4 0 0 1-12.3 7.4L3 21l2.1-5.7A8.4 8.4 0 1 1 21 11.5z"/>',
    ];
    return '<svg class="icone" width="' . $taille . '" height="' . $taille . '" viewBox="0 0 24 24" fill="none" '
         . 'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
         . ($chemins[$nom] ?? '') . '</svg>';
}
