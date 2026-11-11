<?php
require __DIR__ . '/includes/init.php';

$erreurs = [];
$v = ['nom' => '', 'telephone' => '', 'email' => '', 'sujet' => '', 'message' => ''];

if (est_post()) {
    csrf_verifier();
    foreach ($v as $k => $_) {
        $v[$k] = champ($k);
    }
    $tel = normaliser_telephone($v['telephone']);

    if (champ('site_web') !== '') {                                 // champ piège anti-robots
        rediriger('contact.php');
    }
    if (mb_strlen($v['nom']) < 2 || mb_strlen($v['nom']) > 120) {
        $erreurs[] = 'Indiquez votre nom (2 à 120 caractères).';
    }
    if ($tel === null) {
        $erreurs[] = 'Numéro de téléphone invalide. Exemple : 01 97 00 00 00.';
    }
    if ($v['email'] !== '' && !email_valide($v['email'])) {
        $erreurs[] = 'Adresse e-mail invalide.';
    }
    if (mb_strlen($v['sujet']) < 3 || mb_strlen($v['sujet']) > 150) {
        $erreurs[] = 'Indiquez le sujet de votre message (3 à 150 caractères).';
    }
    if (mb_strlen($v['message']) < 10 || mb_strlen($v['message']) > 3000) {
        $erreurs[] = 'Votre message doit contenir entre 10 et 3000 caractères.';
    }
    if (!$erreurs && time() - ($_SESSION['dernier_contact'] ?? 0) < 60) {
        $erreurs[] = 'Vous venez d\'envoyer un message. Patientez une minute avant d\'en envoyer un autre.';
    }

    if (!$erreurs) {
        q('INSERT INTO messages_contact (nom, telephone, email, sujet, message) VALUES (?, ?, ?, ?, ?)',
          [$v['nom'], $tel, $v['email'] ?: null, $v['sujet'], $v['message']]);
        envoyer_email(APP_EMAIL, '[Site] ' . $v['sujet'],
            "Message de {$v['nom']} — tél. $tel" . ($v['email'] ? " — {$v['email']}" : '') . "\n\n{$v['message']}",
            $v['email'] ?: null);
        $_SESSION['dernier_contact'] = time();
        flash('success', 'Merci ! Votre message a bien été envoyé. Nous vous répondrons très vite.');
        rediriger('contact.php');
    }
}

$bbox = sprintf('%F,%F,%F,%F', APP_LONGITUDE - 0.008, APP_LATITUDE - 0.005, APP_LONGITUDE + 0.008, APP_LATITUDE + 0.005);
$carte = 'https://www.openstreetmap.org/export/embed.html?bbox=' . rawurlencode($bbox) . '&layer=mapnik&marker=' . APP_LATITUDE . ',' . APP_LONGITUDE;
$itineraire = 'https://www.google.com/maps/dir/?api=1&destination=' . APP_LATITUDE . ',' . APP_LONGITUDE;

$titre = 'Contact';
$pageActive = 'contact';
require __DIR__ . '/includes/header.php';
?>
<section class="ae-section">
    <div class="container">
        <p class="ae-surtitre">Contact</p>
        <h1>Contactez-nous</h1>
        <p class="lead text-secondary">Le plus rapide : WhatsApp. Sinon, laissez-nous un message, nous vous rappelons.</p>
        <?= afficher_flash() ?>

        <div class="row g-4">
            <div class="col-lg-6">
                <div class="carte">
                    <a class="btn btn-whatsapp btn-lg w-100 mb-3" rel="noopener" href="<?= e(lien_whatsapp(APP_WHATSAPP, 'Bonjour, je souhaite des informations sur le permis de conduire.')) ?>"><?= icone('whatsapp') ?> Discuter sur WhatsApp</a>
                    <h2 class="h5">Ou écrivez-nous</h2>
                    <?= afficher_erreurs($erreurs) ?>
                    <form method="post" novalidate>
                        <?= csrf_champ() ?>
                        <div class="visually-hidden" aria-hidden="true">
                            <label>Ne pas remplir <input type="text" name="site_web" tabindex="-1" autocomplete="off"></label>
                        </div>
                        <div class="mb-3">
                            <label class="form-label requis" for="nom">Nom et prénoms</label>
                            <input class="form-control" id="nom" name="nom" value="<?= e($v['nom']) ?>" required maxlength="120" autocomplete="name">
                        </div>
                        <div class="mb-3">
                            <label class="form-label requis" for="telephone">Téléphone</label>
                            <input class="form-control" id="telephone" name="telephone" type="tel" inputmode="tel" value="<?= e($v['telephone']) ?>" required placeholder="01 97 00 00 00" autocomplete="tel">
                        </div>
                        <div class="mb-3">
                            <label class="form-label" for="email">E-mail <span class="fw-normal text-secondary">(facultatif)</span></label>
                            <input class="form-control" id="email" name="email" type="email" value="<?= e($v['email']) ?>" maxlength="150" autocomplete="email">
                        </div>
                        <div class="mb-3">
                            <label class="form-label requis" for="sujet">Sujet</label>
                            <input class="form-control" id="sujet" name="sujet" value="<?= e($v['sujet']) ?>" required maxlength="150">
                        </div>
                        <div class="mb-3">
                            <label class="form-label requis" for="message">Message</label>
                            <textarea class="form-control" id="message" name="message" rows="4" required maxlength="3000"><?= e($v['message']) ?></textarea>
                        </div>
                        <button class="btn btn-primary btn-lg w-100" type="submit">Envoyer le message</button>
                    </form>
                </div>
            </div>

            <div class="col-lg-6">
                <div class="carte mb-3" style="height:auto">
                    <h2 class="h5">Coordonnées</h2>
                    <ul class="list-unstyled mb-0 d-grid gap-2">
                        <li><?= icone('lieu', 18) ?> <?= e(APP_ADRESSE) ?>, <?= e(APP_PAYS) ?></li>
                        <li><?= icone('tel', 18) ?> <a href="tel:+<?= e(APP_WHATSAPP) ?>"><?= e(APP_TELEPHONE) ?></a></li>
                        <li><?= icone('mail', 18) ?> <a href="mailto:<?= e(APP_EMAIL) ?>"><?= e(APP_EMAIL) ?></a></li>
                    </ul>
                </div>
                <div class="carte mb-3" style="height:auto">
                    <h2 class="h5"><?= icone('horloge', 18) ?> Horaires d'ouverture</h2>
                    <table class="table table-sm mb-0">
                        <tbody>
                        <?php foreach (APP_HORAIRES as $jour => $heures): ?>
                            <tr><td class="ps-0"><?= e($jour) ?></td><td class="text-end fw-semibold pe-0"><?= e($heures) ?></td></tr>
                        <?php endforeach; ?>
                        </tbody>
                    </table>
                </div>
                <div id="zone-carte" data-src="<?= e($carte) ?>">
                    <div class="carte-placeholder">
                        <?= icone('lieu', 36) ?>
                        <strong><?= e(APP_ADRESSE) ?></strong>
                        <div class="d-grid d-sm-flex gap-2">
                            <button class="btn btn-primary" type="button" id="charger-carte">Afficher la carte</button>
                            <a class="btn btn-outline-primary" rel="noopener" href="<?= e($itineraire) ?>">Itinéraire</a>
                        </div>
                        <span class="small text-secondary">La carte n'est chargée que si vous le demandez, pour économiser vos données.</span>
                    </div>
                </div>
            </div>
        </div>
    </div>
</section>
<?php require __DIR__ . '/includes/footer.php'; ?>
