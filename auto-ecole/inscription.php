<?php
/**
 * Inscription en 4 étapes : identité → permis et formule → pièces → récapitulatif et paiement.
 * Les données sont gardées en session jusqu'à la validation finale ; chaque étape est validée côté serveur.
 */
require __DIR__ . '/includes/init.php';

if ($u = utilisateur()) {
    if ($u['role'] === 'candidat') {
        flash('info', 'Vous avez déjà un dossier : retrouvez-le dans votre espace.');
    }
    rediriger(accueil_role($u['role']));
}

$_SESSION['insc'] ??= ['identite' => null, 'choix' => null, 'docs' => []];
$insc = &$_SESSION['insc'];

if (isset($_GET['permis']) && ctype_digit((string) $_GET['permis'])) {
    $insc['preselection'] = (int) $_GET['permis'];
}

$categories = [];
foreach (categories() as $c) {
    $categories[(int) $c['id']] = $c;
}

// Première étape non terminée : on ne peut pas sauter d'étape
$etapeMax = 1;
if ($insc['identite']) {
    $etapeMax = 2;
    if ($insc['choix']) {
        $etapeMax = 3;
        if (count($insc['docs']) === count(TYPES_DOCUMENT)) {
            $etapeMax = 4;
        }
    }
}
$etape = max(1, min(4, (int) ($_GET['etape'] ?? $etapeMax)));
if ($etape > $etapeMax) {
    rediriger('inscription.php?etape=' . $etapeMax);
}

$erreurs = [];
$v = $insc['identite'] ?? ['nom' => '', 'prenoms' => '', 'date_naissance' => '', 'telephone' => '', 'email' => ''];

