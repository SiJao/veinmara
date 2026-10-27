<?php
/*
 * GET  api/auth.php                       → status login + token CSRF
 * POST api/auth.php {action:"login", password}
 * POST api/auth.php {action:"logout"}     (butuh header X-CSRF)
 */
define('VEINMARA_API', 1);
require __DIR__ . '/_lib.php';

$m = method('GET', 'POST');
start_session();

if ($m === 'GET') {
    respond(['ok' => true, 'loggedIn' => is_admin(), 'csrf' => $_SESSION['csrf']]);
}

$in = body();
$action = $in['action'] ?? '';

if ($action === 'logout') {
    require_admin();
    $_SESSION = [];
    session_regenerate_id(true);
    respond(['ok' => true]);
}

if ($action !== 'login') fail(400, 'Aksi tidak dikenal.');

// Batasi percobaan salah per IP
$pdo = db();
$ip = client_ip();
$since = time() - LOGIN_WINDOW;
$pdo->prepare('DELETE FROM vm_login_gagal WHERE waktu < ?')->execute([$since]);
$q = $pdo->prepare('SELECT COUNT(*) FROM vm_login_gagal WHERE ip = ? AND waktu >= ?');
$q->execute([$ip, $since]);
if ((int)$q->fetchColumn() >= LOGIN_MAX_FAIL) {
    fail(429, 'Terlalu banyak percobaan salah. Coba lagi 15 menit lagi.');
}

$password = $in['password'] ?? '';
if (!is_string($password) || $password === '' || !check_password($password)) {
    $pdo->prepare('INSERT INTO vm_login_gagal (ip, waktu) VALUES (?, ?)')->execute([$ip, time()]);
    usleep(400000); // perlambat tebak-tebakan
    fail(401, 'Kata sandi salah.');
}

session_regenerate_id(true);
$_SESSION['admin'] = true;
$_SESSION['seen'] = time();
$_SESSION['csrf'] = bin2hex(random_bytes(32));
$pdo->prepare('DELETE FROM vm_login_gagal WHERE ip = ?')->execute([$ip]);
respond(['ok' => true, 'loggedIn' => true, 'csrf' => $_SESSION['csrf']]);
