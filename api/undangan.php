<?php
/*
 * Halaman undangan (untuk tamu).
 * GET  api/undangan.php                              → pengaturan login + data tamu kalau sudah masuk
 * POST api/undangan.php {action:"masuk", credential} → periksa login Google & cek daftar undangan
 * POST api/undangan.php {action:"keluar"}
 * POST butuh header X-CSRF (token dari GET). Daftar undangan tidak pernah dikirim ke browser —
 * hanya data milik tamu yang sedang masuk.
 */
define('VEINMARA_API', 1);
require __DIR__ . '/_lib.php';
require __DIR__ . '/_google.php';

$m = method('GET', 'POST');
start_session();
$cfg = config();
$clientId = (string)($cfg['google_client_id'] ?? '');
$domain = strtolower((string)($cfg['undangan_domain'] ?? 'daarululuumlido.com'));

function cari_tamu(string $email): ?array {
    $q = db()->prepare('SELECT email, nama, keterangan, dibuka FROM vm_undangan WHERE email = ?');
    $q->execute([$email]);
    return $q->fetch() ?: null;
}
function data_tamu(array $t): array { return ['email' => $t['email'], 'nama' => $t['nama'], 'keterangan' => $t['keterangan']]; }

if ($m === 'GET') {
    $tamu = null;
    if (!empty($_SESSION['tamu'])) {
        $tamu = cari_tamu($_SESSION['tamu']);
        if (!$tamu) unset($_SESSION['tamu']); // sudah dihapus dari daftar
    }
    respond(['ok' => true, 'clientId' => $clientId, 'domain' => $domain, 'csrf' => $_SESSION['csrf'], 'tamu' => $tamu ? data_tamu($tamu) : null]);
}

$sent = $_SERVER['HTTP_X_CSRF'] ?? '';
if (!is_string($sent) || !hash_equals($_SESSION['csrf'], $sent)) fail(403, 'Token keamanan tidak cocok. Muat ulang halaman.');
$in = body();
$action = $in['action'] ?? '';

if ($action === 'keluar') {
    unset($_SESSION['tamu']);
    respond(['ok' => true]);
}
if ($action !== 'masuk') fail(400, 'Aksi tidak dikenal.');
if ($clientId === '') fail(503, 'Login undangan belum diatur oleh admin.');

$claims = verify_google_token($in['credential'] ?? '', $clientId, $domain);
$tamu = cari_tamu($claims['email']);
if (!$tamu) fail(403, 'Email ' . $claims['email'] . ' tidak ada dalam daftar undangan.');

// catat kapan undangan pertama kali dibuka
if ($tamu['dibuka'] === '') db()->prepare('UPDATE vm_undangan SET dibuka = ? WHERE email = ?')->execute([gmdate('c'), $tamu['email']]);
session_regenerate_id(true);
$_SESSION['tamu'] = $tamu['email'];
respond(['ok' => true, 'tamu' => data_tamu($tamu)]);
