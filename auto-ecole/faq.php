<?php
require __DIR__ . '/includes/init.php';

$questions = q('SELECT * FROM faq WHERE actif = 1 ORDER BY ordre, id')->fetchAll();

$titre = 'Questions fréquentes';
$pageActive = 'faq';
require __DIR__ . '/includes/header.php';
?>
<section class="ae-section">
    <div class="container" style="max-width: 820px">
        <p class="ae-surtitre">FAQ</p>
        <h1>Questions fréquentes</h1>
        <p class="lead text-secondary">Les réponses aux questions que nos candidats posent le plus souvent.</p>

        <div class="accordion mt-3" id="faq">
            <?php foreach ($questions as $i => $f): ?>
                <div class="accordion-item">
                    <h2 class="accordion-header">
                        <button class="accordion-button<?= $i ? ' collapsed' : '' ?>" type="button" data-bs-toggle="collapse" data-bs-target="#faq-<?= (int) $f['id'] ?>" aria-expanded="<?= $i ? 'false' : 'true' ?>" aria-controls="faq-<?= (int) $f['id'] ?>">
                            <?= e($f['question']) ?>
                        </button>
                    </h2>
                    <div id="faq-<?= (int) $f['id'] ?>" class="accordion-collapse collapse<?= $i ? '' : ' show' ?>" data-bs-parent="#faq">
                        <div class="accordion-body"><?= nl2br(e($f['reponse'])) ?></div>
                    </div>
                </div>
            <?php endforeach; ?>
        </div>

        <div class="carte mt-4 text-center">
            <p class="h5">Vous n'avez pas trouvé votre réponse ?</p>
            <div class="d-grid d-sm-flex justify-content-center gap-2">
                <a class="btn btn-whatsapp" rel="noopener" href="<?= e(lien_whatsapp(APP_WHATSAPP, 'Bonjour, j\'ai une question sur le permis de conduire.')) ?>"><?= icone('whatsapp') ?> Demander sur WhatsApp</a>
                <a class="btn btn-outline-primary" href="<?= e(url('contact.php')) ?>">Nous écrire</a>
            </div>
        </div>
    </div>
</section>
<?php require __DIR__ . '/includes/footer.php'; ?>
