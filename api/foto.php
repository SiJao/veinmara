<?php
/*
 * POST api/foto.php {id, data:"data:image/jpeg;base64,..."}  → simpan foto
 * POST api/foto.php {id, hapus:true}                           → hapus foto
 * Khusus admin (butuh X-CSRF). Foto disimpan sebagai uploads/foto/<id>.jpg
 */
define('VEINMARA_API', 1);
require __DIR__ . '/_lib.php';

method('POST');
require_admin();
$in = body();

$id = $in['id'] ?? '';
if (!valid_photo_id($id)) fail(400, 'ID foto tidak valid.');

$dir = photo_dir();
if (!is_dir($dir) && !mkdir($dir, 0755, true)) fail(500, 'Folder foto tidak bisa dibuat.');
$file = $dir . '/' . $id . '.jpg';

if (!empty($in['hapus'])) {
    if (is_file($file)) unlink($file);
    respond(['ok' => true]);
}

$data = $in['data'] ?? '';
$prefix = 'data:image/jpeg;base64,';
if (!is_string($data) || strpos($data, $prefix) !== 0) fail(400, 'Foto harus JPEG.');
$bin = base64_decode(substr($data, strlen($prefix)), true);
if ($bin === false || strlen($bin) > MAX_PHOTO_BYTES) fail(413, 'Foto terlalu besar atau rusak.');

// Pastikan benar-benar gambar JPEG yang wajar (bukan file lain yang diberi nama .jpg)
$info = @getimagesizefromstring($bin);
if (!$info || $info[2] !== IMAGETYPE_JPEG || $info[0] > 2000 || $info[1] > 2000) fail(400, 'File bukan foto JPEG yang valid.');

$tmp = $file . '.tmp';
if (file_put_contents($tmp, $bin, LOCK_EX) === false || !rename($tmp, $file)) fail(500, 'Foto gagal disimpan.');
respond(['ok' => true, 'url' => 'uploads/foto/' . $id . '.jpg?v=' . filemtime($file)]);
