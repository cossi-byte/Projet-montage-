<?php
require __DIR__ . '/includes/init.php';

deconnecter();
session_start();
flash('success', 'Vous êtes déconnecté. À bientôt !');
rediriger('connexion.php');
