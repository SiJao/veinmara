<?php
/*
 * Daftar undangan (khusus admin).
 * GET  api/tamu.php                                       → semua tamu + status pengaturan login Google
 * GET  api/tamu.php?cek=1                                 → uji koneksi hosting ke Google
 * POST api/tamu.php {action:"simpan", daftar:[{email,nama,keterangan}]} → tambah/ubah (juga untuk impor CSV)
 * POST api/tamu.php {action:"hapus", emails:[...]}
 * POST butuh X-CSRF.
 */
define('VEINMARA_API', 1);
require __DIR__ . '/_lib.php';
require __DIR__ . '/_google.php';

$m = method('GET', 'POST');
$cfg = config();
$domain = strtolower((string)($cfg['undangan_domain'] ?? 'daarululuumlido.com'));
const MAX_TAMU = 3000;

if ($m === 'GET') {
    if (!is_admin()) fail(401, 'Silakan masuk dulu.');
    if (!empty($_GET['cek'])) {
        $hasil = ['openssl' => function_exists('openssl_verify'), 'koneksi' => false, 'clientId' => !empty($cfg['google_client_id'])];
        $raw = http_get(certs_url());
        $hasil['koneksi'] = $raw !== null && !empty(json_decode($raw, true)['keys']);
        respond(['ok' => true, 'cek' => $hasil]);
    }
    $list = db()->query('SELECT email, nama, keterangan, dibuka FROM vm_undangan ORDER BY nama')->fetchAll();
    respond(['ok' => true, 'domain' => $domain, 'clientId' => (string)($cfg['google_client_id'] ?? ''), 'daftar' => $list]);
}

require_admin();
$in = body();
$action = $in['action'] ?? '';

if ($action === 'hapus') {
    $emails = $in['emails'] ?? [];
    if (!is_array($emails)) fail(400, 'Data tidak valid.');
    $q = db()->prepare('DELETE FROM vm_undangan WHERE email = ?');
    foreach ($emails as $e) if (is_string($e)) $q->execute([strtolower(trim($e))]);
    respond(['ok' => true]);
}

if ($action !== 'simpan') fail(400, 'Aksi tidak dikenal.');
$daftar = $in['daftar'] ?? null;
if (!is_array($daftar) || count($daftar) > MAX_TAMU) fail(400, 'Daftar tidak valid (maks ' . MAX_TAMU . ' baris sekali simpan).');

$pdo = db();
$total = (int)$pdo->query('SELECT COUNT(*) FROM vm_undangan')->fetchColumn();
$cek = $pdo->prepare('SELECT dibuka FROM vm_undangan WHERE email = ?');
$put = $pdo->prepare('REPLACE INTO vm_undangan (email, nama, keterangan, dibuka, diubah) VALUES (?, ?, ?, ?, ?)');
$now = gmdate('c');
$ditolak = [];
$n = 0;
$pdo->beginTransaction();
foreach ($daftar as $i => $t) {
    $email = strtolower(trim((string)($t['email'] ?? '')));
    $nama = trim((string)($t['nama'] ?? ''));
    $ket = trim((string)($t['keterangan'] ?? ''));
    $baris = $i + 1;
    if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 190 || substr($email, -strlen('@' . $domain)) !== '@' . $domain) {
        $ditolak[] = ($email !== "" ? $email : "Baris $baris") . ": email harus @$domain"; continue;
    }
    $len = function ($s) { return function_exists('mb_strlen') ? mb_strlen($s, 'UTF-8') : strlen($s); };
    if ($nama === "" || $len($nama) > 120 || $len($ket) > 120) { $ditolak[] = "$email: nama kosong atau terlalu panjang (maks 120 huruf)"; continue; }
    $cek->execute([$email]);
    $lama = $cek->fetch();
    if (!$lama && ++$total > MAX_TAMU) { $ditolak[] = "$email: daftar sudah penuh (" . MAX_TAMU . ')'; continue; }
    // status "sudah dibuka" tetap dipertahankan saat data diubah
    $put->execute([$email, $nama, $ket, $lama ? $lama['dibuka'] : '', $now]);
    $n++;
}
$pdo->commit();
respond(['ok' => true, 'disimpan' => $n, 'ditolak' => $ditolak]);
