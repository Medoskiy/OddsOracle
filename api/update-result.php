<?php
/* ============================================================
   OddsOracle — Update Prediction Result
   POST: id, result (win|loss), stake (optional, for P&L calc)
   ============================================================ */

header('Content-Type: application/json');
session_start();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed.']);
    exit;
}

require_once __DIR__ . '/db.php';

$input = json_decode(file_get_contents('php://input'), true);
if (!$input) $input = $_POST;

$uid = 0;

/* ── Session check ── */
if (!empty($_SESSION['user_id'])) {
    $uid = (int) $_SESSION['user_id'];
}

/* ── API token fallback ── */
if (!$uid) {
    $token = $_SERVER['HTTP_X_API_TOKEN'] ?? '';
    if (!empty($token)) {
        $db   = getDB();
        $stmt = $db->prepare("SELECT id FROM users WHERE api_token = ? AND is_active = 1 LIMIT 1");
        $stmt->execute([$token]);
        $row = $stmt->fetch();
        if ($row) $uid = (int) $row['id'];
    }
}

if (!$uid) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Not authenticated']);
    exit;
}
$predId = (int) ($input['id']     ?? 0);
$result = trim($input['result']   ?? '');
$stake  = (float) ($input['stake'] ?? 1); // default 1 unit

if (!$predId || !in_array($result, ['win', 'loss', 'pending'])) {
    echo json_encode(['success' => false, 'message' => 'Invalid data.']);
    exit;
}

try {
    $db = getDB();

    /* Verify ownership */
    $stmt = $db->prepare("SELECT id, odds, result FROM prediction_logs WHERE id = ? AND user_id = ?");
    $stmt->execute([$predId, $uid]);
    $pred = $stmt->fetch();

    if (!$pred) {
        echo json_encode(['success' => false, 'message' => 'Prediction not found.']);
        exit;
    }

    /* Calculate P&L in units */
    $pnl = 0;
    if ($result === 'win') {
        $pnl = round(($pred['odds'] - 1) * $stake, 2); // profit in units
    } elseif ($result === 'loss') {
        $pnl = -1 * $stake;
    }

    $stmt = $db->prepare("UPDATE prediction_logs SET result = ?, pnl = ? WHERE id = ? AND user_id = ?");
    $stmt->execute([$result, $pnl, $predId, $uid]);

    echo json_encode([
        'success' => true,
        'message' => 'Result updated!',
        'result'  => $result,
        'pnl'     => $pnl,
    ]);

} catch (Exception $e) {
    error_log('update-result: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Server error.']);
}
