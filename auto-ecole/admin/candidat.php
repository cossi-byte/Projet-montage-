<?php
require __DIR__ . '/_debut.php';

$id = (int) ($_GET['id'] ?? 0);
$d = inscription($id);
if (!$d) {
    http_response_code(404);
    flash('danger', 'Dossier introuvable.');
    rediriger('admin/candidats.php');
}
$retour = 'admin/candidat.php?id=' . $id;

$messagesStatut = [
    'en_attente'   => 'votre dossier est en cours de vérification.',
    'valide'       => 'votre dossier est validé ! Vous pouvez réserver vos cours dans votre espace candidat.',
    'en_formation' => 'votre formation a commencé. Pensez à réserver vos séances dans votre espace candidat.',
    'examen'       => 'vous êtes inscrit(e) à l\'examen. L\'agence vous communiquera votre date de convocation.',
    'admis'        => 'félicitations, vous êtes admis(e) à l\'examen du permis de conduire !',
    'ajourne'      => 'vous n\'avez malheureusement pas été admis(e) cette fois-ci. Contactez-nous pour préparer la prochaine session.',
    'rejete'       => 'votre dossier n\'a pas pu être accepté. Contactez l\'agence pour plus d\'informations.',
];

if (est_post()) {
    csrf_verifier();
    $action = champ('action');

    if ($action === 'statut') {
        $statut = champ('statut');
        $note = mb_substr(champ('note_admin'), 0, 2000);
        if (!isset(STATUTS_DOSSIER[$statut])) {
            flash('danger', 'Statut inconnu.');
        } else {
            q('UPDATE inscriptions SET statut = ?, note_admin = ? WHERE id = ?', [$statut, $note ?: null, $id]);
            if ($statut !== $d['statut']) {
                notifier((int) $d['utilisateur_id'], 'Votre dossier ' . $d['numero_dossier'] . ' : ' . STATUTS_DOSSIER[$statut][0],
                    'Le statut de votre dossier a changé : ' . $messagesStatut[$statut] . ($note ? "\n\nMessage de l'agence : $note" : ''));
                flash('success', 'Statut mis à jour : ' . STATUTS_DOSSIER[$statut][0] . '. Le candidat est prévenu dans son espace' . ($d['email'] ? ' et par e-mail' : ' (il n\'a pas d\'e-mail : pensez au bouton WhatsApp)') . '.');
            } else {
                flash('success', 'Note enregistrée.');
            }
        }
    } elseif ($action === 'document') {
        $doc = q('SELECT * FROM documents WHERE id = ? AND inscription_id = ?', [(int) ($_POST['document_id'] ?? 0), $id])->fetch();
        $decision = champ('decision');
        $motif = mb_substr(champ('motif'), 0, 255);
        if (!$doc || !in_array($decision, ['valide', 'rejete'], true)) {
            flash('danger', 'Action impossible sur ce document.');
        } elseif ($decision === 'rejete' && $motif === '') {
            flash('danger', 'Indiquez le motif du refus : il sera affiché au candidat.');
        } else {
            q('UPDATE documents SET statut = ?, motif_rejet = ? WHERE id = ?', [$decision, $decision === 'rejete' ? $motif : null, $doc['id']]);
            if ($decision === 'rejete') {
                notifier((int) $d['utilisateur_id'], 'Document à renvoyer : ' . TYPES_DOCUMENT[$doc['type']],
                    'Votre document « ' . TYPES_DOCUMENT[$doc['type']] . " » n'a pas pu être accepté. Motif : $motif\nMerci d'en envoyer un nouveau depuis votre espace candidat.");
                flash('warning', 'Document refusé. Le candidat a été notifié.');
            } else {
                $valides = (int) q("SELECT COUNT(*) FROM documents WHERE inscription_id = ? AND statut = 'valide'", [$id])->fetchColumn();
                flash('success', 'Document validé.' . ($valides === count(TYPES_DOCUMENT) && $d['statut'] === 'en_attente'
                    ? ' Toutes les pièces sont validées : vous pouvez passer le dossier au statut « Validé ».' : ''));
            }
        }
    } elseif ($action === 'especes') {
        $brut = preg_replace('/\s+/u', '', champ('montant'));
        $reste = situation_paiement($d)['reste'];
        if (!ctype_digit($brut) || (int) $brut < 1 || (int) $brut > $reste) {
            flash('danger', 'Montant invalide : il doit être compris entre 1 et ' . fcfa($reste) . '.');
        } else {
            q("INSERT INTO paiements (inscription_id, reference, montant, mode) VALUES (?, ?, ?, 'especes')", [$id, nouvelle_reference(), (int) $brut]);
            confirmer_paiement((int) db()->lastInsertId(), (int) $u['id']);
            flash('success', 'Paiement en espèces de ' . fcfa((int) $brut) . ' enregistré et confirmé.');
        }
    } elseif ($action === 'confirmer_paiement') {
        $p = q("SELECT * FROM paiements WHERE id = ? AND inscription_id = ? AND statut = 'en_attente'", [(int) ($_POST['paiement_id'] ?? 0), $id])->fetch();
        if ($p && confirmer_paiement((int) $p['id'], (int) $u['id'])) {
            flash('success', 'Paiement de ' . fcfa($p['montant']) . ' confirmé.');
        } else {
            flash('danger', 'Ce paiement ne peut pas être confirmé.');
        }
    } elseif ($action === 'mot_de_passe') {
        $temp = 'Permis' . random_int(1000, 9999) . chr(random_int(97, 122)) . chr(random_int(97, 122));
        q('UPDATE utilisateurs SET mot_de_passe = ? WHERE id = ?', [password_hash($temp, PASSWORD_DEFAULT), $d['utilisateur_id']]);
        q('DELETE FROM tentatives_connexion WHERE identifiant IN (?, ?)', [$d['telephone'], (string) $d['email']]);
        $_SESSION['mdp_temporaire'] = $temp;
        flash('success', 'Mot de passe réinitialisé. Communiquez le mot de passe provisoire affiché ci-dessous au candidat.');
    } elseif ($action === 'compte') {
        q('UPDATE utilisateurs SET actif = 1 - actif WHERE id = ?', [$d['utilisateur_id']]);
        flash('success', $d['compte_actif'] ? 'Compte désactivé : le candidat ne peut plus se connecter.' : 'Compte réactivé.');
    }
    rediriger($retour);
}

