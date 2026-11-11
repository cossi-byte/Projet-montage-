<?php
/**
 * Reçu de paiement en PDF. Accessible au candidat propriétaire et à l'administration.
 */
require dirname(__DIR__) . '/includes/init.php';
require RACINE . '/includes/pdf.php';

$u = exiger_role('candidat', 'admin');

$p = q("SELECT p.*, i.numero_dossier, i.formule, i.montant_total, i.utilisateur_id, i.id AS inscription_id,
               c.libelle AS categorie_libelle, u.nom, u.prenoms, u.telephone,
               a.nom AS admin_nom, a.prenoms AS admin_prenoms
        FROM paiements p
        JOIN inscriptions i ON i.id = p.inscription_id
        JOIN categories c ON c.id = i.categorie_id
        JOIN utilisateurs u ON u.id = i.utilisateur_id
        LEFT JOIN utilisateurs a ON a.id = p.confirme_par
        WHERE p.id = ? AND p.statut = 'confirme'", [(int) ($_GET['id'] ?? 0)])->fetch();

if (!$p || ($u['role'] === 'candidat' && (int) $p['utilisateur_id'] !== (int) $u['id'])) {
    http_response_code(404);
    exit('Reçu introuvable.');
}

// Cumul payé à la date de ce reçu
$cumul = (int) q("SELECT COALESCE(SUM(montant), 0) FROM paiements WHERE inscription_id = ? AND statut = 'confirme' AND (date_paiement < ? OR (date_paiement = ? AND id <= ?))",
                 [$p['inscription_id'], $p['date_paiement'], $p['date_paiement'], $p['id']])->fetchColumn();
$reste = max(0, (int) $p['montant_total'] - $cumul);

[$r, $v, $b] = couleur_rvb(COULEUR_PRINCIPALE);
$pdf = new PdfSimple();

// Bandeau
$pdf->rectangle(0, 0, 210, 38, $r, $v, $b);
$pdf->texte(15, 17, APP_NOM, 20, true, 'G', 1);
$pdf->texte(15, 25, APP_ADRESSE . ' — ' . APP_PAYS, 10, false, 'G', 1);
$pdf->texte(15, 31, 'Tél. ' . APP_TELEPHONE . '   ' . APP_EMAIL, 10, false, 'G', 1);
$pdf->texte(195, 17, 'REÇU DE PAIEMENT', 14, true, 'D', 1);
$pdf->texte(195, 25, 'N° ' . $p['reference'], 10, false, 'D', 1);

// Candidat
$y = 54;
$pdf->texte(15, $y, 'Reçu de', 9, false, 'G', 0.45);
$pdf->texte(15, $y + 7, $p['nom'] . ' ' . $p['prenoms'], 13, true);
$pdf->texte(15, $y + 13, 'Téléphone : ' . telephone_affiche($p['telephone']), 10);
$pdf->texte(195, $y, 'Date du paiement', 9, false, 'D', 0.45);
$pdf->texte(195, $y + 7, date_fr($p['date_paiement'], true), 12, true, 'D');
$pdf->texte(195, $y + 13, 'Dossier n° ' . $p['numero_dossier'], 10, false, 'D');

// Détail
$y = 84;
$pdf->rectangle(15, $y, 180, 9, 238, 242, 247);
$pdf->texte(18, $y + 6.2, 'Désignation', 10, true);
$pdf->texte(192, $y + 6.2, 'Montant', 10, true, 'D');
$y += 17;
$pdf->texte(18, $y, 'Formation ' . $p['categorie_libelle'], 11);
$pdf->texte(192, $y, fcfa($p['montant']), 11, true, 'D');
$pdf->texte(18, $y + 6, FORMULES[$p['formule']], 9, false, 'G', 0.45);
$mode = MODES_PAIEMENT[$p['mode']] . ($p['operateur'] ? ' (' . (OPERATEURS[$p['operateur']] ?? $p['operateur']) . ')' : '');
$pdf->texte(18, $y + 11, 'Mode de paiement : ' . $mode, 9, false, 'G', 0.45);
if ($p['transaction_id']) {
    $pdf->texte(18, $y + 16, 'Transaction : ' . $p['transaction_id'], 9, false, 'G', 0.45);
}
$y += 23;
$pdf->ligne(15, $y, 195, $y, 0.2, 0.7);

// Totaux
$lignes = [
    ['Montant total de la formation', fcfa($p['montant_total']), false],
    ['Total payé à ce jour', fcfa($cumul), false],
    ['Reste à payer', fcfa($reste), true],
];
foreach ($lignes as $i => [$libelle, $valeur, $gras]) {
    $pdf->texte(120, $y + 8 + $i * 7, $libelle, 10, $gras);
    $pdf->texte(192, $y + 8 + $i * 7, $valeur, 10, $gras, 'D');
}
$y += 38;
$pdf->rectangle(15, $y, 180, 16, 232, 245, 238);
$pdf->texte(105, $y + 7, 'Montant reçu : ' . fcfa($p['montant']), 14, true, 'C');
$pdf->texte(105, $y + 12.5, $reste === 0 ? 'Formation entièrement réglée' : 'Paiement partiel — solde restant : ' . fcfa($reste), 9, false, 'C', 0.3);

$y += 30;
if ($p['mode'] === 'especes' && $p['admin_nom']) {
    $pdf->texte(15, $y, 'Encaissé par : ' . $p['admin_prenoms'] . ' ' . $p['admin_nom'], 10);
}
$pdf->texte(195, $y, 'Cachet et signature de l\'auto-école', 10, false, 'D', 0.45);

$pdf->ligne(15, 275, 195, 275, 0.2, 0.7);
$pdf->texte(105, 281, 'Reçu généré le ' . date('d/m/Y à H\hi') . ' — ' . APP_NOM . ', ' . APP_VILLE . '. Document à conserver.', 8, false, 'C', 0.45);

$pdf->envoyer('recu-' . $p['reference'] . '.pdf', !isset($_GET['voir']));
