<?php
/* ============================================================
   OddsOracle — Auth Check (called by JS to verify session)
   ============================================================ */

header('Content-Type: application/json');
session_start();

if (!empty($_SESSION['user_id'])) {
    echo json_encode([
        'logged_in' => true,
        'username'  => $_SESSION['username'],
        'plan'      => $_SESSION['plan'],
    ]);
} else {
    echo json_encode(['logged_in' => false]);
}
