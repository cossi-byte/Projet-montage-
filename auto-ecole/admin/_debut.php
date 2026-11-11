<?php
/**
 * Début commun de l'administration : contrôle d'accès et mise en page.
 * Chaque page définit $rolesAutorises avant l'inclusion (par défaut : admin seul).
 */
require dirname(__DIR__) . '/includes/init.php';

$u = exiger_role(...($rolesAutorises ?? ['admin']));

function admin_entete(string $titre, string $actif = ''): void
{
    $u = utilisateur();
    $menu = $u['role'] === 'admin'
        ? [
            'tableau'   => ['admin/index.php', 'Tableau de bord'],
            'candidats' => ['admin/candidats.php', 'Candidats'],
            'paiements' => ['admin/paiements.php', 'Paiements'],
            'creneaux'  => ['admin/creneaux.php', 'Créneaux'],
            'planning'  => ['admin/planning.php', 'Présences'],
            'moniteurs' => ['admin/moniteurs.php', 'Moniteurs'],
            'vehicules' => ['admin/vehicules.php', 'Véhicules'],
            'tarifs'    => ['admin/tarifs.php', 'Tarifs'],
            'messages'  => ['admin/messages.php', 'Messages'],
        ]
        : ['planning' => ['admin/planning.php', 'Mon planning']];
    $nonLus = $u['role'] === 'admin' ? (int) q('SELECT COUNT(*) FROM messages_contact WHERE lu = 0')->fetchColumn() : 0;
    ?>
<!doctype html>
<html lang="fr">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex, nofollow">
    <title><?= e($titre) ?> — Administration <?= e(APP_NOM) ?></title>
    <link rel="icon" href="<?= e(url('assets/favicon.svg')) ?>" type="image/svg+xml">
    <link rel="stylesheet" href="<?= e(url('assets/css/bootstrap.min.css')) ?>">
    <style>:root{--ae-principale:<?= e(COULEUR_PRINCIPALE) ?>;--ae-secondaire:<?= e(COULEUR_SECONDAIRE) ?>;--ae-accent:<?= e(COULEUR_ACCENT) ?>}</style>
    <link rel="stylesheet" href="<?= e(url('assets/css/style.css')) ?>">
</head>
<body>
<nav class="navbar navbar-expand-xxl navbar-dark ae-navbar ae-admin sticky-top">
    <div class="container-fluid">
        <a class="navbar-brand fw-bold" href="<?= e(url(accueil_role($u['role']))) ?>"><?= e(APP_NOM) ?> <span class="badge text-bg-warning ms-1"><?= $u['role'] === 'admin' ? 'Admin' : 'Moniteur' ?></span></a>
        <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#menu-admin" aria-controls="menu-admin" aria-expanded="false" aria-label="Ouvrir le menu">
            <span class="navbar-toggler-icon"></span>
        </button>
        <div class="collapse navbar-collapse" id="menu-admin">
            <ul class="navbar-nav me-auto">
                <?php foreach ($menu as $cle => [$href, $libelle]): ?>
                    <li class="nav-item">
                        <a class="nav-link<?= $cle === $actif ? ' active' : '' ?>" href="<?= e(url($href)) ?>"><?= e($libelle) ?>
                            <?php if ($cle === 'messages' && $nonLus): ?><span class="badge text-bg-danger"><?= $nonLus ?></span><?php endif; ?></a>
                    </li>
                <?php endforeach; ?>
            </ul>
            <ul class="navbar-nav">
                <li class="nav-item"><a class="nav-link" href="<?= e(url('index.php')) ?>">Voir le site</a></li>
                <li class="nav-item"><a class="nav-link" href="<?= e(url('admin/compte.php')) ?>"><?= icone('user', 16) ?> <?= e($u['prenoms']) ?></a></li>
                <li class="nav-item"><a class="nav-link" href="<?= e(url('deconnexion.php')) ?>">Déconnexion</a></li>
            </ul>
        </div>
    </div>
</nav>
<main class="container-fluid py-4" style="max-width: 1280px">
    <h1 class="h3 mb-3"><?= e($titre) ?></h1>
    <?= afficher_flash() ?>
    <?php
}

function admin_pied(): void
{
    ?>
</main>
<script src="<?= e(url('assets/js/bootstrap.bundle.min.js')) ?>" defer></script>
<script src="<?= e(url('assets/js/app.js')) ?>" defer></script>
</body>
</html>
    <?php
}

/** Message WhatsApp pré-rempli à destination d'un candidat. */
function whatsapp_candidat(array $candidat, string $message): string
{
    return lien_whatsapp($candidat['telephone'], 'Bonjour ' . $candidat['prenoms'] . ', ' . $message . ' — ' . APP_NOM);
}
