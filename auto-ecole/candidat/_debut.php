<?php
/**
 * Début commun des pages de l'espace candidat : contrôle d'accès + chargement du dossier.
 * Fournit $u (utilisateur), $dossier (inscription) et $situation (paiements).
 */
require dirname(__DIR__) . '/includes/init.php';

$u = exiger_role('candidat');
$dossier = inscription_de((int) $u['id']);
if (!$dossier) {
    http_response_code(404);
    exit('<h1>Aucun dossier</h1><p>Votre compte n\'a pas de dossier d\'inscription. Contactez l\'agence.</p>');
}
$situation = situation_paiement($dossier);
$pageActive = 'espace';
$masquerCta = true;

/** Onglets de l'espace candidat. */
function onglets_candidat(string $actif): string
{
    $onglets = [
        'dossier'   => ['candidat/index.php', 'Mon dossier'],
        'planning'  => ['candidat/planning.php', 'Planning'],
        'paiements' => ['candidat/paiements.php', 'Paiements'],
        'profil'    => ['candidat/profil.php', 'Mon compte'],
    ];
    $html = '<ul class="nav nav-pills nav-espace gap-1 mb-4">';
    foreach ($onglets as $cle => [$href, $libelle]) {
        $html .= '<li class="nav-item"><a class="nav-link' . ($cle === $actif ? ' active" aria-current="page' : '') . '" href="' . e(url($href)) . '">' . e($libelle) . '</a></li>';
    }
    return $html . '</ul>';
}
