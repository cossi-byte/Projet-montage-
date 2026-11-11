<?php
$rolesAutorises = ['admin', 'moniteur'];
require __DIR__ . '/_debut.php';

$erreurs = [];
if (est_post()) {
    csrf_verifier();
    $nouveau = (string) ($_POST['nouveau'] ?? '');
    $hash = (string) q('SELECT mot_de_passe FROM utilisateurs WHERE id = ?', [$u['id']])->fetchColumn();
    if (!password_verify((string) ($_POST['actuel'] ?? ''), $hash)) {
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
        rediriger('admin/compte.php');
    }
}

admin_entete('Mon compte', '');
?>
<div style="max-width: 480px">
    <p><?= e($u['nom'] . ' ' . $u['prenoms']) ?> · <?= e(telephone_affiche($u['telephone'])) ?><?= $u['email'] ? ' · ' . e($u['email']) : '' ?></p>
    <?= afficher_erreurs($erreurs) ?>
    <form method="post" class="carte" style="height:auto" novalidate>
        <?= csrf_champ() ?>
        <h2 class="h5">Changer mon mot de passe</h2>
        <div class="mb-3"><label class="form-label" for="actuel">Mot de passe actuel</label><input class="form-control" id="actuel" name="actuel" type="password" required autocomplete="current-password"></div>
        <div class="mb-3"><label class="form-label" for="nouveau">Nouveau mot de passe</label><input class="form-control" id="nouveau" name="nouveau" type="password" required minlength="8" autocomplete="new-password">
            <div class="form-text">8 caractères minimum, avec une lettre et un chiffre.</div></div>
        <div class="mb-3"><label class="form-label" for="confirmation">Confirmez le nouveau mot de passe</label><input class="form-control" id="confirmation" name="confirmation" type="password" required autocomplete="new-password"></div>
        <button class="btn btn-primary" type="submit">Modifier</button>
    </form>
</div>
<?php admin_pied(); ?>
