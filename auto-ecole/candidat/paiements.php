<?php
require __DIR__ . '/_debut.php';

// Annulation d'une promesse de paiement en espèces non encore réglée
if (est_post()) {
    csrf_verifier();
    $n = q("UPDATE paiements SET statut = 'annule' WHERE id = ? AND inscription_id = ? AND statut = 'en_attente'",
           [(int) ($_POST['paiement_id'] ?? 0), $dossier['id']])->rowCount();
    flash($n ? 'success' : 'danger', $n ? 'Paiement en attente annulé.' : 'Ce paiement ne peut plus être annulé.');
    rediriger('candidat/paiements.php');
}

$paiements = q("SELECT * FROM paiements WHERE inscription_id = ? AND NOT (mode = 'mobile_money' AND statut = 'annule') ORDER BY id DESC",
               [$dossier['id']])->fetchAll();

$titre = 'Mes paiements';
require RACINE . '/includes/header.php';
?>
<section class="ae-section">
    <div class="container" style="max-width: 900px">
        <h1 class="h2">Mes paiements</h1>
        <?= onglets_candidat('paiements') ?>
        <?= afficher_flash() ?>

        <div class="row g-3 mb-3">
            <div class="col-4"><div class="stat"><div class="libelle">Total</div><div class="valeur fs-5"><?= e(fcfa($situation['total'])) ?></div></div></div>
            <div class="col-4"><div class="stat"><div class="libelle">Payé</div><div class="valeur fs-5 text-success"><?= e(fcfa($situation['paye'])) ?></div></div></div>
            <div class="col-4"><div class="stat"><div class="libelle">Reste</div><div class="valeur fs-5 <?= $situation['reste'] ? 'text-danger' : '' ?>"><?= e(fcfa($situation['reste'])) ?></div></div></div>
        </div>
        <div class="progress mb-3" role="progressbar" aria-label="Part payée" aria-valuenow="<?= $situation['pourcent'] ?>" aria-valuemin="0" aria-valuemax="100">
            <div class="progress-bar" style="width: <?= $situation['pourcent'] ?>%"></div>
        </div>

        <?php if ($situation['payable'] > 0): ?>
            <a class="btn btn-accent btn-lg w-100 mb-4" href="<?= e(url('candidat/payer.php')) ?>">Payer une tranche</a>
        <?php elseif ($situation['reste'] === 0): ?>
            <div class="alert alert-success"><?= icone('check', 18) ?> Votre formation est entièrement réglée. Merci !</div>
        <?php endif; ?>

        <h2 class="h5">Historique</h2>
        <?php if (!$paiements): ?>
            <p class="text-secondary">Aucun paiement enregistré pour le moment.</p>
        <?php endif; ?>
        <?php foreach ($paiements as $p): ?>
            <div class="carte mb-2" style="height:auto">
                <div class="d-flex justify-content-between align-items-start gap-2">
                    <div>
                        <strong class="fs-5"><?= e(fcfa($p['montant'])) ?></strong> <?= badge(STATUTS_PAIEMENT, $p['statut']) ?><br>
                        <span class="small text-secondary">
                            <?= e(MODES_PAIEMENT[$p['mode']]) ?><?= $p['operateur'] ? ' · ' . e(OPERATEURS[$p['operateur']] ?? $p['operateur']) : '' ?>
                            · <?= e(date_fr($p['date_paiement'] ?: $p['created_at'], true)) ?><br>Réf. <?= e($p['reference']) ?>
                        </span>
                    </div>
                    <div class="text-end">
                        <?php if ($p['statut'] === 'confirme'): ?>
                            <a class="btn btn-sm btn-outline-primary" href="<?= e(url('candidat/recu.php?id=' . $p['id'])) ?>"><?= icone('telecharger', 16) ?> Reçu PDF</a>
                        <?php elseif ($p['statut'] === 'en_attente' && $p['mode'] === 'especes'): ?>
                            <form method="post">
                                <?= csrf_champ() ?>
                                <input type="hidden" name="paiement_id" value="<?= (int) $p['id'] ?>">
                                <button class="btn btn-sm btn-outline-danger" type="submit" data-confirmer="Annuler ce paiement en attente ?">Annuler</button>
                            </form>
                        <?php endif; ?>
                    </div>
                </div>
                <?php if ($p['statut'] === 'en_attente' && $p['mode'] === 'especes'): ?>
                    <p class="small mb-0 mt-2">À régler à l'agence (<?= e(APP_ADRESSE) ?>) en donnant la référence ci-dessus.</p>
                <?php endif; ?>
            </div>
        <?php endforeach; ?>
    </div>
</section>
<?php require RACINE . '/includes/footer.php'; ?>
