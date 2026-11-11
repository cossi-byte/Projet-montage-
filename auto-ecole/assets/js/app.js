/* Auto-école — JavaScript sans dépendance (améliorations progressives :
   tout fonctionne aussi sans JavaScript, la validation réelle est faite par le serveur). */
(function () {
    'use strict';

    var fcfa = function (n) {
        return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' FCFA';
    };

    // ---- Anti double-envoi : désactive le bouton pendant l'envoi (connexions lentes) ----
    document.querySelectorAll('form').forEach(function (form) {
        form.addEventListener('submit', function () {
            var btn = form.querySelector('button[type=submit]:not([data-libre])');
            if (!btn || btn.disabled) { return; }
            setTimeout(function () {
                btn.disabled = true;
                btn.innerHTML = '<span class="spinner-border spinner-border-sm" aria-hidden="true"></span> Patientez…';
            }, 0);
        });
    });

    // ---- Confirmation avant une action sensible ----
    document.querySelectorAll('[data-confirmer]').forEach(function (el) {
        el.addEventListener('click', function (ev) {
            if (!window.confirm(el.getAttribute('data-confirmer'))) { ev.preventDefault(); }
        });
    });

    // ---- Afficher / masquer le mot de passe ----
    document.querySelectorAll('[data-voir-mdp]').forEach(function (btn) {
        btn.addEventListener('click', function () {
            var champ = document.getElementById(btn.getAttribute('data-voir-mdp'));
            var visible = champ.type === 'text';
            champ.type = visible ? 'password' : 'text';
            btn.textContent = visible ? 'Voir' : 'Masquer';
        });
    });

    // ---- Inscription, étape 2 : prix selon la catégorie et la formule ----
    var zonePrix = document.getElementById('prix-choisi');
    if (zonePrix) {
        var majPrix = function () {
            var cat = document.querySelector('input[name=categorie_id]:checked');
            var formule = document.querySelector('input[name=formule]:checked');
            document.querySelectorAll('[data-prix-formule]').forEach(function (el) {
                var f = el.getAttribute('data-prix-formule');
                el.textContent = cat ? fcfa(cat.getAttribute('data-prix-' + f)) : '';
            });
            zonePrix.textContent = (cat && formule) ? fcfa(cat.getAttribute('data-prix-' + formule.value)) : '—';
        };
        document.querySelectorAll('input[name=categorie_id], input[name=formule]').forEach(function (el) {
            el.addEventListener('change', majPrix);
        });
        majPrix();
    }

    // ---- Fichiers : contrôle immédiat de la taille et du type + aperçu du nom ----
    document.querySelectorAll('input[type=file][data-max]').forEach(function (input) {
        input.addEventListener('change', function () {
            var info = document.getElementById(input.id + '-info');
            var f = input.files && input.files[0];
            if (!f) { return; }
            var max = parseInt(input.getAttribute('data-max'), 10);
            var ok = /^(image\/(jpeg|png)|application\/pdf)$/.test(f.type);
            var message = '';
            if (!ok) { message = 'Format non accepté : envoyez une photo (JPG, PNG) ou un PDF.'; }
            else if (f.size > max) { message = 'Fichier trop lourd (' + (f.size / 1048576).toFixed(1) + ' Mo). Maximum : ' + (max / 1048576).toFixed(0) + ' Mo.'; }
            input.classList.toggle('is-invalid', message !== '');
            if (message) { input.value = ''; }
            if (info) {
                info.textContent = message || ('✓ ' + f.name + ' (' + Math.max(1, Math.round(f.size / 1024)) + ' Ko)');
                info.className = 'form-text ' + (message ? 'text-danger fw-semibold' : 'text-success');
            }
        });
    });

    // ---- Paiement : opérateur visible seulement pour Mobile Money, raccourcis de montant ----
    var blocOperateur = document.getElementById('bloc-operateur');
    if (blocOperateur) {
        var majMode = function () {
            var mode = document.querySelector('input[name=mode]:checked');
            blocOperateur.hidden = !mode || mode.value !== 'mobile_money';
        };
        document.querySelectorAll('input[name=mode]').forEach(function (el) { el.addEventListener('change', majMode); });
        majMode();
    }
    document.querySelectorAll('[data-montant]').forEach(function (btn) {
        btn.addEventListener('click', function () {
            var champ = document.getElementById('montant');
            if (champ) { champ.value = btn.getAttribute('data-montant'); }
        });
    });

    // ---- Récapitulatif : montant de la première tranche ----
    var zoneTranche = document.getElementById('montant-tranche');
    if (zoneTranche) {
        var total = parseInt(zoneTranche.getAttribute('data-total'), 10);
        var majTranche = function () {
            var n = document.querySelector('input[name=nb_tranches]:checked');
            zoneTranche.textContent = fcfa(Math.ceil(total / (n ? parseInt(n.value, 10) : 1)));
        };
        document.querySelectorAll('input[name=nb_tranches]').forEach(function (el) { el.addEventListener('change', majTranche); });
        majTranche();
    }

    // ---- Carte : chargée seulement à la demande (économise les données mobiles) ----
    var btnCarte = document.getElementById('charger-carte');
    if (btnCarte) {
        btnCarte.addEventListener('click', function () {
            var zone = document.getElementById('zone-carte');
            var iframe = document.createElement('iframe');
            iframe.className = 'carte-osm';
            iframe.title = 'Carte : emplacement de l\'agence';
            iframe.loading = 'lazy';
            iframe.referrerPolicy = 'no-referrer';
            iframe.src = zone.getAttribute('data-src');
            zone.replaceChildren(iframe);
        });
    }
})();
