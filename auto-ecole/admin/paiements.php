<?php
require __DIR__ . '/_debut.php';

if (est_post()) {
    csrf_verifier();
    $p = q("SELECT * FROM paiements WHERE id = ? AND statut = 'en_attente'", [(int) ($_POST['paiement_id'] ?? 0)])->fetch();
    if ($p && champ('action') === 'confirmer' && confirmer_paiement((int) $p['id'], (int) $u['id'])) {
        flash('success', 'Paiement ' . $p['reference'] . ' de ' . fcfa($p['montant']) . ' confirmé. Le candidat a été notifié.');
    } elseif ($p && champ('action') === 'annuler') {
        q("UPDATE paiements SET statut = 'annule' WHERE id = ?", [$p['id']]);
        flash('success', 'Paiement ' . $p['reference'] . ' annulé.');
    } else {
        flash('danger', 'Action impossible sur ce paiement.');
    }
    rediriger('admin/paiements.php?' . http_build_query(['statut' => $_GET['statut'] ?? '']));
}

$statut = isset(STATUTS_PAIEMENT[$_GET['statut'] ?? '']) ? $_GET['statut'] : '';
$mode = isset(MODES_PAIEMENT[$_GET['mode'] ?? '']) ? $_GET['mode'] : '';
$where = ["NOT (p.mode = 'mobile_money' AND p.statut = 'annule')"];
$params = [];
if ($statut) { $where[] = 'p.statut = ?'; $params[] = $statut; }
if ($mode)   { $where[] = 'p.mode = ?';   $params[] = $mode; }

$paiements = q("SELECT p.*, i.numero_dossier, i.id AS inscription_id, u.nom, u.prenoms
                FROM paiements p JOIN inscriptions i ON i.id = p.inscription_id JOIN utilisateurs u ON u.id = i.utilisateur_id
                WHERE " . implode(' AND ', $where) . ' ORDER BY p.id DESC LIMIT 200', $params)->fetchAll();
$total = array_sum(array_map(fn($p) => $p['statut'] === 'confirme' ? (int) $p['montant'] : 0, $paiements));

admin_entete('Paiements', 'paiements');
?>
<form method="get" class="carte mb-3" style="height:auto">
    <div class="row g-2 align-items-end">
        <div class="col-6 col-md-3">
            <label class="form-label" for="statut">Statut</label>
            <select class="form-select" id="statut" name="statut">
                <option value="">Tous</option>
                <?php foreach (STATUTS_PAIEMENT as $cle => [$l]): ?><option value="<?= e($cle) ?>" <?= $statut === $cle ? 'selected' : '' ?>><?= e($l) ?></option><?php endforeach; ?>
            </select>
        </div>
        <div class="col-6 col-md-3">
            <label class="form-label" for="mode">Mode</label>
            <select class="form-select" id="mode" name="mode">
                <option value="">Tous</option>
                <?php foreach (MODES_PAIEMENT as $cle => $l): ?><option value="<?= e($cle) ?>" <?= $mode === $cle ? 'selected' : '' ?>><?= e($l) ?></option><?php endforeach; ?>
            </select>
        </div>
        <div class="col-md-2 d-grid"><button class="btn btn-primary" type="submit" data-libre>Filtrer</button></div>
        <div class="col-md-4 text-md-end">Confirmés affichés : <strong><?= e(fcfa($total)) ?></strong></div>
    </div>
</form>

<div class="table-responsive">
    <table class="table table-hover">
        <thead><tr><th>Date</th><th>Candidat</th><th>Référence</th><th>Mode</th><th class="text-end">Montant</th><th>Statut</th><th></th></tr></thead>
        <tbody>
        <?php if (!$paiements): ?><tr><td colspan="7" class="text-center text-secondary py-4">Aucun paiement.</td></tr><?php endif; ?>
        <?php foreach ($paiements as $p): ?>
            <tr>
                <td class="text-nowrap"><?= e(date_fr($p['date_paiement'] ?: $p['created_at'], true)) ?></td>
                <td><a class="text-decoration-none fw-semibold" href="<?= e(url('admin/candidat.php?id=' . $p['inscription_id'])) ?>"><?= e($p['nom'] . ' ' . $p['prenoms']) ?></a><br><span class="small text-secondary"><?= e($p['numero_dossier']) ?></span></td>
                <td class="text-nowrap small"><?= e($p['reference']) ?></td>
                <td class="text-nowrap"><?= e(MODES_PAIEMENT[$p['mode']]) ?><?= $p['operateur'] ? '<br><span class="small text-secondary">' . e(OPERATEURS[$p['operateur']] ?? $p['operateur']) . '</span>' : '' ?></td>
                <td class="text-end fw-bold text-nowrap"><?= e(fcfa($p['montant'])) ?></td>
                <td><?= badge(STATUTS_PAIEMENT, $p['statut']) ?></td>
                <td class="text-nowrap">
                    <?php if ($p['statut'] === 'confirme'): ?>
                        <a class="btn btn-sm btn-outline-primary" href="<?= e(url('candidat/recu.php?id=' . $p['id'])) ?>">Reçu</a>
                    <?php elseif ($p['statut'] === 'en_attente'): ?>
                        <form method="post" class="d-inline"><?= csrf_champ() ?><input type="hidden" name="paiement_id" value="<?= (int) $p['id'] ?>">
                            <button class="btn btn-sm btn-success" type="submit" name="action" value="confirmer" data-libre data-confirmer="Confirmer la réception de <?= e(fcfa($p['montant'])) ?> ?">Confirmer</button>
                            <button class="btn btn-sm btn-outline-danger" type="submit" name="action" value="annuler" data-libre data-confirmer="Annuler ce paiement en attente ?">Annuler</button>
                        </form>
                    <?php endif; ?>
                </td>
            </tr>
        <?php endforeach; ?>
        </tbody>
    </table>
</div>
<?php admin_pied(); ?>
