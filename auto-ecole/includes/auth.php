<?php
/**
 * Authentification et contrôle des rôles (candidat, moniteur, admin).
 */
declare(strict_types=1);

/** Utilisateur connecté (ou null). Relu en base à chaque requête : un compte désactivé est déconnecté. */
function utilisateur(): ?array
{
    static $cache = false;
    if ($cache === false) {
        $cache = null;
        if (!empty($_SESSION['utilisateur_id'])) {
            $u = q('SELECT id, role, nom, prenoms, telephone, email FROM utilisateurs WHERE id = ? AND actif = 1',
                   [$_SESSION['utilisateur_id']])->fetch();
            if ($u) {
                $cache = $u;
            } else {
                unset($_SESSION['utilisateur_id']);
            }
        }
    }
    return $cache;
}

function est_connecte(): bool
{
    return utilisateur() !== null;
}

/** Page d'accueil de l'espace correspondant au rôle. */
function accueil_role(string $role): string
{
    return match ($role) {
        'admin'    => 'admin/index.php',
        'moniteur' => 'admin/planning.php',
        default    => 'candidat/index.php',
    };
}

/** Bloque la page si l'utilisateur n'a pas l'un des rôles demandés. */
function exiger_role(string ...$roles): array
{
    $u = utilisateur();
    if (!$u) {
        $_SESSION['apres_connexion'] = $_SERVER['REQUEST_URI'] ?? '';
        flash('warning', 'Connectez-vous pour accéder à cette page.');
        rediriger('connexion.php');
    }
    if (!in_array($u['role'], $roles, true)) {
        http_response_code(403);
        exit('<h1>Accès refusé</h1><p>Vous n\'avez pas les droits nécessaires. <a href="' . e(url(accueil_role($u['role']))) . '">Retour à mon espace</a></p>');
    }
    return $u;
}

function connecter(int $utilisateurId): void
{
    session_regenerate_id(true);                 // contre la fixation de session
    $_SESSION['utilisateur_id'] = $utilisateurId;
    $_SESSION['csrf'] = bin2hex(random_bytes(32));
    q('UPDATE utilisateurs SET derniere_connexion = NOW() WHERE id = ?', [$utilisateurId]);
}

function deconnecter(): void
{
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $p = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $p['path'], $p['domain'], $p['secure'], $p['httponly']);
    }
    session_destroy();
}

function adresse_ip(): string
{
    return substr($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0', 0, 45);
}

/** Trop de tentatives échouées récemment pour cet identifiant ou cette adresse IP ? */
function connexion_bloquee(string $identifiant): bool
{
    $depuis = date('Y-m-d H:i:s', time() - CONNEXION_FENETRE_MIN * 60);
    $n = (int) q('SELECT COUNT(*) FROM tentatives_connexion WHERE identifiant = ? AND created_at > ?',
                 [$identifiant, $depuis])->fetchColumn();
    $nIp = (int) q('SELECT COUNT(*) FROM tentatives_connexion WHERE ip = ? AND created_at > ?',
                   [adresse_ip(), $depuis])->fetchColumn();
    return $n >= CONNEXION_MAX_TENTATIVES || $nIp >= CONNEXION_MAX_TENTATIVES * 4;
}

/**
 * Tente une connexion par téléphone ou e-mail.
 * Renvoie l'utilisateur en cas de succès, sinon un message d'erreur (string).
 */
function tenter_connexion(string $identifiant, string $motDePasse): array|string
{
    $identifiant = trim($identifiant);
    if (str_contains($identifiant, '@')) {
        $cle = mb_strtolower($identifiant);
        $colonne = 'email';
    } else {
        $cle = normaliser_telephone($identifiant) ?? '';
        $colonne = 'telephone';
    }
    if ($cle === '' || $motDePasse === '') {
        return 'Saisissez votre téléphone (ou e-mail) et votre mot de passe.';
    }
    if (connexion_bloquee($cle)) {
        return 'Trop de tentatives. Réessayez dans ' . CONNEXION_FENETRE_MIN . ' minutes.';
    }

    $u = q("SELECT * FROM utilisateurs WHERE $colonne = ? LIMIT 1", [$cle])->fetch();
    // password_verify est toujours exécuté pour ne pas révéler si le compte existe
    $hash = $u['mot_de_passe'] ?? '$2y$10$GWzHsfTcK5UmPZ4xDCt7rOvv0amreAi9fP65fVBDooskPvsi0sP6S';
    $ok = password_verify($motDePasse, $hash);

    if (!$u || !$ok || !$u['actif']) {
        q('INSERT INTO tentatives_connexion (identifiant, ip) VALUES (?, ?)', [mb_substr($cle, 0, 150), adresse_ip()]);
        return 'Identifiant ou mot de passe incorrect.';
    }

    if (password_needs_rehash($u['mot_de_passe'], PASSWORD_DEFAULT)) {
        q('UPDATE utilisateurs SET mot_de_passe = ? WHERE id = ?', [password_hash($motDePasse, PASSWORD_DEFAULT), $u['id']]);
    }
    q('DELETE FROM tentatives_connexion WHERE identifiant = ? OR created_at < ?',
      [$cle, date('Y-m-d H:i:s', time() - 86400)]);
    connecter((int) $u['id']);
    return $u;
}
