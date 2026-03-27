<?php
/* ============================================================
   OddsOracle — User Login
   ============================================================ */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed.']);
    exit;
}

require_once __DIR__ . '/db.php';

/* ── Read input ── */
$input    = json_decode(file_get_contents('php://input'), true);
if (!$input) $input = $_POST;

$username = trim($input['username'] ?? '');
$password = $input['password']      ?? '';

/* ── Validate ── */
if (!$username || !$password) {
    echo json_encode(['success' => false, 'message' => 'Please enter your username and password.']);
    exit;
}

/* ── Look up user (by username or email) ── */
initDB();
$db = getDB();

$stmt = $db->prepare('
    SELECT id, username, email, password, plan, is_active
    FROM users
    WHERE username = ? OR email = ?
    LIMIT 1
');
$stmt->execute([$username, $username]);
$user = $stmt->fetch();

if (!$user || !password_verify($password, $user['password'])) {
    echo json_encode(['success' => false, 'message' => 'Incorrect username or password.']);
    exit;
}

if (!$user['is_active']) {
    echo json_encode(['success' => false, 'message' => 'Your account has been suspended. Contact support.']);
    exit;
}

/* ── Update last login ── */
$db->prepare('UPDATE users SET last_login = NOW() WHERE id = ?')->execute([$user['id']]);

/* ── Start session ── */
session_start();
$_SESSION['user_id']  = $user['id'];
$_SESSION['username'] = $user['username'];
$_SESSION['plan']     = $user['plan'];

echo json_encode([
    'success'  => true,
    'message'  => 'Welcome back, @' . $user['username'] . '!',
    'redirect' => '../dashboard.html',
    'user'     => [
        'username' => $user['username'],
        'plan'     => $user['plan'],
    ],
]);
