<?php
/**
 * Connexion à la base de données MySQL.
 * XAMPP par défaut : hôte localhost, utilisateur root, mot de passe vide.
 * Les variables d'environnement AE_DB_* (facultatives) ont priorité.
 */
return [
    'hote'         => getenv('AE_DB_HOTE') ?: 'localhost',
    'port'         => (int) (getenv('AE_DB_PORT') ?: 3306),
    'base'         => getenv('AE_DB_BASE') ?: 'auto_ecole',
    'utilisateur'  => getenv('AE_DB_UTILISATEUR') ?: 'root',
    'mot_de_passe' => getenv('AE_DB_MOT_DE_PASSE') !== false ? getenv('AE_DB_MOT_DE_PASSE') : '',
];
