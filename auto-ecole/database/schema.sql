-- ============================================================
--  AUTO-ÉCOLE — Schéma complet + données de démonstration
--  MySQL 5.7+ / MariaDB 10.3+   —   Encodage : utf8mb4
--
--  Import : phpMyAdmin > Importer, ou
--           mysql -u root -p < database/schema.sql
--
--  Sur un hébergement mutualisé où la base existe déjà, supprimez
--  les deux lignes CREATE DATABASE / USE ci-dessous avant l'import.
-- ============================================================

CREATE DATABASE IF NOT EXISTS auto_ecole CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE auto_ecole;

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS notifications, tentatives_connexion, messages_contact, faq, temoignages,
    reservations, creneaux, vehicules, moniteurs, paiements, documents, inscriptions,
    categories, utilisateurs;

SET FOREIGN_KEY_CHECKS = 1;

-- ------------------------------------------------------------
-- Utilisateurs (candidats, moniteurs, administrateurs)
-- ------------------------------------------------------------
CREATE TABLE utilisateurs (
    id                 INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    role               ENUM('candidat','moniteur','admin') NOT NULL DEFAULT 'candidat',
    nom                VARCHAR(80)  NOT NULL,
    prenoms            VARCHAR(120) NOT NULL,
    telephone          VARCHAR(15)  NOT NULL,
    email              VARCHAR(150) NULL,
    mot_de_passe       VARCHAR(255) NOT NULL,
    actif              TINYINT(1)   NOT NULL DEFAULT 1,
    derniere_connexion DATETIME     NULL,
    created_at         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_utilisateurs_telephone (telephone),
    UNIQUE KEY uq_utilisateurs_email (email),
    KEY idx_utilisateurs_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Catégories de permis et tarifs (FCFA)
-- ------------------------------------------------------------
CREATE TABLE categories (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    code            VARCHAR(3)   NOT NULL,
    libelle         VARCHAR(100) NOT NULL,
    description     TEXT         NOT NULL,
    age_minimum     TINYINT UNSIGNED NOT NULL DEFAULT 18,
    duree_semaines  TINYINT UNSIGNED NOT NULL DEFAULT 8,
    heures_code     SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    heures_conduite SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    prix_code       INT UNSIGNED NOT NULL DEFAULT 0,
    prix_conduite   INT UNSIGNED NOT NULL DEFAULT 0,
    prix_complet    INT UNSIGNED NOT NULL DEFAULT 0,
    pieces          TEXT         NOT NULL COMMENT 'Une pièce à fournir par ligne',
    ordre           TINYINT UNSIGNED NOT NULL DEFAULT 0,
    actif           TINYINT(1)   NOT NULL DEFAULT 1,
    UNIQUE KEY uq_categories_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Inscriptions (dossier du candidat)
-- ------------------------------------------------------------
CREATE TABLE inscriptions (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    numero_dossier  VARCHAR(20)  NULL,
    utilisateur_id  INT UNSIGNED NOT NULL,
    categorie_id    INT UNSIGNED NOT NULL,
    formule         ENUM('code','conduite','complet') NOT NULL,
    date_naissance  DATE         NOT NULL,
    montant_total   INT UNSIGNED NOT NULL,
    nb_tranches     TINYINT UNSIGNED NOT NULL DEFAULT 1,
    statut          ENUM('en_attente','valide','en_formation','examen','admis','ajourne','rejete')
                    NOT NULL DEFAULT 'en_attente',
    note_admin      TEXT         NULL,
    created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_inscriptions_numero (numero_dossier),
    KEY idx_inscriptions_statut (statut),
    KEY idx_inscriptions_date (created_at),
    CONSTRAINT fk_inscriptions_utilisateur FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id) ON DELETE CASCADE,
    CONSTRAINT fk_inscriptions_categorie  FOREIGN KEY (categorie_id)  REFERENCES categories(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Pièces justificatives
-- ------------------------------------------------------------
CREATE TABLE documents (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    inscription_id  INT UNSIGNED NOT NULL,
    type            ENUM('piece_identite','photo','certificat_medical') NOT NULL,
    fichier         VARCHAR(100) NOT NULL COMMENT 'Nom aléatoire sur le disque',
    nom_original    VARCHAR(255) NOT NULL,
    mime            VARCHAR(60)  NOT NULL,
    taille          INT UNSIGNED NOT NULL,
    statut          ENUM('en_attente','valide','rejete') NOT NULL DEFAULT 'en_attente',
    motif_rejet     VARCHAR(255) NULL,
    created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_documents_type (inscription_id, type),
    CONSTRAINT fk_documents_inscription FOREIGN KEY (inscription_id) REFERENCES inscriptions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Paiements (tranches)
-- ------------------------------------------------------------
CREATE TABLE paiements (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    inscription_id  INT UNSIGNED NOT NULL,
    reference       VARCHAR(30)  NOT NULL,
    montant         INT UNSIGNED NOT NULL,
    mode            ENUM('mobile_money','especes') NOT NULL,
    operateur       VARCHAR(20)  NULL COMMENT 'mtn, moov…',
    statut          ENUM('en_attente','confirme','echoue','annule') NOT NULL DEFAULT 'en_attente',
    transaction_id  VARCHAR(80)  NULL COMMENT 'Identifiant chez l''agrégateur',
    confirme_par    INT UNSIGNED NULL,
    date_paiement   DATETIME     NULL,
    created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_paiements_reference (reference),
    KEY idx_paiements_statut (statut),
    KEY idx_paiements_date (date_paiement),
    CONSTRAINT fk_paiements_inscription FOREIGN KEY (inscription_id) REFERENCES inscriptions(id) ON DELETE CASCADE,
    CONSTRAINT fk_paiements_admin FOREIGN KEY (confirme_par) REFERENCES utilisateurs(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Moniteurs
-- ------------------------------------------------------------
CREATE TABLE moniteurs (
    id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    utilisateur_id   INT UNSIGNED NOT NULL,
    specialite       ENUM('code','conduite','les_deux') NOT NULL DEFAULT 'les_deux',
    numero_agrement  VARCHAR(40) NULL,
    UNIQUE KEY uq_moniteurs_utilisateur (utilisateur_id),
    CONSTRAINT fk_moniteurs_utilisateur FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Véhicules
-- ------------------------------------------------------------
CREATE TABLE vehicules (
    id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    immatriculation  VARCHAR(20) NOT NULL,
    marque           VARCHAR(60) NOT NULL,
    modele           VARCHAR(60) NOT NULL,
    categorie_id     INT UNSIGNED NULL,
    statut           ENUM('disponible','maintenance','hors_service') NOT NULL DEFAULT 'disponible',
    UNIQUE KEY uq_vehicules_immat (immatriculation),
    CONSTRAINT fk_vehicules_categorie FOREIGN KEY (categorie_id) REFERENCES categories(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Créneaux de cours (code / conduite)
-- ------------------------------------------------------------
CREATE TABLE creneaux (
    id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    type          ENUM('code','conduite') NOT NULL,
    categorie_id  INT UNSIGNED NULL COMMENT 'NULL = toutes catégories',
    moniteur_id   INT UNSIGNED NOT NULL,
    vehicule_id   INT UNSIGNED NULL,
    date_creneau  DATE NOT NULL,
    heure_debut   TIME NOT NULL,
    heure_fin     TIME NOT NULL,
    capacite      SMALLINT UNSIGNED NOT NULL DEFAULT 1,
    lieu          VARCHAR(120) NOT NULL DEFAULT 'Agence',
    KEY idx_creneaux_date (date_creneau, heure_debut),
    CONSTRAINT fk_creneaux_categorie FOREIGN KEY (categorie_id) REFERENCES categories(id) ON DELETE SET NULL,
    CONSTRAINT fk_creneaux_moniteur  FOREIGN KEY (moniteur_id)  REFERENCES moniteurs(id) ON DELETE CASCADE,
    CONSTRAINT fk_creneaux_vehicule  FOREIGN KEY (vehicule_id)  REFERENCES vehicules(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Réservations de créneaux
-- ------------------------------------------------------------
CREATE TABLE reservations (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    creneau_id      INT UNSIGNED NOT NULL,
    inscription_id  INT UNSIGNED NOT NULL,
    statut          ENUM('reservee','annulee','presente','absente') NOT NULL DEFAULT 'reservee',
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_reservations (creneau_id, inscription_id),
    CONSTRAINT fk_reservations_creneau     FOREIGN KEY (creneau_id)     REFERENCES creneaux(id)     ON DELETE CASCADE,
    CONSTRAINT fk_reservations_inscription FOREIGN KEY (inscription_id) REFERENCES inscriptions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Contenus du site
-- ------------------------------------------------------------
CREATE TABLE temoignages (
    id       INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nom      VARCHAR(100) NOT NULL,
    permis   VARCHAR(40)  NOT NULL,
    note     TINYINT UNSIGNED NOT NULL DEFAULT 5,
    message  TEXT NOT NULL,
    actif    TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE faq (
    id        INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    question  VARCHAR(255) NOT NULL,
    reponse   TEXT NOT NULL,
    ordre     SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    actif     TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE messages_contact (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nom         VARCHAR(120) NOT NULL,
    telephone   VARCHAR(20)  NOT NULL,
    email       VARCHAR(150) NULL,
    sujet       VARCHAR(150) NOT NULL,
    message     TEXT NOT NULL,
    lu          TINYINT(1) NOT NULL DEFAULT 0,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Sécurité : limitation des tentatives de connexion
-- ------------------------------------------------------------
CREATE TABLE tentatives_connexion (
    id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    identifiant  VARCHAR(150) NOT NULL,
    ip           VARCHAR(45)  NOT NULL,
    created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_tentatives (identifiant, created_at),
    KEY idx_tentatives_ip (ip, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Journal des notifications (e-mails envoyés aux candidats)
-- ------------------------------------------------------------
CREATE TABLE notifications (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    utilisateur_id  INT UNSIGNED NOT NULL,
    sujet           VARCHAR(200) NOT NULL,
    message         TEXT NOT NULL,
    email_envoye    TINYINT(1) NOT NULL DEFAULT 0,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_notifications_user (utilisateur_id, created_at),
    CONSTRAINT fk_notifications_utilisateur FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
--  DONNÉES DE DÉMONSTRATION
-- ============================================================

-- Comptes par défaut (à changer dès la mise en ligne !)
--   Admin    : admin@auto-ecole.bj   /  Admin@2026
--   Moniteur : 0197000001            /  Moniteur@2026
--   Candidat : 0196000001            /  Candidat@2026
INSERT INTO utilisateurs (id, role, nom, prenoms, telephone, email, mot_de_passe, created_at) VALUES
(1, 'admin',    'ADMIN',     'Direction',        '0190000000', 'admin@auto-ecole.bj',      '$2y$10$11syJus7tdE18dHtiZFJdOTkvQW0Qe1RQeKn3TFN2C3OtZN2Y0TFi', NOW() - INTERVAL 200 DAY),
(2, 'moniteur', 'HOUNKPATIN','Rodrigue',         '0197000001', 'rodrigue@auto-ecole.bj',   '$2y$10$hFvrZ2v65/3VncM4fXrCGeAU5Nc1QC3z88fwqF/gLMFEAKGub.gHq', NOW() - INTERVAL 190 DAY),
(3, 'moniteur', 'AKPOVI',    'Clarisse',         '0197000002', 'clarisse@auto-ecole.bj',   '$2y$10$hFvrZ2v65/3VncM4fXrCGeAU5Nc1QC3z88fwqF/gLMFEAKGub.gHq', NOW() - INTERVAL 190 DAY),
(4, 'candidat', 'DOSSOU',    'Koffi Marcel',     '0196000001', 'koffi.dossou@example.com', '$2y$10$315NnVVcLiNAcqQ.6n69I.oqr3tLKnDsWTnsYy6CjXesni/dgaZVW', NOW() - INTERVAL 20 DAY),
(5, 'candidat', 'AGBODJAN',  'Sènami Ruth',      '0196000002', 'senami@example.com',       '$2y$10$315NnVVcLiNAcqQ.6n69I.oqr3tLKnDsWTnsYy6CjXesni/dgaZVW', NOW() - INTERVAL 150 DAY),
(6, 'candidat', 'ZINSOU',    'Ulrich',           '0196000003', NULL,                       '$2y$10$315NnVVcLiNAcqQ.6n69I.oqr3tLKnDsWTnsYy6CjXesni/dgaZVW', NOW() - INTERVAL 120 DAY),
(7, 'candidat', 'ADJOVI',    'Fifamè Grâce',     '0196000004', 'fifame@example.com',       '$2y$10$315NnVVcLiNAcqQ.6n69I.oqr3tLKnDsWTnsYy6CjXesni/dgaZVW', NOW() - INTERVAL 75 DAY),
(8, 'candidat', 'TOSSOU',    'Jean-Baptiste',    '0196000005', 'jb.tossou@example.com',    '$2y$10$315NnVVcLiNAcqQ.6n69I.oqr3tLKnDsWTnsYy6CjXesni/dgaZVW', NOW() - INTERVAL 45 DAY),
(9, 'candidat', 'SOGLO',     'Mahougnon Estelle','0196000006', NULL,                       '$2y$10$315NnVVcLiNAcqQ.6n69I.oqr3tLKnDsWTnsYy6CjXesni/dgaZVW', NOW() - INTERVAL 3 DAY),
(10,'candidat', 'GNONLONFOUN','Patrice',         '0196000007', 'patrice.g@example.com',    '$2y$10$315NnVVcLiNAcqQ.6n69I.oqr3tLKnDsWTnsYy6CjXesni/dgaZVW', NOW() - INTERVAL 100 DAY);

INSERT INTO categories (id, code, libelle, description, age_minimum, duree_semaines, heures_code, heures_conduite, prix_code, prix_conduite, prix_complet, pieces, ordre) VALUES
(1, 'A', 'Permis A — Moto',
 'Pour conduire les motocyclettes et tricycles à moteur. Idéal pour les zémidjans et les trajets quotidiens.',
 16, 4, 20, 10, 25000, 40000, 60000,
 'Pièce d''identité valide (CIP, carte biométrique ou passeport)\n2 photos d''identité récentes\nCertificat médical de moins de 3 mois', 1),
(2, 'B', 'Permis B — Voiture',
 'Le permis le plus demandé : véhicules légers de moins de 3,5 tonnes et de 9 places maximum.',
 18, 8, 30, 20, 40000, 90000, 120000,
 'Pièce d''identité valide (CIP, carte biométrique ou passeport)\n4 photos d''identité récentes\nCertificat médical de moins de 3 mois', 2),
(3, 'C', 'Permis C — Poids lourd',
 'Pour le transport de marchandises : camions de plus de 3,5 tonnes.',
 21, 10, 35, 25, 55000, 140000, 185000,
 'Pièce d''identité valide\n4 photos d''identité récentes\nCertificat médical de moins de 3 mois\nCopie du permis B', 3),
(4, 'D', 'Permis D — Transport en commun',
 'Pour conduire les bus et minibus de plus de 9 places affectés au transport de personnes.',
 21, 12, 40, 30, 60000, 160000, 210000,
 'Pièce d''identité valide\n4 photos d''identité récentes\nCertificat médical de moins de 3 mois\nCopie du permis B ou C', 4),
(5, 'E', 'Permis E — Remorque',
 'Extension pour tracter une remorque lourde ou conduire un ensemble articulé.',
 21, 6, 20, 20, 50000, 130000, 170000,
 'Pièce d''identité valide\n4 photos d''identité récentes\nCertificat médical de moins de 3 mois\nCopie du permis C ou D', 5);

INSERT INTO inscriptions (id, numero_dossier, utilisateur_id, categorie_id, formule, date_naissance, montant_total, nb_tranches, statut, created_at) VALUES
(1, 'AE-00001', 4,  2, 'complet',  '2001-04-12', 120000, 3, 'en_formation', NOW() - INTERVAL 20 DAY),
(2, 'AE-00002', 5,  2, 'complet',  '1998-09-03', 120000, 1, 'admis',        NOW() - INTERVAL 150 DAY),
(3, 'AE-00003', 6,  1, 'complet',  '2004-01-22',  60000, 2, 'admis',        NOW() - INTERVAL 120 DAY),
(4, 'AE-00004', 7,  2, 'code',     '2002-11-30',  40000, 1, 'examen',       NOW() - INTERVAL 75 DAY),
(5, 'AE-00005', 8,  3, 'complet',  '1994-06-18', 185000, 3, 'valide',       NOW() - INTERVAL 45 DAY),
(6, 'AE-00006', 9,  2, 'conduite', '2003-02-14',  90000, 2, 'en_attente',   NOW() - INTERVAL 3 DAY),
(7, 'AE-00007', 10, 2, 'complet',  '1999-12-05', 120000, 2, 'ajourne',      NOW() - INTERVAL 100 DAY);

-- (Les fichiers des pièces de démonstration ne sont pas fournis : seul le dossier n°6
--  n'a pas encore de pièces, les autres sont considérés comme vérifiés en agence.)

INSERT INTO paiements (inscription_id, reference, montant, mode, operateur, statut, confirme_par, date_paiement, created_at) VALUES
(1, 'PAY-DEMO-0001',  40000, 'mobile_money', 'mtn',  'confirme', NULL, NOW() - INTERVAL 20 DAY,  NOW() - INTERVAL 20 DAY),
(1, 'PAY-DEMO-0002',  40000, 'especes',      NULL,   'confirme', 1,    NOW() - INTERVAL 6 DAY,   NOW() - INTERVAL 6 DAY),
(2, 'PAY-DEMO-0003', 120000, 'mobile_money', 'moov', 'confirme', NULL, NOW() - INTERVAL 150 DAY, NOW() - INTERVAL 150 DAY),
(3, 'PAY-DEMO-0004',  30000, 'especes',      NULL,   'confirme', 1,    NOW() - INTERVAL 120 DAY, NOW() - INTERVAL 120 DAY),
(3, 'PAY-DEMO-0005',  30000, 'mobile_money', 'mtn',  'confirme', NULL, NOW() - INTERVAL 92 DAY,  NOW() - INTERVAL 92 DAY),
(4, 'PAY-DEMO-0006',  40000, 'mobile_money', 'mtn',  'confirme', NULL, NOW() - INTERVAL 75 DAY,  NOW() - INTERVAL 75 DAY),
(5, 'PAY-DEMO-0007',  62000, 'mobile_money', 'moov', 'confirme', NULL, NOW() - INTERVAL 45 DAY,  NOW() - INTERVAL 45 DAY),
(5, 'PAY-DEMO-0008',  62000, 'especes',      NULL,   'en_attente', NULL, NULL,                   NOW() - INTERVAL 1 DAY),
(6, 'PAY-DEMO-0009',  45000, 'especes',      NULL,   'en_attente', NULL, NULL,                   NOW() - INTERVAL 3 DAY),
(7, 'PAY-DEMO-0010',  60000, 'mobile_money', 'mtn',  'confirme', NULL, NOW() - INTERVAL 100 DAY, NOW() - INTERVAL 100 DAY),
(7, 'PAY-DEMO-0011',  60000, 'especes',      NULL,   'confirme', 1,    NOW() - INTERVAL 61 DAY,  NOW() - INTERVAL 61 DAY);

INSERT INTO moniteurs (id, utilisateur_id, specialite, numero_agrement) VALUES
(1, 2, 'les_deux', 'AGR-BJ-2019-0142'),
(2, 3, 'code',     'AGR-BJ-2021-0388');

INSERT INTO vehicules (id, immatriculation, marque, modele, categorie_id, statut) VALUES
(1, 'BJ 4521 RB', 'Toyota',  'Yaris',     2, 'disponible'),
(2, 'BJ 7810 RB', 'Peugeot', '301',       2, 'disponible'),
(3, 'BK 1204 RB', 'Bajaj',   'Boxer 125', 1, 'disponible'),
(4, 'BH 9933 RB', 'Renault', 'Midlum',    3, 'maintenance');

-- Créneaux générés par rapport à la date d'import, pour que le planning soit toujours rempli
INSERT INTO creneaux (id, type, categorie_id, moniteur_id, vehicule_id, date_creneau, heure_debut, heure_fin, capacite, lieu) VALUES
(1,  'code',     NULL, 2, NULL, CURDATE() + INTERVAL 1 DAY, '08:00', '10:00', 20, 'Salle de code — Agence'),
(2,  'code',     NULL, 2, NULL, CURDATE() + INTERVAL 2 DAY, '17:00', '19:00', 20, 'Salle de code — Agence'),
(3,  'code',     NULL, 2, NULL, CURDATE() + INTERVAL 4 DAY, '08:00', '10:00', 20, 'Salle de code — Agence'),
(4,  'code',     NULL, 1, NULL, CURDATE() + INTERVAL 6 DAY, '17:00', '19:00', 20, 'Salle de code — Agence'),
(5,  'conduite', 2,    1, 1,    CURDATE() + INTERVAL 1 DAY, '10:30', '11:30', 1,  'Départ agence'),
(6,  'conduite', 2,    1, 1,    CURDATE() + INTERVAL 1 DAY, '15:00', '16:00', 1,  'Départ agence'),
(7,  'conduite', 2,    1, 2,    CURDATE() + INTERVAL 2 DAY, '07:00', '08:00', 1,  'Départ agence'),
(8,  'conduite', 2,    1, 2,    CURDATE() + INTERVAL 3 DAY, '16:00', '17:00', 1,  'Départ agence'),
(9,  'conduite', 2,    1, 1,    CURDATE() + INTERVAL 5 DAY, '09:00', '10:00', 1,  'Départ agence'),
(10, 'conduite', 1,    1, 3,    CURDATE() + INTERVAL 2 DAY, '11:00', '12:00', 1,  'Piste moto'),
(11, 'conduite', 1,    1, 3,    CURDATE() + INTERVAL 5 DAY, '11:00', '12:00', 1,  'Piste moto'),
(12, 'code',     NULL, 2, NULL, CURDATE() - INTERVAL 3 DAY, '08:00', '10:00', 20, 'Salle de code — Agence');

INSERT INTO reservations (creneau_id, inscription_id, statut) VALUES
(1, 1, 'reservee'),
(5, 1, 'reservee'),
(12, 1, 'presente');

INSERT INTO temoignages (nom, permis, note, message) VALUES
('Sènami A.',  'Permis B', 5, 'J''ai eu mon permis du premier coup ! Les moniteurs sont patients et expliquent très bien. Le paiement en plusieurs fois m''a vraiment aidée.'),
('Ulrich Z.',  'Permis A', 5, 'Inscription faite depuis mon téléphone en dix minutes. Je réservais mes heures de conduite le soir après le travail, très pratique.'),
('Florent K.', 'Permis C', 4, 'Formation sérieuse, véhicules en bon état. On est bien préparé pour l''examen de l''ANaTT.'),
('Nadège H.',  'Permis B', 5, 'J''avais très peur de conduire à Cotonou. Aujourd''hui je circule seule sans stress. Merci à toute l''équipe !');

INSERT INTO faq (question, reponse, ordre) VALUES
('Quel âge faut-il avoir pour s''inscrire ?',
 'Il faut avoir au moins 16 ans pour le permis A (moto), 18 ans pour le permis B (voiture) et 21 ans pour les permis C, D et E.', 1),
('Quelles pièces dois-je fournir ?',
 'Une pièce d''identité valide (CIP, carte biométrique ou passeport), une photo d''identité récente et un certificat médical de moins de 3 mois. Vous pouvez les envoyer en photo directement depuis votre téléphone lors de l''inscription.', 2),
('Puis-je payer en plusieurs fois ?',
 'Oui. Vous pouvez régler en 1, 2 ou 3 tranches. La première tranche est versée à l''inscription, les suivantes depuis votre espace candidat ou à l''agence.', 3),
('Quels moyens de paiement acceptez-vous ?',
 'MTN Mobile Money et Moov Money directement en ligne, ou en espèces à l''agence. Chaque paiement donne droit à un reçu PDF téléchargeable.', 4),
('Combien de temps dure la formation ?',
 'Entre 4 et 12 semaines selon la catégorie de permis et votre disponibilité. La durée indicative est précisée sur la page Formations.', 5),
('Comment réserver mes cours de code et de conduite ?',
 'Dès que votre dossier est validé, connectez-vous à votre espace candidat, rubrique « Planning », et choisissez les créneaux qui vous conviennent.', 6),
('Que se passe-t-il si j''échoue à l''examen ?',
 'Pas d''inquiétude : nous vous proposons des séances de remise à niveau et vous représentons à la session suivante. Renseignez-vous à l''agence pour les conditions.', 7),
('Mon dossier est « en attente », que dois-je faire ?',
 'Rien de particulier : notre équipe vérifie vos pièces sous 48 heures ouvrées. Vous recevrez une notification dès la validation. Si une pièce est refusée, vous pourrez la renvoyer depuis votre espace.', 8);

INSERT INTO messages_contact (nom, telephone, email, sujet, message, created_at) VALUES
('Prudence Ahouansou', '0195112233', NULL, 'Horaires du samedi', 'Bonjour, est-ce que les cours de code ont lieu aussi le samedi après-midi ? Merci.', NOW() - INTERVAL 1 DAY);
