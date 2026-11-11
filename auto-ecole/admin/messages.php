<?php
require __DIR__ . '/_debut.php';

if (est_post()) {
    csrf_verifier();
    $mid = (int) ($_POST['id'] ?? 0);
    if (champ('action') === 'supprimer') {
        q('DELETE FROM messages_contact WHERE id = ?', [$mid]);
        flash('success', 'Message supprimé.');
    } else {
        q('UPDATE messages_contact SET lu = 1 - lu WHERE id = ?', [$mid]);
    }
    rediriger('admin/messages.php');
}

$messages = q('SELECT * FROM messages_contact ORDER BY lu, id DESC LIMIT 100')->fetchAll();

admin_entete('Messages du formulaire de contact', 'messages');
?>
<?php if (!$messages): ?><p class="text-secondary">Aucun message.</p><?php endif; ?>
<?php foreach ($messages as $m): ?>
    <div class="carte mb-2 <?= $m['lu'] ? '' : 'border-primary border-2' ?>" style="height:auto">
        <div class="d-flex justify-content-between flex-wrap gap-2">
            <div><strong><?= e($m['sujet']) ?></strong> <?= $m['lu'] ? '' : '<span class="badge text-bg-danger">Nouveau</span>' ?><br>
                <span class="small text-secondary"><?= e($m['nom']) ?> · <?= e(telephone_affiche($m['telephone'])) ?><?= $m['email'] ? ' · ' . e($m['email']) : '' ?> · <?= e(date_fr($m['created_at'], true)) ?></span></div>
            <div class="d-flex gap-1 align-items-start flex-wrap">
                <a class="btn btn-sm btn-whatsapp" target="_blank" rel="noopener" href="<?= e(lien_whatsapp($m['telephone'], 'Bonjour ' . $m['nom'] . ', suite à votre message « ' . $m['sujet'] . ' » : ')) ?>">Répondre par WhatsApp</a>
                <?php if ($m['email']): ?><a class="btn btn-sm btn-outline-primary" href="mailto:<?= e($m['email']) ?>?subject=<?= e(rawurlencode('Re: ' . $m['sujet'])) ?>">E-mail</a><?php endif; ?>
                <form method="post"><?= csrf_champ() ?><input type="hidden" name="id" value="<?= (int) $m['id'] ?>">
                    <button class="btn btn-sm btn-outline-secondary" type="submit" name="action" value="lu" data-libre><?= $m['lu'] ? 'Marquer non lu' : 'Marquer lu' ?></button>
                    <button class="btn btn-sm btn-outline-danger" type="submit" name="action" value="supprimer" data-libre data-confirmer="Supprimer ce message ?">Supprimer</button></form>
            </div>
        </div>
        <p class="mb-0 mt-2"><?= nl2br(e($m['message'])) ?></p>
    </div>
<?php endforeach; ?>
<?php admin_pied(); ?>
