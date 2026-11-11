<?php
/**
 * Point d'entrée commun : chargé au début de chaque page.
 * Configuration, session sécurisée, connexion PDO, fonctions.
 */
declare(strict_types=1);

define('RACINE', dirname(__DIR__));

require RACINE . '/config/config.php';

// ---------- Erreurs ----------
error_reporting(E_ALL);
ini_set('display_errors', APP_DEBUG ? '1' : '0');
ini_set('log_errors', '1');

// ---------- URL de base (détection automatique du sous-dossier) ----------
(function (): void {
    $base = APP_URL_BASE;
    if ($base === '') {
        $script  = str_replace('\\', '/', (string) realpath($_SERVER['SCRIPT_FILENAME'] ?? ''));
        $racine  = str_replace('\\', '/', (string) realpath(RACINE));
        $relatif = str_starts_with($script, $racine) ? substr($script, strlen($racine)) : '';
        $nom     = str_replace('\\', '/', $_SERVER['SCRIPT_NAME'] ?? '');
        if ($relatif !== '' && str_ends_with($nom, $relatif)) {
            $base = substr($nom, 0, -strlen($relatif));
        }
    }
    define('BASE_URL', rtrim($base, '/'));
})();

// ---------- Session sécurisée ----------
$https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
      || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
define('EST_HTTPS', $https);

if (PHP_SAPI !== 'cli' && session_status() === PHP_SESSION_NONE) {
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    session_name('AESESSID');
    session_set_cookie_params([
        'lifetime' => 0,
        'path'     => BASE_URL . '/',
        'secure'   => EST_HTTPS,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();

    // Expiration après 2 h d'inactivité
    if (isset($_SESSION['derniere_activite']) && time() - $_SESSION['derniere_activite'] > 7200) {
        $_SESSION = [];
        session_regenerate_id(true);
    }
    $_SESSION['derniere_activite'] = time();
}

// ---------- En-têtes de sécurité ----------
if (PHP_SAPI !== 'cli' && !headers_sent()) {
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: SAMEORIGIN');
    header('Referrer-Policy: strict-origin-when-cross-origin');
}

// ---------- Base de données ----------
function db(): PDO
{
    static $pdo = null;
    if ($pdo === null) {
        $c = require RACINE . '/config/database.php';
        try {
            $pdo = new PDO(
                "mysql:host={$c['hote']};port={$c['port']};dbname={$c['base']};charset=utf8mb4",
                $c['utilisateur'],
                $c['mot_de_passe'],
                [
                    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_EMULATE_PREPARES   => false,
                ]
            );
            // Même fuseau horaire que PHP : NOW() et CURDATE() donnent l'heure du Bénin
            $pdo->exec("SET time_zone = '" . date('P') . "'");
        } catch (PDOException $e) {
            error_log('Connexion BD impossible : ' . $e->getMessage());
            http_response_code(503);
            exit('<h1>Site momentanément indisponible</h1><p>La connexion à la base de données a échoué. '
               . 'Vérifiez <code>config/database.php</code> et que le script <code>database/schema.sql</code> a bien été importé.</p>');
        }
    }
    return $pdo;
}

/** Exécute une requête préparée et renvoie le PDOStatement. */
function q(string $sql, array $params = []): PDOStatement
{
    $stmt = db()->prepare($sql);
    $stmt->execute($params);
    return $stmt;
}

require RACINE . '/includes/fonctions.php';
require RACINE . '/includes/auth.php';
require RACINE . '/includes/metier.php';
