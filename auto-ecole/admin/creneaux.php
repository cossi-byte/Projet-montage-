<?php
require __DIR__ . '/_debut.php';

$categories = categories(false);
$moniteurs = q("SELECT m.id, m.specialite, u.nom, u.prenoms FROM moniteurs m JOIN utilisateurs u ON u.id = m.utilisateur_id WHERE u.actif = 1 ORDER BY u.nom")->fetchAll();
$vehicules = q("SELECT * FROM vehicules WHERE statut = 'disponible' ORDER BY marque")->fetchAll();

$erreurs = [];
$edition = isset($_GET['modifier']) ? (q('SELECT * FROM creneaux WHERE id = ?', [(int) $_GET['modifier']])->fetch() ?: null) : null;
$v = $edition ?? ['id' => 0, 'type' => 'code', 'categorie_id' => 0, 'moniteur_id' => 0, 'vehicule_id' => 0,
                  'date_creneau' => date('Y-m-d', strtotime('+1 day')), 'heure_debut' => '08:00', 'heure_fin' => '10:00', 'capacite' => 20, 'lieu' => 'Salle de code — Agence'];
$repetitions = 1;

if (est_post()) {
    csrf_verifier();
    $cid = (int) ($_POST['id'] ?? 0);

    if (champ('action') === 'supprimer') {
        $inscrits = q("SELECT DISTINCT i.utilisateur_id, c.date_creneau, c.heure_debut FROM reservations r
                       JOIN inscriptions i ON i.id = r.inscription_id JOIN creneaux c ON c.id = r.creneau_id
                       WHERE r.creneau_id = ? AND r.statut = 'reservee' AND TIMESTAMP(c.date_creneau, c.heure_debut) > NOW()", [$cid])->fetchAll();
        q('DELETE FROM creneaux WHERE id = ?', [$cid]);
        foreach ($inscrits as $i) {
            notifier((int) $i['utilisateur_id'], 'Cours annulé — ' . jour_fr($i['date_creneau']),
                'Votre cours du ' . jour_fr($i['date_creneau']) . ' à ' . heure_fr($i['heure_debut']) . ' a été annulé par l\'auto-école. Merci de réserver un autre créneau dans votre espace candidat.');
        }
        flash('success', 'Créneau supprimé.' . ($inscrits ? ' ' . count($inscrits) . ' candidat(s) prévenu(s).' : ''));
        rediriger('admin/creneaux.php');
    }

    $v = [
        'id'           => $cid,
        'type'         => champ('type'),
        'categorie_id' => (int) ($_POST['categorie_id'] ?? 0),
        'moniteur_id'  => (int) ($_POST['moniteur_id'] ?? 0),
        'vehicule_id'  => (int) ($_POST['vehicule_id'] ?? 0),
        'date_creneau' => champ('date_creneau'),
        'heure_debut'  => champ('heure_debut'),
        'heure_fin'    => champ('heure_fin'),
        'capacite'     => (int) ($_POST['capacite'] ?? 0),
        'lieu'         => mb_substr(champ('lieu'), 0, 120),
    ];
    $repetitions = $cid ? 1 : max(1, min(12, (int) ($_POST['repetitions'] ?? 1)));
    $heureOk = fn(string $h): bool => (bool) preg_match('/^([01]\d|2[0-3]):[0-5]\d$/', $h);

    if (!in_array($v['type'], ['code', 'conduite'], true)) { $erreurs[] = 'Type de cours invalide.'; }
    if (!in_array($v['moniteur_id'], array_map('intval', array_column($moniteurs, 'id')), true)) { $erreurs[] = 'Choisissez un moniteur actif.'; }
    if ($v['categorie_id'] && !in_array($v['categorie_id'], array_map('intval', array_column($categories, 'id')), true)) { $erreurs[] = 'Catégorie invalide.'; }
    if ($v['vehicule_id'] && !q('SELECT 1 FROM vehicules WHERE id = ?', [$v['vehicule_id']])->fetch()) { $erreurs[] = 'Véhicule invalide.'; }
    if (!date_valide($v['date_creneau'])) { $erreurs[] = 'Date invalide.'; }
    elseif (!$cid && $v['date_creneau'] < date('Y-m-d')) { $erreurs[] = 'La date ne peut pas être dans le passé.'; }
    if (!$heureOk($v['heure_debut']) || !$heureOk($v['heure_fin'])) { $erreurs[] = 'Heures invalides (format HH:MM).'; }
    elseif ($v['heure_fin'] <= $v['heure_debut']) { $erreurs[] = 'L\'heure de fin doit être après l\'heure de début.'; }
    if ($v['capacite'] < 1 || $v['capacite'] > 200) { $erreurs[] = 'La capacité doit être comprise entre 1 et 200.'; }
    if ($v['lieu'] === '') { $erreurs[] = 'Indiquez le lieu du cours.'; }
    if ($v['type'] === 'code') { $v['vehicule_id'] = 0; }

    // Un moniteur ou un véhicule ne peut pas être à deux endroits en même temps
    if (!$erreurs) {
        for ($k = 0; $k < $repetitions; $k++) {
            $date = date('Y-m-d', strtotime($v['date_creneau'] . " +$k week"));
            $conflit = q("SELECT 1 FROM creneaux WHERE id <> ? AND date_creneau = ? AND heure_debut < ? AND heure_fin > ?
                          AND (moniteur_id = ? OR (vehicule_id IS NOT NULL AND vehicule_id = ?))",
                         [$cid, $date, $v['heure_fin'], $v['heure_debut'], $v['moniteur_id'], $v['vehicule_id'] ?: -1])->fetch();
            if ($conflit) {
                $erreurs[] = 'Conflit le ' . date_fr($date) . ' : le moniteur ou le véhicule est déjà pris sur cet horaire.';
            }
        }
    }

    if (!$erreurs) {
        $base = [$v['type'], $v['categorie_id'] ?: null, $v['moniteur_id'], $v['vehicule_id'] ?: null];
        $fin = [$v['heure_debut'], $v['heure_fin'], $v['capacite'], $v['lieu']];
        if ($cid) {
            q('UPDATE creneaux SET type = ?, categorie_id = ?, moniteur_id = ?, vehicule_id = ?, date_creneau = ?, heure_debut = ?, heure_fin = ?, capacite = ?, lieu = ? WHERE id = ?',
              [...$base, $v['date_creneau'], ...$fin, $cid]);
            flash('success', 'Créneau mis à jour.');
        } else {
            for ($k = 0; $k < $repetitions; $k++) {
                q('INSERT INTO creneaux (type, categorie_id, moniteur_id, vehicule_id, date_creneau, heure_debut, heure_fin, capacite, lieu) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                  [...$base, date('Y-m-d', strtotime($v['date_creneau'] . " +$k week")), ...$fin]);
            }
            flash('success', $repetitions > 1 ? "$repetitions créneaux créés (un par semaine)." : 'Créneau créé.');
        }
        rediriger('admin/creneaux.php');
    }
    $edition = $cid ? $v : null;
}

$passes = isset($_GET['passes']);
$creneaux = q("SELECT c.*, u.nom AS moniteur_nom, u.prenoms AS moniteur_prenoms, v.marque, v.modele, cat.code AS categorie_code,
                      (SELECT COUNT(*) FROM reservations r WHERE r.creneau_id = c.id AND r.statut IN ('reservee', 'presente')) AS pris
               FROM creneaux c
               JOIN moniteurs m ON m.id = c.moniteur_id JOIN utilisateurs u ON u.id = m.utilisateur_id
               LEFT JOIN vehicules v ON v.id = c.vehicule_id LEFT JOIN categories cat ON cat.id = c.categorie_id
               WHERE " . ($passes ? 'c.date_creneau < CURDATE() ORDER BY c.date_creneau DESC, c.heure_debut DESC' : 'c.date_creneau >= CURDATE() ORDER BY c.date_creneau, c.heure_debut')
            . ' LIMIT 150')->fetchAll();

admin_entete('Créneaux de cours', 'creneaux');
?>
<div class="row g-3">
    <div class="col-lg-8">
        <ul class="nav nav-pills nav-espace gap-1 mb-3">
            <li class="nav-item"><a class="nav-link <?= $passes ? '' : 'active' ?>" href="<?= e(url('admin/creneaux.php')) ?>">À venir</a></li>
            <li class="nav-item"><a class="nav-link <?= $passes ? 'active' : '' ?>" href="<?= e(url('admin/creneaux.php?passes')) ?>">Passés</a></li>
        </ul>
        <div class="table-responsive">
            <table class="table">
                <thead><tr><th>Date</th><th>Cours</th><th>Moniteur</th><th>Places</th><th></th></tr></thead>
                <tbody>
                <?php if (!$creneaux): ?><tr><td colspan="5" class="text-center text-secondary py-4">Aucun créneau.</td></tr><?php endif; ?>
                <?php foreach ($creneaux as $c): ?>
                    <tr>
                        <td class="text-nowrap"><strong><?= e(jour_fr($c['date_creneau'])) ?></strong><br><?= e(heure_fr($c['heure_debut'])) ?>–<?= e(heure_fr($c['heure_fin'])) ?></td>
                        <td><span class="badge text-bg-<?= $c['type'] === 'code' ? 'primary' : 'success' ?>"><?= $c['type'] === 'code' ? 'Code' : 'Conduite' ?></span>
                            <?= $c['categorie_code'] ? 'Permis ' . e($c['categorie_code']) : '<span class="text-secondary">Tous permis</span>' ?>
                            <br><span class="small text-secondary"><?= e($c['lieu']) ?><?= $c['marque'] ? ' · ' . e($c['marque'] . ' ' . $c['modele']) : '' ?></span></td>
                        <td><?= e($c['moniteur_prenoms'] . ' ' . $c['moniteur_nom']) ?></td>
                        <td class="text-nowrap"><a href="<?= e(url('admin/planning.php?creneau=' . $c['id'])) ?>"><?= (int) $c['pris'] ?> / <?= (int) $c['capacite'] ?></a></td>
                        <td class="text-nowrap">
                            <a class="btn btn-sm btn-outline-primary" href="<?= e(url('admin/creneaux.php?modifier=' . $c['id'])) ?>">Modifier</a>
                            <form method="post" class="d-inline"><?= csrf_champ() ?><input type="hidden" name="action" value="supprimer"><input type="hidden" name="id" value="<?= (int) $c['id'] ?>">
                                <button class="btn btn-sm btn-outline-danger" type="submit" data-confirmer="Supprimer ce créneau ?<?= $c['pris'] ? ' Les ' . (int) $c['pris'] . ' candidat(s) inscrit(s) seront prévenus.' : '' ?>">Supprimer</button></form>
                        </td>
                    </tr>
                <?php endforeach; ?>
                </tbody>
            </table>
        </div>
    </div>
    <div class="col-lg-4">
        <form method="post" class="carte" style="height:auto" novalidate>
            <?= csrf_champ() ?>
            <input type="hidden" name="action" value="enregistrer">
            <input type="hidden" name="id" value="<?= (int) ($edition['id'] ?? 0) ?>">
            <h2 class="h5"><?= $edition ? 'Modifier le créneau' : 'Nouveau créneau' ?></h2>
            <?= afficher_erreurs($erreurs) ?>
            <?php if (!$moniteurs): ?><div class="alert alert-warning">Ajoutez d'abord un moniteur actif.</div><?php endif; ?>
            <div class="row g-2">
                <div class="col-6"><label class="form-label" for="type">Type</label>
                    <select class="form-select" id="type" name="type">
                        <option value="code" <?= $v['type'] === 'code' ? 'selected' : '' ?>>Code</option>
                        <option value="conduite" <?= $v['type'] === 'conduite' ? 'selected' : '' ?>>Conduite</option>
                    </select></div>
                <div class="col-6"><label class="form-label" for="categorie_id">Permis</label>
                    <select class="form-select" id="categorie_id" name="categorie_id"><option value="0">Tous</option>
                        <?php foreach ($categories as $c): ?><option value="<?= (int) $c['id'] ?>" <?= (int) $v['categorie_id'] === (int) $c['id'] ? 'selected' : '' ?>><?= e($c['code']) ?></option><?php endforeach; ?>
                    </select></div>
                <div class="col-12"><label class="form-label requis" for="moniteur_id">Moniteur</label>
                    <select class="form-select" id="moniteur_id" name="moniteur_id" required>
                        <?php foreach ($moniteurs as $m): ?><option value="<?= (int) $m['id'] ?>" <?= (int) $v['moniteur_id'] === (int) $m['id'] ? 'selected' : '' ?>><?= e($m['nom'] . ' ' . $m['prenoms']) ?></option><?php endforeach; ?>
                    </select></div>
                <div class="col-12"><label class="form-label" for="vehicule_id">Véhicule <span class="fw-normal text-secondary">(conduite)</span></label>
                    <select class="form-select" id="vehicule_id" name="vehicule_id"><option value="0">Aucun</option>
                        <?php foreach ($vehicules as $x): ?><option value="<?= (int) $x['id'] ?>" <?= (int) $v['vehicule_id'] === (int) $x['id'] ? 'selected' : '' ?>><?= e($x['marque'] . ' ' . $x['modele'] . ' — ' . $x['immatriculation']) ?></option><?php endforeach; ?>
                    </select></div>
                <div class="col-12"><label class="form-label requis" for="date_creneau">Date</label><input class="form-control" id="date_creneau" name="date_creneau" type="date" value="<?= e($v['date_creneau']) ?>" required></div>
                <div class="col-6"><label class="form-label requis" for="heure_debut">Début</label><input class="form-control" id="heure_debut" name="heure_debut" type="time" value="<?= e(substr($v['heure_debut'], 0, 5)) ?>" required></div>
                <div class="col-6"><label class="form-label requis" for="heure_fin">Fin</label><input class="form-control" id="heure_fin" name="heure_fin" type="time" value="<?= e(substr($v['heure_fin'], 0, 5)) ?>" required></div>
                <div class="col-5"><label class="form-label requis" for="capacite">Places</label><input class="form-control" id="capacite" name="capacite" type="number" min="1" max="200" value="<?= (int) $v['capacite'] ?>" required></div>
                <div class="col-7"><label class="form-label requis" for="lieu">Lieu</label><input class="form-control" id="lieu" name="lieu" value="<?= e($v['lieu']) ?>" required maxlength="120"></div>
                <?php if (!$edition): ?>
                    <div class="col-12"><label class="form-label" for="repetitions">Répéter chaque semaine pendant</label>
                        <select class="form-select" id="repetitions" name="repetitions">
                            <?php foreach ([1 => 'Ne pas répéter', 2 => '2 semaines', 4 => '4 semaines', 8 => '8 semaines', 12 => '12 semaines'] as $n => $l): ?>
                                <option value="<?= $n ?>" <?= $repetitions === $n ? 'selected' : '' ?>><?= e($l) ?></option>
                            <?php endforeach; ?>
                        </select></div>
                <?php endif; ?>
            </div>
            <button class="btn btn-primary mt-3" type="submit"><?= $edition ? 'Enregistrer' : 'Créer' ?></button>
            <?php if ($edition): ?><a class="btn btn-link mt-3" href="<?= e(url('admin/creneaux.php')) ?>">Annuler</a><?php endif; ?>
        </form>
    </div>
</div>
<?php admin_pied(); ?>
