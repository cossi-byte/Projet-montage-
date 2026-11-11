<?php
require __DIR__ . '/includes/init.php';

if ($u = utilisateur()) {
    rediriger(accueil_role($u['role']));
}

$erreur = null;
$identifiant = '';

if (est_post()) {
    csrf_verifier();
    $identifiant = champ('identifiant');
    $resultat = tenter_connexion($identifiant, (string) ($_POST['mot_de_passe'] ?? ''));
    if (is_array($resultat)) {
        $cible = $_SESSION['apres_connexion'] ?? '';
        unset($_SESSION['apres_connexion']);
        // On ne suit que les retours internes au site
        if (is_string($cible) && $cible !== '' && str_starts_with($cible, BASE_URL . '/') && !str_starts_with($cible, '//')) {
            header('Location: ' . $cible);
            exit;
        }
        rediriger(accueil_role($resultat['role']));
    }
    $erreur = $resultat;
}

$titre = 'Connexion';
$pageActive = 'connexion';
$masquerCta = true;
require __DIR__ . '/includes/header.php';
?>
<section class="ae-section">
    <div class="container" style="max-width: 460px">
        <h1 class="h2 text-center">Mon espace</h1>
        <p class="text-center text-secondary">Connectez-vous avec votre téléphone ou votre e-mail.</p>
        <?= afficher_flash() ?>
        <?php if ($erreur): ?><div class="alert alert-danger" role="alert"><?= e($erreur) ?></div><?php endif; ?>

        <form method="post" class="carte" novalidate>
            <?= csrf_champ() ?>
            <div class="mb-3">
                <label class="form-label" for="identifiant">Téléphone ou e-mail</label>
                <input class="form-control form-control-lg" id="identifiant" name="identifiant" value="<?= e($identifiant) ?>" required autofocus autocomplete="username" placeholder="01 97 00 00 00">
            </div>
            <div class="mb-3">
                <label class="form-label" for="mot_de_passe">Mot de passe</label>
                <div class="input-group">
                    <input class="form-control form-control-lg" id="mot_de_passe" name="mot_de_passe" type="password" required autocomplete="current-password">
                    <button class="btn btn-outline-secondary" type="button" data-voir-mdp="mot_de_passe">Voir</button>
                </div>
            </div>
            <button class="btn btn-primary btn-lg w-100" type="submit">Se connecter</button>
            <p class="small text-secondary mt-3 mb-0">
                Mot de passe oublié ? <a rel="noopener" href="<?= e(lien_whatsapp(APP_WHATSAPP, 'Bonjour, j\'ai oublié le mot de passe de mon espace candidat. Mon numéro : ')) ?>">Contactez l'agence sur WhatsApp</a> : nous le réinitialisons après vérification de votre identité.
            </p>
        </form>

        <p class="text-center mt-3">Pas encore inscrit ? <a class="fw-semibold" href="<?= e(url('inscription.php')) ?>">Créer mon dossier</a></p>
    </div>
</section>
<?php require __DIR__ . '/includes/footer.php'; ?>
