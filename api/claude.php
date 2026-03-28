<?php
/* ============================================================
   OddsOracle — Claude AI Analysis Proxy
   POST: match, home, away, sport, league, odds, confidence,
         outcomes (JSON array), edge, fair_prob
   Returns: { success, verdict, analysis, factors, recommendation }
   ============================================================ */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed.']);
    exit;
}

require_once __DIR__ . '/config.php';

/* ── Read input ── */
$input = json_decode(file_get_contents('php://input'), true);
if (!$input) $input = $_POST;

$match      = trim($input['match']       ?? '');
$home       = trim($input['home']        ?? '');
$away       = trim($input['away']        ?? '');
$sport      = trim($input['sport']       ?? '');
$league     = trim($input['league']      ?? '');
$confidence = (int)   ($input['confidence']  ?? 0);
$grade      = trim($input['grade']       ?? 'B');
$edge       = (float) ($input['edge']        ?? 0);
$fair_prob  = (float) ($input['fair_prob']   ?? 0);
$best_odds  = (float) ($input['best_odds']   ?? 0);
$pick       = trim($input['pick']        ?? '');
$outcomes   = $input['outcomes']         ?? [];
$book_count = (int) ($input['book_count'] ?? 1);

if (!$match || !$sport) {
    echo json_encode(['success' => false, 'message' => 'Missing match data.']);
    exit;
}

/* ── Build outcomes summary ── */
$outcomeLines = '';
if (is_array($outcomes)) {
    foreach ($outcomes as $o) {
        $val = !empty($o['isValue']) ? ' ⚡ VALUE' : '';
        $outcomeLines .= "  - {$o['name']}: best odds {$o['bestOdds']} | fair prob {$o['fairProb']}% | edge {$o['edge']}%{$val}\n";
    }
}

/* ── Build Claude prompt ── */
$prompt = <<<PROMPT
You are OddsOracle's AI sports analyst. Analyse this upcoming match and give a sharp, data-driven verdict.

MATCH: {$match}
SPORT: {$sport}
LEAGUE: {$league}
KICKOFF: Soon

ODDS & PROBABILITIES (from {$book_count} sportsbooks):
{$outcomeLines}

AI RECOMMENDATION: {$pick}
Confidence Score: {$confidence}%
Grade: {$grade}
Statistical Edge: +{$edge}%
Fair Win Probability: {$fair_prob}%
Best Available Odds: {$best_odds}

Respond in this EXACT JSON format (no markdown, no extra text):
{
  "verdict": "BET" | "MONITOR" | "PASS",
  "summary": "2-3 sentence sharp analysis covering the key statistical edge, market signal, and why this pick has value",
  "factors": [
    {"name": "Factor name", "signal": "Strong" | "Neutral" | "Weak", "detail": "one line explanation"},
    {"name": "Factor name", "signal": "Strong" | "Neutral" | "Weak", "detail": "one line explanation"},
    {"name": "Factor name", "signal": "Strong" | "Neutral" | "Weak", "detail": "one line explanation"},
    {"name": "Factor name", "signal": "Strong" | "Neutral" | "Weak", "detail": "one line explanation"},
    {"name": "Factor name", "signal": "Strong" | "Neutral" | "Weak", "detail": "one line explanation"},
    {"name": "Factor name", "signal": "Strong" | "Neutral" | "Weak", "detail": "one line explanation"}
  ],
  "stake_advice": "e.g. 1-2 units (value play)" | "e.g. 0.5 units (speculative)" | "No stake — pass",
  "risk_level": "Low" | "Medium" | "High"
}

Rules:
- verdict BET = confidence ≥78% AND edge >3%
- verdict MONITOR = confidence 68-77% OR edge 1-3%  
- verdict PASS = confidence <68% OR edge <1%
- Be concise and analytical, not promotional
- Reference the specific teams and sport in your summary
PROMPT;

/* ── Call Claude API ── */
$payload = json_encode([
    'model'      => CLAUDE_MODEL,
    'max_tokens' => 600,
    'messages'   => [
        ['role' => 'user', 'content' => $prompt]
    ],
]);

$ch = curl_init(CLAUDE_API_BASE);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => $payload,
    CURLOPT_TIMEOUT        => 20,
    CURLOPT_HTTPHEADER     => [
        'Content-Type: application/json',
        'x-api-key: ' . CLAUDE_API_KEY,
        'anthropic-version: 2023-06-01',
    ],
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlErr  = curl_error($ch);
curl_close($ch);

if ($curlErr) {
    http_response_code(502);
    echo json_encode(['success' => false, 'message' => 'Network error: ' . $curlErr]);
    exit;
}

if ($httpCode !== 200) {
    $err = json_decode($response, true);
    $errType = $err['error']['type']    ?? '';
    $errMsg  = $err['error']['message'] ?? ($err['error'] ?? "HTTP $httpCode");
    if (is_array($errMsg)) $errMsg = json_encode($errMsg);
    $fullMsg = $errType ? "[$errType] $errMsg" : $errMsg;
    http_response_code(502);
    echo json_encode([
        'success'   => false,
        'message'   => $fullMsg,
        'http_code' => $httpCode,
        'raw_error' => $response,
    ]);
    exit;
}

$data    = json_decode($response, true);
$content = $data['content'][0]['text'] ?? '';

/* ── Parse Claude's JSON response ── */
$analysis = json_decode($content, true);
if (!$analysis || !isset($analysis['verdict'])) {
    /* Try to extract JSON from any surrounding text */
    if (preg_match('/\{[\s\S]+\}/m', $content, $m)) {
        $analysis = json_decode($m[0], true);
    }
}

if (!$analysis) {
    echo json_encode([
        'success'  => false,
        'message'  => 'Could not parse AI response.',
        'raw'      => $content,
    ]);
    exit;
}

echo json_encode([
    'success'      => true,
    'verdict'      => $analysis['verdict']      ?? 'MONITOR',
    'summary'      => $analysis['summary']      ?? '',
    'factors'      => $analysis['factors']      ?? [],
    'stake_advice' => $analysis['stake_advice'] ?? '',
    'risk_level'   => $analysis['risk_level']   ?? 'Medium',
    'model'        => CLAUDE_MODEL,
    'usage'        => $data['usage'] ?? [],
]);
