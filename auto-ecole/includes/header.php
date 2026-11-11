<?php
/**
 * En-tête commun (site public + espace candidat).
 * Variables attendues : $titre (obligatoire), $description, $pageActive, $masquerCta.
 */
$titre       = $titre ?? APP_NOM;
$description = $description ?? (APP_NOM . ' à ' . APP_VILLE . ' : inscription en ligne au permis de conduire, paiement Mobile Money, suivi de dossier.');
$pageActive  = $pageActive ?? '';
$u           = utilisateur();
$lien = static fn(string $cle, string $href, string $texte): string =>
    '<li class="nav-item"><a class="nav-link' . ($pageActive === $cle ? ' active" aria-current="page' : '') . '" href="' . e(url($href)) . '">' . $texte . '</a></li>';
?>
<!doctype html>
<html lang="fr">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title><?= e($titre) ?> — <?= e(APP_NOM) ?></title>
    <meta name="description" content="<?= e($description) ?>">
    <meta name="theme-color" content="<?= e(COULEUR_PRINCIPALE) ?>">
    <link rel="icon" href="<?= e(url('assets/favicon.svg')) ?>" type="image/svg+xml">
    <link rel="stylesheet" href="<?= e(url('assets/css/bootstrap.min.css')) ?>">
    <style>:root{--ae-principale:<?= e(COULEUR_PRINCIPALE) ?>;--ae-secondaire:<?= e(COULEUR_SECONDAIRE) ?>;--ae-accent:<?= e(COULEUR_ACCENT) ?>}</style>
    <link rel="stylesheet" href="<?= e(url('assets/css/style.css')) ?>">
</head>
<body class="<?= empty($masquerCta) && !$u ? 'avec-cta' : '' ?>">
<a class="visually-hidden-focusable" href="#contenu">Aller au contenu</a>

<nav class="navbar navbar-expand-lg navbar-dark ae-navbar sticky-top">
    <div class="container">
        <a class="navbar-brand fw-bold d-flex align-items-center gap-2" href="<?= e(url('index.php')) ?>">
            <span class="ae-logo"><?= icone('voiture', 22) ?></span><?= e(APP_NOM) ?>
        </a>
        <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#menu" aria-controls="menu" aria-expanded="false" aria-label="Ouvrir le menu">
            <span class="navbar-toggler-icon"></span>
        </button>
        <div class="collapse navbar-collapse" id="menu">
            <ul class="navbar-nav ms-auto align-items-lg-center gap-lg-1">
                <?= $lien('accueil', 'index.php', 'Accueil') ?>
                <?= $lien('formations', 'formations.php', 'Formations') ?>
                <?= $lien('faq', 'faq.php', 'FAQ') ?>
                <?= $lien('contact', 'contact.php', 'Contact') ?>
                <?php if ($u): ?>
                    <?= $lien('espace', accueil_role($u['role']), icone('user', 16) . ' ' . e($u['prenoms'])) ?>
                    <li class="nav-item"><a class="nav-link" href="<?= e(url('deconnexion.php')) ?>">Déconnexion</a></li>
                <?php else: ?>
                    <?= $lien('connexion', 'connexion.php', 'Connexion') ?>
                    <li class="nav-item ms-lg-2 mt-2 mt-lg-0">
                        <a class="btn btn-accent w-100" href="<?= e(url('inscription.php')) ?>">S'inscrire</a>
                    </li>
                <?php endif; ?>
            </ul>
        </div>
    </div>
</nav>

<main id="contenu">
