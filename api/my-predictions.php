<?php
/* ============================================================
   OddsOracle — My Predictions
   GET: returns all saved predictions for logged-in user
   ============================================================ */

header('Content-Type: application/json');
session_start();

if (empty($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Not authenticated']);
    exit;
}

require_once __DIR__ . '/db.php';

$uid    = (int) $_SESSION['user_id'];
$page   = max(1, (int) ($_GET['page']   ?? 1));
$limit  = 20;
$offset = ($page - 1) * $limit;
$filter = $_GET['result'] ?? 'all'; // all | pending | win | loss
$sport  = $_GET['sport']  ?? 'all';

try {
    $db = getDB();

    /* ── Build WHERE ── */
    $where  = ['user_id = ?'];
    $params = [$uid];

    if ($filter !== 'all' && in_array($filter, ['pending', 'win', 'loss'])) {
        $where[]  = 'result = ?';
        $params[] = $filter;
    }
    if ($sport !== 'all') {
        $where[]  = 'sport = ?';
        $params[] = $sport;
    }

    $whereSQL = implode(' AND ', $where);

    /* ── Total count ── */
    $countStmt = $db->prepare("SELECT COUNT(*) FROM prediction_logs WHERE $whereSQL");
    $countStmt->execute($params);
    $total = (int) $countStmt->fetchColumn();

    /* ── Fetch rows ── */
    $stmt = $db->prepare("
        SELECT id, match_name, sport, league, prediction, odds, confidence, result, pnl, created_at
        FROM prediction_logs
        WHERE $whereSQL
        ORDER BY created_at DESC
        LIMIT $limit OFFSET $offset
    ");
    $stmt->execute($params);
    $rows = $stmt->fetchAll();

    /* ── Aggregate stats ── */
    $statsStmt = $db->prepare("
        SELECT
            COUNT(*)                                              AS total,
            SUM(result = 'win')                                   AS wins,
            SUM(result = 'loss')                                  AS losses,
            SUM(result = 'pending')                               AS pending,
            ROUND(SUM(pnl), 2)                                    AS total_pnl,
            ROUND(AVG(CASE WHEN result != 'pending' THEN confidence END), 1) AS avg_conf
        FROM prediction_logs WHERE user_id = ?
    ");
    $statsStmt->execute([$uid]);
    $stats = $statsStmt->fetch();

    $resolved = ($stats['wins'] + $stats['losses']);
    $winRate  = $resolved > 0 ? round(($stats['wins'] / $resolved) * 100, 1) : 0;

    /* ── Sports list for filter ── */
    $sportsStmt = $db->prepare("SELECT DISTINCT sport FROM prediction_logs WHERE user_id = ? ORDER BY sport");
    $sportsStmt->execute([$uid]);
    $sports = array_column($sportsStmt->fetchAll(), 'sport');

    echo json_encode([
        'success'  => true,
        'total'    => $total,
        'page'     => $page,
        'pages'    => (int) ceil($total / $limit),
        'stats'    => array_merge($stats, ['win_rate' => $winRate]),
        'sports'   => $sports,
        'rows'     => $rows,
    ]);

} catch (Exception $e) {
    error_log('my-predictions: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Server error.']);
}
