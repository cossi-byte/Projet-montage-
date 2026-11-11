<?php
/**
 * Intégration FedaPay (MTN MoMo, Moov Money…) par l'API REST, sans dépendance.
 * Documentation : https://docs.fedapay.com
 *
 * Parcours : 1) création de la transaction  2) génération du lien de paiement
 *            3) le client paie chez FedaPay  4) retour sur paiement_retour.php,
 *               où le statut est RE-VÉRIFIÉ côté serveur avant toute confirmation.
 */
declare(strict_types=1);

function fedapay_actif(): bool
{
    return FEDAPAY_CLE_SECRETE !== '' && function_exists('curl_init');
}

function fedapay_requete(string $methode, string $chemin, ?array $donnees = null): array
{
    $base = FEDAPAY_ENVIRONNEMENT === 'live' ? 'https://api.fedapay.com/v1' : 'https://sandbox-api.fedapay.com/v1';
    $ch = curl_init($base . $chemin);
    curl_setopt_array($ch, [
        CURLOPT_CUSTOMREQUEST  => $methode,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 30,
        CURLOPT_CONNECTTIMEOUT => 15,
        CURLOPT_HTTPHEADER     => [
            'Authorization: Bearer ' . FEDAPAY_CLE_SECRETE,
            'Content-Type: application/json',
            'Accept: application/json',
        ],
    ]);
    if ($donnees !== null) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($donnees, JSON_UNESCAPED_UNICODE));
    }
    $reponse = curl_exec($ch);
    $code    = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $erreur  = curl_error($ch);
    curl_close($ch);

    if ($reponse === false) {
        throw new RuntimeException('Connexion à FedaPay impossible : ' . $erreur);
    }
    $json = json_decode((string) $reponse, true);
    if ($code < 200 || $code >= 300 || !is_array($json)) {
        throw new RuntimeException("FedaPay a répondu HTTP $code : " . mb_substr((string) $reponse, 0, 300));
    }
    return $json;
}

/** Crée la transaction et renvoie ['id' => ..., 'url' => lien de paiement]. */
function fedapay_creer_transaction(int $montant, string $description, string $urlRetour, array $client): array
{
    $c = ['firstname' => $client['prenoms'], 'lastname' => $client['nom']];
    if (!empty($client['email'])) {
        $c['email'] = $client['email'];
    }
    if (!empty($client['telephone'])) {
        $c['phone_number'] = ['number' => '+229' . $client['telephone'], 'country' => 'bj'];
    }
    $r = fedapay_requete('POST', '/transactions', [
        'description'  => $description,
        'amount'       => $montant,
        'currency'     => ['iso' => 'XOF'],
        'callback_url' => $urlRetour,
        'customer'     => $c,
    ]);
    $t = $r['v1/transaction'] ?? $r;
    if (empty($t['id'])) {
        throw new RuntimeException('Réponse FedaPay inattendue à la création de la transaction.');
    }
    $jeton = fedapay_requete('POST', '/transactions/' . rawurlencode((string) $t['id']) . '/token');
    if (empty($jeton['url'])) {
        throw new RuntimeException('Réponse FedaPay inattendue à la génération du lien de paiement.');
    }
    return ['id' => (string) $t['id'], 'url' => $jeton['url']];
}

/** Relit la transaction chez FedaPay : ['statut' => 'approved'|'pending'|'declined'|'canceled'…, 'montant' => int]. */
function fedapay_transaction(string $id): array
{
    $r = fedapay_requete('GET', '/transactions/' . rawurlencode($id));
    $t = $r['v1/transaction'] ?? $r;
    return ['statut' => (string) ($t['status'] ?? ''), 'montant' => (int) ($t['amount'] ?? 0)];
}
