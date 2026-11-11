<?php
/**
 * Export de la liste des candidats (mêmes filtres que la page Candidats) en Excel ou en PDF.
 */
require __DIR__ . '/_debut.php';
require __DIR__ . '/_candidats_requete.php';

[$lignes, $f] = candidats_filtres($_GET);
$nom = 'candidats-' . date('Y-m-d');

if (($_GET['format'] ?? '') === 'xlsx') {
    require RACINE . '/includes/xlsx.php';
    $donnees = [];
    foreach ($lignes as $l) {
        $donnees[] = [
            $l['numero_dossier'], $l['nom'], $l['prenoms'], telephone_affiche($l['telephone']), (string) $l['email'],
            date_fr($l['date_naissance']), $l['categorie_code'], FORMULES[$l['formule']], STATUTS_DOSSIER[$l['statut']][0],
            (int) $l['montant_total'], (int) $l['paye'], max(0, (int) $l['montant_total'] - (int) $l['paye']), date_fr($l['created_at']),
        ];
    }
    envoyer_excel($nom, 'Candidats',
        ['Dossier', 'Nom', 'Prénoms', 'Téléphone', 'E-mail', 'Né(e) le', 'Permis', 'Formule', 'Statut', 'Total (FCFA)', 'Payé (FCFA)', 'Reste (FCFA)', 'Inscrit le'],
        $donnees);
}

// ---------- PDF (A4 paysage) ----------
require RACINE . '/includes/pdf.php';
$pdf = new PdfSimple(true);
[$r, $v, $b] = couleur_rvb(COULEUR_PRINCIPALE);
// [titre, x, largeur, alignement]
$colonnes = [
    ['Dossier', 10, 22, 'G'], ['Candidat', 32, 70, 'G'], ['Téléphone', 102, 30, 'G'], ['Permis', 132, 14, 'G'], ['Formule', 146, 22, 'G'],
    ['Statut', 168, 26, 'G'], ['Total', 194, 28, 'D'], ['Payé', 222, 28, 'D'], ['Reste', 250, 37, 'D'],
];
$filtres = array_filter([
    $f['recherche'] !== '' ? 'recherche « ' . $f['recherche'] . ' »' : '',
    $f['statut'] ? 'statut : ' . STATUTS_DOSSIER[$f['statut']][0] : '',
    $f['solde'] ? ($f['solde'] === 'du' ? 'solde dû' : 'tout réglé') : '',
]);
$page = 0;
$entete = function () use ($pdf, $colonnes, $r, $v, $b, $filtres, $lignes, &$page): float {
    $page++;
    $pdf->texte(10, 14, APP_NOM . ' — Liste des candidats', 14, true);
    $pdf->texte(287, 14, 'Édité le ' . date('d/m/Y à H\hi') . ' · page ' . $page, 9, false, 'D', 0.4);
    $pdf->texte(10, 20, count($lignes) . ' candidat(s)' . ($filtres ? ' — filtres : ' . implode(', ', $filtres) : ''), 9, false, 'G', 0.4);
    $pdf->rectangle(10, 24, 277, 8, $r, $v, $b);
    foreach ($colonnes as [$t, $x, $w, $a]) {
        $pdf->texte($a === 'D' ? $x + $w - 2 : $x + 2, 29.5, $t, 9, true, $a, 1);
    }
    return 38.0;
};

$y = $entete();
$totaux = [0, 0];
foreach ($lignes as $i => $l) {
    if ($y > 195) {
        $pdf->nouvellePage();
        $y = $entete();
    }
    if ($i % 2 === 0) {
        $pdf->rectangle(10, $y - 4.5, 277, 6.5, 244, 246, 250);
    }
    $reste = max(0, (int) $l['montant_total'] - (int) $l['paye']);
    $cellules = [
        $l['numero_dossier'], $l['nom'] . ' ' . $l['prenoms'], telephone_affiche($l['telephone']), $l['categorie_code'], ucfirst($l['formule']),
        STATUTS_DOSSIER[$l['statut']][0], fcfa($l['montant_total']), fcfa($l['paye']), fcfa($reste),
    ];
    foreach ($colonnes as $k => [, $x, $w, $a]) {
        $pdf->texte($a === 'D' ? $x + $w - 2 : $x + 2, $y, $pdf->tronquer((string) $cellules[$k], $w - 3, 9), 9, false, $a);
    }
    $totaux[0] += (int) $l['paye'];
    $totaux[1] += $reste;
    $y += 6.5;
}
if (!$lignes) {
    $pdf->texte(148.5, $y + 6, 'Aucun candidat ne correspond aux filtres.', 11, false, 'C', 0.4);
} else {
    if ($y > 195) {
        $pdf->nouvellePage();
        $y = $entete();
    }
    $pdf->ligne(10, $y - 3, 287, $y - 3, 0.3);
    $pdf->texte(192, $y + 2, 'Totaux', 10, true, 'D');
    $pdf->texte(248, $y + 2, fcfa($totaux[0]), 10, true, 'D');
    $pdf->texte(285, $y + 2, fcfa($totaux[1]), 10, true, 'D');
}
$pdf->envoyer($nom . '.pdf');
