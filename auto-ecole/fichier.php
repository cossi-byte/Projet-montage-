<?php
/**
 * Sert une pièce justificative après contrôle des droits :
 * seuls le candidat propriétaire et l'administration peuvent la consulter.
 */
require __DIR__ . '/includes/init.php';

$u = exiger_role('candidat', 'admin');

$doc = q('SELECT d.*, i.utilisateur_id FROM documents d JOIN inscriptions i ON i.id = d.inscription_id WHERE d.id = ?',
         [(int) ($_GET['id'] ?? 0)])->fetch();

if (!$doc || ($u['role'] === 'candidat' && (int) $doc['utilisateur_id'] !== (int) $u['id'])) {
    http_response_code(404);
    exit('Document introuvable.');
}
$chemin = dossier_uploads() . '/' . basename($doc['fichier']);
if (!isset(UPLOAD_TYPES[$doc['mime']]) || !is_file($chemin)) {
    http_response_code(404);
    exit('Fichier absent du serveur.');
}

header('Content-Type: ' . $doc['mime']);
header('Content-Length: ' . filesize($chemin));
header('Content-Disposition: inline; filename="' . $doc['type'] . '-' . (int) $doc['inscription_id'] . '.' . UPLOAD_TYPES[$doc['mime']] . '"');
header('Cache-Control: private, no-store');
readfile($chemin);
