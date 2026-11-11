<?php
require __DIR__ . '/_debut.php';

$erreurs = [];
$categories = categories(false);

if (est_post()) {
    csrf_verifier();
    $entier = static fn(mixed $x): ?int => (is_string($x) && ctype_digit($x = preg_replace('/\s+/u', '', $x))) ? (int) $x : null;
    $maj = [];
    foreach ($categories as $c) {
        $l = $_POST['cat'][$c['id']] ?? null;
        if (!is_array($l)) {
            continue;
        }
        $ligne = [
            'prix_code'       => $entier($l['prix_code'] ?? ''),
            'prix_conduite'   => $entier($l['prix_conduite'] ?? ''),
            'prix_complet'    => $entier($l['prix_complet'] ?? ''),
            'duree_semaines'  => $entier($l['duree_semaines'] ?? ''),
            'heures_code'     => $entier($l['heures_code'] ?? ''),
            'heures_conduite' => $entier($l['heures_conduite'] ?? ''),
        ];
        foreach ($ligne as $cle => $val) {
            $max = str_starts_with($cle, 'prix') ? 5000000 : 255;
            if ($val === null || $val > $max) {
                $erreurs[] = "Permis {$c['code']} : valeur invalide pour « " . str_replace('_', ' ', $cle) . ' » (nombre entier attendu).';
            }
        }
        $ligne['actif'] = empty($l['actif']) ? 0 : 1;
        $ligne['pieces'] = trim(str_replace("\r", '', (string) ($l['pieces'] ?? '')));
        if ($ligne['pieces'] === '' || mb_strlen($ligne['pieces']) > 2000) {
            $erreurs[] = "Permis {$c['code']} : indiquez les pièces à fournir (une par ligne).";
        }
        $maj[$c['id']] = $ligne;
    }
    if (!$erreurs) {
        foreach ($maj as $cid => $l) {
            q('UPDATE categories SET prix_code = ?, prix_conduite = ?, prix_complet = ?, duree_semaines = ?, heures_code = ?, heures_conduite = ?, actif = ?, pieces = ? WHERE id = ?',
              [$l['prix_code'], $l['prix_conduite'], $l['prix_complet'], $l['duree_semaines'], $l['heures_code'], $l['heures_conduite'], $l['actif'], $l['pieces'], $cid]);
        }
        flash('success', 'Tarifs enregistrés. Ils s\'appliquent aux nouvelles inscriptions ; les dossiers existants gardent leur montant.');
        rediriger('admin/tarifs.php');
    }
    // Réafficher la saisie
    foreach ($categories as &$c) {
        foreach (($_POST['cat'][$c['id']] ?? []) as $cle => $val) {
            if (array_key_exists($cle, $c) && is_string($val)) {
                $c[$cle] = $val;
            }
        }
        $c['actif'] = empty($_POST['cat'][$c['id']]['actif']) ? 0 : 1;
    }
    unset($c);
}

admin_entete('Tarifs et formations', 'tarifs');
?>
<?= afficher_erreurs($erreurs) ?>
<form method="post" novalidate>
    <?= csrf_champ() ?>
    <?php foreach ($categories as $c): $n = 'cat[' . (int) $c['id'] . ']'; $i = 'c' . (int) $c['id']; ?>
        <fieldset class="carte mb-3" style="height:auto">
            <legend class="h5 d-flex justify-content-between align-items-center">
                <span><span class="badge text-bg-primary"><?= e($c['code']) ?></span> <?= e($c['libelle']) ?></span>
                <span class="form-check form-switch fs-6 fw-normal">
                    <input class="form-check-input" type="checkbox" role="switch" id="<?= $i ?>-actif" name="<?= $n ?>[actif]" value="1" <?= $c['actif'] ? 'checked' : '' ?>>
                    <label class="form-check-label" for="<?= $i ?>-actif">Proposé</label>
                </span>
            </legend>
            <div class="row g-2">
                <?php foreach (['prix_code' => 'Code seul (FCFA)', 'prix_conduite' => 'Conduite seule (FCFA)', 'prix_complet' => 'Formule complète (FCFA)'] as $cle => $l): ?>
                    <div class="col-sm-4"><label class="form-label" for="<?= $i . $cle ?>"><?= e($l) ?></label>
                        <input class="form-control" id="<?= $i . $cle ?>" name="<?= $n ?>[<?= $cle ?>]" type="number" min="0" step="500" value="<?= e($c[$cle]) ?>" required></div>
                <?php endforeach; ?>
                <?php foreach (['duree_semaines' => 'Durée (semaines)', 'heures_code' => 'Heures de code', 'heures_conduite' => 'Heures de conduite'] as $cle => $l): ?>
                    <div class="col-4"><label class="form-label" for="<?= $i . $cle ?>"><?= e($l) ?></label>
                        <input class="form-control" id="<?= $i . $cle ?>" name="<?= $n ?>[<?= $cle ?>]" type="number" min="0" max="255" value="<?= e($c[$cle]) ?>" required></div>
                <?php endforeach; ?>
                <div class="col-12"><label class="form-label" for="<?= $i ?>pieces">Pièces à fournir <span class="fw-normal text-secondary">(une par ligne)</span></label>
                    <textarea class="form-control" id="<?= $i ?>pieces" name="<?= $n ?>[pieces]" rows="3" maxlength="2000" required><?= e($c['pieces']) ?></textarea></div>
            </div>
        </fieldset>
    <?php endforeach; ?>
    <button class="btn btn-primary btn-lg" type="submit">Enregistrer les tarifs</button>
</form>
<?php admin_pied(); ?>