if (est_post()) {
    csrf_verifier();

    // ======================= Étape 1 : identité =======================
    if ($etape === 1) {
        $v = [
            'nom'            => mb_strtoupper(champ('nom')),
            'prenoms'        => champ('prenoms'),
            'date_naissance' => champ('date_naissance'),
            'telephone'      => champ('telephone'),
            'email'          => mb_strtolower(champ('email')),
        ];
        $mdp  = (string) ($_POST['mot_de_passe'] ?? '');
        $mdp2 = (string) ($_POST['mot_de_passe_confirmation'] ?? '');
        $tel  = normaliser_telephone($v['telephone']);
        $motifNom = '/^[\p{L}][\p{L} \'’\-]*$/u';

        if (mb_strlen($v['nom']) < 2 || mb_strlen($v['nom']) > 80 || !preg_match($motifNom, $v['nom'])) {
            $erreurs[] = 'Nom invalide : utilisez uniquement des lettres (2 à 80 caractères).';
        }
        if (mb_strlen($v['prenoms']) < 2 || mb_strlen($v['prenoms']) > 120 || !preg_match($motifNom, $v['prenoms'])) {
            $erreurs[] = 'Prénoms invalides : utilisez uniquement des lettres (2 à 120 caractères).';
        }
        if (!date_valide($v['date_naissance'])) {
            $erreurs[] = 'Indiquez votre date de naissance.';
        } elseif ($v['date_naissance'] > date('Y-m-d') || age($v['date_naissance']) > 90) {
            $erreurs[] = 'La date de naissance n\'est pas plausible.';
        } elseif (age($v['date_naissance']) < 16) {
            $erreurs[] = 'Il faut avoir au moins 16 ans pour s\'inscrire.';
        }
        if ($tel === null) {
            $erreurs[] = 'Numéro de téléphone invalide. Exemple : 01 97 00 00 00.';
        } elseif (q('SELECT 1 FROM utilisateurs WHERE telephone = ?', [$tel])->fetch()) {
            $erreurs[] = 'Ce numéro de téléphone a déjà un compte. Connectez-vous à votre espace.';
        }
        if ($v['email'] !== '') {
            if (!email_valide($v['email'])) {
                $erreurs[] = 'Adresse e-mail invalide.';
            } elseif (q('SELECT 1 FROM utilisateurs WHERE email = ?', [$v['email']])->fetch()) {
                $erreurs[] = 'Cette adresse e-mail a déjà un compte. Connectez-vous à votre espace.';
            }
        }
        $hash = $insc['identite']['hash'] ?? null;
        if ($mdp !== '' || !$hash) {
            if ($err = erreur_mot_de_passe($mdp)) {
                $erreurs[] = $err;
            } elseif ($mdp !== $mdp2) {
                $erreurs[] = 'Les deux mots de passe ne sont pas identiques.';
            } else {
                $hash = password_hash($mdp, PASSWORD_DEFAULT);
            }
        }

        if (!$erreurs) {
            $insc['identite'] = ['telephone' => $tel, 'hash' => $hash] + $v;
            // Si l'âge a changé, le choix du permis doit être revalidé
            if ($insc['choix'] && age($v['date_naissance']) < (int) ($categories[$insc['choix']['categorie_id']]['age_minimum'] ?? 99)) {
                $insc['choix'] = null;
            }
            rediriger('inscription.php?etape=2');
        }
    }

    // ======================= Étape 2 : permis et formule =======================
    if ($etape === 2) {
        $catId   = (int) ($_POST['categorie_id'] ?? 0);
        $formule = champ('formule');
        $cat     = $categories[$catId] ?? null;

        if (!$cat) {
            $erreurs[] = 'Choisissez une catégorie de permis.';
        } elseif (age($insc['identite']['date_naissance']) < (int) $cat['age_minimum']) {
            $erreurs[] = 'Il faut avoir au moins ' . (int) $cat['age_minimum'] . ' ans pour le permis ' . $cat['code'] . '.';
        }
        if (!isset(FORMULES[$formule])) {
            $erreurs[] = 'Choisissez une formule.';
        }
        $insc['choix_saisi'] = ['categorie_id' => $catId, 'formule' => $formule];
        if (!$erreurs) {
            $insc['choix'] = ['categorie_id' => $catId, 'formule' => $formule];
            rediriger('inscription.php?etape=3');
        }
    }

    // ======================= Étape 3 : pièces =======================
    if ($etape === 3) {
        // Si le total envoyé dépasse post_max_size, PHP vide $_POST et $_FILES
        foreach (TYPES_DOCUMENT as $type => $libelle) {
            $f = $_FILES[$type] ?? null;
            if ($f && ($f['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE) {
                try {
                    $meta = enregistrer_upload($f, $libelle);
                    if (isset($insc['docs'][$type])) {
                        supprimer_upload($insc['docs'][$type]['fichier']);
                    }
                    $insc['docs'][$type] = $meta;
                } catch (RuntimeException $ex) {
                    $erreurs[] = $ex->getMessage();
                }
            } elseif (!isset($insc['docs'][$type])) {
                $erreurs[] = "$libelle : ajoutez ce document.";
            }
        }
        if (!$erreurs) {
            rediriger('inscription.php?etape=4');
        }
    }

    // ======================= Étape 4 : validation et paiement =======================
    if ($etape === 4) {
        $nbTranches = (int) ($_POST['nb_tranches'] ?? 0);
        $mode       = champ('mode');
        $operateur  = champ('operateur');
        $cat        = $categories[$insc['choix']['categorie_id']] ?? null;

        if (!$cat) {
            $erreurs[] = 'La catégorie choisie n\'est plus disponible. Revenez à l\'étape 2.';
        }
        if (!in_array($nbTranches, [1, 2, 3], true)) {
            $erreurs[] = 'Choisissez le nombre de tranches.';
        }
        if (!isset(MODES_PAIEMENT[$mode])) {
            $erreurs[] = 'Choisissez un moyen de paiement.';
        } elseif ($mode === 'mobile_money' && !isset(OPERATEURS[$operateur])) {
            $erreurs[] = 'Choisissez votre opérateur Mobile Money.';
        }
        if (empty($_POST['conditions'])) {
            $erreurs[] = 'Vous devez certifier l\'exactitude des informations pour continuer.';
        }
        foreach ($insc['docs'] as $d) {
            if (!is_file(dossier_uploads() . '/' . $d['fichier'])) {
                $erreurs[] = 'Un document envoyé est introuvable. Revenez à l\'étape 3 pour le renvoyer.';
                $insc['docs'] = [];
                break;
            }
        }

        if (!$erreurs) {
            $id = $insc['identite'];
            $total = prix_formule($cat, $insc['choix']['formule']);
            $pdo = db();
            try {
                $pdo->beginTransaction();
                q('INSERT INTO utilisateurs (role, nom, prenoms, telephone, email, mot_de_passe) VALUES (\'candidat\', ?, ?, ?, ?, ?)',
                  [$id['nom'], $id['prenoms'], $id['telephone'], $id['email'] ?: null, $id['hash']]);
                $userId = (int) $pdo->lastInsertId();

                q('INSERT INTO inscriptions (utilisateur_id, categorie_id, formule, date_naissance, montant_total, nb_tranches) VALUES (?, ?, ?, ?, ?, ?)',
                  [$userId, $cat['id'], $insc['choix']['formule'], $id['date_naissance'], $total, $nbTranches]);
                $inscId = (int) $pdo->lastInsertId();
                $numero = 'AE-' . str_pad((string) $inscId, 5, '0', STR_PAD_LEFT);
                q('UPDATE inscriptions SET numero_dossier = ? WHERE id = ?', [$numero, $inscId]);

                foreach ($insc['docs'] as $type => $d) {
                    q('INSERT INTO documents (inscription_id, type, fichier, nom_original, mime, taille) VALUES (?, ?, ?, ?, ?, ?)',
                      [$inscId, $type, $d['fichier'], $d['nom_original'], $d['mime'], $d['taille']]);
                }
                $pdo->commit();
            } catch (PDOException $ex) {
                $pdo->rollBack();
                if ($ex->getCode() === '23000') {
                    $erreurs[] = 'Ce téléphone ou cet e-mail vient d\'être utilisé pour un autre compte. Connectez-vous ou modifiez l\'étape 1.';
                } else {
                    error_log('Inscription : ' . $ex->getMessage());
                    $erreurs[] = 'Une erreur technique est survenue. Réessayez dans un instant.';
                }
            }

            if (!$erreurs) {
                unset($_SESSION['insc']);
                connecter($userId);
                notifier($userId, 'Votre inscription est enregistrée — dossier ' . $numero,
                    "Bienvenue ! Votre dossier n° $numero (permis {$cat['code']}, " . mb_strtolower(FORMULES[$insc['choix']['formule'] ?? ''] ?? '')
                    . ') a bien été créé. Notre équipe vérifie vos pièces sous 48 heures ouvrées. Montant total : ' . fcfa($total) . '.');
                envoyer_email(APP_EMAIL, 'Nouvelle inscription — ' . $numero,
                    "Nouveau dossier $numero : {$id['nom']} {$id['prenoms']}, tél. {$id['telephone']}, permis {$cat['code']}.\n" . url_absolue('admin/candidat.php?id=' . $inscId));

                flash('success', 'Votre dossier n° ' . $numero . ' est créé. Bienvenue !');
                try {
                    $dossier = inscription_de($userId);
                    $cible = initier_paiement($dossier, (int) ceil($total / $nbTranches), $mode, $operateur ?: null);
                } catch (RuntimeException $ex) {
                    flash('warning', $ex->getMessage());
                    $cible = url('candidat/payer.php');
                }
                header('Location: ' . $cible);
                exit;
            }
        }
    }
}

// ---------- Affichage ----------
$choix = $insc['choix'] ?? $insc['choix_saisi'] ?? ['categorie_id' => $insc['preselection'] ?? 0, 'formule' => 'complet'];
$libellesEtapes = [1 => 'Identité', 2 => 'Permis', 3 => 'Pièces', 4 => 'Paiement'];

$titre = 'Inscription — étape ' . $etape . ' sur 4';
$masquerCta = true;
require __DIR__ . '/includes/header.php';
?>
<section class="ae-section">
    <div class="container" style="max-width: 720px">
        <h1 class="h2">Inscription au permis de conduire</h1>

        <ol class="ae-etapes mt-3" aria-label="Étapes de l'inscription">
            <?php foreach ($libellesEtapes as $n => $l): ?>
                <li class="<?= $n < $etape ? 'faite' : ($n === $etape ? 'active' : '') ?>"<?= $n === $etape ? ' aria-current="step"' : '' ?>><?= e($l) ?></li>
            <?php endforeach; ?>
        </ol>
        <div class="progress mb-4" role="progressbar" aria-label="Progression" aria-valuenow="<?= $etape * 25 ?>" aria-valuemin="0" aria-valuemax="100">
            <div class="progress-bar" style="width: <?= $etape * 25 ?>%"></div>
        </div>

        <?= afficher_flash() ?>
        <?= afficher_erreurs($erreurs) ?>

        <?php if ($etape === 1): ?>
            <form method="post" class="carte" novalidate>
                <?= csrf_champ() ?>
                <h2 class="h4">1. Votre identité</h2>
                <p class="text-secondary">Écrivez votre nom exactement comme sur votre pièce d'identité.</p>
                <div class="row g-3">
                    <div class="col-sm-5">
                        <label class="form-label requis" for="nom">Nom</label>
                        <input class="form-control" id="nom" name="nom" value="<?= e($v['nom']) ?>" required maxlength="80" autocomplete="family-name">
                    </div>
                    <div class="col-sm-7">
                        <label class="form-label requis" for="prenoms">Prénoms</label>
                        <input class="form-control" id="prenoms" name="prenoms" value="<?= e($v['prenoms']) ?>" required maxlength="120" autocomplete="given-name">
                    </div>
                    <div class="col-sm-5">
                        <label class="form-label requis" for="date_naissance">Date de naissance</label>
                        <input class="form-control" id="date_naissance" name="date_naissance" type="date" value="<?= e($v['date_naissance']) ?>" required max="<?= date('Y-m-d', strtotime('-16 years')) ?>" autocomplete="bday">
                    </div>
                    <div class="col-sm-7">
                        <label class="form-label requis" for="telephone">Téléphone</label>
                        <input class="form-control" id="telephone" name="telephone" type="tel" inputmode="tel" value="<?= e($v['telephone']) ?>" required placeholder="01 97 00 00 00" autocomplete="tel">
                        <div class="form-text">Il servira à vous connecter.</div>
                    </div>
                    <div class="col-12">
                        <label class="form-label" for="email">E-mail <span class="fw-normal text-secondary">(facultatif)</span></label>
                        <input class="form-control" id="email" name="email" type="email" value="<?= e($v['email']) ?>" maxlength="150" autocomplete="email">
                        <div class="form-text">Pour recevoir vos notifications et vos reçus.</div>
                    </div>
                    <div class="col-sm-6">
                        <label class="form-label <?= empty($insc['identite']['hash']) ? 'requis' : '' ?>" for="mot_de_passe">Mot de passe</label>
                        <div class="input-group">
                            <input class="form-control" id="mot_de_passe" name="mot_de_passe" type="password" minlength="8" autocomplete="new-password" <?= empty($insc['identite']['hash']) ? 'required' : '' ?>>
                            <button class="btn btn-outline-secondary" type="button" data-voir-mdp="mot_de_passe">Voir</button>
                        </div>
                        <div class="form-text"><?= empty($insc['identite']['hash']) ? '8 caractères minimum, avec une lettre et un chiffre.' : 'Déjà enregistré. Laissez vide pour le conserver.' ?></div>
                    </div>
                    <div class="col-sm-6">
                        <label class="form-label <?= empty($insc['identite']['hash']) ? 'requis' : '' ?>" for="mot_de_passe_confirmation">Confirmez le mot de passe</label>
                        <input class="form-control" id="mot_de_passe_confirmation" name="mot_de_passe_confirmation" type="password" autocomplete="new-password">
                    </div>
                </div>
                <button class="btn btn-primary btn-lg w-100 mt-4" type="submit">Continuer <?= icone('fleche', 18) ?></button>
                <p class="small text-secondary text-center mt-3 mb-0">Déjà inscrit ? <a href="<?= e(url('connexion.php')) ?>">Connectez-vous</a></p>
            </form>

        <?php elseif ($etape === 2): ?>
            <form method="post" novalidate>
                <?= csrf_champ() ?>
                <div class="carte mb-3">
                    <h2 class="h4">2. Votre permis</h2>
                    <fieldset>
                        <legend class="form-label fs-6 requis">Catégorie</legend>
                        <div class="row g-2">
                            <?php $ageCandidat = age($insc['identite']['date_naissance']);
                            foreach ($categories as $c): $tropJeune = $ageCandidat < (int) $c['age_minimum']; ?>
                                <div class="col-sm-6 choix">
                                    <input type="radio" name="categorie_id" id="cat-<?= (int) $c['id'] ?>" value="<?= (int) $c['id'] ?>"
                                           data-prix-code="<?= (int) $c['prix_code'] ?>" data-prix-conduite="<?= (int) $c['prix_conduite'] ?>" data-prix-complet="<?= (int) $c['prix_complet'] ?>"
                                           <?= (int) $choix['categorie_id'] === (int) $c['id'] && !$tropJeune ? 'checked' : '' ?> <?= $tropJeune ? 'disabled' : '' ?> required>
                                    <label for="cat-<?= (int) $c['id'] ?>">
                                        <span class="d-flex align-items-center gap-2">
                                            <span class="pastille-permis" style="width:2.4rem;height:2.4rem;font-size:1.1rem"><?= e($c['code']) ?></span>
                                            <span><strong><?= e($c['libelle']) ?></strong><br>
                                            <span class="small text-secondary"><?= $tropJeune ? 'À partir de ' . (int) $c['age_minimum'] . ' ans' : 'Environ ' . (int) $c['duree_semaines'] . ' semaines' ?></span></span>
                                        </span>
                                    </label>
                                </div>
                            <?php endforeach; ?>
                        </div>
                    </fieldset>
                </div>
                <div class="carte mb-3">
                    <fieldset>
                        <legend class="form-label fs-6 requis">Formule</legend>
                        <div class="d-grid gap-2">
                            <?php foreach (FORMULES as $cle => $libelle): ?>
                                <div class="choix">
                                    <input type="radio" name="formule" id="formule-<?= e($cle) ?>" value="<?= e($cle) ?>" <?= $choix['formule'] === $cle ? 'checked' : '' ?> required>
                                    <label for="formule-<?= e($cle) ?>" class="d-flex justify-content-between align-items-center gap-2">
                                        <strong><?= e($libelle) ?></strong>
                                        <span class="fw-bold text-nowrap text-primary" data-prix-formule="<?= e($cle) ?>"></span>
                                    </label>
                                </div>
                            <?php endforeach; ?>
                        </div>
                    </fieldset>
                    <p class="d-flex justify-content-between align-items-center border-top mt-3 pt-3 mb-0">
                        <span class="fw-semibold">Montant de votre formation</span>
                        <span class="prix" id="prix-choisi" aria-live="polite">—</span>
                    </p>
                    <noscript><p class="small text-secondary mb-0">Les tarifs détaillés sont sur la page <a href="<?= e(url('formations.php')) ?>">Formations</a>.</p></noscript>
                </div>
                <div class="d-flex gap-2">
                    <a class="btn btn-outline-secondary btn-lg" href="<?= e(url('inscription.php?etape=1')) ?>">Retour</a>
                    <button class="btn btn-primary btn-lg flex-grow-1" type="submit">Continuer <?= icone('fleche', 18) ?></button>
                </div>
            </form>

        <?php elseif ($etape === 3): ?>
            <form method="post" enctype="multipart/form-data" class="carte" novalidate>
                <?= csrf_champ() ?>
                <h2 class="h4">3. Vos pièces</h2>
                <p class="text-secondary">Prenez simplement chaque document en photo avec votre téléphone. Formats acceptés : JPG, PNG ou PDF, <?= (int) (UPLOAD_TAILLE_MAX / 1048576) ?> Mo maximum par fichier.</p>
                <?php
                $aides = [
                    'piece_identite'     => 'CIP, carte biométrique ou passeport, bien lisible.',
                    'photo'              => 'Photo récente, de face, sur fond clair.',
                    'certificat_medical' => 'Datant de moins de 3 mois.',
                ];
                foreach (TYPES_DOCUMENT as $type => $libelle): $deja = $insc['docs'][$type] ?? null; ?>
                    <div class="mb-4">
                        <label class="form-label <?= $deja ? '' : 'requis' ?>" for="<?= e($type) ?>"><?= e($libelle) ?></label>
                        <?php if ($deja): ?>
                            <div class="alert alert-success py-2 mb-2"><?= icone('check', 16) ?> Reçu : <?= e($deja['nom_original']) ?> <span class="small">(choisissez un autre fichier pour le remplacer)</span></div>
                        <?php endif; ?>
                        <input class="form-control" type="file" id="<?= e($type) ?>" name="<?= e($type) ?>" accept="image/jpeg,image/png,application/pdf" data-max="<?= UPLOAD_TAILLE_MAX ?>" <?= $deja ? '' : 'required' ?>>
                        <div class="form-text" id="<?= e($type) ?>-info"><?= e($aides[$type]) ?></div>
                    </div>
                <?php endforeach; ?>
                <div class="d-flex gap-2">
                    <a class="btn btn-outline-secondary btn-lg" href="<?= e(url('inscription.php?etape=2')) ?>">Retour</a>
                    <button class="btn btn-primary btn-lg flex-grow-1" type="submit">Envoyer et continuer <?= icone('fleche', 18) ?></button>
                </div>
                <p class="small text-secondary mt-3 mb-0"><?= icone('bouclier', 16) ?> Vos documents sont confidentiels : seule l'administration de l'auto-école peut les consulter.</p>
            </form>

        <?php else:
            $cat = $categories[$insc['choix']['categorie_id']];
            $total = prix_formule($cat, $insc['choix']['formule']);
            $id = $insc['identite']; ?>
            <form method="post" novalidate>
                <?= csrf_champ() ?>
                <div class="carte mb-3">
                    <h2 class="h4">4. Récapitulatif</h2>
                    <dl class="row mb-0">
                        <dt class="col-5 fw-normal text-secondary">Candidat</dt><dd class="col-7 fw-semibold"><?= e($id['nom'] . ' ' . $id['prenoms']) ?></dd>
                        <dt class="col-5 fw-normal text-secondary">Né(e) le</dt><dd class="col-7"><?= e(date_fr($id['date_naissance'])) ?></dd>
                        <dt class="col-5 fw-normal text-secondary">Téléphone</dt><dd class="col-7"><?= e(telephone_affiche($id['telephone'])) ?></dd>
                        <?php if ($id['email']): ?><dt class="col-5 fw-normal text-secondary">E-mail</dt><dd class="col-7 text-break"><?= e($id['email']) ?></dd><?php endif; ?>
                        <dt class="col-5 fw-normal text-secondary">Permis</dt><dd class="col-7 fw-semibold"><?= e($cat['libelle']) ?></dd>
                        <dt class="col-5 fw-normal text-secondary">Formule</dt><dd class="col-7"><?= e(FORMULES[$insc['choix']['formule']]) ?></dd>
                        <dt class="col-5 fw-normal text-secondary">Pièces</dt><dd class="col-7"><?= count($insc['docs']) ?> documents reçus</dd>
                        <dt class="col-5 fw-normal text-secondary border-top pt-2">Total</dt><dd class="col-7 border-top pt-2 prix mb-0"><?= e(fcfa($total)) ?></dd>
                    </dl>
                    <p class="small mt-2 mb-0"><a href="<?= e(url('inscription.php?etape=1')) ?>">Modifier mes informations</a> · <a href="<?= e(url('inscription.php?etape=2')) ?>">Changer de formule</a></p>
                </div>

                <div class="carte mb-3">
                    <fieldset class="mb-3">
                        <legend class="form-label fs-6 requis">Comment souhaitez-vous payer ?</legend>
                        <div class="row g-2">
                            <?php $nbChoisi = (int) ($_POST['nb_tranches'] ?? 1);
                            foreach ([1 => 'En 1 fois', 2 => 'En 2 tranches', 3 => 'En 3 tranches'] as $n => $l): ?>
                                <div class="col-4 choix">
                                    <input type="radio" name="nb_tranches" id="tr-<?= $n ?>" value="<?= $n ?>" <?= $nbChoisi === $n ? 'checked' : '' ?>>
                                    <label for="tr-<?= $n ?>" class="text-center px-1"><strong><?= e($l) ?></strong><br><span class="small text-secondary text-nowrap"><?= e(fcfa(ceil($total / $n))) ?></span></label>
                                </div>
                            <?php endforeach; ?>
                        </div>
                        <p class="mt-3 mb-0">À régler maintenant : <strong class="text-primary" id="montant-tranche" data-total="<?= $total ?>" aria-live="polite"><?= e(fcfa(ceil($total / max(1, $nbChoisi)))) ?></strong></p>
                    </fieldset>

                    <fieldset>
                        <legend class="form-label fs-6 requis">Moyen de paiement</legend>
                        <?php $modeChoisi = champ('mode', 'mobile_money'); ?>
                        <div class="d-grid gap-2">
                            <div class="choix">
                                <input type="radio" name="mode" id="mode-mm" value="mobile_money" <?= $modeChoisi === 'mobile_money' ? 'checked' : '' ?>>
                                <label for="mode-mm"><strong>Mobile Money</strong><br><span class="small text-secondary">MTN MoMo ou Moov Money, paiement immédiat et sécurisé.</span></label>
                            </div>
                            <div id="bloc-operateur" class="ps-3">
                                <?php foreach (OPERATEURS as $cle => $l): ?>
                                    <div class="form-check form-check-inline">
                                        <input class="form-check-input" type="radio" name="operateur" id="op-<?= e($cle) ?>" value="<?= e($cle) ?>" <?= champ('operateur', 'mtn') === $cle ? 'checked' : '' ?>>
                                        <label class="form-check-label" for="op-<?= e($cle) ?>"><?= e($l) ?></label>
                                    </div>
                                <?php endforeach; ?>
                            </div>
                            <div class="choix">
                                <input type="radio" name="mode" id="mode-esp" value="especes" <?= $modeChoisi === 'especes' ? 'checked' : '' ?>>
                                <label for="mode-esp"><strong>Espèces à l'agence</strong><br><span class="small text-secondary">Vous réglez sur place ; votre paiement est confirmé par notre équipe.</span></label>
                            </div>
                        </div>
                    </fieldset>
                </div>

                <div class="form-check mb-3">
                    <input class="form-check-input" type="checkbox" id="conditions" name="conditions" value="1" required>
                    <label class="form-check-label" for="conditions">Je certifie que les informations et les documents fournis sont exacts.</label>
                </div>
                <div class="d-flex gap-2">
                    <a class="btn btn-outline-secondary btn-lg" href="<?= e(url('inscription.php?etape=3')) ?>">Retour</a>
                    <button class="btn btn-accent btn-lg flex-grow-1" type="submit">Valider mon inscription</button>
                </div>
            </form>
        <?php endif; ?>
    </div>
</section>
<?php require __DIR__ . '/includes/footer.php'; ?>
