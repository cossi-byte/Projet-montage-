<?php
require __DIR__ . '/_debut.php';

const SPECIALITES = ['les_deux' => 'Code et conduite', 'code' => 'Code', 'conduite' => 'Conduite'];

$erreurs = [];
$edition = null;
if (isset($_GET['modifier'])) {
    $edition = q('SELECT m.*, u.nom, u.prenoms, u.telephone, u.email FROM moniteurs m JOIN utilisateurs u ON u.id = m.utilisateur_id WHERE m.id = ?',
                 [(int) $_GET['modifier']])->fetch() ?: null;
}
$v = $edition ?? ['nom' => '', 'prenoms' => '', 'telephone' => '', 'email' => '', 'specialite' => 'les_deux', 'numero_agrement' => ''];

if (est_post()) {
    csrf_verifier();
    $action = champ('action');

    if ($action === 'basculer') {
        q("UPDATE utilisateurs u JOIN moniteurs m ON m.utilisateur_id = u.id SET u.actif = 1 - u.actif WHERE m.id = ?", [(int) ($_POST['id'] ?? 0)]);
        flash('success', 'Statut du moniteur mis à jour.');
        rediriger('admin/moniteurs.php');
    }

    $mid = (int) ($_POST['id'] ?? 0);
    $existant = $mid ? q('SELECT * FROM moniteurs WHERE id = ?', [$mid])->fetch() : null;
    $v = [
        'id'              => $mid,
        'nom'             => mb_strtoupper(champ('nom')),
        'prenoms'         => champ('prenoms'),
        'telephone'       => champ('telephone'),
        'email'           => mb_strtolower(champ('email')),
        'specialite'      => champ('specialite'),
        'numero_agrement' => mb_substr(champ('numero_agrement'), 0, 40),
    ];
    $mdp = (string) ($_POST['mot_de_passe'] ?? '');
    $tel = normaliser_telephone($v['telephone']);
    $uid = $existant ? (int) $existant['utilisateur_id'] : 0;

    if ($mid && !$existant) { $erreurs[] = 'Moniteur introuvable.'; }
    if (mb_strlen($v['nom']) < 2 || mb_strlen($v['nom']) > 80) { $erreurs[] = 'Nom obligatoire (2 à 80 caractères).'; }
    if (mb_strlen($v['prenoms']) < 2 || mb_strlen($v['prenoms']) > 120) { $erreurs[] = 'Prénoms obligatoires (2 à 120 caractères).'; }
    if ($tel === null) {
        $erreurs[] = 'Numéro de téléphone invalide.';
    } elseif (q('SELECT 1 FROM utilisateurs WHERE telephone = ? AND id <> ?', [$tel, $uid])->fetch()) {
        $erreurs[] = 'Ce téléphone est déjà utilisé par un autre compte.';
    }
    if ($v['email'] !== '') {
        if (!email_valide($v['email'])) {
            $erreurs[] = 'Adresse e-mail invalide.';
        } elseif (q('SELECT 1 FROM utilisateurs WHERE email = ? AND id <> ?', [$v['email'], $uid])->fetch()) {
            $erreurs[] = 'Cet e-mail est déjà utilisé par un autre compte.';
        }
    }
    if (!isset(SPECIALITES[$v['specialite']])) { $erreurs[] = 'Spécialité invalide.'; }
    if ((!$existant || $mdp !== '') && ($err = erreur_mot_de_passe($mdp))) { $erreurs[] = $err; }

    if (!$erreurs) {
        $pdo = db();
        $pdo->beginTransaction();
        if ($existant) {
            q('UPDATE utilisateurs SET nom = ?, prenoms = ?, telephone = ?, email = ? WHERE id = ?', [$v['nom'], $v['prenoms'], $tel, $v['email'] ?: null, $uid]);
            if ($mdp !== '') {
                q('UPDATE utilisateurs SET mot_de_passe = ? WHERE id = ?', [password_hash($mdp, PASSWORD_DEFAULT), $uid]);
            }
            q('UPDATE moniteurs SET specialite = ?, numero_agrement = ? WHERE id = ?', [$v['specialite'], $v['numero_agrement'] ?: null, $mid]);
        } else {
            q("INSERT INTO utilisateurs (role, nom, prenoms, telephone, email, mot_de_passe) VALUES ('moniteur', ?, ?, ?, ?, ?)",
              [$v['nom'], $v['prenoms'], $tel, $v['email'] ?: null, password_hash($mdp, PASSWORD_DEFAULT)]);
            q('INSERT INTO moniteurs (utilisateur_id, specialite, numero_agrement) VALUES (?, ?, ?)', [(int) $pdo->lastInsertId(), $v['specialite'], $v['numero_agrement'] ?: null]);
        }
        $pdo->commit();
        flash('success', $existant ? 'Moniteur mis à jour.' : 'Moniteur ajouté. Il peut se connecter avec son téléphone et le mot de passe choisi.');
        rediriger('admin/moniteurs.php');
    }
    $edition = $existant ? $v : null;
}

