<?php
/* ============================================================
   OddsOracle — Save Prediction
   POST: match_name, sport, league, prediction, odds, confidence
   ============================================================ */

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed.']);
    exit;
}

require_once __DIR__ . '/db.php';

$input = json_decode(file_get_contents('php://input'), true);
if (!$input) $input = $_POST;

/* ── Auth: try API token first (reliable on mobile), fallback to session ── */
$uid = 0;

$apiToken = $_SERVER['HTTP_X_API_TOKEN'] ?? '';
if ($apiToken) {
    $db   = getDB();
    $stmt = $db->prepare("SELECT id FROM users WHERE api_token = ? AND is_active = 1 LIMIT 1");
    $stmt->execute([$apiToken]);
    $row = $stmt->fetch();
    if ($row) $uid = (int) $row['id'];
}

/* Fallback to PHP session */
if (!$uid) {
    session_start();
    if (!empty($_SESSION['user_id'])) {
        $uid = (int) $_SESSION['user_id'];
    }
}

if (!$uid) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Please log in to save predictions.']);
    exit;
}
$matchName  = trim($input['match_name']  ?? '');
$sport      = trim($input['sport']       ?? '');
$league     = trim($input['league']      ?? '');
$prediction = trim($input['prediction']  ?? '');
$odds       = (float) ($input['odds']    ?? 0);
$confidence = (int)   ($input['confidence'] ?? 0);

/* ── Validate ── */
if (!$matchName || !$sport || !$prediction || $odds <= 0) {
    echo json_encode(['success' => false, 'message' => 'Missing required prediction data.']);
    exit;
}

try {
    $db = getDB();

    /* Prevent duplicate saves for same match+prediction by same user today */
    $stmt = $db->prepare("
        SELECT id FROM prediction_logs
        WHERE user_id = ? AND match_name = ? AND prediction = ?
        AND DATE(created_at) = CURDATE()
        LIMIT 1
    ");
    $stmt->execute([$uid, $matchName, $prediction]);
    if ($stmt->fetch()) {
        echo json_encode(['success' => false, 'message' => 'You already saved this pick today.', 'duplicate' => true]);
        exit;
    }

    /* ── Insert ── */
    $stmt = $db->prepare("
        INSERT INTO prediction_logs (user_id, match_name, sport, league, prediction, odds, confidence)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ");
    $stmt->execute([$uid, $matchName, $sport, $league ?: 'General', $prediction, $odds, $confidence]);
    $newId = $db->lastInsertId();

    echo json_encode([
        'success' => true,
        'message' => 'Pick saved! Track it in your dashboard.',
        'id'      => (int) $newId,
    ]);

} catch (Exception $e) {
    error_log('save-prediction: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Server error. Please try again.']);
}
