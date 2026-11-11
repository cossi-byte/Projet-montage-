<?php
require __DIR__ . '/_debut.php';

// ---------- Renvoi d'une pièce refusée (ou manquante) ----------
if (est_post()) {
    csrf_verifier();
    $type = champ('type');
    if (!isset(TYPES_DOCUMENT[$type])) {
        flash('danger', 'Type de document inconnu.');
        rediriger('candidat/index.php');
    }
    $existant = q('SELECT * FROM documents WHERE inscription_id = ? AND type = ?', [$dossier['id'], $type])->fetch();
    if ($existant && $existant['statut'] === 'valide') {
        flash('info', 'Ce document est déjà validé, il n\'est plus modifiable.');
        rediriger('candidat/index.php');
    }
    try {
        $m = enregistrer_upload($_FILES['fichier'] ?? [], TYPES_DOCUMENT[$type]);
        if ($existant) {
            q("UPDATE documents SET fichier = ?, nom_original = ?, mime = ?, taille = ?, statut = 'en_attente', motif_rejet = NULL, created_at = NOW() WHERE id = ?",
              [$m['fichier'], $m['nom_original'], $m['mime'], $m['taille'], $existant['id']]);
            supprimer_upload($existant['fichier']);
        } else {
            q('INSERT INTO documents (inscription_id, type, fichier, nom_original, mime, taille) VALUES (?, ?, ?, ?, ?, ?)',
              [$dossier['id'], $type, $m['fichier'], $m['nom_original'], $m['mime'], $m['taille']]);
        }
        flash('success', TYPES_DOCUMENT[$type] . ' : document bien reçu. Il sera vérifié par notre équipe.');
    } catch (RuntimeException $ex) {
        flash('danger', $ex->getMessage());
    }
    rediriger('candidat/index.php');
}

