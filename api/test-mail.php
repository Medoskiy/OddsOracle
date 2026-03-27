<?php
/* ============================================================
   OddsOracle — Mail Test (DELETE after testing!)
   Visit: https://oddsoracle.pro/api/test-mail.php?to=YOUR@EMAIL.COM
   ============================================================ */

header('Content-Type: application/json');

$to = $_GET['to'] ?? '';
if (!$to || !filter_var($to, FILTER_VALIDATE_EMAIL)) {
    echo json_encode(['error' => 'Add ?to=your@email.com to the URL']);
    exit;
}

$results = [];

/* ── Test 1: PHP mail() ── */
$headers  = "From: contact@oddsoracle.pro\r\n";
$headers .= "Reply-To: contact@oddsoracle.pro\r\n";
$headers .= "MIME-Version: 1.0\r\n";
$headers .= "Content-Type: text/html; charset=UTF-8\r\n";
$mailResult = mail($to, 'OddsOracle Test Email', '<h1>Test from OddsOracle!</h1><p>PHP mail() is working.</p>', $headers);
$results['php_mail'] = $mailResult ? 'SUCCESS' : 'FAILED';

/* ── Test 2: SMTP port 465 (SSL) ── */
$socket465 = @fsockopen('ssl://smtp.hostinger.com', 465, $e, $es, 10);
$results['smtp_465_ssl'] = $socket465 ? 'OPEN' : "FAILED: $es ($e)";
if ($socket465) fclose($socket465);

/* ── Test 3: SMTP port 587 (TLS) ── */
$socket587 = @fsockopen('smtp.hostinger.com', 587, $e, $es, 10);
$results['smtp_587_tls'] = $socket587 ? 'OPEN' : "FAILED: $es ($e)";
if ($socket587) fclose($socket587);

/* ── Test 4: Check allow_url_fopen ── */
$results['allow_url_fopen'] = ini_get('allow_url_fopen') ? 'ON' : 'OFF';
$results['openssl']         = extension_loaded('openssl') ? 'loaded' : 'NOT loaded';

echo json_encode($results, JSON_PRETTY_PRINT);
