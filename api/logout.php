<?php
/* ============================================================
   OddsOracle — Logout
   ============================================================ */

session_start();
require_once __DIR__ . '/db.php';

/* ── Invalidate API token in DB ── */
/* Try session user first, then fallback to token passed as GET param */
$uid = (int) ($_SESSION['user_id'] ?? 0);

if (!$uid) {
    $tok = $_GET['token'] ?? '';
    if ($tok) {
        $db   = getDB();
        $stmt = $db->prepare("SELECT id FROM users WHERE api_token = ? LIMIT 1");
        $stmt->execute([$tok]);
        $row  = $stmt->fetch();
        if ($row) $uid = (int) $row['id'];
    }
}

if ($uid) {
    $db = getDB();
    $db->prepare("UPDATE users SET api_token = NULL WHERE id = ?")->execute([$uid]);
}

/* ── Destroy PHP session ── */
session_unset();
session_destroy();

/* ── Clear session cookie ── */
if (ini_get('session.use_cookies')) {
    $p = session_get_cookie_params();
    setcookie(session_name(), '', time() - 42000, $p['path'], $p['domain'], $p['secure'], $p['httponly']);
}

/* ── Redirect — JS will clear sessionStorage and localStorage on logout=1 ── */
header('Location: ../index.html?logout=1');
exit;
