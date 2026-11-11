<?php
require __DIR__ . '/_debut.php';

$erreurs = [];
$email = (string) $u['email'];

if (est_post()) {
    csrf_verifier();

    if (champ('action') === 'email') {
        $email = mb_strtolower(champ('email'));
        if ($email !== '' && !email_valide($email)) {
            $erreurs[] = 'Adresse e-mail invalide.';
        } elseif ($email !== '' && q('SELECT 1 FROM utilisateurs WHERE email = ? AND id <> ?', [$email, $u['id']])->fetch()) {
            $erreurs[] = 'Cette adresse e-mail est déjà utilisée par un autre compte.';
        }
        if (!$erreurs) {
            q('UPDATE utilisateurs SET email = ? WHERE id = ?', [$email ?: null, $u['id']]);
            flash('success', 'Adresse e-mail mise à jour.');
            rediriger('candidat/profil.php');
        }
    } else {
        $actuel  = (string) ($_POST['actuel'] ?? '');
        $nouveau = (string) ($_POST['nouveau'] ?? '');
        $hash = q('SELECT mot_de_passe FROM utilisateurs WHERE id = ?', [$u['id']])->fetchColumn();
        if (!password_verify($actuel, (string) $hash)) {
            $erreurs[] = 'Le mot de passe actuel est incorrect.';
        } elseif ($err = erreur_mot_de_passe($nouveau)) {
            $erreurs[] = $err;
        } elseif ($nouveau !== (string) ($_POST['confirmation'] ?? '')) {
            $erreurs[] = 'Les deux nouveaux mots de passe ne sont pas identiques.';
        }
        if (!$erreurs) {
            q('UPDATE utilisateurs SET mot_de_passe = ? WHERE id = ?', [password_hash($nouveau, PASSWORD_DEFAULT), $u['id']]);
            session_regenerate_id(true);
            flash('success', 'Mot de passe modifié.');
            rediriger('candidat/profil.php');
        }
    }
}

$titre = 'Mon compte';
require RACINE . '/includes/header.php';
?>
<section class="ae-section">
    <div class="container" style="max-width: 560px">
        <h1 class="h2">Mon compte</h1>
        <?= onglets_candidat('profil') ?>
        <?= afficher_flash() ?>
        <?= afficher_erreurs($erreurs) ?>

        <div class="carte mb-3" style="height:auto">
            <h2 class="h5">Mes informations</h2>
            <dl class="row mb-0">
                <dt class="col-5 fw-normal text-secondary">Nom</dt><dd class="col-7 fw-semibold"><?= e($u['nom'] . ' ' . $u['prenoms']) ?></dd>
                <dt class="col-5 fw-normal text-secondary">Né(e) le</dt><dd class="col-7"><?= e(date_fr($dossier['date_naissance'])) ?></dd>
                <dt class="col-5 fw-normal text-secondary">Téléphone</dt><dd class="col-7"><?= e(telephone_affiche($u['telephone'])) ?></dd>
            </dl>
            <p class="small text-secondary mb-0">Une erreur dans votre nom ou votre numéro ? Contactez l'agence pour la faire corriger.</p>
        </div>

        <form method="post" class="carte mb-3" style="height:auto" novalidate>
            <?= csrf_champ() ?>
            <input type="hidden" name="action" value="email">
            <h2 class="h5">Adresse e-mail</h2>
            <label class="form-label" for="email">E-mail pour vos notifications</label>
            <input class="form-control mb-3" id="email" name="email" type="email" value="<?= e($email) ?>" maxlength="150" autocomplete="email">
            <button class="btn btn-primary" type="submit">Enregistrer</button>
        </form>

        <form method="post" class="carte" style="height:auto" novalidate>
            <?= csrf_champ() ?>
            <input type="hidden" name="action" value="mot_de_passe">
            <h2 class="h5">Changer mon mot de passe</h2>
            <div class="mb-3">
                <label class="form-label" for="actuel">Mot de passe actuel</label>
                <input class="form-control" id="actuel" name="actuel" type="password" required autocomplete="current-password">
            </div>
            <div class="mb-3">
                <label class="form-label" for="nouveau">Nouveau mot de passe</label>
                <input class="form-control" id="nouveau" name="nouveau" type="password" required minlength="8" autocomplete="new-password">
                <div class="form-text">8 caractères minimum, avec une lettre et un chiffre.</div>
            </div>
            <div class="mb-3">
                <label class="form-label" for="confirmation">Confirmez le nouveau mot de passe</label>
                <input class="form-control" id="confirmation" name="confirmation" type="password" required autocomplete="new-password">
            </div>
            <button class="btn btn-primary" type="submit">Modifier le mot de passe</button>
        </form>
    </div>
</section>
<?php require RACINE . '/includes/footer.php'; ?>
