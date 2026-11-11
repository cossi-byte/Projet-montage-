<?php
/**
 * Requête commune à la liste des candidats et à son export (mêmes filtres, mêmes résultats).
 * Renvoie [lignes, filtres nettoyés].
 */
function candidats_filtres(array $source, ?int $limite = null, int $decalage = 0): array
{
    $f = [
        'recherche' => trim((string) ($source['q'] ?? '')),
        'statut'    => isset(STATUTS_DOSSIER[$source['statut'] ?? '']) ? $source['statut'] : '',
        'categorie' => (int) ($source['categorie'] ?? 0),
        'solde'     => in_array($source['solde'] ?? '', ['du', 'regle'], true) ? $source['solde'] : '',
    ];
    $where = [];
    $params = [];
    if ($f['recherche'] !== '') {
        $like = '%' . str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $f['recherche']) . '%';
        $tel = preg_replace('/\D+/', '', $f['recherche']);
        $where[] = '(u.nom LIKE ? OR u.prenoms LIKE ? OR i.numero_dossier LIKE ?' . ($tel !== '' ? ' OR u.telephone LIKE ?' : '') . ')';
        array_push($params, $like, $like, $like);
        if ($tel !== '') {
            $params[] = '%' . $tel . '%';
        }
    }
    if ($f['statut'] !== '') {
        $where[] = 'i.statut = ?';
        $params[] = $f['statut'];
    }
    if ($f['categorie']) {
        $where[] = 'i.categorie_id = ?';
        $params[] = $f['categorie'];
    }
    $having = match ($f['solde']) {
        'du'    => 'HAVING paye < i.montant_total',
        'regle' => 'HAVING paye >= i.montant_total',
        default => '',
    };
    $sql = "SELECT i.id, i.numero_dossier, i.formule, i.statut, i.montant_total, i.date_naissance, i.created_at,
                   u.nom, u.prenoms, u.telephone, u.email, c.code AS categorie_code,
                   COALESCE((SELECT SUM(p.montant) FROM paiements p WHERE p.inscription_id = i.id AND p.statut = 'confirme'), 0) AS paye
            FROM inscriptions i
            JOIN utilisateurs u ON u.id = i.utilisateur_id
            JOIN categories c ON c.id = i.categorie_id "
         . ($where ? 'WHERE ' . implode(' AND ', $where) : '') . " $having ORDER BY i.id DESC"
         . ($limite !== null ? ' LIMIT ' . (int) $limite . ' OFFSET ' . (int) $decalage : '');
    return [q($sql, $params)->fetchAll(), $f];
}
