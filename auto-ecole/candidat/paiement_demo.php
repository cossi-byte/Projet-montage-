<?php
/**
 * Simulation de paiement Mobile Money — MODE DÉMONSTRATION uniquement.
 * Cette page est inaccessible dès qu'une clé FedaPay est renseignée dans config/config.php.
 */
require __DIR__ . '/_debut.php';
require_once RACINE . '/includes/fedapay.php';

if (fedapay_actif()) {
    http_response_code(404);
    exit('Page indisponible.');
}

$p = q("SELECT * FROM paiements WHERE reference = ? AND inscription_id = ? AND mode = 'mobile_money' AND statut = 'en_attente'",
       [(string) ($_REQUEST['ref'] ?? ''), $dossier['id']])->fetch();
if (!$p) {
    flash('danger', 'Paiement introuvable ou déjà traité.');
    rediriger('candidat/paiements.php');
}

if (est_post()) {
    csrf_verifier();
    if (champ('resultat') === 'succes') {
        q('UPDATE paiements SET transaction_id = ? WHERE id = ?', ['DEMO-' . strtoupper(bin2hex(random_bytes(4))), $p['id']]);
        confirmer_paiement((int) $p['id']);
        flash('success', 'Paiement de ' . fcfa($p['montant']) . ' confirmé (simulation). Votre reçu est disponible ci-dessous.');
    } else {
        q("UPDATE paiements SET statut = 'echoue' WHERE id = ?", [$p['id']]);
        flash('danger', 'Paiement refusé (simulation). Aucun montant n\'a été enregistré.');
    }
    rediriger('candidat/paiements.php');
}

$titre = 'Paiement Mobile Money (démonstration)';
require RACINE . '/includes/header.php';
?>
<section class="ae-section">
    <div class="container" style="max-width: 480px">
        <div class="alert alert-warning"><strong>Mode démonstration.</strong> Aucune clé FedaPay n'est configurée : cette page remplace l'écran de paiement réel. Aucun argent n'est débité.</div>
        <div class="carte text-center">
            <p class="text-secondary mb-1"><?= e(OPERATEURS[$p['operateur']] ?? 'Mobile Money') ?> · <?= e(telephone_affiche($u['telephone'])) ?></p>
            <p class="prix fs-2 mb-1"><?= e(fcfa($p['montant'])) ?></p>
            <p class="small text-secondary">Référence <?= e($p['reference']) ?> · Dossier <?= e($dossier['numero_dossier']) ?></p>
            <form method="post" class="d-grid gap-2">
                <?= csrf_champ() ?>
                <input type="hidden" name="ref" value="<?= e($p['reference']) ?>">
                <button class="btn btn-primary btn-lg" type="submit" name="resultat" value="succes" data-libre>Simuler un paiement réussi</button>
                <button class="btn btn-outline-danger" type="submit" name="resultat" value="echec" data-libre>Simuler un échec</button>
            </form>
        </div>
    </div>
</section>
<?php require RACINE . '/includes/footer.php'; ?>
