<?php
require __DIR__ . '/includes/init.php';

$categories = categories();

$titre = 'Formations et tarifs';
$description = 'Permis A, B, C, D et E à ' . APP_VILLE . ' : durée, tarifs en FCFA et pièces à fournir pour chaque catégorie.';
$pageActive = 'formations';
require __DIR__ . '/includes/header.php';
?>
<section class="ae-section">
    <div class="container">
        <p class="ae-surtitre">Formations</p>
        <h1>Nos formations et nos tarifs</h1>
        <p class="lead text-secondary">Trois formules pour chaque permis : code seul, conduite seule, ou formule complète. Paiement possible en 1, 2 ou 3 tranches.</p>

        <nav class="d-flex flex-wrap gap-2 my-3" aria-label="Catégories de permis">
            <?php foreach ($categories as $c): ?>
                <a class="btn btn-outline-primary btn-sm" href="#permis-<?= e($c['code']) ?>">Permis <?= e($c['code']) ?></a>
            <?php endforeach; ?>
        </nav>

        <?php foreach ($categories as $c): ?>
            <article class="carte mb-3" id="permis-<?= e($c['code']) ?>" style="scroll-margin-top:5rem">
                <div class="d-flex align-items-center gap-3 mb-2">
                    <span class="pastille-permis"><?= e($c['code']) ?></span>
                    <div>
                        <h2 class="h4 mb-0"><?= e($c['libelle']) ?></h2>
                        <span class="text-secondary small">À partir de <?= (int) $c['age_minimum'] ?> ans</span>
                    </div>
                </div>
                <p><?= e($c['description']) ?></p>

                <div class="row g-3">
                    <div class="col-lg-4">
                        <h3 class="h6">Durée de la formation</h3>
                        <ul class="list-unstyled mb-0">
                            <li><?= icone('horloge', 16) ?> Environ <strong><?= (int) $c['duree_semaines'] ?> semaines</strong></li>
                            <li><?= icone('fichier', 16) ?> <?= (int) $c['heures_code'] ?> h de code de la route</li>
                            <li><?= icone('voiture', 16) ?> <?= (int) $c['heures_conduite'] ?> h de conduite</li>
                        </ul>
                    </div>
                    <div class="col-lg-4">
                        <h3 class="h6">Tarifs</h3>
                        <table class="table table-sm mb-0">
                            <tbody>
                            <?php foreach (FORMULES as $cle => $libelle): ?>
                                <tr>
                                    <td class="ps-0"><?= e($libelle) ?></td>
                                    <td class="text-end fw-bold text-nowrap pe-0"><?= e(fcfa(prix_formule($c, $cle))) ?></td>
                                </tr>
                            <?php endforeach; ?>
                            </tbody>
                        </table>
                    </div>
                    <div class="col-lg-4">
                        <h3 class="h6">Pièces à fournir</h3>
                        <ul class="mb-0 ps-3">
                            <?php foreach (array_filter(array_map('trim', explode("\n", $c['pieces']))) as $piece): ?>
                                <li><?= e($piece) ?></li>
                            <?php endforeach; ?>
                        </ul>
                    </div>
                </div>
                <div class="mt-3">
                    <a class="btn btn-accent" href="<?= e(url('inscription.php?permis=' . $c['id'])) ?>">S'inscrire au permis <?= e($c['code']) ?></a>
                </div>
            </article>
        <?php endforeach; ?>

        <div class="alert alert-info mt-4 mb-0">
            <strong>Bon à savoir :</strong> les frais d'examen officiels (ANaTT) ne sont pas compris dans ces tarifs.
            Une question ? <a href="<?= e(url('contact.php')) ?>">Contactez-nous</a> ou consultez la <a href="<?= e(url('faq.php')) ?>">FAQ</a>.
        </div>
    </div>
</section>
<?php require __DIR__ . '/includes/footer.php'; ?>
