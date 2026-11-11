<?php
/**
 * Retour de FedaPay après paiement.
 * Les paramètres de l'URL ne sont PAS dignes de confiance : le statut et le montant
 * sont relus chez FedaPay avec la clé secrète avant de confirmer quoi que ce soit.
 */
require __DIR__ . '/_debut.php';
require_once RACINE . '/includes/fedapay.php';

$p = q("SELECT * FROM paiements WHERE reference = ? AND inscription_id = ? AND mode = 'mobile_money'",
       [(string) ($_GET['ref'] ?? ''), $dossier['id']])->fetch();

if (!$p || !$p['transaction_id']) {
    flash('danger', 'Paiement introuvable.');
} elseif ($p['statut'] === 'confirme') {
    flash('success', 'Votre paiement de ' . fcfa($p['montant']) . ' est confirmé.');
} elseif (!fedapay_actif()) {
    flash('danger', 'Le service de paiement n\'est pas configuré.');
} else {
    try {
        $t = fedapay_transaction($p['transaction_id']);
        if (in_array($t['statut'], ['approved', 'transferred'], true) && $t['montant'] >= (int) $p['montant']) {
            confirmer_paiement((int) $p['id']);
            flash('success', 'Merci ! Votre paiement de ' . fcfa($p['montant']) . ' est confirmé. Votre reçu est disponible ci-dessous.');
        } elseif ($t['statut'] === 'pending') {
            flash('info', 'Votre paiement est en cours de traitement chez l\'opérateur. Rechargez cette page dans quelques instants.');
        } else {
            q("UPDATE paiements SET statut = 'echoue' WHERE id = ? AND statut = 'en_attente'", [$p['id']]);
            flash('danger', 'Le paiement n\'a pas abouti (refusé ou annulé). Aucun montant n\'a été enregistré. Vous pouvez réessayer.');
        }
    } catch (Throwable $ex) {
        error_log('FedaPay retour : ' . $ex->getMessage());
        flash('warning', 'Nous n\'avons pas pu vérifier votre paiement pour l\'instant. S\'il a été débité, il sera confirmé par l\'agence : conservez la référence ' . $p['reference'] . '.');
    }
}
rediriger('candidat/paiements.php');
