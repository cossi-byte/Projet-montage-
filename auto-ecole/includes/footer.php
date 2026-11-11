<?php $u = utilisateur(); ?>
</main>

<footer class="ae-footer mt-5">
    <div class="container py-4">
        <div class="row g-4">
            <div class="col-md-5">
                <p class="h5 text-white"><?= e(APP_NOM) ?></p>
                <p class="mb-2"><?= e(APP_SLOGAN) ?>.</p>
                <p class="mb-0"><?= icone('lieu', 16) ?> <?= e(APP_ADRESSE) ?>, <?= e(APP_PAYS) ?></p>
            </div>
            <div class="col-6 col-md-3">
                <p class="h6 text-white">Liens utiles</p>
                <ul class="list-unstyled mb-0">
                    <li><a href="<?= e(url('formations.php')) ?>">Formations et tarifs</a></li>
                    <li><a href="<?= e(url('inscription.php')) ?>">Inscription en ligne</a></li>
                    <li><a href="<?= e(url('faq.php')) ?>">Questions fréquentes</a></li>
                    <li><a href="<?= e(url('connexion.php')) ?>">Espace candidat</a></li>
                </ul>
            </div>
            <div class="col-6 col-md-4">
                <p class="h6 text-white">Nous joindre</p>
                <ul class="list-unstyled mb-0">
                    <li><a href="tel:+<?= e(APP_WHATSAPP) ?>"><?= icone('tel', 16) ?> <?= e(APP_TELEPHONE) ?></a></li>
                    <li><a href="<?= e(lien_whatsapp(APP_WHATSAPP, 'Bonjour, je souhaite des informations sur le permis de conduire.')) ?>" rel="noopener"><?= icone('whatsapp', 16) ?> WhatsApp</a></li>
                    <li><a href="mailto:<?= e(APP_EMAIL) ?>"><?= icone('mail', 16) ?> <?= e(APP_EMAIL) ?></a></li>
                </ul>
            </div>
        </div>
        <hr>
        <p class="small mb-0 text-center">© <?= date('Y') ?> <?= e(APP_NOM) ?>, <?= e(APP_VILLE) ?>. Tous droits réservés.</p>
    </div>
</footer>

<?php if (empty($masquerCta) && !$u): ?>
<div class="ae-cta-mobile d-lg-none">
    <a class="btn btn-accent btn-lg w-100" href="<?= e(url('inscription.php')) ?>">S'inscrire au permis <?= icone('fleche', 18) ?></a>
</div>
<?php endif; ?>

<script src="<?= e(url('assets/js/bootstrap.bundle.min.js')) ?>" defer></script>
<script src="<?= e(url('assets/js/app.js')) ?>" defer></script>
</body>
</html>
