<?php
/* ============================================================
   OddsOracle — Dashboard Data API
   Returns logged-in user's profile, stats, and recent activity
   ============================================================ */

header('Content-Type: application/json');
session_start();

if (empty($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Not authenticated']);
    exit;
}

require_once __DIR__ . '/db.php';

try {
    $db = getDB();
    $uid = (int) $_SESSION['user_id'];

    /* ── Fetch user profile ── */
    $stmt = $db->prepare("SELECT id, username, email, plan, created_at, last_login FROM users WHERE id = ?");
    $stmt->execute([$uid]);
    $user = $stmt->fetch();

    if (!$user) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'User not found']);
        exit;
    }

    /* ── Fetch prediction stats ── */
    $stmt = $db->prepare("
        SELECT
            COUNT(*)                                          AS total,
            SUM(result = 'win')                               AS wins,
            SUM(result = 'loss')                              AS losses,
            SUM(result = 'pending')                           AS pending,
            ROUND(AVG(CASE WHEN result != 'pending' THEN confidence END), 1) AS avg_confidence,
            ROUND(SUM(pnl), 2)                                AS total_pnl
        FROM prediction_logs WHERE user_id = ?
    ");
    $stmt->execute([$uid]);
    $stats = $stmt->fetch();

    /* ── Fetch 5 most recent predictions ── */
    $stmt = $db->prepare("
        SELECT match_name, sport, league, prediction, odds, confidence, result, pnl, created_at
        FROM prediction_logs
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT 5
    ");
    $stmt->execute([$uid]);
    $recent = $stmt->fetchAll();

    /* ── Days as member ── */
    $joinDate  = new DateTime($user['created_at']);
    $today     = new DateTime();
    $daysMember = (int) $joinDate->diff($today)->days;

    /* ── Win rate ── */
    $resolved = ($stats['wins'] + $stats['losses']);
    $winRate  = $resolved > 0 ? round(($stats['wins'] / $resolved) * 100, 1) : 0;

    echo json_encode([
        'success' => true,
        'user'    => [
            'username'    => $user['username'],
            'email'       => $user['email'],
            'plan'        => $user['plan'],
            'created_at'  => $user['created_at'],
            'last_login'  => $user['last_login'],
            'days_member' => $daysMember,
        ],
        'stats' => [
            'total'          => (int) $stats['total'],
            'wins'           => (int) $stats['wins'],
            'losses'         => (int) $stats['losses'],
            'pending'        => (int) $stats['pending'],
            'win_rate'       => $winRate,
            'avg_confidence' => (float) $stats['avg_confidence'],
            'total_pnl'      => (float) $stats['total_pnl'],
        ],
        'recent' => $recent,
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Server error']);
}
