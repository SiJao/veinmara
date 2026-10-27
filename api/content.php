<?php
/*
 * GET  api/content.php            → isi web yang tersimpan + daftar foto (publik)
 * POST api/content.php {content}  → simpan isi web (khusus admin, butuh X-CSRF)
 */
define('VEINMARA_API', 1);
require __DIR__ . '/_lib.php';

$m = method('GET', 'POST');

if ($m === 'GET') {
    $row = db()->query("SELECT isi, diubah FROM vm_konten WHERE kunci = 'content'")->fetch();
    $fotos = [];
    foreach (glob(photo_dir() . '/*.jpg') ?: [] as $f) {
        $id = basename($f, '.jpg');
        if (valid_photo_id($id)) $fotos[$id] = 'uploads/foto/' . $id . '.jpg?v=' . filemtime($f);
    }
    respond([
        'ok' => true,
        'content' => $row ? json_decode($row['isi'], true) : null,
        'updatedAt' => $row['diubah'] ?? null,
        'fotos' => (object)$fotos,
    ]);
}

require_admin();
$in = body();
$content = $in['content'] ?? null;
if (!is_array($content)) fail(400, 'Isi tidak valid.');

// Hanya bagian yang memang boleh diedit yang disimpan
$clean = [];
foreach (EDITABLE_KEYS as $k) {
    if (!array_key_exists($k, $content)) fail(400, "Bagian '$k' tidak ada.");
    $clean[$k] = $content[$k];
}
if (!is_array($clean['pemimpin']) || !is_array($clean['momen']) || !is_array($clean['halaman']) || !is_array($clean['peresmian'])) {
    fail(400, 'Struktur isi tidak valid.');
}
if (strtotime((string)($clean['peresmian']['waktu'] ?? '')) === false) fail(400, 'Waktu peresmian tidak valid.');

$json = json_encode($clean, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
if ($json === false || strlen($json) > MAX_CONTENT_BYTES) fail(413, 'Isi terlalu besar.');

$now = gmdate('c');
// REPLACE INTO berlaku di MySQL/MariaDB maupun SQLite
db()->prepare("REPLACE INTO vm_konten (kunci, isi, diubah) VALUES ('content', ?, ?)")->execute([$json, $now]);
respond(['ok' => true, 'updatedAt' => $now]);