$mdpTemporaire = $_SESSION['mdp_temporaire'] ?? null;
unset($_SESSION['mdp_temporaire']);

$s = situation_paiement($d);
$documents = [];
foreach (q('SELECT * FROM documents WHERE inscription_id = ?', [$id]) as $doc) {
    $documents[$doc['type']] = $doc;
}
$paiements = q("SELECT * FROM paiements WHERE inscription_id = ? ORDER BY id DESC", [$id])->fetchAll();
$reservations = q("SELECT c.*, r.statut AS statut_reservation FROM reservations r JOIN creneaux c ON c.id = r.creneau_id
                   WHERE r.inscription_id = ? AND r.statut <> 'annulee' ORDER BY c.date_creneau DESC, c.heure_debut DESC LIMIT 10", [$id])->fetchAll();
$notifications = q('SELECT * FROM notifications WHERE utilisateur_id = ? ORDER BY id DESC LIMIT 8', [$d['utilisateur_id']])->fetchAll();

admin_entete($d['nom'] . ' ' . $d['prenoms'], 'candidats');
?>
<p><a href="<?= e(url('admin/candidats.php')) ?>">← Tous les candidats</a></p>

<?php if ($mdpTemporaire): ?>
    <div class="alert alert-warning">
        Mot de passe provisoire : <strong class="fs-5 user-select-all"><?= e($mdpTemporaire) ?></strong> (affiché une seule fois).
        <a class="btn btn-sm btn-whatsapp ms-2" target="_blank" rel="noopener" href="<?= e(whatsapp_candidat($d, 'voici votre mot de passe provisoire pour votre espace candidat : ' . $mdpTemporaire . ' . Changez-le dès votre connexion dans « Mon compte ».')) ?>">Envoyer par WhatsApp</a>
    </div>
<?php endif; ?>

<div class="row g-3">
    <div class="col-lg-5">
        <div class="carte mb-3" style="height:auto">
            <div class="d-flex justify-content-between align-items-start">
                <h2 class="h5">Dossier <?= e($d['numero_dossier']) ?></h2><?= badge(STATUTS_DOSSIER, $d['statut']) ?>
            </div>
            <dl class="row mb-2 small">
                <dt class="col-5 fw-normal text-secondary">Téléphone</dt><dd class="col-7"><a href="tel:+229<?= e($d['telephone']) ?>"><?= e(telephone_affiche($d['telephone'])) ?></a></dd>
                <dt class="col-5 fw-normal text-secondary">E-mail</dt><dd class="col-7 text-break"><?= $d['email'] ? e($d['email']) : '<span class="text-secondary">non renseigné</span>' ?></dd>
                <dt class="col-5 fw-normal text-secondary">Né(e) le</dt><dd class="col-7"><?= e(date_fr($d['date_naissance'])) ?> (<?= age($d['date_naissance']) ?> ans)</dd>
                <dt class="col-5 fw-normal text-secondary">Permis</dt><dd class="col-7"><?= e($d['categorie_libelle']) ?></dd>
                <dt class="col-5 fw-normal text-secondary">Formule</dt><dd class="col-7"><?= e(FORMULES[$d['formule']]) ?></dd>
                <dt class="col-5 fw-normal text-secondary">Inscrit le</dt><dd class="col-7"><?= e(date_fr($d['created_at'], true)) ?></dd>
                <dt class="col-5 fw-normal text-secondary">Compte</dt><dd class="col-7"><?= $d['compte_actif'] ? 'Actif' : '<span class="text-danger fw-semibold">Désactivé</span>' ?></dd>
            </dl>
            <div class="d-flex flex-wrap gap-2">
                <a class="btn btn-sm btn-whatsapp" target="_blank" rel="noopener" href="<?= e(whatsapp_candidat($d, $messagesStatut[$d['statut']])) ?>"><?= icone('whatsapp', 16) ?> Prévenir par WhatsApp</a>
                <form method="post"><?= csrf_champ() ?><input type="hidden" name="action" value="mot_de_passe">
                    <button class="btn btn-sm btn-outline-secondary" type="submit" data-confirmer="Réinitialiser le mot de passe de ce candidat ?">Réinitialiser le mot de passe</button></form>
                <form method="post"><?= csrf_champ() ?><input type="hidden" name="action" value="compte">
                    <button class="btn btn-sm btn-outline-<?= $d['compte_actif'] ? 'danger' : 'success' ?>" type="submit" data-confirmer="<?= $d['compte_actif'] ? 'Désactiver' : 'Réactiver' ?> ce compte ?"><?= $d['compte_actif'] ? 'Désactiver le compte' : 'Réactiver le compte' ?></button></form>
            </div>
        </div>

        <form method="post" class="carte mb-3" style="height:auto">
            <?= csrf_champ() ?>
            <input type="hidden" name="action" value="statut">
            <h2 class="h5">Changer le statut</h2>
            <label class="form-label" for="statut">Statut du dossier</label>
            <select class="form-select mb-3" id="statut" name="statut">
                <?php foreach (STATUTS_DOSSIER as $cle => [$l]): ?>
                    <option value="<?= e($cle) ?>" <?= $d['statut'] === $cle ? 'selected' : '' ?>><?= e($l) ?></option>
                <?php endforeach; ?>
            </select>
            <label class="form-label" for="note_admin">Message visible par le candidat <span class="fw-normal text-secondary">(facultatif)</span></label>
            <textarea class="form-control mb-3" id="note_admin" name="note_admin" rows="2" maxlength="2000" placeholder="Ex. : examen prévu le 12 à 8h, centre de Godomey"><?= e($d['note_admin']) ?></textarea>
            <button class="btn btn-primary" type="submit">Enregistrer et notifier</button>
            <p class="form-text mb-0">Le candidat est prévenu par e-mail (s'il en a un) et dans son espace.</p>
        </form>

        <div class="carte" style="height:auto">
            <h2 class="h5">Notifications envoyées</h2>
            <?php if (!$notifications): ?><p class="text-secondary mb-0">Aucune.</p><?php endif; ?>
            <?php foreach ($notifications as $n): ?>
                <div class="border-top py-2 small">
                    <strong><?= e($n['sujet']) ?></strong>
                    <span class="badge text-bg-<?= $n['email_envoye'] ? 'success' : 'secondary' ?>"><?= $n['email_envoye'] ? 'E-mail envoyé' : 'Espace candidat seulement' ?></span>
                    <br><span class="text-secondary"><?= e(date_fr($n['created_at'], true)) ?></span>
                </div>
            <?php endforeach; ?>
        </div>
    </div>

    <div class="col-lg-7">
        <div class="carte mb-3" style="height:auto">
            <h2 class="h5">Pièces justificatives</h2>
            <?php foreach (TYPES_DOCUMENT as $type => $libelle): $doc = $documents[$type] ?? null; ?>
                <div class="border-top py-3">
                    <div class="d-flex justify-content-between align-items-center flex-wrap gap-2">
                        <strong><?= e($libelle) ?></strong>
                        <?php if ($doc): ?>
                            <span><?= badge(STATUTS_DOCUMENT, $doc['statut']) ?>
                                <a class="btn btn-sm btn-outline-primary ms-1" href="<?= e(url('fichier.php?id=' . $doc['id'])) ?>" target="_blank" rel="noopener">Ouvrir le fichier</a></span>
                        <?php else: ?>
                            <span class="badge text-bg-secondary">Non fourni en ligne</span>
                        <?php endif; ?>
                    </div>
                    <?php if ($doc): ?>
                        <p class="small text-secondary mb-2"><?= e($doc['nom_original']) ?> · <?= round($doc['taille'] / 1024) ?> Ko · reçu le <?= e(date_fr($doc['created_at'], true)) ?>
                            <?= $doc['statut'] === 'rejete' ? '<br><span class="text-danger">Motif : ' . e($doc['motif_rejet']) . '</span>' : '' ?></p>
                        <?php if ($doc['statut'] !== 'valide'): ?>
                            <div class="d-flex flex-column flex-sm-row gap-2">
                                <form method="post"><?= csrf_champ() ?>
                                    <input type="hidden" name="action" value="document"><input type="hidden" name="document_id" value="<?= (int) $doc['id'] ?>"><input type="hidden" name="decision" value="valide">
                                    <button class="btn btn-sm btn-success" type="submit"><?= icone('check', 16) ?> Valider</button>
                                </form>
                                <?php if ($doc['statut'] === 'en_attente'): ?>
                                    <form method="post" class="d-flex gap-2 flex-grow-1"><?= csrf_champ() ?>
                                        <input type="hidden" name="action" value="document"><input type="hidden" name="document_id" value="<?= (int) $doc['id'] ?>"><input type="hidden" name="decision" value="rejete">
                                        <label class="visually-hidden" for="motif-<?= (int) $doc['id'] ?>">Motif du refus</label>
                                        <input class="form-control form-control-sm" id="motif-<?= (int) $doc['id'] ?>" name="motif" placeholder="Motif du refus (ex. photo floue)" maxlength="255" required>
                                        <button class="btn btn-sm btn-outline-danger text-nowrap" type="submit">Refuser</button>
                                    </form>
                                <?php endif; ?>
                            </div>
                        <?php endif; ?>
                    <?php endif; ?>
                </div>
            <?php endforeach; ?>
        </div>

        <div class="carte mb-3" style="height:auto">
            <h2 class="h5">Paiements</h2>
            <p class="mb-2">Payé <strong><?= e(fcfa($s['paye'])) ?></strong> sur <?= e(fcfa($s['total'])) ?> (<?= (int) $d['nb_tranches'] ?> tranche<?= $d['nb_tranches'] > 1 ? 's' : '' ?> prévue<?= $d['nb_tranches'] > 1 ? 's' : '' ?>)
                · Reste <strong class="<?= $s['reste'] ? 'text-danger' : 'text-success' ?>"><?= e(fcfa($s['reste'])) ?></strong></p>
            <div class="progress mb-3"><div class="progress-bar" style="width: <?= $s['pourcent'] ?>%"></div></div>

            <?php if ($s['reste'] > 0): ?>
                <form method="post" class="row g-2 align-items-end mb-3">
                    <?= csrf_champ() ?>
                    <input type="hidden" name="action" value="especes">
                    <div class="col-sm-6">
                        <label class="form-label" for="montant">Encaisser des espèces (FCFA)</label>
                        <input class="form-control" id="montant" name="montant" type="number" min="1" max="<?= $s['reste'] ?>" step="1" value="<?= min($s['reste'], max($s['suggere'], 1)) ?>" required>
                    </div>
                    <div class="col-sm-6 d-grid"><button class="btn btn-primary" type="submit" data-confirmer="Confirmer l'encaissement en espèces ?">Enregistrer le paiement</button></div>
                </form>
            <?php endif; ?>

            <?php foreach ($paiements as $p): ?>
                <div class="border-top py-2 d-flex justify-content-between align-items-center gap-2 flex-wrap">
                    <div><strong><?= e(fcfa($p['montant'])) ?></strong> <?= badge(STATUTS_PAIEMENT, $p['statut']) ?><br>
                        <span class="small text-secondary"><?= e(MODES_PAIEMENT[$p['mode']]) ?><?= $p['operateur'] ? ' · ' . e(OPERATEURS[$p['operateur']] ?? $p['operateur']) : '' ?> · <?= e(date_fr($p['date_paiement'] ?: $p['created_at'], true)) ?> · <?= e($p['reference']) ?></span></div>
                    <div>
                        <?php if ($p['statut'] === 'confirme'): ?>
                            <a class="btn btn-sm btn-outline-primary" href="<?= e(url('candidat/recu.php?id=' . $p['id'])) ?>">Reçu PDF</a>
                        <?php elseif ($p['statut'] === 'en_attente'): ?>
                            <form method="post"><?= csrf_champ() ?><input type="hidden" name="action" value="confirmer_paiement"><input type="hidden" name="paiement_id" value="<?= (int) $p['id'] ?>">
                                <button class="btn btn-sm btn-success" type="submit" data-confirmer="Confirmer la réception de <?= e(fcfa($p['montant'])) ?> ?">Confirmer la réception</button></form>
                        <?php endif; ?>
                    </div>
                </div>
            <?php endforeach; ?>
            <?php if (!$paiements): ?><p class="text-secondary mb-0">Aucun paiement.</p><?php endif; ?>
        </div>

        <div class="carte" style="height:auto">
            <h2 class="h5">Cours réservés</h2>
            <?php if (!$reservations): ?><p class="text-secondary mb-0">Aucune réservation.</p><?php endif; ?>
            <?php $etats = ['presente' => ['Présent', 'success'], 'absente' => ['Absent', 'danger'], 'reservee' => ['Réservé', 'info']];
            foreach ($reservations as $r): ?>
                <div class="border-top py-2 d-flex justify-content-between small">
                    <span><?= e(jour_fr($r['date_creneau'])) ?> · <?= e(heure_fr($r['heure_debut'])) ?> · <?= $r['type'] === 'code' ? 'Code' : 'Conduite' ?></span>
                    <?= badge($etats, $r['statut_reservation']) ?>
                </div>
            <?php endforeach; ?>
        </div>
    </div>
</div>
<?php admin_pied(); ?>
