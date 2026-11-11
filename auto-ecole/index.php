<?php
require __DIR__ . '/includes/init.php';

$categories  = categories();
$temoignages = q('SELECT * FROM temoignages WHERE actif = 1 ORDER BY id LIMIT 4')->fetchAll();
$prixMin     = $categories ? min(array_column($categories, 'prix_code')) : 0;

$titre = 'Permis de conduire à ' . APP_VILLE;
$pageActive = 'accueil';
require __DIR__ . '/includes/header.php';
?>
<section class="ae-hero">
    <div class="container">
        <div class="row align-items-center g-4">
            <div class="col-lg-7">
                <h1>Passez votre permis de conduire à <?= e(APP_VILLE) ?>, en toute confiance</h1>
                <p class="lead mt-3">Inscrivez-vous en ligne en 10 minutes depuis votre téléphone, payez par Mobile Money et suivez votre dossier pas à pas.</p>
                <div class="d-grid d-sm-flex gap-2 mt-4">
                    <a class="btn btn-accent btn-lg" href="<?= e(url('inscription.php')) ?>">S'inscrire maintenant <?= icone('fleche', 18) ?></a>
                    <a class="btn btn-outline-light btn-lg" href="<?= e(url('formations.php')) ?>">Voir les tarifs</a>
                </div>
                <ul class="ae-hero-points">
                    <li><?= icone('check', 18) ?>Moniteurs agréés et véhicules récents</li>
                    <li><?= icone('check', 18) ?>Paiement en 1, 2 ou 3 tranches</li>
                    <li><?= icone('check', 18) ?>MTN MoMo, Moov Money ou espèces à l'agence</li>
                </ul>
            </div>
            <div class="col-lg-5">
                <div class="ae-hero-carte">
                    <p class="h5 mb-3">Une question ? Parlez-nous directement</p>
                    <div class="d-grid gap-2">
                        <a class="btn btn-whatsapp btn-lg" rel="noopener" href="<?= e(lien_whatsapp(APP_WHATSAPP, 'Bonjour, je souhaite m\'inscrire au permis de conduire.')) ?>"><?= icone('whatsapp') ?> Écrire sur WhatsApp</a>
                        <a class="btn btn-outline-primary btn-lg" href="tel:+<?= e(APP_WHATSAPP) ?>"><?= icone('tel') ?> <?= e(APP_TELEPHONE) ?></a>
                    </div>
                    <p class="small text-secondary mt-3 mb-0"><?= icone('lieu', 16) ?> <?= e(APP_ADRESSE) ?></p>
                </div>
            </div>
        </div>
    </div>
</section>

<section class="ae-section">
    <div class="container">
        <p class="ae-surtitre">Nos formations</p>
        <h2>Choisissez votre catégorie de permis</h2>
        <p class="text-secondary">Tarifs tout compris en francs CFA, à partir de <?= e(fcfa($prixMin)) ?>.</p>
        <div class="row g-3 mt-1">
            <?php foreach ($categories as $c): ?>
                <div class="col-md-6 col-lg-4">
                    <div class="carte carte-permis">
                        <div class="d-flex align-items-center gap-3 mb-2">
                            <span class="pastille-permis"><?= e($c['code']) ?></span>
                            <h3 class="h5 mb-0"><?= e($c['libelle']) ?></h3>
                        </div>
                        <p class="text-secondary flex-grow-1"><?= e($c['description']) ?></p>
                        <div class="d-flex justify-content-between align-items-end gap-2">
                            <div class="prix"><small>Formule complète</small><br><?= e(fcfa($c['prix_complet'])) ?></div>
                            <a class="btn btn-outline-primary btn-sm" href="<?= e(url('formations.php#permis-' . $c['code'])) ?>">Détails</a>
                        </div>
                    </div>
                </div>
            <?php endforeach; ?>
        </div>
    </div>
</section>

<section class="ae-section ae-section-blanche">
    <div class="container">
        <p class="ae-surtitre">Comment ça marche</p>
        <h2>Votre permis en 5 étapes</h2>
        <div class="row g-3 mt-1">
            <?php
            $etapes = [
                ['Inscription en ligne', 'Remplissez le formulaire et envoyez vos pièces en photo depuis votre téléphone.'],
                ['Validation du dossier', 'Notre équipe vérifie vos pièces sous 48 heures et vous prévient.'],
                ['Cours de code', 'Réservez vos séances de code de la route aux horaires qui vous arrangent.'],
                ['Leçons de conduite', 'Apprenez à conduire avec un moniteur agréé, à votre rythme.'],
                ['Examen et permis', 'Nous vous présentons à l\'examen officiel. Félicitations, vous êtes admis !'],
            ];
            foreach ($etapes as $i => [$t, $d]): ?>
                <div class="col-md-6 col-lg">
                    <div class="d-flex d-lg-block gap-3">
                        <span class="etape-num mb-lg-2"><?= $i + 1 ?></span>
                        <div>
                            <h3 class="h6 mb-1"><?= e($t) ?></h3>
                            <p class="text-secondary mb-0 small"><?= e($d) ?></p>
                        </div>
                    </div>
                </div>
            <?php endforeach; ?>
        </div>
    </div>
</section>

<?php if ($temoignages): ?>
<section class="ae-section">
    <div class="container">
        <p class="ae-surtitre">Ils ont réussi avec nous</p>
        <h2>Témoignages de nos candidats</h2>
        <div class="row g-3 mt-1">
            <?php foreach ($temoignages as $t): ?>
                <div class="col-md-6">
                    <figure class="carte mb-0">
                        <div class="etoiles" aria-label="Note : <?= (int) $t['note'] ?> sur 5"><?= str_repeat('★', (int) $t['note']) . str_repeat('☆', 5 - (int) $t['note']) ?></div>
                        <blockquote class="mt-2 mb-2"><p class="mb-0">« <?= e($t['message']) ?> »</p></blockquote>
                        <figcaption class="fw-semibold"><?= e($t['nom']) ?> <span class="text-secondary fw-normal">· <?= e($t['permis']) ?></span></figcaption>
                    </figure>
                </div>
            <?php endforeach; ?>
        </div>
    </div>
</section>
<?php endif; ?>

<section class="container">
    <div class="ae-bandeau d-lg-flex align-items-center justify-content-between gap-3">
        <div>
            <h2 class="h3 mb-1">Prêt à prendre le volant ?</h2>
            <p class="mb-3 mb-lg-0">L'inscription prend moins de 10 minutes. Préparez votre pièce d'identité, une photo et votre certificat médical.</p>
        </div>
        <a class="btn btn-accent btn-lg flex-shrink-0" href="<?= e(url('inscription.php')) ?>">Commencer mon inscription</a>
    </div>
</section>
<?php require __DIR__ . '/includes/footer.php'; ?>
