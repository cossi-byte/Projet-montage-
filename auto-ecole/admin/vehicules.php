<?php
require __DIR__ . '/_debut.php';

const STATUTS_VEHICULE = ['disponible' => ['Disponible', 'success'], 'maintenance' => ['En maintenance', 'warning'], 'hors_service' => ['Hors service', 'secondary']];

$categories = categories(false);
$erreurs = [];
$edition = isset($_GET['modifier']) ? (q('SELECT * FROM vehicules WHERE id = ?', [(int) $_GET['modifier']])->fetch() ?: null) : null;
$v = $edition ?? ['id' => 0, 'immatriculation' => '', 'marque' => '', 'modele' => '', 'categorie_id' => 0, 'statut' => 'disponible'];

if (est_post()) {
    csrf_verifier();
    $vid = (int) ($_POST['id'] ?? 0);

    if (champ('action') === 'supprimer') {
        q('DELETE FROM vehicules WHERE id = ?', [$vid]);
        flash('success', 'Véhicule supprimé. Les créneaux qui l\'utilisaient sont conservés, sans véhicule.');
        rediriger('admin/vehicules.php');
    }

    $v = [
        'id'              => $vid,
        'immatriculation' => mb_strtoupper(champ('immatriculation')),
        'marque'          => champ('marque'),
        'modele'          => champ('modele'),
        'categorie_id'    => (int) ($_POST['categorie_id'] ?? 0),
        'statut'          => champ('statut'),
    ];
    if (!preg_match('/^[A-Z0-9][A-Z0-9 \-]{2,19}$/', $v['immatriculation'])) { $erreurs[] = 'Immatriculation invalide (3 à 20 lettres, chiffres, espaces ou tirets).'; }
    elseif (q('SELECT 1 FROM vehicules WHERE immatriculation = ? AND id <> ?', [$v['immatriculation'], $vid])->fetch()) { $erreurs[] = 'Cette immatriculation existe déjà.'; }
    if ($v['marque'] === '' || mb_strlen($v['marque']) > 60) { $erreurs[] = 'Marque obligatoire (60 caractères maximum).'; }
    if ($v['modele'] === '' || mb_strlen($v['modele']) > 60) { $erreurs[] = 'Modèle obligatoire (60 caractères maximum).'; }
    if ($v['categorie_id'] && !in_array($v['categorie_id'], array_map('intval', array_column($categories, 'id')), true)) { $erreurs[] = 'Catégorie invalide.'; }
    if (!isset(STATUTS_VEHICULE[$v['statut']])) { $erreurs[] = 'Statut invalide.'; }

    if (!$erreurs) {
        $params = [$v['immatriculation'], $v['marque'], $v['modele'], $v['categorie_id'] ?: null, $v['statut']];
        if ($vid) {
            q('UPDATE vehicules SET immatriculation = ?, marque = ?, modele = ?, categorie_id = ?, statut = ? WHERE id = ?', [...$params, $vid]);
        } else {
            q('INSERT INTO vehicules (immatriculation, marque, modele, categorie_id, statut) VALUES (?, ?, ?, ?, ?)', $params);
        }
        flash('success', $vid ? 'Véhicule mis à jour.' : 'Véhicule ajouté.');
        rediriger('admin/vehicules.php');
    }
    $edition = $vid ? $v : null;
}

$vehicules = q('SELECT v.*, c.code FROM vehicules v LEFT JOIN categories c ON c.id = v.categorie_id ORDER BY v.statut, v.marque')->fetchAll();

admin_entete('Véhicules', 'vehicules');
?>
<div class="row g-3">
    <div class="col-lg-8">
        <div class="table-responsive">
            <table class="table">
                <thead><tr><th>Véhicule</th><th>Immatriculation</th><th>Permis</th><th>Statut</th><th></th></tr></thead>
                <tbody>
                <?php if (!$vehicules): ?><tr><td colspan="5" class="text-center text-secondary py-4">Aucun véhicule.</td></tr><?php endif; ?>
                <?php foreach ($vehicules as $x): ?>
                    <tr>
                        <td><strong><?= e($x['marque'] . ' ' . $x['modele']) ?></strong></td>
                        <td class="text-nowrap"><?= e($x['immatriculation']) ?></td>
                        <td><?= $x['code'] ? '<span class="badge text-bg-primary">' . e($x['code']) . '</span>' : '—' ?></td>
                        <td><?= badge(STATUTS_VEHICULE, $x['statut']) ?></td>
                        <td class="text-nowrap">
                            <a class="btn btn-sm btn-outline-primary" href="<?= e(url('admin/vehicules.php?modifier=' . $x['id'])) ?>">Modifier</a>
                            <form method="post" class="d-inline"><?= csrf_champ() ?><input type="hidden" name="action" value="supprimer"><input type="hidden" name="id" value="<?= (int) $x['id'] ?>">
                                <button class="btn btn-sm btn-outline-danger" type="submit" data-confirmer="Supprimer définitivement ce véhicule ?">Supprimer</button></form>
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
            <h2 class="h5"><?= $edition ? 'Modifier le véhicule' : 'Ajouter un véhicule' ?></h2>
            <?= afficher_erreurs($erreurs) ?>
            <div class="mb-2"><label class="form-label requis" for="immatriculation">Immatriculation</label><input class="form-control" id="immatriculation" name="immatriculation" value="<?= e($v['immatriculation']) ?>" required maxlength="20"></div>
            <div class="mb-2"><label class="form-label requis" for="marque">Marque</label><input class="form-control" id="marque" name="marque" value="<?= e($v['marque']) ?>" required maxlength="60"></div>
            <div class="mb-2"><label class="form-label requis" for="modele">Modèle</label><input class="form-control" id="modele" name="modele" value="<?= e($v['modele']) ?>" required maxlength="60"></div>
            <div class="mb-2"><label class="form-label" for="categorie_id">Catégorie de permis</label>
                <select class="form-select" id="categorie_id" name="categorie_id"><option value="0">—</option>
                    <?php foreach ($categories as $c): ?><option value="<?= (int) $c['id'] ?>" <?= (int) $v['categorie_id'] === (int) $c['id'] ? 'selected' : '' ?>><?= e($c['libelle']) ?></option><?php endforeach; ?>
                </select></div>
            <div class="mb-3"><label class="form-label" for="statut">Statut</label>
                <select class="form-select" id="statut" name="statut">
                    <?php foreach (STATUTS_VEHICULE as $cle => [$l]): ?><option value="<?= e($cle) ?>" <?= $v['statut'] === $cle ? 'selected' : '' ?>><?= e($l) ?></option><?php endforeach; ?>
                </select></div>
            <button class="btn btn-primary" type="submit"><?= $edition ? 'Enregistrer' : 'Ajouter' ?></button>
            <?php if ($edition): ?><a class="btn btn-link" href="<?= e(url('admin/vehicules.php')) ?>">Annuler</a><?php endif; ?>
        </form>
    </div>
</div>
<?php admin_pied(); ?>
