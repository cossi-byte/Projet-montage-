<?php
require __DIR__ . '/_debut.php';

$stats = q("SELECT COUNT(*) AS total,
                   SUM(created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')) AS ce_mois,
                   SUM(statut = 'en_attente') AS en_attente,
                   SUM(statut IN ('valide', 'en_formation', 'examen')) AS en_cours,
                   SUM(statut = 'admis') AS admis,
                   SUM(statut = 'ajourne') AS ajournes,
                   COALESCE(SUM(montant_total), 0) AS facture
            FROM inscriptions WHERE statut <> 'rejete'")->fetch();
$revenus = q("SELECT COALESCE(SUM(montant), 0) AS total,
                     COALESCE(SUM(CASE WHEN date_paiement >= DATE_FORMAT(CURDATE(), '%Y-%m-01') THEN montant END), 0) AS ce_mois
              FROM paiements WHERE statut = 'confirme'")->fetch();
$especesAttente = q("SELECT COUNT(*) AS n, COALESCE(SUM(montant), 0) AS total FROM paiements WHERE statut = 'en_attente' AND mode = 'especes'")->fetch();
$docsAttente = (int) q("SELECT COUNT(*) FROM documents WHERE statut = 'en_attente'")->fetchColumn();

$examines = (int) $stats['admis'] + (int) $stats['ajournes'];
$tauxReussite = $examines ? round((int) $stats['admis'] * 100 / $examines) : null;
$resteDu = max(0, (int) $stats['facture'] - (int) $revenus['total']);

// Revenus et inscriptions des 6 derniers mois
$mois = [];
for ($i = 5; $i >= 0; $i--) {
    $mois[date('Y-m', strtotime("first day of -$i month"))] = ['revenus' => 0, 'inscriptions' => 0];
}
$debut = array_key_first($mois) . '-01';
foreach (q("SELECT DATE_FORMAT(date_paiement, '%Y-%m') AS m, SUM(montant) AS s FROM paiements WHERE statut = 'confirme' AND date_paiement >= ? GROUP BY m", [$debut]) as $l) {
    if (isset($mois[$l['m']])) { $mois[$l['m']]['revenus'] = (int) $l['s']; }
}
foreach (q("SELECT DATE_FORMAT(created_at, '%Y-%m') AS m, COUNT(*) AS n FROM inscriptions WHERE created_at >= ? GROUP BY m", [$debut]) as $l) {
    if (isset($mois[$l['m']])) { $mois[$l['m']]['inscriptions'] = (int) $l['n']; }
}
$maxRevenus = max(1, ...array_column($mois, 'revenus'));
$nomsMois = ['01' => 'janv.', '02' => 'févr.', '03' => 'mars', '04' => 'avr.', '05' => 'mai', '06' => 'juin', '07' => 'juil.', '08' => 'août', '09' => 'sept.', '10' => 'oct.', '11' => 'nov.', '12' => 'déc.'];

$parCategorie = q("SELECT c.code, COUNT(i.id) AS n FROM categories c LEFT JOIN inscriptions i ON i.categorie_id = c.id AND i.statut <> 'rejete' GROUP BY c.id, c.code ORDER BY c.ordre")->fetchAll();
$recents = q("SELECT i.id, i.numero_dossier, i.statut, i.created_at, u.nom, u.prenoms, c.code
              FROM inscriptions i JOIN utilisateurs u ON u.id = i.utilisateur_id JOIN categories c ON c.id = i.categorie_id
              ORDER BY i.id DESC LIMIT 6")->fetchAll();

admin_entete('Tableau de bord', 'tableau');
?>
<div class="row g-3 mb-3">
    <div class="col-6 col-lg-3"><div class="stat"><div class="libelle">Inscriptions</div><div class="valeur"><?= (int) $stats['total'] ?></div><div class="small text-success">+<?= (int) $stats['ce_mois'] ?> ce mois-ci</div></div></div>
    <div class="col-6 col-lg-3"><div class="stat"><div class="libelle">Revenus encaissés</div><div class="valeur"><?= e(fcfa($revenus['total'])) ?></div><div class="small text-success"><?= e(fcfa($revenus['ce_mois'])) ?> ce mois-ci</div></div></div>
    <div class="col-6 col-lg-3"><div class="stat"><div class="libelle">Taux de réussite</div><div class="valeur"><?= $tauxReussite === null ? '—' : $tauxReussite . ' %' ?></div><div class="small text-secondary"><?= (int) $stats['admis'] ?> admis sur <?= $examines ?> examinés</div></div></div>
    <div class="col-6 col-lg-3"><div class="stat"><div class="libelle">Reste à encaisser</div><div class="valeur"><?= e(fcfa($resteDu)) ?></div><div class="small text-secondary"><?= (int) $stats['en_cours'] ?> candidats en cours</div></div></div>
</div>

<div class="row g-3 mb-3">
    <div class="col-md-4"><a class="stat d-block text-decoration-none" href="<?= e(url('admin/candidats.php?statut=en_attente')) ?>"><div class="libelle">Dossiers à valider</div><div class="valeur <?= $stats['en_attente'] ? 'text-danger' : '' ?>"><?= (int) $stats['en_attente'] ?></div><div class="small text-secondary"><?= $docsAttente ?> pièce(s) à vérifier</div></a></div>
    <div class="col-md-4"><a class="stat d-block text-decoration-none" href="<?= e(url('admin/paiements.php?statut=en_attente')) ?>"><div class="libelle">Espèces à confirmer</div><div class="valeur <?= $especesAttente['n'] ? 'text-danger' : '' ?>"><?= (int) $especesAttente['n'] ?></div><div class="small text-secondary"><?= e(fcfa($especesAttente['total'])) ?> attendus à l'agence</div></a></div>
    <div class="col-md-4"><div class="stat"><div class="libelle">Inscriptions par permis</div>
        <div class="d-flex gap-3 mt-1 flex-wrap"><?php foreach ($parCategorie as $c): ?><span><span class="badge text-bg-primary"><?= e($c['code']) ?></span> <strong><?= (int) $c['n'] ?></strong></span><?php endforeach; ?></div></div></div>
</div>

<div class="row g-3">
    <div class="col-lg-7">
        <div class="stat">
            <h2 class="h6">Revenus des 6 derniers mois</h2>
            <div class="barres mt-3" role="img" aria-label="Histogramme des revenus mensuels">
                <?php foreach ($mois as $cle => $m): ?>
                    <div class="barre" title="<?= e(fcfa($m['revenus'])) ?> · <?= $m['inscriptions'] ?> inscription(s)">
                        <span class="fw-semibold text-dark"><?= $m['revenus'] ? e(number_format($m['revenus'] / 1000, 0, ',', ' ')) . ' k' : '0' ?></span>
                        <span class="colonne" style="height: <?= round($m['revenus'] * 75 / $maxRevenus) ?>%"></span>
                        <span><?= e($nomsMois[substr($cle, 5)]) ?></span>
                    </div>
                <?php endforeach; ?>
            </div>
            <table class="table table-sm mt-3 small">
                <thead><tr><th>Mois</th><th class="text-end">Revenus</th><th class="text-end">Inscriptions</th></tr></thead>
                <tbody>
                <?php foreach ($mois as $cle => $m): ?>
                    <tr><td><?= e($nomsMois[substr($cle, 5)] . ' ' . substr($cle, 0, 4)) ?></td><td class="text-end"><?= e(fcfa($m['revenus'])) ?></td><td class="text-end"><?= $m['inscriptions'] ?></td></tr>
                <?php endforeach; ?>
                </tbody>
            </table>
        </div>
    </div>
    <div class="col-lg-5">
        <div class="stat">
            <div class="d-flex justify-content-between align-items-center"><h2 class="h6 mb-0">Dernières inscriptions</h2><a class="small" href="<?= e(url('admin/candidats.php')) ?>">Tout voir</a></div>
            <ul class="list-unstyled mb-0 mt-2">
                <?php foreach ($recents as $r): ?>
                    <li class="border-top py-2 d-flex justify-content-between align-items-center gap-2">
                        <a class="text-decoration-none" href="<?= e(url('admin/candidat.php?id=' . $r['id'])) ?>"><strong><?= e($r['nom'] . ' ' . $r['prenoms']) ?></strong><br>
                            <span class="small text-secondary">Permis <?= e($r['code']) ?> · <?= e(date_fr($r['created_at'])) ?></span></a>
                        <?= badge(STATUTS_DOSSIER, $r['statut']) ?>
                    </li>
                <?php endforeach; ?>
            </ul>
        </div>
    </div>
</div>
<?php admin_pied(); ?>
