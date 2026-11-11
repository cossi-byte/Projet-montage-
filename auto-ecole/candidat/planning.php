<?php
require __DIR__ . '/_debut.php';

const DELAI_ANNULATION_H = 12;   // on peut annuler jusqu'à 12 h avant le cours

if (est_post()) {
    csrf_verifier();
    $creneauId = (int) ($_POST['creneau_id'] ?? 0);
    $action = champ('action');
    $pdo = db();

    if ($action === 'reserver') {
        try {
            $pdo->beginTransaction();
            // Verrou sur le créneau : deux candidats ne peuvent pas prendre la dernière place en même temps
            $c = q('SELECT * FROM creneaux WHERE id = ? FOR UPDATE', [$creneauId])->fetch();
            if (!$c || strtotime($c['date_creneau'] . ' ' . $c['heure_debut']) <= time()) {
                throw new RuntimeException('Ce créneau n\'est plus disponible.');
            }
            if (!peut_reserver($dossier, $c['type'])) {
                throw new RuntimeException('Votre dossier ne permet pas de réserver ce type de cours pour le moment.');
            }
            if ($c['categorie_id'] !== null && (int) $c['categorie_id'] !== (int) $dossier['categorie_id']) {
                throw new RuntimeException('Ce créneau est réservé à une autre catégorie de permis.');
            }
            $pris = (int) q("SELECT COUNT(*) FROM reservations WHERE creneau_id = ? AND statut IN ('reservee', 'presente')", [$creneauId])->fetchColumn();
            if ($pris >= (int) $c['capacite']) {
                throw new RuntimeException('Désolé, ce créneau vient d\'être complet.');
            }
            // Pas deux cours en même temps
            $conflit = q("SELECT 1 FROM reservations r JOIN creneaux c ON c.id = r.creneau_id
                          WHERE r.inscription_id = ? AND r.statut = 'reservee' AND c.id <> ? AND c.date_creneau = ?
                            AND c.heure_debut < ? AND c.heure_fin > ?",
                         [$dossier['id'], $creneauId, $c['date_creneau'], $c['heure_fin'], $c['heure_debut']])->fetch();
            if ($conflit) {
                throw new RuntimeException('Vous avez déjà un cours réservé sur cet horaire.');
            }
            q("INSERT INTO reservations (creneau_id, inscription_id, statut) VALUES (?, ?, 'reservee')
               ON DUPLICATE KEY UPDATE statut = 'reservee', created_at = NOW()", [$creneauId, $dossier['id']]);
            $pdo->commit();
            flash('success', 'Cours réservé : ' . jour_fr($c['date_creneau']) . ' à ' . heure_fr($c['heure_debut']) . '. Soyez à l\'heure !');
        } catch (RuntimeException $ex) {
            $pdo->rollBack();
            flash('danger', $ex->getMessage());
        }
    } elseif ($action === 'annuler') {
        $c = q("SELECT c.* FROM reservations r JOIN creneaux c ON c.id = r.creneau_id
                WHERE r.creneau_id = ? AND r.inscription_id = ? AND r.statut = 'reservee'", [$creneauId, $dossier['id']])->fetch();
        if (!$c) {
            flash('danger', 'Réservation introuvable.');
        } elseif (strtotime($c['date_creneau'] . ' ' . $c['heure_debut']) - time() < DELAI_ANNULATION_H * 3600) {
            flash('danger', 'Il est trop tard pour annuler en ligne (moins de ' . DELAI_ANNULATION_H . ' h avant le cours). Appelez l\'agence.');
        } else {
            q("UPDATE reservations SET statut = 'annulee' WHERE creneau_id = ? AND inscription_id = ?", [$creneauId, $dossier['id']]);
            flash('success', 'Réservation annulée.');
        }
    }
    rediriger('candidat/planning.php');
}

$mesReservations = q("SELECT c.*, r.statut AS statut_reservation, u.prenoms AS moniteur_prenoms, u.nom AS moniteur_nom,
                             v.marque, v.modele
                      FROM reservations r
                      JOIN creneaux c ON c.id = r.creneau_id
                      JOIN moniteurs m ON m.id = c.moniteur_id JOIN utilisateurs u ON u.id = m.utilisateur_id
                      LEFT JOIN vehicules v ON v.id = c.vehicule_id
                      WHERE r.inscription_id = ? AND r.statut <> 'annulee'
                      ORDER BY c.date_creneau DESC, c.heure_debut DESC LIMIT 30", [$dossier['id']])->fetchAll();
$aVenir = array_reverse(array_filter($mesReservations, fn($c) => $c['statut_reservation'] === 'reservee' && strtotime($c['date_creneau'] . ' ' . $c['heure_fin']) >= time()));
$passes = array_filter($mesReservations, fn($c) => !($c['statut_reservation'] === 'reservee' && strtotime($c['date_creneau'] . ' ' . $c['heure_fin']) >= time()));

$types = array_values(array_filter(['code', 'conduite'], fn($t) => peut_reserver($dossier, $t)));
$disponibles = [];
if ($types) {
    $in = implode(',', array_fill(0, count($types), '?'));
    $disponibles = q("SELECT c.*, u.prenoms AS moniteur_prenoms, u.nom AS moniteur_nom, v.marque, v.modele,
                             (SELECT COUNT(*) FROM reservations r WHERE r.creneau_id = c.id AND r.statut IN ('reservee', 'presente')) AS pris
                      FROM creneaux c
                      JOIN moniteurs m ON m.id = c.moniteur_id JOIN utilisateurs u ON u.id = m.utilisateur_id
                      LEFT JOIN vehicules v ON v.id = c.vehicule_id
                      WHERE c.type IN ($in) AND (c.categorie_id IS NULL OR c.categorie_id = ?)
                        AND TIMESTAMP(c.date_creneau, c.heure_debut) > NOW()
                        AND c.date_creneau <= CURDATE() + INTERVAL 21 DAY
                        AND NOT EXISTS (SELECT 1 FROM reservations r2 WHERE r2.creneau_id = c.id AND r2.inscription_id = ? AND r2.statut = 'reservee')
                      ORDER BY c.date_creneau, c.heure_debut",
                     [...$types, $dossier['categorie_id'], $dossier['id']])->fetchAll();
}

$titre = 'Planning';
require RACINE . '/includes/header.php';

$carteCreneau = function (array $c, string $boutons): string {
    $detail = ($c['type'] === 'code' ? 'Cours de code' : 'Leçon de conduite') . ' · ' . $c['lieu'];
    $sous = 'Moniteur : ' . $c['moniteur_prenoms'] . ' ' . $c['moniteur_nom'] . (!empty($c['marque']) ? ' · ' . $c['marque'] . ' ' . $c['modele'] : '');
    return '<div class="carte creneau ' . e($c['type']) . ' mb-2" style="height:auto"><div class="d-flex justify-content-between align-items-center gap-2 flex-wrap">'
         . '<div><strong>' . e(jour_fr($c['date_creneau'])) . '</strong> · ' . e(heure_fr($c['heure_debut'])) . '–' . e(heure_fr($c['heure_fin']))
         . '<br><span class="small">' . e($detail) . '</span><br><span class="small text-secondary">' . e($sous) . '</span></div>'
         . '<div>' . $boutons . '</div></div></div>';
};
?>
<section class="ae-section">
    <div class="container" style="max-width: 900px">
        <h1 class="h2">Planning des cours</h1>
        <?= onglets_candidat('planning') ?>
        <?= afficher_flash() ?>

        <h2 class="h5">Mes cours réservés</h2>
        <?php if (!$aVenir): ?>
            <p class="text-secondary">Vous n'avez aucun cours à venir.</p>
        <?php endif; ?>
        <?php foreach ($aVenir as $c):
            $annulable = strtotime($c['date_creneau'] . ' ' . $c['heure_debut']) - time() >= DELAI_ANNULATION_H * 3600;
            $btn = $annulable
                ? '<form method="post">' . csrf_champ() . '<input type="hidden" name="creneau_id" value="' . (int) $c['id'] . '"><input type="hidden" name="action" value="annuler">'
                  . '<button class="btn btn-sm btn-outline-danger" type="submit" data-confirmer="Annuler ce cours ?">Annuler</button></form>'
                : '<span class="badge text-bg-success">Confirmé</span>';
            echo $carteCreneau($c, $btn);
        endforeach; ?>

        <h2 class="h5 mt-4">Créneaux disponibles <span class="fw-normal text-secondary fs-6">(3 prochaines semaines)</span></h2>
        <?php if (!$types): ?>
            <div class="alert alert-info">
                <?php if ($dossier['statut'] === 'en_attente'): ?>
                    La réservation sera ouverte dès que votre dossier aura été validé par l'agence.
                <?php else: ?>
                    La réservation n'est pas disponible pour votre dossier (statut : <?= e(STATUTS_DOSSIER[$dossier['statut']][0]) ?>).
                <?php endif; ?>
            </div>
        <?php elseif (!$disponibles): ?>
            <p class="text-secondary">Aucun créneau n'est ouvert pour le moment. Revenez bientôt ou contactez l'agence.</p>
        <?php endif; ?>
        <?php foreach ($disponibles as $c):
            $places = (int) $c['capacite'] - (int) $c['pris'];
            if ($places <= 0) {
                $btn = '<span class="badge text-bg-secondary">Complet</span>';
            } else {
                $btn = '<form method="post" class="text-end">' . csrf_champ() . '<input type="hidden" name="creneau_id" value="' . (int) $c['id'] . '"><input type="hidden" name="action" value="reserver">'
                     . ($c['capacite'] > 1 ? '<div class="small text-secondary mb-1">' . $places . ' place' . ($places > 1 ? 's' : '') . '</div>' : '')
                     . '<button class="btn btn-primary" type="submit">Réserver</button></form>';
            }
            echo $carteCreneau($c, $btn);
        endforeach; ?>

        <?php if ($passes): ?>
            <h2 class="h5 mt-4">Historique</h2>
            <div class="table-responsive">
                <table class="table table-sm">
                    <thead><tr><th>Date</th><th>Cours</th><th>Présence</th></tr></thead>
                    <tbody>
                    <?php $etats = ['presente' => ['Présent(e)', 'success'], 'absente' => ['Absent(e)', 'danger'], 'reservee' => ['Non pointé', 'secondary']];
                    foreach ($passes as $c): ?>
                        <tr>
                            <td><?= e(date_fr($c['date_creneau'])) ?> · <?= e(heure_fr($c['heure_debut'])) ?></td>
                            <td><?= $c['type'] === 'code' ? 'Code' : 'Conduite' ?></td>
                            <td><?= badge($etats, $c['statut_reservation']) ?></td>
                        </tr>
                    <?php endforeach; ?>
                    </tbody>
                </table>
            </div>
        <?php endif; ?>
    </div>
</section>
<?php require RACINE . '/includes/footer.php'; ?>
