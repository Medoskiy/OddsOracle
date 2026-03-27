<?php
/* ============================================================
   OddsOracle — User Registration
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

/* ── Read JSON or form POST ── */
$input = json_decode(file_get_contents('php://input'), true);
if (!$input) $input = $_POST;

$username  = trim($input['username']  ?? '');
$email     = trim($input['email']     ?? '');
$firstName = trim($input['firstName'] ?? '');
$lastName  = trim($input['lastName']  ?? '');
$password  = $input['password']       ?? '';
$confirm   = $input['confirm']        ?? '';

/* ── Validate ── */
$errors = [];

if (strlen($username) < 3)
    $errors[] = 'Username must be at least 3 characters.';
if (!preg_match('/^[a-zA-Z0-9_]+$/', $username))
    $errors[] = 'Username can only contain letters, numbers and underscores.';
if (!filter_var($email, FILTER_VALIDATE_EMAIL))
    $errors[] = 'Please enter a valid email address.';
if (strlen($password) < 6)
    $errors[] = 'Password must be at least 6 characters.';
if ($password !== $confirm)
    $errors[] = 'Passwords do not match.';

if ($errors) {
    echo json_encode(['success' => false, 'message' => implode(' ', $errors)]);
    exit;
}

/* ── Check existing user ── */
initDB();
$db = getDB();

$stmt = $db->prepare('SELECT id FROM users WHERE username = ? OR email = ?');
$stmt->execute([$username, $email]);
if ($stmt->fetch()) {
    echo json_encode(['success' => false, 'message' => 'Username or email is already registered.']);
    exit;
}

/* ── Create user ── */
$hash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);

$stmt = $db->prepare('
    INSERT INTO users (username, email, password)
    VALUES (?, ?, ?)
');
$stmt->execute([$username, $email, $hash]);
$userId = $db->lastInsertId();

/* ── Start session ── */
session_start();
$_SESSION['user_id']  = $userId;
$_SESSION['username'] = $username;
$_SESSION['plan']     = 'free';

/* ── Send welcome email (non-blocking — don't fail registration if email fails) ── */
require_once __DIR__ . '/mailer.php';
welcomeEmail($username, $email);

echo json_encode([
    'success'  => true,
    'message'  => 'Account created! Check your email for a welcome message.',
    'redirect' => '../predictions.html',
    'user'     => ['username' => $username, 'plan' => 'free'],
]);
