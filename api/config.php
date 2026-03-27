<?php
/* ============================================================
   OddsOracle — API Configuration
   ============================================================
   1. Sign up FREE at https://the-odds-api.com
   2. Copy your API key and paste it below
   3. Upload this file to your Hostinger public_html/api/ folder
   ============================================================ */

define('ODDS_API_KEY', 'YOUR_API_KEY_HERE');
define('ODDS_API_BASE', 'https://api.the-odds-api.com/v4');

/* Cache settings — reduces API calls (saves your free quota) */
define('CACHE_DIR',      __DIR__ . '/cache');
define('CACHE_DURATION', 300); /* seconds — refresh every 5 minutes */
