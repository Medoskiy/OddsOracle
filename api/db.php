<?php
/* ============================================================
   OddsOracle — Database Connection
   ============================================================ */

require_once __DIR__ . '/config.php';

define('DB_HOST', 'localhost');
define('DB_NAME', 'u496345488_oddsoracle');
define('DB_USER', 'u496345488_oddsuser');
define('DB_PASS', 'OddsOracle@2026!');
define('DB_CHARSET', 'utf8mb4');

function getDB() {
    static $pdo = null;
    if ($pdo) return $pdo;

    $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=' . DB_CHARSET;
    $options = [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ];
    try {
        $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Database connection failed.']);
        exit;
    }
    return $pdo;
}

/* ── Create tables if they don't exist ── */
function initDB() {
    $db = getDB();

    /* Users table */
    $db->exec("
        CREATE TABLE IF NOT EXISTS users (
            id           INT AUTO_INCREMENT PRIMARY KEY,
            username     VARCHAR(30)  NOT NULL UNIQUE,
            email        VARCHAR(120) NOT NULL UNIQUE,
            password     VARCHAR(255) NOT NULL,
            plan         ENUM('free','pro','elite') NOT NULL DEFAULT 'free',
            api_token    VARCHAR(64)  NULL,
            created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            last_login   DATETIME NULL,
            is_active    TINYINT(1) NOT NULL DEFAULT 1
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ");
    /* Add api_token column to existing tables that may not have it */
    try { $db->exec("ALTER TABLE users ADD COLUMN api_token VARCHAR(64) NULL"); } catch(Exception $e) {}

    /* Prediction tracker table */
    $db->exec("
        CREATE TABLE IF NOT EXISTS prediction_logs (
            id           INT AUTO_INCREMENT PRIMARY KEY,
            user_id      INT NOT NULL,
            match_name   VARCHAR(150) NOT NULL,
            sport        VARCHAR(50)  NOT NULL,
            league       VARCHAR(80)  NOT NULL,
            prediction   VARCHAR(80)  NOT NULL,
            odds         DECIMAL(6,2) NOT NULL,
            confidence   INT NOT NULL,
            result       ENUM('win','loss','pending') NOT NULL DEFAULT 'pending',
            pnl          DECIMAL(8,2) NOT NULL DEFAULT 0,
            created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ");
}