$moniteurs = q("SELECT m.*, u.nom, u.prenoms, u.telephone, u.email, u.actif,
                       (SELECT COUNT(*) FROM creneaux c WHERE c.moniteur_id = m.id AND c.date_creneau >= CURDATE()) AS a_venir
                FROM moniteurs m JOIN utilisateurs u ON u.id = m.utilisateur_id ORDER BY u.actif DESC, u.nom")->fetchAll();

admin_entete('Moniteurs', 'moniteurs');
?>
<div class="row g-3">
    <div class="col-lg-8">
        <div class="table-responsive">
            <table class="table">
                <thead><tr><th>Moniteur</th><th>Téléphone</th><th>Spécialité</th><th>Créneaux à venir</th><th></th></tr></thead>
                <tbody>
                <?php foreach ($moniteurs as $m): ?>
                    <tr class="<?= $m['actif'] ? '' : 'text-secondary' ?>">
                        <td><strong><?= e($m['nom'] . ' ' . $m['prenoms']) ?></strong><?= $m['actif'] ? '' : ' <span class="badge text-bg-secondary">Inactif</span>' ?>
                            <br><span class="small text-secondary"><?= e($m['numero_agrement'] ?: 'Agrément non renseigné') ?></span></td>
                        <td class="text-nowrap"><?= e(telephone_affiche($m['telephone'])) ?></td>
                        <td><?= e(SPECIALITES[$m['specialite']]) ?></td>
                        <td><?= (int) $m['a_venir'] ?></td>
                        <td class="text-nowrap">
                            <a class="btn btn-sm btn-outline-primary" href="<?= e(url('admin/moniteurs.php?modifier=' . $m['id'])) ?>">Modifier</a>
                            <form method="post" class="d-inline"><?= csrf_champ() ?><input type="hidden" name="action" value="basculer"><input type="hidden" name="id" value="<?= (int) $m['id'] ?>">
                                <button class="btn btn-sm btn-outline-secondary" type="submit" data-confirmer="<?= $m['actif'] ? 'Désactiver ce moniteur ? Il ne pourra plus se connecter.' : 'Réactiver ce moniteur ?' ?>"><?= $m['actif'] ? 'Désactiver' : 'Réactiver' ?></button></form>
                        </td>
                    </tr>
                <?php endforeach; ?>
                </tbody>
            </table>
        </div>
    </div>
    <div class="col-lg-4">
        <form method="post" class="carte" style="height:auto" novalidate>
            <?= csrf_champ() ?>
            <input type="hidden" name="action" value="enregistrer">
            <input type="hidden" name="id" value="<?= (int) ($edition['id'] ?? 0) ?>">
            <h2 class="h5"><?= $edition ? 'Modifier le moniteur' : 'Ajouter un moniteur' ?></h2>
            <?= afficher_erreurs($erreurs) ?>
            <div class="mb-2"><label class="form-label requis" for="nom">Nom</label><input class="form-control" id="nom" name="nom" value="<?= e($v['nom']) ?>" required maxlength="80"></div>
            <div class="mb-2"><label class="form-label requis" for="prenoms">Prénoms</label><input class="form-control" id="prenoms" name="prenoms" value="<?= e($v['prenoms']) ?>" required maxlength="120"></div>
            <div class="mb-2"><label class="form-label requis" for="telephone">Téléphone</label><input class="form-control" id="telephone" name="telephone" type="tel" value="<?= e($v['telephone']) ?>" required></div>
            <div class="mb-2"><label class="form-label" for="email">E-mail</label><input class="form-control" id="email" name="email" type="email" value="<?= e($v['email']) ?>" maxlength="150"></div>
            <div class="mb-2"><label class="form-label" for="specialite">Spécialité</label>
                <select class="form-select" id="specialite" name="specialite">
                    <?php foreach (SPECIALITES as $cle => $l): ?><option value="<?= e($cle) ?>" <?= $v['specialite'] === $cle ? 'selected' : '' ?>><?= e($l) ?></option><?php endforeach; ?>
                </select></div>
            <div class="mb-2"><label class="form-label" for="numero_agrement">N° d'agrément</label><input class="form-control" id="numero_agrement" name="numero_agrement" value="<?= e($v['numero_agrement']) ?>" maxlength="40"></div>
            <div class="mb-3"><label class="form-label <?= $edition ? '' : 'requis' ?>" for="mot_de_passe">Mot de passe</label>
                <input class="form-control" id="mot_de_passe" name="mot_de_passe" type="password" autocomplete="new-password" <?= $edition ? '' : 'required' ?>>
                <div class="form-text"><?= $edition ? 'Laissez vide pour ne pas le changer.' : '8 caractères minimum, avec une lettre et un chiffre.' ?></div></div>
            <button class="btn btn-primary" type="submit"><?= $edition ? 'Enregistrer' : 'Ajouter' ?></button>
            <?php if ($edition): ?><a class="btn btn-link" href="<?= e(url('admin/moniteurs.php')) ?>">Annuler</a><?php endif; ?>
        </form>
    </div>
</div>
<?php admin_pied(); ?>
