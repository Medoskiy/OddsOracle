<?php
/* ============================================================
   OddsOracle — Live Odds Proxy
   Fetches real odds from The Odds API and returns JSON
   ============================================================ */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Cache-Control: no-cache');

require_once 'config.php';

/* ── Helper: cache read/write ── */
function getCached($key) {
    $file = CACHE_DIR . '/' . md5($key) . '.json';
    if (file_exists($file) && (time() - filemtime($file)) < CACHE_DURATION) {
        return file_get_contents($file);
    }
    return false;
}
function setCache($key, $data) {
    if (!is_dir(CACHE_DIR)) mkdir(CACHE_DIR, 0755, true);
    file_put_contents(CACHE_DIR . '/' . md5($key) . '.json', $data);
}

/* ── Helper: fetch URL ── */
function fetchURL($url) {
    if (function_exists('curl_init')) {
        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL            => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 12,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_HTTPHEADER     => ['Accept: application/json'],
        ]);
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        return ['code' => $httpCode, 'body' => $response];
    }
    /* fallback: file_get_contents */
    $ctx = stream_context_create(['http' => ['timeout' => 12]]);
    $body = @file_get_contents($url, false, $ctx);
    return ['code' => $body !== false ? 200 : 500, 'body' => $body];
}

/* ── Sport key map (OddsOracle name → The Odds API key) ── */
$SPORT_MAP = [
    'soccer'     => 'soccer_epl',
    'epl'        => 'soccer_epl',
    'champions'  => 'soccer_uefa_champs_league',
    'laliga'     => 'soccer_spain_la_liga',
    'bundesliga' => 'soccer_germany_bundesliga',
    'seriea'     => 'soccer_italy_serie_a',
    'nba'        => 'basketball_nba',
    'nfl'        => 'americanfootball_nfl',
    'tennis'     => 'tennis_atp_french_open',
    'cricket'    => 'cricket_ipl',
    'mma'        => 'mma_mixed_martial_arts',
    'baseball'   => 'baseball_mlb',
    'all'        => 'soccer_epl', /* default */
];

$action = $_GET['action'] ?? 'odds';

/* ── ACTION: list available sports ── */
if ($action === 'sports') {
    $cacheKey = 'sports_list';
    if ($cached = getCached($cacheKey)) { echo $cached; exit; }

    $url      = ODDS_API_BASE . '/sports/?apiKey=' . ODDS_API_KEY;
    $result   = fetchURL($url);

    if ($result['code'] === 200) {
        setCache($cacheKey, $result['body']);
        echo $result['body'];
    } else {
        http_response_code($result['code']);
        echo json_encode(['error' => 'Could not fetch sports list', 'code' => $result['code']]);
    }
    exit;
}

/* ── ACTION: fetch live odds ── */
if ($action === 'odds') {
    $sportParam = strtolower($_GET['sport'] ?? 'all');
    $sportKey   = $SPORT_MAP[$sportParam] ?? 'soccer_epl';
    $regions    = 'uk,eu,us,au';
    $markets    = 'h2h';
    $oddsFormat = 'decimal';

    $cacheKey = 'odds_' . $sportKey;
    if ($cached = getCached($cacheKey)) { echo $cached; exit; }

    $url = ODDS_API_BASE . '/sports/' . $sportKey . '/odds/'
         . '?apiKey='     . ODDS_API_KEY
         . '&regions='    . $regions
         . '&markets='    . $markets
         . '&oddsFormat=' . $oddsFormat;

    $result = fetchURL($url);

    if ($result['code'] === 200) {
        setCache($cacheKey, $result['body']);
        /* Pass remaining quota back as header */
        echo $result['body'];
    } else {
        http_response_code($result['code']);
        echo json_encode([
            'error'   => 'Could not fetch odds',
            'code'    => $result['code'],
            'message' => $result['code'] === 401
                ? 'Invalid API key — check api/config.php'
                : 'The Odds API returned an error',
        ]);
    }
    exit;
}

/* ── ACTION: quota check ── */
if ($action === 'quota') {
    $url    = ODDS_API_BASE . '/sports/?apiKey=' . ODDS_API_KEY;
    $result = fetchURL($url);
    /* Quota info is in response headers — return status only */
    echo json_encode([
        'configured' => ODDS_API_KEY !== 'YOUR_API_KEY_HERE',
        'status'     => $result['code'],
    ]);
    exit;
}

echo json_encode(['error' => 'Unknown action']);
