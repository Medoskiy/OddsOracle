<?php
/* ============================================================
   OddsOracle — Logout
   ============================================================ */

session_start();
session_unset();
session_destroy();

/* Clear auth cookie */
if (ini_get('session.use_cookies')) {
    $p = session_get_cookie_params();
    setcookie(session_name(), '', time() - 42000, $p['path'], $p['domain'], $p['secure'], $p['httponly']);
}

/* Redirect to homepage with cache-clear flag so JS clears sessionStorage */
header('Location: ../index.html?logout=1');
exit;
