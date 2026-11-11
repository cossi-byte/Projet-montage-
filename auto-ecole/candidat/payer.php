<?php
require __DIR__ . '/_debut.php';
require_once RACINE . '/includes/fedapay.php';

if ($situation['payable'] <= 0) {
    flash('info', $situation['reste'] > 0
        ? 'Un paiement en espèces est déjà en attente pour le solde. Réglez-le à l\'agence ou annulez-le pour payer autrement.'
        : 'Votre formation est entièrement réglée.');
    rediriger('candidat/paiements.php');
}

$erreur = null;
$montant = $situation['suggere'];
$mode = 'mobile_money';
$operateur = 'mtn';

if (est_post()) {
    csrf_verifier();
    $brut = preg_replace('/\s+/u', '', champ('montant'));
    $mode = champ('mode');
    $operateur = champ('operateur');
    if (!ctype_digit($brut)) {
        $erreur = 'Saisissez un montant en chiffres, sans virgule.';
    } else {
        $montant = (int) $brut;
        try {
            header('Location: ' . initier_paiement($dossier, $montant, $mode, $operateur ?: null));
            exit;
        } catch (RuntimeException $ex) {
            $erreur = $ex->getMessage();
        }
    }
}

$titre = 'Payer une tranche';
require RACINE . '/includes/header.php';
?>
<section class="ae-section">
    <div class="container" style="max-width: 560px">
        <h1 class="h2">Payer une tranche</h1>
        <?= onglets_candidat('paiements') ?>
        <?= afficher_flash() ?>
        <?php if ($erreur): ?><div class="alert alert-danger" role="alert"><?= e($erreur) ?></div><?php endif; ?>
        <?php if (!fedapay_actif()): ?>
            <div class="alert alert-warning small">Mode démonstration : le paiement Mobile Money est simulé, aucun argent n'est débité.</div>
        <?php endif; ?>

        <form method="post" class="carte" novalidate>
            <?= csrf_champ() ?>
            <p>Reste à payer : <strong><?= e(fcfa($situation['reste'])) ?></strong>
                <?php if ($situation['attente']): ?><br><span class="small text-secondary">dont <?= e(fcfa($situation['attente'])) ?> en attente de règlement à l'agence</span><?php endif; ?></p>

            <div class="mb-3">
                <label class="form-label requis" for="montant">Montant à payer (FCFA)</label>
                <input class="form-control form-control-lg" id="montant" name="montant" type="number" inputmode="numeric" step="1"
                       min="<?= $situation['minimum'] ?>" max="<?= $situation['payable'] ?>" value="<?= (int) $montant ?>" required>
                <div class="form-text">Entre <?= e(fcfa($situation['minimum'])) ?> et <?= e(fcfa($situation['payable'])) ?>.</div>
                <div class="d-flex gap-2 mt-2 flex-wrap">
                    <?php if ($situation['suggere'] < $situation['payable']): ?>
                        <button class="btn btn-sm btn-outline-primary" type="button" data-montant="<?= $situation['suggere'] ?>">Une tranche : <?= e(fcfa($situation['suggere'])) ?></button>
                    <?php endif; ?>
                    <button class="btn btn-sm btn-outline-primary" type="button" data-montant="<?= $situation['payable'] ?>">Tout le solde : <?= e(fcfa($situation['payable'])) ?></button>
                </div>
            </div>

            <fieldset class="mb-3">
                <legend class="form-label fs-6 requis">Moyen de paiement</legend>
                <div class="d-grid gap-2">
                    <div class="choix">
                        <input type="radio" name="mode" id="mode-mm" value="mobile_money" <?= $mode !== 'especes' ? 'checked' : '' ?>>
                        <label for="mode-mm"><strong>Mobile Money</strong><br><span class="small text-secondary">MTN MoMo ou Moov Money</span></label>
                    </div>
                    <div id="bloc-operateur" class="ps-3">
                        <?php foreach (OPERATEURS as $cle => $l): ?>
                            <div class="form-check form-check-inline">
                                <input class="form-check-input" type="radio" name="operateur" id="op-<?= e($cle) ?>" value="<?= e($cle) ?>" <?= $operateur === $cle ? 'checked' : '' ?>>
                                <label class="form-check-label" for="op-<?= e($cle) ?>"><?= e($l) ?></label>
                            </div>
                        <?php endforeach; ?>
                    </div>
                    <div class="choix">
                        <input type="radio" name="mode" id="mode-esp" value="especes" <?= $mode === 'especes' ? 'checked' : '' ?>>
                        <label for="mode-esp"><strong>Espèces à l'agence</strong><br><span class="small text-secondary">Confirmé par notre équipe après règlement sur place</span></label>
                    </div>
                </div>
            </fieldset>

            <button class="btn btn-accent btn-lg w-100" type="submit">Continuer vers le paiement</button>
            <p class="small text-secondary text-center mt-3 mb-0"><?= icone('bouclier', 16) ?> Paiement sécurisé. Un reçu PDF est disponible après chaque paiement.</p>
        </form>
    </div>
</section>
<?php require RACINE . '/includes/footer.php'; ?>
