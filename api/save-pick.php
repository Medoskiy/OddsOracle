<?php
/* ============================================================
   OddsOracle — Save Pick (browser navigation approach)
   GET: match, sport, league, pick, odds, conf
   Saves the pick then redirects back to predictions.html
   ============================================================ */

session_start();
require_once __DIR__ . '/db.php';

/* ── Auth check — redirect to login if not logged in ── */
$uid = 0;

/* Try API token first */
$apiToken = $_GET['token'] ?? '';
if ($apiToken) {
    $db   = getDB();
    $stmt = $db->prepare("SELECT id, username, plan FROM users WHERE api_token = ? AND is_active = 1 LIMIT 1");
    $stmt->execute([$apiToken]);
    $row = $stmt->fetch();
    if ($row) {
        $uid = (int) $row['id'];
        /* Restore PHP session so subsequent page requests stay authenticated */
        $_SESSION['user_id']  = $uid;
        $_SESSION['username'] = $row['username'];
        $_SESSION['plan']     = $row['plan'];
    }
}

/* Fallback to session */
if (!$uid && !empty($_SESSION['user_id'])) {
    $uid = (int) $_SESSION['user_id'];
}

if (!$uid) {
    header('Location: ../login.html');
    exit;
}

/* ── Read pick data from GET params ── */
$matchName  = trim(urldecode($_GET['match']  ?? ''));
$sport      = trim(urldecode($_GET['sport']  ?? ''));
$league     = trim(urldecode($_GET['league'] ?? '')) ?: 'General';
$prediction = trim(urldecode($_GET['pick']   ?? ''));
$odds       = (float) ($_GET['odds'] ?? 0);
$confidence = (int)   ($_GET['conf'] ?? 0);

if (!$matchName || !$sport || !$prediction || $odds <= 0) {
    header('Location: ../predictions.html?save=error');
    exit;
}

try {
    $db = getDB();

    /* Prevent duplicate saves today */
    $stmt = $db->prepare("
        SELECT id FROM prediction_logs
        WHERE user_id = ? AND match_name = ? AND prediction = ?
        AND DATE(created_at) = CURDATE()
        LIMIT 1
    ");
    $stmt->execute([$uid, $matchName, $prediction]);
    if ($stmt->fetch()) {
        header('Location: ../predictions.html?save=duplicate');
        exit;
    }

    /* Insert */
    $stmt = $db->prepare("
        INSERT INTO prediction_logs (user_id, match_name, sport, league, prediction, odds, confidence)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ");
    $stmt->execute([$uid, $matchName, $sport, $league, $prediction, $odds, $confidence]);

    header('Location: ../predictions.html?save=ok&pick=' . urlencode($matchName));
    exit;

} catch (Exception $e) {
    error_log('save-pick.php: ' . $e->getMessage());
    header('Location: ../predictions.html?save=error');
    exit;
}