$documents = [];
foreach (q('SELECT * FROM documents WHERE inscription_id = ?', [$dossier['id']]) as $d) {
    $documents[$d['type']] = $d;
}
$prochains = q("SELECT c.*, u.nom AS moniteur_nom, u.prenoms AS moniteur_prenoms
                FROM reservations r
                JOIN creneaux c ON c.id = r.creneau_id
                JOIN moniteurs m ON m.id = c.moniteur_id JOIN utilisateurs u ON u.id = m.utilisateur_id
                WHERE r.inscription_id = ? AND r.statut = 'reservee' AND TIMESTAMP(c.date_creneau, c.heure_fin) >= NOW()
                ORDER BY c.date_creneau, c.heure_debut LIMIT 3", [$dossier['id']])->fetchAll();
$notifications = q('SELECT * FROM notifications WHERE utilisateur_id = ? ORDER BY id DESC LIMIT 5', [$u['id']])->fetchAll();

$statut = $dossier['statut'];
$indexEtape = array_search($statut, ETAPES_DOSSIER, true);
if ($statut === 'ajourne') {
    $indexEtape = 3;    // revenu au stade « examen »
}
$messages = [
    'en_attente'   => 'Votre dossier est en cours de vérification. Nous vous prévenons sous 48 heures ouvrées.',
    'valide'       => 'Votre dossier est validé ! Vous pouvez maintenant réserver vos premiers cours dans l\'onglet Planning.',
    'en_formation' => 'Vous êtes en formation. Réservez régulièrement vos séances pour progresser vite.',
    'examen'       => 'Vous êtes prêt(e) pour l\'examen. L\'agence vous communiquera la date de votre convocation.',
    'admis'        => 'Félicitations, vous avez obtenu votre permis ! Toute l\'équipe vous souhaite bonne route.',
    'ajourne'      => 'Vous n\'avez pas été admis(e) cette fois-ci. Ne vous découragez pas : contactez l\'agence pour préparer la prochaine session.',
    'rejete'       => 'Votre dossier n\'a pas pu être accepté. Contactez l\'agence pour en connaître la raison.',
];

$titre = 'Mon dossier';
require RACINE . '/includes/header.php';
?>
<section class="ae-section">
    <div class="container" style="max-width: 900px">
        <h1 class="h2">Bonjour <?= e($u['prenoms']) ?></h1>
        <p class="text-secondary">Dossier n° <strong><?= e($dossier['numero_dossier']) ?></strong> · <?= e($dossier['categorie_libelle']) ?> · <?= e(FORMULES[$dossier['formule']]) ?></p>
        <?= onglets_candidat('dossier') ?>
        <?= afficher_flash() ?>

        <div class="carte mb-3" style="height:auto">
            <div class="d-flex justify-content-between align-items-center mb-2">
                <h2 class="h5 mb-0">Suivi de mon dossier</h2>
                <?= badge(STATUTS_DOSSIER, $statut) ?>
            </div>
            <?php if ($indexEtape !== false): ?>
                <ol class="suivi my-3">
                    <?php foreach (ETAPES_DOSSIER as $i => $cle): ?>
                        <li class="<?= $i < $indexEtape ? 'faite' : ($i === $indexEtape ? 'active' : '') ?>"><?= e(STATUTS_DOSSIER[$cle][0]) ?></li>
                    <?php endforeach; ?>
                </ol>
            <?php endif; ?>
            <p class="mb-0"><?= e($messages[$statut] ?? '') ?></p>
            <?php if ($dossier['note_admin']): ?>
                <div class="alert alert-info mt-3 mb-0"><strong>Message de l'agence :</strong> <?= nl2br(e($dossier['note_admin'])) ?></div>
            <?php endif; ?>
        </div>

        <div class="row g-3">
            <div class="col-md-6">
                <div class="carte">
                    <h2 class="h5"><?= icone('carte', 18) ?> Paiement</h2>
                    <div class="progress my-2" role="progressbar" aria-label="Part payée" aria-valuenow="<?= $situation['pourcent'] ?>" aria-valuemin="0" aria-valuemax="100">
                        <div class="progress-bar" style="width: <?= $situation['pourcent'] ?>%"></div>
                    </div>
                    <p class="mb-1">Payé : <strong><?= e(fcfa($situation['paye'])) ?></strong> sur <?= e(fcfa($situation['total'])) ?></p>
                    <?php if ($situation['reste'] > 0): ?>
                        <p class="mb-3">Reste à payer : <strong class="text-danger"><?= e(fcfa($situation['reste'])) ?></strong></p>
                        <?php if ($situation['payable'] > 0): ?>
                            <a class="btn btn-accent w-100" href="<?= e(url('candidat/payer.php')) ?>">Payer une tranche</a>
                        <?php else: ?>
                            <p class="small text-secondary mb-0">Un paiement en espèces est en attente de confirmation à l'agence.</p>
                        <?php endif; ?>
                    <?php else: ?>
                        <p class="text-success fw-semibold mb-0"><?= icone('check', 18) ?> Formation entièrement réglée</p>
                    <?php endif; ?>
                </div>
            </div>
            <div class="col-md-6">
                <div class="carte">
                    <h2 class="h5"><?= icone('agenda', 18) ?> Mes prochains cours</h2>
                    <?php if ($prochains): ?>
                        <ul class="list-unstyled d-grid gap-2">
                            <?php foreach ($prochains as $c): ?>
                                <li><strong><?= e(jour_fr($c['date_creneau'])) ?></strong>, <?= e(heure_fr($c['heure_debut'])) ?>–<?= e(heure_fr($c['heure_fin'])) ?>
                                    <br><span class="small text-secondary"><?= $c['type'] === 'code' ? 'Code' : 'Conduite' ?> · <?= e($c['lieu']) ?> · <?= e($c['moniteur_prenoms']) ?></span></li>
                            <?php endforeach; ?>
                        </ul>
                    <?php else: ?>
                        <p class="text-secondary">Aucun cours réservé pour le moment.</p>
                    <?php endif; ?>
                    <a class="btn btn-outline-primary w-100" href="<?= e(url('candidat/planning.php')) ?>">Voir le planning</a>
                </div>
            </div>
        </div>

        <div class="carte mt-3" style="height:auto">
            <h2 class="h5"><?= icone('fichier', 18) ?> Mes pièces</h2>
            <?php foreach (TYPES_DOCUMENT as $type => $libelle): $d = $documents[$type] ?? null; ?>
                <div class="border-top py-3">
                    <div class="d-flex justify-content-between align-items-center gap-2 flex-wrap">
                        <strong><?= e($libelle) ?></strong>
                        <span>
                            <?= $d ? badge(STATUTS_DOCUMENT, $d['statut']) : '<span class="badge text-bg-secondary">À fournir à l\'agence ou ci-dessous</span>' ?>
                            <?php if ($d): ?><a class="btn btn-sm btn-outline-secondary ms-1" href="<?= e(url('fichier.php?id=' . $d['id'])) ?>" target="_blank" rel="noopener">Voir</a><?php endif; ?>
                        </span>
                    </div>
                    <?php if ($d && $d['statut'] === 'rejete'): ?>
                        <p class="text-danger mt-2 mb-0"><strong>Motif du refus :</strong> <?= e($d['motif_rejet'] ?: 'document non conforme') ?></p>
                    <?php endif; ?>
                    <?php if (!$d || $d['statut'] === 'rejete'): ?>
                        <form method="post" enctype="multipart/form-data" class="mt-2 d-flex flex-column flex-sm-row gap-2">
                            <?= csrf_champ() ?>
                            <input type="hidden" name="type" value="<?= e($type) ?>">
                            <div class="flex-grow-1">
                                <label class="visually-hidden" for="f-<?= e($type) ?>">Nouveau fichier : <?= e($libelle) ?></label>
                                <input class="form-control" type="file" id="f-<?= e($type) ?>" name="fichier" accept="image/jpeg,image/png,application/pdf" data-max="<?= UPLOAD_TAILLE_MAX ?>" required>
                                <div class="form-text" id="f-<?= e($type) ?>-info">JPG, PNG ou PDF, <?= (int) (UPLOAD_TAILLE_MAX / 1048576) ?> Mo maximum.</div>
                            </div>
                            <div><button class="btn btn-primary" type="submit">Envoyer</button></div>
                        </form>
                    <?php endif; ?>
                </div>
            <?php endforeach; ?>
        </div>

        <?php if ($notifications): ?>
            <div class="carte mt-3" style="height:auto">
                <h2 class="h5"><?= icone('mail', 18) ?> Derniers messages</h2>
                <?php foreach ($notifications as $n): ?>
                    <div class="border-top py-2">
                        <div class="d-flex justify-content-between gap-2"><strong><?= e($n['sujet']) ?></strong><span class="small text-secondary text-nowrap"><?= e(date_fr($n['created_at'])) ?></span></div>
                        <p class="small mb-0 text-secondary"><?= nl2br(e($n['message'])) ?></p>
                    </div>
                <?php endforeach; ?>
            </div>
        <?php endif; ?>
    </div>
</section>
<?php require RACINE . '/includes/footer.php'; ?>
