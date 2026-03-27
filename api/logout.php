<?php
/* ============================================================
   OddsOracle — Logout
   ============================================================ */

session_start();
session_unset();
session_destroy();

/* Redirect back to homepage */
header('Location: ../index.html');
exit;
