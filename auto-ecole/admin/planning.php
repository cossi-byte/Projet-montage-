<?php
/**
 * Planning et feuilles de présence.
 *  - Moniteur : ses propres créneaux uniquement.
 *  - Admin    : tous les créneaux.
 */
$rolesAutorises = ['admin', 'moniteur'];
require __DIR__ . '/_debut.php';

$estAdmin = $u['role'] === 'admin';
$moniteurId = $estAdmin ? null : (int) q('SELECT id FROM moniteurs WHERE utilisateur_id = ?', [$u['id']])->fetchColumn();

/** Créneau accessible à l'utilisateur courant, ou null. */
$chargerCreneau = function (int $id) use ($estAdmin, $moniteurId): ?array {
    $c = q("SELECT c.*, u.nom AS moniteur_nom, u.prenoms AS moniteur_prenoms, v.marque, v.modele, v.immatriculation
            FROM creneaux c JOIN moniteurs m ON m.id = c.moniteur_id JOIN utilisateurs u ON u.id = m.utilisateur_id
            LEFT JOIN vehicules v ON v.id = c.vehicule_id WHERE c.id = ?", [$id])->fetch();
    return ($c && ($estAdmin || (int) $c['moniteur_id'] === $moniteurId)) ? $c : null;
};

if (est_post()) {
    csrf_verifier();
    $c = $chargerCreneau((int) ($_POST['creneau_id'] ?? 0));
    if (!$c) {
        flash('danger', 'Créneau introuvable.');
        rediriger('admin/planning.php');
    }
    if (strtotime($c['date_creneau'] . ' ' . $c['heure_debut']) > time()) {
        flash('danger', 'Les présences se pointent à partir du début du cours.');
    } else {
        $n = 0;
        foreach ((array) ($_POST['presence'] ?? []) as $reservationId => $etat) {
            if (in_array($etat, ['presente', 'absente', 'reservee'], true)) {
                $n += q("UPDATE reservations SET statut = ? WHERE id = ? AND creneau_id = ? AND statut <> 'annulee'", [$etat, (int) $reservationId, $c['id']])->rowCount();
            }
        }
        flash('success', 'Présences enregistrées.');
    }
    rediriger('admin/planning.php?creneau=' . $c['id']);
}

$detail = isset($_GET['creneau']) ? $chargerCreneau((int) $_GET['creneau']) : null;

if ($detail) {
    $inscrits = q("SELECT r.id, r.statut, u.nom, u.prenoms, u.telephone, i.numero_dossier, i.id AS inscription_id, cat.code
                   FROM reservations r JOIN inscriptions i ON i.id = r.inscription_id
                   JOIN utilisateurs u ON u.id = i.utilisateur_id JOIN categories cat ON cat.id = i.categorie_id
                   WHERE r.creneau_id = ? AND r.statut <> 'annulee' ORDER BY u.nom, u.prenoms", [$detail['id']])->fetchAll();
    $commence = strtotime($detail['date_creneau'] . ' ' . $detail['heure_debut']) <= time();

    admin_entete(($detail['type'] === 'code' ? 'Cours de code' : 'Leçon de conduite') . ' — ' . jour_fr($detail['date_creneau']), 'planning');
    ?>
    <p><a href="<?= e(url('admin/planning.php')) ?>">← Retour au planning</a></p>
    <div class="carte mb-3" style="height:auto">
        <strong><?= e(heure_fr($detail['heure_debut'])) ?>–<?= e(heure_fr($detail['heure_fin'])) ?></strong> · <?= e($detail['lieu']) ?>
        · Moniteur : <?= e($detail['moniteur_prenoms'] . ' ' . $detail['moniteur_nom']) ?>
        <?= $detail['marque'] ? ' · ' . e($detail['marque'] . ' ' . $detail['modele'] . ' (' . $detail['immatriculation'] . ')') : '' ?>
        · <?= count($inscrits) ?> / <?= (int) $detail['capacite'] ?> inscrit(s)
    </div>
    <?php if (!$inscrits): ?>
        <p class="text-secondary">Aucun candidat inscrit à ce créneau.</p>
    <?php else: ?>
        <form method="post">
            <?= csrf_champ() ?>
            <input type="hidden" name="creneau_id" value="<?= (int) $detail['id'] ?>">
            <div class="table-responsive">
                <table class="table">
                    <thead><tr><th>Candidat</th><th>Téléphone</th><th>Présence</th></tr></thead>
                    <tbody>
                    <?php foreach ($inscrits as $r): ?>
                        <tr>
                            <td><strong><?= e($r['nom'] . ' ' . $r['prenoms']) ?></strong><br><span class="small text-secondary">Permis <?= e($r['code']) ?> · <?= e($r['numero_dossier']) ?></span></td>
                            <td class="text-nowrap"><a href="tel:+229<?= e($r['telephone']) ?>"><?= e(telephone_affiche($r['telephone'])) ?></a></td>
                            <td>
                                <?php if ($commence): ?>
                                    <div class="btn-group" role="group" aria-label="Présence de <?= e($r['prenoms']) ?>">
                                        <?php foreach (['presente' => ['Présent', 'success'], 'absente' => ['Absent', 'danger']] as $etat => [$l, $couleur]): ?>
                                            <input type="radio" class="btn-check" name="presence[<?= (int) $r['id'] ?>]" id="p<?= (int) $r['id'] . $etat ?>" value="<?= $etat ?>" <?= $r['statut'] === $etat ? 'checked' : '' ?>>
                                            <label class="btn btn-sm btn-outline-<?= $couleur ?>" for="p<?= (int) $r['id'] . $etat ?>"><?= $l ?></label>
                                        <?php endforeach; ?>
                                    </div>
                                <?php else: ?>
                                    <span class="badge text-bg-info">Réservé</span>
                                <?php endif; ?>
                            </td>
                        </tr>
                    <?php endforeach; ?>
                    </tbody>
                </table>
            </div>
            <?php if ($commence): ?>
                <button class="btn btn-primary btn-lg mt-3" type="submit">Enregistrer les présences</button>
            <?php else: ?>
                <p class="text-secondary mt-2">Le pointage sera possible à partir du début du cours.</p>
            <?php endif; ?>
        </form>
    <?php endif;
    admin_pied();
    exit;
}

// ---------- Liste des créneaux ----------
$params = [];
$filtre = '';
if (!$estAdmin) {
    $filtre = 'AND c.moniteur_id = ?';
    $params[] = $moniteurId;
}
$creneaux = q("SELECT c.*, u.nom AS moniteur_nom, u.prenoms AS moniteur_prenoms, v.marque, v.modele, cat.code AS categorie_code,
                      (SELECT COUNT(*) FROM reservations r WHERE r.creneau_id = c.id AND r.statut <> 'annulee') AS inscrits,
                      (SELECT COUNT(*) FROM reservations r WHERE r.creneau_id = c.id AND r.statut = 'reservee') AS non_pointes
               FROM creneaux c JOIN moniteurs m ON m.id = c.moniteur_id JOIN utilisateurs u ON u.id = m.utilisateur_id
               LEFT JOIN vehicules v ON v.id = c.vehicule_id LEFT JOIN categories cat ON cat.id = c.categorie_id
               WHERE c.date_creneau BETWEEN CURDATE() - INTERVAL 7 DAY AND CURDATE() + INTERVAL 21 DAY $filtre
               ORDER BY c.date_creneau, c.heure_debut", $params)->fetchAll();

admin_entete($estAdmin ? 'Planning et présences' : 'Mon planning', 'planning');
?>
<p class="text-secondary">Du <?= e(date('d/m', strtotime('-7 days'))) ?> au <?= e(date('d/m', strtotime('+21 days'))) ?>. Ouvrez un créneau pour voir les candidats inscrits et pointer les présences.</p>
<?php if (!$creneaux): ?><p class="text-secondary">Aucun créneau sur cette période.</p><?php endif; ?>
<?php $jour = null;
foreach ($creneaux as $c):
    $passe = strtotime($c['date_creneau'] . ' ' . $c['heure_debut']) <= time();
    if ($jour !== $c['date_creneau']): $jour = $c['date_creneau']; ?>
        <h2 class="h6 mt-4 <?= $c['date_creneau'] === date('Y-m-d') ? 'text-success' : '' ?>"><?= e(jour_fr($c['date_creneau'])) ?><?= $c['date_creneau'] === date('Y-m-d') ? ' — aujourd\'hui' : '' ?></h2>
    <?php endif; ?>
    <a class="carte creneau <?= e($c['type']) ?> mb-2 d-flex justify-content-between align-items-center gap-2 text-decoration-none text-body" style="height:auto" href="<?= e(url('admin/planning.php?creneau=' . $c['id'])) ?>">
        <span><strong><?= e(heure_fr($c['heure_debut'])) ?>–<?= e(heure_fr($c['heure_fin'])) ?></strong> · <?= $c['type'] === 'code' ? 'Code' : 'Conduite' ?><?= $c['categorie_code'] ? ' · Permis ' . e($c['categorie_code']) : '' ?>
            <br><span class="small text-secondary"><?= e($c['lieu']) ?><?= $c['marque'] ? ' · ' . e($c['marque'] . ' ' . $c['modele']) : '' ?><?= $estAdmin ? ' · ' . e($c['moniteur_prenoms'] . ' ' . $c['moniteur_nom']) : '' ?></span></span>
        <span class="text-end text-nowrap">
            <span class="badge text-bg-<?= $c['inscrits'] ? 'primary' : 'secondary' ?>"><?= (int) $c['inscrits'] ?> / <?= (int) $c['capacite'] ?></span>
            <?php if ($passe && $c['non_pointes']): ?><br><span class="badge text-bg-warning mt-1">À pointer</span><?php endif; ?>
        </span>
    </a>
<?php endforeach; ?>
<?php admin_pied(); ?>
