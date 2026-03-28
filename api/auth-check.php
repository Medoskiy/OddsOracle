<?php
/* ============================================================
   OddsOracle — Auth Check (called by JS to verify session)
   Checks PHP session first, then falls back to API token header
   ============================================================ */

header('Content-Type: application/json');
session_start();

/* ── 1. Session check ── */
if (!empty($_SESSION['user_id'])) {
    echo json_encode([
        'logged_in' => true,
        'username'  => $_SESSION['username'],
        'plan'      => $_SESSION['plan'],
    ]);
    exit;
}

/* ── 2. API token fallback (for mobile where sessions expire) ── */
$token = $_SERVER['HTTP_X_API_TOKEN'] ?? '';
if (!empty($token)) {
    require_once __DIR__ . '/db.php';
    $db   = getDB();
    $stmt = $db->prepare("SELECT id, username, plan FROM users WHERE api_token = ? AND is_active = 1 LIMIT 1");
    $stmt->execute([$token]);
    $user = $stmt->fetch();
    if ($user) {
        /* Restore session so subsequent page requests work */
        $_SESSION['user_id']  = $user['id'];
        $_SESSION['username'] = $user['username'];
        $_SESSION['plan']     = $user['plan'];
        echo json_encode([
            'logged_in' => true,
            'username'  => $user['username'],
            'plan'      => $user['plan'],
        ]);
        exit;
    }
}

echo json_encode(['logged_in' => false]);
