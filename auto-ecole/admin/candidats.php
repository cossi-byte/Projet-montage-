<?php
require __DIR__ . '/_debut.php';
require __DIR__ . '/_candidats_requete.php';

const PAR_PAGE = 25;
$page = max(1, (int) ($_GET['page'] ?? 1));
[$lignes, $f] = candidats_filtres($_GET, PAR_PAGE + 1, ($page - 1) * PAR_PAGE);
$suivante = count($lignes) > PAR_PAGE;
$lignes = array_slice($lignes, 0, PAR_PAGE);

$filtresUrl = http_build_query(array_filter(['q' => $f['recherche'], 'statut' => $f['statut'], 'categorie' => $f['categorie'] ?: '', 'solde' => $f['solde']]));
$categories = categories(false);

admin_entete('Candidats', 'candidats');
?>
<form method="get" class="carte mb-3" style="height:auto">
    <div class="row g-2 align-items-end">
        <div class="col-md-4">
            <label class="form-label" for="q">Recherche</label>
            <input class="form-control" id="q" name="q" value="<?= e($f['recherche']) ?>" placeholder="Nom, téléphone ou n° de dossier">
        </div>
        <div class="col-6 col-md-2">
            <label class="form-label" for="statut">Statut</label>
            <select class="form-select" id="statut" name="statut">
                <option value="">Tous</option>
                <?php foreach (STATUTS_DOSSIER as $cle => [$l]): ?>
                    <option value="<?= e($cle) ?>" <?= $f['statut'] === $cle ? 'selected' : '' ?>><?= e($l) ?></option>
                <?php endforeach; ?>
            </select>
        </div>
        <div class="col-6 col-md-2">
            <label class="form-label" for="categorie">Permis</label>
            <select class="form-select" id="categorie" name="categorie">
                <option value="">Tous</option>
                <?php foreach ($categories as $c): ?>
                    <option value="<?= (int) $c['id'] ?>" <?= $f['categorie'] === (int) $c['id'] ? 'selected' : '' ?>><?= e($c['code']) ?></option>
                <?php endforeach; ?>
            </select>
        </div>
        <div class="col-6 col-md-2">
            <label class="form-label" for="solde">Paiement</label>
            <select class="form-select" id="solde" name="solde">
                <option value="">Tous</option>
                <option value="du" <?= $f['solde'] === 'du' ? 'selected' : '' ?>>Solde dû</option>
                <option value="regle" <?= $f['solde'] === 'regle' ? 'selected' : '' ?>>Tout réglé</option>
            </select>
        </div>
        <div class="col-6 col-md-2 d-grid"><button class="btn btn-primary" type="submit" data-libre>Filtrer</button></div>
    </div>
</form>

<div class="d-flex flex-wrap gap-2 mb-3">
    <a class="btn btn-sm btn-outline-success" href="<?= e(url('admin/export.php?format=xlsx&' . $filtresUrl)) ?>"><?= icone('telecharger', 16) ?> Export Excel</a>
    <a class="btn btn-sm btn-outline-danger" href="<?= e(url('admin/export.php?format=pdf&' . $filtresUrl)) ?>"><?= icone('telecharger', 16) ?> Export PDF</a>
    <span class="small text-secondary align-self-center">L'export reprend les filtres ci-dessus.</span>
</div>

<div class="table-responsive">
    <table class="table table-hover">
        <thead><tr><th>Dossier</th><th>Candidat</th><th>Téléphone</th><th>Permis</th><th>Statut</th><th class="text-end">Payé / Total</th><th>Inscrit le</th><th></th></tr></thead>
        <tbody>
        <?php if (!$lignes): ?>
            <tr><td colspan="8" class="text-center text-secondary py-4">Aucun candidat ne correspond à ces critères.</td></tr>
        <?php endif; ?>
        <?php foreach ($lignes as $l): ?>
            <tr>
                <td class="text-nowrap"><?= e($l['numero_dossier']) ?></td>
                <td><a class="fw-semibold text-decoration-none" href="<?= e(url('admin/candidat.php?id=' . $l['id'])) ?>"><?= e($l['nom'] . ' ' . $l['prenoms']) ?></a></td>
                <td class="text-nowrap"><?= e(telephone_affiche($l['telephone'])) ?></td>
                <td class="text-nowrap"><span class="badge text-bg-primary"><?= e($l['categorie_code']) ?></span> <span class="small text-secondary"><?= e(ucfirst($l['formule'])) ?></span></td>
                <td><?= badge(STATUTS_DOSSIER, $l['statut']) ?></td>
                <td class="text-end text-nowrap <?= (int) $l['paye'] >= (int) $l['montant_total'] ? 'text-success' : '' ?>"><?= e(number_format((int) $l['paye'], 0, ',', ' ')) ?> / <?= e(fcfa($l['montant_total'])) ?></td>
                <td class="text-nowrap"><?= e(date_fr($l['created_at'])) ?></td>
                <td><a class="btn btn-sm btn-outline-primary" href="<?= e(url('admin/candidat.php?id=' . $l['id'])) ?>">Ouvrir</a></td>
            </tr>
        <?php endforeach; ?>
        </tbody>
    </table>
</div>

<?php if ($page > 1 || $suivante): ?>
    <nav class="d-flex justify-content-between mt-3" aria-label="Pagination">
        <a class="btn btn-outline-secondary <?= $page > 1 ? '' : 'disabled' ?>" href="<?= e(url('admin/candidats.php?' . $filtresUrl . '&page=' . ($page - 1))) ?>">← Précédents</a>
        <span class="align-self-center text-secondary">Page <?= $page ?></span>
        <a class="btn btn-outline-secondary <?= $suivante ? '' : 'disabled' ?>" href="<?= e(url('admin/candidats.php?' . $filtresUrl . '&page=' . ($page + 1))) ?>">Suivants →</a>
    </nav>
<?php endif; ?>
<?php admin_pied(); ?>
